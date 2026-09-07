"""Generated art -> rembg cutouts -> registered, authored gameplay atlas.

Requires Pillow and rembg[cpu]. Source sheets retain the unedited generations.
Generated contacts are explicitly selected, not blindly played row-by-row.
This builds the base hero atlas; pack-boss.py builds its support poses and boss.
"""
import os
os.environ.setdefault('OMP_NUM_THREADS', '2')
from pathlib import Path
from PIL import Image
from rembg import remove, new_session
import json
import sys

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path('/tmp/emberfall-generated-cutouts-birefnet')
CACHE.mkdir(exist_ok=True)
session = new_session('birefnet-general-lite')

def sheet(name, rows, scale, anchors):
    source = Image.open(ROOT / 'art/source' / f'scarlet-{name}.png').convert('RGBA')
    width, height = source.size
    result = []
    for i in range(rows*4):
        left, right = round(i%4*width/4), round((i%4+1)*width/4)
        top, bottom = round(i//4*height/rows), round((i//4+1)*height/rows)
        # The generated apex blade crosses the next cell; exclude that neighbor
        # from the fall frame before segmentation (the fall cape starts later).
        if name == 'movement' and i == 5: left += round(width*.04)
        if name == 'actions':
            boundaries = [0, round(height*.25), round(height*.478), round(height*.75), height]
            top, bottom = boundaries[i//4], boundaries[i//4+1]
        path = CACHE / f'{name}-{i}.png'
        if path.exists(): cutout = Image.open(path).convert('RGBA')
        else:
            # High-resolution BiRefNet preserves the sword/cloth negative space.
            # Its mask is sufficient; a sparse matting solve can stall on blades.
            cutout = remove(source.crop((left,top,right,bottom)), session=session)
            cutout.save(path)
            print(f'Cut out {name}-{i}', flush=True)
        # Make rembg's soft matte crisp at the final source pixel resolution.
        cutout.putalpha(cutout.getchannel('A').point(lambda a: 255 if a > 128 else 0))
        box = cutout.getbbox()
        if not box: raise ValueError(f'Empty foreground: {name}-{i}')
        cropped = cutout.crop(box)
        cropped = cropped.resize((max(1,round(cropped.width*scale)), max(1,round(cropped.height*scale))),Image.Resampling.NEAREST)
        frame = Image.new('RGBA',(128,128))
        anchor = (right-left)*anchors[i]
        dx = round(64+(box[0]-anchor)*scale)
        dy = 108-cropped.height
        if name == 'movement' and i in (3,4,5): dy -= 7
        if name == 'run' and i in (3,7): dy -= 3
        frame.paste(cropped,(dx,dy),cropped)
        result.append(frame)
    return result

run = sheet('run',2,.18,[.62,.62,.62,.62,.62,.62,.62,.62])
actions = sheet('actions',4,.30,[.49,.47,.42,.49,.50,.50,.45,.50,.50,.43,.43,.52,.50,.43,.42,.50])
movement = sheet('movement',2,.235,[.49,.47,.50,.50,.50,.405,.50,.50])
manifest=json.loads((ROOT/'src/game/characters.json').read_text())
atlas=Image.new('RGBA',(1536,1792))
for clip, meta in manifest['clips'].items():
    for index in range(meta['count']):
        t=index/max(1,meta['count']-1)
        if clip=='run': frame=run[min(7,index*8//meta['count'])]
        elif clip=='idle': frame=movement[0 if t<.5 else 1]
        elif clip=='takeoff': frame=movement[2 if t<.5 else 3]
        elif clip in ('rise','apex','fall'): frame=movement[{'rise':3,'apex':4,'fall':5}[clip]]
        elif clip=='land': frame=movement[6 if t<.35 else 2 if t<.7 else 0]
        elif clip=='hurt': frame=movement[7]
        elif clip=='death': frame=actions[14]
        elif clip=='roll': frame=actions[12+min(3,int(t*4))]
        else:
            n=int(clip[-1]); offset=(n-1)*4
            if n==1: local=0 if t<.07 or t>=.8 else 1 if t<.245 else 2 if t<.39 else 3
            else: local=0 if t<.245 else 1 if t<.39 else 2 if t<.75 else 3
            frame=actions[offset+local]
        absolute=meta['start']+index
        atlas.paste(frame,((absolute%12)*128,(absolute//12)*128))
atlas.save(ROOT/'public/characters/hero.png',optimize=True)
print('Generated hero packed: 32 authored source poses, 162 timing slots')
if '--preview' in sys.argv:
    preview=Image.new('RGBA',(1024,512),'#30333d')
    for i,frame in enumerate(run+actions+movement):
        preview.alpha_composite(frame,((i%8)*128,(i//8)*128))
    preview.resize((2048,1024),Image.Resampling.NEAREST).save(sys.argv[sys.argv.index('--preview')+1])
