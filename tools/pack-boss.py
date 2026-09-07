"""Painter sheets -> rembg cutouts -> registered gameplay atlases.
Run with the same Pillow + rembg[cpu] Python environment as pack-generated.py.
No model is used at runtime. Cache intermediates outside the project.
"""
import os
os.environ.setdefault('OMP_NUM_THREADS', '2')
import subprocess
import sys
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parent.parent
CACHE=Path('/tmp/emberfall-boss-cutouts'); CACHE.mkdir(exist_ok=True)

def frames(name, rows, size, origin, scale, anchor=.5):
    source=Image.open(ROOT/'art/source'/f'{name}.png').convert('RGBA')
    w,h=source.size; result=[]
    for i in range(rows*4):
        x0,x1=round(i%4*w/4),round((i%4+1)*w/4)
        center=x0+(x1-x0)*anchor
        y0,y1=round(i//4*h/rows),round((i//4+1)*h/rows)
        if name=='boss-combat' and i//4 in (1,2):
            # The horizontal blades cross the nominal column boundary.
            bounds=[0,.28,.448,.745,1] if i//4==1 else [0,.25,.455,.75,1]
            x0,x1=[round(w*v) for v in bounds[i%4:i%4+2]]
        if name=='boss-ending': y0,y1=([0,round(h*.60),h][i//4:i//4+2])
        suffix='-wide' if name=='boss-combat' and i//4 in (1,2) else ''
        cache=CACHE/f'{name}-{i}{suffix}.png'
        if cache.exists(): cut=Image.open(cache).convert('RGBA')
        else:
            # Release the inference arena after each frame; a long-lived session
            # can retain gigabytes while processing these full-resolution sheets.
            raw=CACHE/f'{name}-{i}-input.png'
            source.crop((x0,y0,x1,y1)).save(raw)
            subprocess.run([sys.executable, '-c',
                'import sys; from PIL import Image; from rembg import remove,new_session; '
                'remove(Image.open(sys.argv[1]),session=new_session("birefnet-general-lite")).save(sys.argv[2])',
                str(raw),str(cache)],check=True)
            raw.unlink()
            cut=Image.open(cache).convert('RGBA')
            print(f'Cut out {name}-{i}',flush=True)
        cut.putalpha(cut.getchannel('A').point(lambda a:255 if a>128 else 0))
        # Despill saturated magenta at the matte edge; preserve the model's alpha.
        cut.putdata([(min(r,g+18),g,min(b,g+18),a) if r>g*2+25 and b>g*2+25 else (r,g,b,a)
                     for r,g,b,a in cut.getdata()])
        bbox=cut.getbbox()
        if not bbox: raise ValueError(f'Empty {cache}')
        cropped=cut.crop(bbox)
        cropped=cropped.resize((round(cropped.width*scale),round(cropped.height*scale)),Image.Resampling.NEAREST)
        frame=Image.new('RGBA',(size,size))
        dx=round(size/2+(x0+bbox[0]-center)*scale)
        frame.alpha_composite(cropped,(dx,origin-cropped.height))
        result.append(frame)
    return result

def pack(frames,name,size,columns):
    atlas=Image.new('RGBA',(size*columns,size*((len(frames)+columns-1)//columns)))
    for i,frame in enumerate(frames): atlas.paste(frame,((i%columns)*size,(i//columns)*size))
    atlas.save(ROOT/'public/characters'/f'{name}.png',optimize=True)
    print(f'Packed {name}: {len(frames)} poses',flush=True)

hero=frames('scarlet-support',4,128,108,.30)
pack(hero,'hero-support',128,4)
boss=frames('boss-combat',4,256,230,.48,.58)+frames('boss-ending',2,256,230,.345,.59)
pack(boss,'boss',256,6)
