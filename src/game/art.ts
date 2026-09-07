type Platform = { x: number; y: number; w: number };

// One art-direction grade for the existing hand-built scenery: cold ash stone,
// burgundy foliage and sparse warm light, matching the scarlet pilgrim sheet.
const palette = new Map<string, string>();
function ashPalette(color: string) {
  if (["#ed3545", "#ffc58d", "#731f34"].includes(color)) return color;
  const cached = palette.get(color);
  if (cached) return cached;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const l = r * 0.22 + g * 0.65 + b * 0.13;
  const channels =
    r > g * 1.18
      ? [r * 0.72, g * 0.35, b * 0.78]
      : [l * 0.7, l * 0.76, l * 0.86];
  const result =
    "#" +
    channels.map((n) => Math.round(n).toString(16).padStart(2, "0")).join("");
  palette.set(color, result);
  return result;
}

const rect = (
  g: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  w: number,
  h: number,
) => {
  g.fillStyle = ashPalette(color);
  g.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
};

function rng(seed: number) {
  let n = seed >>> 0;
  return () => {
    n += 0x6d2b79f5;
    let t = n;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function steppedDisc(
  g: CanvasRenderingContext2D,
  color: string,
  cx: number,
  cy: number,
  rows: number[],
) {
  for (let i = 0; i < rows.length; i++)
    rect(g, color, cx - rows[i], cy + i * 4 - rows.length * 2, rows[i] * 2, 4);
}

function arch(
  g: CanvasRenderingContext2D,
  x: number,
  base: number,
  w: number,
  h: number,
  stone: string,
  dark: string,
) {
  rect(g, stone, x, base - h, w, h);
  // A pointed gothic arch with stepped voussoirs and recessed pillars.
  for (let yy = 18; yy < h; yy += 3) {
    const opening = Math.min(w / 2 - 18, yy * 0.64);
    rect(g, dark, x + w / 2 - opening, base - h + yy, opening * 2, 3);
    if (yy < w / 1.28 - 28) {
      rect(g, "#729084", x + w / 2 - opening - 5, base - h + yy, 3, 3);
      rect(g, "#486963", x + w / 2 + opening + 2, base - h + yy, 3, 3);
    }
  }
  rect(g, "#4e6f65", x + 11, base - h + w * 0.65, 3, h - w * 0.65);
  rect(g, "#203d3e", x + w - 16, base - h + w * 0.65, 6, h - w * 0.65);
  for (let side = 0; side < 2; side++) {
    const xx = x + side * (w - 20);
    rect(g, "#192f32", xx, base - 15, 20, 15);
    rect(g, "#718473", xx - 3, base - 18, 25, 4);
    rect(g, "#657f71", xx - 2, base - h + w * 0.65, 23, 4);
  }
  for (let y = base - h + 12; y < base; y += 18) {
    rect(g, "#446463", x + ((y / 18) & 1 ? 4 : 0), y, 9, 2);
    rect(g, "#263f42", x + w - 13, y + 6, 10, 2);
  }
  rect(g, "#759084", x, base - h + 17, 4, h - 17);
  rect(g, "#182d31", x + w - 5, base - h + 23, 5, h - 23);
}

function lancet(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  glow = false,
) {
  rect(g, "#172e32", x, y + 10, w, h - 10);
  rect(g, "#172e32", x + 4, y + 5, w - 8, 8);
  rect(g, glow ? "#b7b27c" : "#315459", x + 5, y + 12, w - 10, h - 17);
  rect(g, "#162b2f", x + Math.floor(w / 2) - 1, y + 10, 3, h - 10);
  for (let yy = y + 18; yy < y + h; yy += 12)
    rect(g, "#162b2f", x + 3, yy, w - 6, 2);
}

function foliage(
  g: CanvasRenderingContext2D,
  random: () => number,
  x: number,
  y: number,
  scale = 1,
) {
  const colors = ["#733c2b", "#985032", "#b36035", "#cb7440", "#66332c"];
  for (let i = 0; i < 145; i++) {
    const angle = random() * Math.PI * 2,
      radius = Math.sqrt(random());
    const dx = Math.cos(angle) * radius * 61 * scale;
    const dy = Math.sin(angle) * radius * 35 * scale;
    const size = (2 + Math.floor(random() * 3) * 2) * scale;
    rect(
      g,
      colors[Math.floor(random() * colors.length)],
      x + dx,
      y + dy,
      size + 5,
      size,
    );
    if (random() > 0.7) rect(g, "#d58a4c", x + dx + 3, y + dy, 3, 2);
  }
}

function masonry(
  g: CanvasRenderingContext2D,
  random: () => number,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  for (let yy = y + 8; yy < y + h; yy += 11) {
    const offset = ((yy / 11) & 1) * 9;
    for (let xx = x + offset; xx < x + w - 5; xx += 22) {
      if (random() < 0.68)
        rect(
          g,
          random() < 0.18 ? "#54706a" : "#324e4e",
          xx,
          yy,
          13 + Math.floor(random() * 7),
          2,
        );
    }
  }
  for (let i = 0; i < (w * h) / 700; i++)
    rect(g, "#6e7f6d", x + random() * w, y + random() * h, 2 + random() * 4, 2);
}

export function createBackdrop(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = 432;
  const g = canvas.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  const sky = [
    "#102d35",
    "#12343c",
    "#163d44",
    "#1c474c",
    "#245359",
    "#2c5d61",
    "#38696a",
    "#467574",
  ];
  for (let y = 0; y < 432; y += 4)
    rect(g, sky[Math.min(sky.length - 1, Math.floor(y / 54))], 0, y, 1000, 4);
  // An ember eclipse: restrained blood-red disc and a broken ivory-hot rim.
  steppedDisc(
    g,
    "#731f34",
    600,
    91,
    Array.from({ length: 28 }, (_, i) =>
      Math.floor(Math.sqrt(56 * 56 - (i * 4 - 54) ** 2)),
    ),
  );
  steppedDisc(
    g,
    "#ffc58d",
    600,
    91,
    Array.from({ length: 22 }, (_, i) =>
      Math.floor(Math.sqrt(44 * 44 - (i * 4 - 42) ** 2)),
    ),
  );
  steppedDisc(
    g,
    "#ed3545",
    600,
    91,
    Array.from({ length: 18 }, (_, i) =>
      Math.floor(Math.sqrt(37 * 37 - (i * 4 - 34) ** 2)),
    ),
  );
  rect(g, "#ed3545", 617, 118, 17, 7);
  rect(g, "#ffc58d", 626, 119, 4, 4);
  const stars = rng(78);
  for (let i = 0; i < 200; i++)
    rect(g, i % 5 ? "#395859" : "#8d9e86", stars() * 1000, stars() * 220, 1, 1);
  for (let i = 0; i < 24; i++) {
    const x = stars() * 1000,
      y = 60 + stars() * 130;
    rect(g, "#24464c", x, y, 35 + stars() * 90, 2);
    rect(g, "#24464c", x + 12, y - 2, 40 + stars() * 40, 2);
  }
  // Far monastery: deliberately pale and low contrast behind the title.
  rect(g, "#31585b", 310, 179, 408, 119);
  rect(g, "#385f61", 350, 136, 62, 162);
  rect(g, "#385f61", 626, 151, 55, 147);
  rect(g, "#31585b", 365, 113, 30, 30);
  rect(g, "#31585b", 645, 125, 20, 30);
  for (let i = 0; i < 20; i++) {
    rect(g, "#385f61", 380 - i, 72 + i * 3, i * 2, 3);
    rect(g, "#385f61", 652 - i * 0.8, 90 + i * 3, i * 1.6, 3);
  }
  rect(g, "#658078", 379, 63, 2, 18);
  rect(g, "#658078", 375, 68, 10, 2);
  lancet(g, 363, 148, 24, 51);
  lancet(g, 639, 164, 23, 44);
  for (let i = 0; i < 5; i++) lancet(g, 337 + i * 75, 196, 20, 65);
  arch(g, 485, 298, 72, 112, "#3b6261", "#24494d");
  rect(g, "#62807b", 291, 175, 445, 5);
  // Mountain and pine silhouettes use stepped blocks rather than smoothed paths.
  const random = rng(1204);
  for (let x = 0; x < 1000; x += 8) {
    const ridge =
      238 +
      Math.floor(((Math.sin(x * 0.019) + Math.sin(x * 0.047)) * 18) / 4) * 4;
    rect(g, "#24494e", x, ridge, 8, 354 - ridge);
  }
  for (let x = 6; x < 1000; x += 24 + Math.floor(random() * 20)) {
    const top = 236 + Math.floor(random() * 56);
    rect(g, "#173a40", x, top, 4, 432 - top);
    for (let y = top + 8; y < Math.min(350, top + 74); y += 8)
      rect(g, "#173a40", x - (y - top) / 5, y, 8 + (y - top) / 2.5, 5);
  }
  for (let y = 307; y < 355; y += 8)
    rect(g, y < 331 ? "#557675" : "#466b6b", 0, y, 1000, 4);
  rect(g, "#16373a", 0, 354, 1000, 78);
  return canvas;
}

export function createWorld(
  seed: number,
  platforms: Platform[],
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1920;
  canvas.height = 432;
  const g = canvas.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  const random = rng(seed);

  // Mid-near ruined monastery, framing the opening 768px on both sides.
  rect(g, "#243f40", 8, 178, 138, 176);
  masonry(g, random, 8, 178, 138, 176);
  rect(g, "#1b3437", 21, 137, 27, 217);
  rect(g, "#60766a", 18, 134, 34, 8);
  lancet(g, 70, 211, 38, 81, true);
  arch(g, 248, 354, 126, 210, "#355453", "#152e32");
  rect(g, "#263f40", 368, 238, 54, 116);
  rect(g, "#6a7765", 363, 232, 64, 8);
  arch(g, 650, 354, 150, 245, "#304c4d", "#142c30");
  rect(g, "#233e40", 790, 198, 74, 156);
  lancet(g, 810, 222, 27, 65);
  // Repeating but varied ruins across the traversable world.
  for (let x = 910; x < 1750; x += 250) {
    const height = 116 + Math.floor(random() * 70);
    rect(g, "#243f40", x, 354 - height, 46, height);
    rect(g, "#6a7768", x - 5, 354 - height, 56, 7);
    masonry(g, random, x, 354 - height, 46, height);
    if (x < 1600)
      arch(
        g,
        x + 70,
        354,
        105,
        135 + Math.floor(random() * 50),
        "#2b4849",
        "#142d31",
      );
  }
  // Gnarled rust-orange trees woven into the masonry.
  const trees = [
    [178, 224, 1],
    [470, 198, 1.18],
    [875, 238, 0.86],
    [1320, 219, 1.05],
  ] as const;
  for (const [x, y, s] of trees) {
    rect(g, "#442f2b", x - 7 * s, y, 13 * s, 354 - y);
    rect(g, "#51342d", x - 22 * s, y + 20, 19 * s, 7 * s);
    rect(g, "#51342d", x, y + 8, 28 * s, 7 * s);
    rect(g, "#67402f", x - 2, y, 5, 120 * s);
    for (let i = 0; i < 48; i++) {
      rect(g, "#51372e", x - i * 0.8, y + 30 - i, 5, 4);
      rect(g, "#67402f", x + i * 0.75, y + 36 - i * 0.8, 4, 4);
    }
    foliage(g, random, x - 15, y + 5, s);
  }
  // Frayed ceremonial banners and carved lintels give the ruins a human history.
  for (const x of [38, 691, 978, 1512]) {
    rect(g, "#a7a27a", x - 7, 147, 41, 3);
    rect(g, "#824e3b", x, 150, 25, 66);
    rect(g, "#a96743", x + 3, 152, 2, 60);
    rect(g, "#603c34", x + 22, 151, 3, 70);
    for (let i = 0; i < 9; i++)
      rect(
        g,
        "#d2a46a",
        x + 12 - Math.abs(4 - i),
        166 + i * 2,
        2 + Math.abs(4 - i),
        2,
      );
    rect(g, "#d2a46a", x + 10, 174, 3, 19);
    for (let i = 0; i < 5; i++)
      rect(g, "#824e3b", x + i * 5, 213, 3, 4 + random() * 10);
  }
  // Fine hanging vines do not imply collision.
  for (const [x, y, len] of [
    [132, 176, 62],
    [368, 151, 80],
    [661, 133, 55],
    [1110, 190, 69],
  ]) {
    for (let yy = 0; yy < len; yy += 7)
      rect(
        g,
        yy % 14 ? "#60734d" : "#758252",
        x + (yy % 21 === 0 ? 2 : 0),
        y + yy,
        3,
        8,
      );
  }

  // Platforms: only their bright stone/moss caps read as a surface, with dark supports below.
  for (const p of platforms) {
    const x = Math.floor(p.x),
      y = Math.floor(p.y),
      w = Math.floor(p.w);
    rect(g, "#142c2e", x + 4, y + 6, w - 8, Math.min(18, 354 - y - 6));
    rect(g, "#829071", x, y, w, 3);
    rect(g, "#b0a77e", x + 4, y, Math.max(3, Math.floor(w * 0.24)), 2);
    for (let xx = x + 9; xx < x + w - 6; xx += 19)
      rect(
        g,
        random() > 0.45 ? "#536750" : "#6f7e59",
        xx,
        y + 3,
        10 + Math.floor(random() * 8),
        3,
      );
    rect(g, "#294344", x + 3, y + 7, w - 6, 3);
  }

  // The sole continuous collision ground begins at exactly y=354.
  rect(g, "#879171", 0, 354, 1920, 4);
  for (let x = 0; x < 1920; x += 16) {
    rect(
      g,
      random() > 0.35 ? "#536a56" : "#707c5d",
      x,
      354,
      9 + Math.floor(random() * 11),
      3,
    );
    if (random() > 0.55) rect(g, "#b2a77a", x + 3, 354, 5, 2);
  }
  rect(g, "#1a3334", 0, 358, 1920, 74);
  for (let y = 363; y < 432; y += 12)
    for (let x = y % 24; x < 1920; x += 29)
      rect(
        g,
        random() > 0.2 ? "#294445" : "#38524e",
        x,
        y,
        18 + Math.floor(random() * 10),
        3,
      );
  for (let x = 0; x < 1920; x += 73)
    rect(g, "#102a2d", x + Math.floor(random() * 22), 371, 4, 61);
  // Ground-cover, chipped stone, roots and fallen copper leaves.
  for (let x = 0; x < 1920; x += 5) {
    if (random() > 0.5) {
      const h = 2 + random() * 8;
      rect(g, "#6d8159", x, 354 - h, 1, h);
      rect(g, "#91a16a", x + 2, 350, 2, 4);
    }
    if (random() > 0.68) rect(g, "#ad6b3b", x, 351, 3 + random() * 4, 2);
  }
  for (let i = 0; i < 550; i++)
    rect(
      g,
      random() > 0.6 ? "#3a5650" : "#132d2f",
      random() * 1920,
      363 + random() * 69,
      1 + random() * 3,
      1,
    );

  // Lantern and its restrained blocky light pool.
  for (let i = 4; i > 0; i--)
    rect(
      g,
      `rgba(220,116,48,${0.025 * i})`,
      160 - i * 13,
      344 - i * 3,
      i * 26,
      3 + i * 3,
    );
  rect(g, "#151f20", 152, 337, 16, 17);
  rect(g, "#bc562d", 155, 340, 10, 10);
  rect(g, "#ffd27a", 158, 340, 5, 7);
  rect(g, "#273236", 150, 337, 20, 3);
  rect(g, "#111d20", 154, 351, 12, 3);
  rect(g, "#d47c3e", 157, 336, 7, 2);

  // Exit gate at x=1830: a strong silhouette and ivory/rust focal marks.
  arch(g, 1780, 354, 100, 178, "#395351", "#0c2025");
  rect(g, "#779079", 1774, 174, 112, 8);
  rect(g, "#18282a", 1828, 202, 4, 152);
  for (let y = 221; y < 338; y += 22) rect(g, "#26393a", 1802, y, 57, 3);
  rect(g, "#b75b32", 1818, 260, 26, 4);
  rect(g, "#e4c47a", 1828, 255, 7, 13);
  rect(g, "#617653", 1779, 181, 8, 71);
  rect(g, "#788452", 1783, 211, 11, 4);
  return canvas;
}
