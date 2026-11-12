import * as i from 'three';
import { RoundedBoxGeometry as vs } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  mergeGeometries as Xn,
  mergeVertices as hl,
} from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Procedural 3D Cutaway House Interior & Catalog Furniture Geometry Builders
 * Includes:
 * - Seeded Mulberry32 PRNG (`we`)
 * - RoundedBoxGeometry helper (`We`) & Vertex-Welded Smooth Normal helper (`Ee`)
 * - Box-Projected Triplanar UV Mapper (`ir`) & Material-Grouped Geometry Batcher (`O`)
 * - Organic Deformers: `Je` (Puffed Cushions), `io` (Pinched Throw Pillows), `Ft` (Lathe Ceramics),
 *   `Ro` + `Eo` (Folded/Curled Fiddle, Heart, Paddle & Oval Botanical Leaves),
 *   `lo` (Small Potted Tabletop Plants), `et` (Turned Ceramic Vases), `Io` (Randomized Bookshelf Stacks)
 * - All 23 Original Furniture Builders (`lc`..`Dc`) in `BUDDIES_FURNITURE_BUILDERS` (`je`)
 */

function we(e: number): () => number {
  return () => {
    e |= 0;
    e = (e + 1831565813) | 0;
    let t = Math.imul(e ^ (e >>> 15), 1 | e);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const We = (e: number, t: number, o: number, a = 0.02, n = 2): i.BufferGeometry =>
  new vs(e, t, o, n, Math.min(a, Math.min(e, t, o) / 2.02));

const Ee = (e: i.BufferGeometry): i.BufferGeometry => {
  e.deleteAttribute('uv');
  e.deleteAttribute('normal');
  const merged = hl(e);
  merged.computeVertexNormals();
  return merged;
};

const sr = new i.Matrix4();
const Ha = new i.Quaternion();
const Ts = new i.Euler(0, 0, 0, 'YXZ');
const Ls = new i.Vector3(1, 1, 1);
const Na = new i.Vector3(0, 1, 0);
const Ol = new i.Vector3();
const Rs = new i.Quaternion();
const ae = new i.Vector3();
const ut = new i.Vector3();
const Vs = new i.Vector3();
const Bo = new i.Vector3();
const Po = new i.Vector3();

function ir(e: i.BufferGeometry): i.BufferGeometry {
  const geo = e.index ? e.toNonIndexed() : e;
  const t = geo.attributes.position;
  const o = new Float32Array(t.count * 2);
  const a = new i.Vector3();
  const n = new i.Vector3();
  const r = new i.Vector3();
  const s = new i.Vector3();
  for (let l = 0; l < t.count; l += 3) {
    a.fromBufferAttribute(t, l);
    n.fromBufferAttribute(t, l + 1);
    r.fromBufferAttribute(t, l + 2);
    s.subVectors(r, n).cross(ae.subVectors(a, n));
    const c = Math.abs(s.x);
    const u = Math.abs(s.y);
    const d = Math.abs(s.z);
    for (let p = 0; p < 3; p++) {
      const h = p ? (p === 1 ? n : r) : a;
      let f: number;
      let m: number;
      if (c >= u && c >= d) {
        f = h.z * Math.sign(s.x || 1);
        m = h.y;
      } else if (u >= d) {
        f = h.x;
        m = h.z * Math.sign(s.y || 1);
      } else {
        f = -h.x * Math.sign(s.z || 1);
        m = h.y;
      }
      o[(l + p) * 2] = f;
      o[(l + p) * 2 + 1] = m;
    }
  }
  geo.setAttribute('uv', new i.BufferAttribute(o, 2));
  return geo;
}

interface TintMaterialRef {
  isTint: true;
  base: i.Material;
  col: i.Color;
}

type MaterialOrTint = i.Material | TintMaterialRef;

interface BatchTransformOpts {
  r?: number;
  seg?: number;
  seg2?: number;
  hs?: number;
  open?: boolean;
  rs?: number;
  ts?: number;
  arc?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  dir?: [number, number, number] | number[];
  roll?: number;
  s?: [number, number, number];
  uv?: 'keep' | 'box';
  col?: i.Color;
}

function O() {
  const e = new Map<i.Material, { mat: i.Material; list: i.BufferGeometry[] }>();
  const t = (
    rawMat: MaterialOrTint,
    rawGeo: i.BufferGeometry,
    n: number,
    r: number,
    s: number,
    l: BatchTransformOpts = {},
  ) => {
    let o: i.Material;
    let opts = l;
    if ('isTint' in rawMat && rawMat.isTint) {
      opts = { ...l, col: rawMat.col };
      o = rawMat.base;
    } else {
      o = rawMat as i.Material;
    }
    let a = rawGeo.index ? rawGeo.toNonIndexed() : rawGeo;
    for (const u of Object.keys(a.attributes)) {
      if (!['position', 'normal', 'uv', 'color'].includes(u)) {
        a.deleteAttribute(u);
      }
    }
    if (opts.dir) {
      Ha.setFromUnitVectors(Na, Ol.set(opts.dir[0], opts.dir[1], opts.dir[2]).normalize());
      if (opts.roll) {
        Ha.multiply(Rs.setFromAxisAngle(Na, opts.roll));
      }
    } else {
      Ts.set(opts.rx || 0, opts.ry || 0, opts.rz || 0);
      Ha.setFromEuler(Ts);
    }
    a.applyMatrix4(
      sr.compose(
        ut.set(n, r, s),
        Ha,
        opts.s ? Ls.set(opts.s[0], opts.s[1], opts.s[2]) : Ls.set(1, 1, 1),
      ),
    );
    if (opts.uv !== 'keep' && (opts.uv === 'box' || o.userData?.boxUV)) {
      a = ir(a);
    }
    if (!a.attributes.uv) {
      a.setAttribute(
        'uv',
        new i.Float32BufferAttribute(new Float32Array(a.attributes.position.count * 2), 2),
      );
    }
    const matWithVertexColors = o as i.Material & { vertexColors?: boolean };
    if (!a.attributes.color && matWithVertexColors.vertexColors) {
      const u = a.attributes.position.count;
      const d = new Float32Array(u * 3);
      const p = opts.col;
      for (let h = 0; h < u; h++) {
        d[h * 3] = p ? p.r : 1;
        d[h * 3 + 1] = p ? p.g : 1;
        d[h * 3 + 2] = p ? p.b : 1;
      }
      a.setAttribute('color', new i.BufferAttribute(d, 3));
    }
    if (a.attributes.color && !matWithVertexColors.vertexColors) {
      a.deleteAttribute('color');
    }
    let c = e.get(o);
    if (!c) {
      c = { mat: o, list: [] };
      e.set(o, c);
    }
    c.list.push(a);
  };
  return {
    box(
      o: MaterialOrTint,
      a: number,
      n: number,
      r: number,
      s: number,
      l: number,
      c: number,
      u: BatchTransformOpts = {},
    ) {
      t(o, u.r ? We(s, l, c, u.r, u.seg || 2) : new i.BoxGeometry(s, l, c), a, n, r, u);
      return this;
    },
    cyl(
      o: MaterialOrTint,
      a: number,
      n: number,
      r: number,
      s: number,
      l: number,
      c: number,
      u: BatchTransformOpts = {},
    ) {
      t(
        o,
        new i.CylinderGeometry(s, l, c, u.seg || 20, u.hs || 1, Boolean(u.open)),
        a,
        n,
        r,
        u,
      );
      return this;
    },
    sph(
      o: MaterialOrTint,
      a: number,
      n: number,
      r: number,
      s: number,
      l: BatchTransformOpts = {},
    ) {
      t(o, new i.SphereGeometry(s, l.seg || 16, l.seg2 || 12), a, n, r, l);
      return this;
    },
    tor(
      o: MaterialOrTint,
      a: number,
      n: number,
      r: number,
      s: number,
      l: number,
      c: BatchTransformOpts = {},
    ) {
      t(
        o,
        new i.TorusGeometry(s, l, c.rs || 8, c.ts || 28, c.arc || Math.PI * 2),
        a,
        n,
        r,
        c,
      );
      return this;
    },
    geo(
      o: MaterialOrTint,
      a: i.BufferGeometry,
      n = 0,
      r = 0,
      s = 0,
      l: BatchTransformOpts = {},
    ) {
      t(o, a.clone(), n, r, s, l);
      return this;
    },
    get empty() {
      return !e.size;
    },
    flush(o: i.Object3D, a = true) {
      const n: i.Mesh[] = [];
      for (const { mat: r, list: s } of e.values()) {
        const merged = Xn(s);
        if (merged) {
          const l = new i.Mesh(merged, r);
          l.castShadow = a;
          l.receiveShadow = true;
          o.add(l);
          n.push(l);
        }
        s.forEach((c) => c.dispose());
      }
      e.clear();
      return n;
    },
  };
}

const Ue = new Map<string, i.Material>();
function j(e: string, t: Record<string, unknown> = {}): i.MeshStandardMaterial {
  const o = 'M' + e + JSON.stringify(t);
  if (!Ue.has(o)) {
    Ue.set(o, new i.MeshStandardMaterial({ color: e, roughness: 0.85, envMapIntensity: 0.5, ...t }));
  }
  return Ue.get(o) as i.MeshStandardMaterial;
}

function rr(e: string, t: Record<string, unknown> = {}): i.MeshPhysicalMaterial {
  const o = 'P' + e + JSON.stringify(t);
  if (!Ue.has(o)) {
    Ue.set(
      o,
      new i.MeshPhysicalMaterial({
        color: e,
        roughness: 0.34,
        clearcoat: 1,
        clearcoatRoughness: 0.16,
        envMapIntensity: 1.1,
        ...t,
      }),
    );
  }
  return Ue.get(o) as i.MeshPhysicalMaterial;
}

function no(e: string, t: Record<string, unknown> = {}): i.MeshPhysicalMaterial {
  const o = 'T' + e + JSON.stringify(t);
  if (!Ue.has(o)) {
    Ue.set(
      o,
      new i.MeshPhysicalMaterial({
        color: e,
        metalness: 0.85,
        roughness: 0.32,
        envMapIntensity: 1.25,
        clearcoat: 0.35,
        clearcoatRoughness: 0.3,
        ...t,
      }),
    );
  }
  return Ue.get(o) as i.MeshPhysicalMaterial;
}

const ct = (e: string, t = 1) =>
  new i.MeshBasicMaterial({ color: new i.Color(e).multiplyScalar(t), fog: false });

// --- Procedural Japandi canvas textures (interior redesign Phase 1) ---
// Interior box-projected UVs are in metres, so the oak map is authored as a 1 m x 1 m tile.
function japandiRand(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeJapandiOakTexture(): i.Texture | null {
  if (typeof document === 'undefined') return null;
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  const rnd = japandiRand(20261112);
  ctx.fillStyle = '#c9a26b';
  ctx.fillRect(0, 0, S, S);
  // Long grain streaks running along U
  for (let k = 0; k < 110; k++) {
    const y0 = rnd() * S;
    ctx.strokeStyle = rnd() > 0.5 ? 'rgba(232,207,158,0.16)' : 'rgba(146,106,58,0.15)';
    ctx.lineWidth = 0.6 + rnd() * 2.8;
    ctx.beginPath();
    ctx.moveTo(-8, y0);
    for (let x = 0; x <= S + 16; x += 32) {
      ctx.lineTo(x, y0 + Math.sin((x / S) * Math.PI * (1 + rnd())) * 3 + (rnd() - 0.5) * 2);
    }
    ctx.stroke();
  }
  // Sparse subtle knots
  for (let k = 0; k < 3; k++) {
    const kx = 60 + rnd() * (S - 120);
    const ky = 40 + rnd() * (S - 80);
    for (let r = 7; r > 1; r -= 2) {
      ctx.strokeStyle = 'rgba(120,84,40,0.10)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(kx, ky, r * 2.2, r, 0.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // Fine speckle
  for (let k = 0; k < 2600; k++) {
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,240,205,0.05)' : 'rgba(110,78,38,0.05)';
    ctx.fillRect(rnd() * S, rnd() * S, 1.4, 1.4);
  }
  const tex = new i.CanvasTexture(cv);
  tex.wrapS = i.RepeatWrapping;
  tex.wrapT = i.RepeatWrapping;
  tex.colorSpace = i.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeJapandiWeaveBump(repeat: number): i.Texture | null {
  if (typeof document === 'undefined') return null;
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, S, S);
  const cell = 4;
  for (let y = 0; y < S; y += cell) {
    for (let x = 0; x < S; x += cell) {
      const over = (x / cell + y / cell) % 2 === 0;
      ctx.fillStyle = over ? '#969696' : '#6a6a6a';
      if (over) ctx.fillRect(x, y + 1, cell, cell - 2);
      else ctx.fillRect(x + 1, y, cell - 2, cell);
    }
  }
  const tex = new i.CanvasTexture(cv);
  tex.wrapS = i.RepeatWrapping;
  tex.wrapT = i.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  return tex;
}

const JAPANDI_OAK_MAP = makeJapandiOakTexture();
const JAPANDI_WEAVE_FINE = makeJapandiWeaveBump(6);
const JAPANDI_WEAVE_RUG = makeJapandiWeaveBump(4);

export const BUDDIES_SLOT_MATERIALS = {
  upholstery: new i.MeshPhysicalMaterial({
    color: '#ede7dc',
    roughness: 0.88,
    sheen: 0.25,
    sheenRoughness: 0.5,
    sheenColor: new i.Color('#ffffff'),
    ...(JAPANDI_WEAVE_FINE ? { bumpMap: JAPANDI_WEAVE_FINE, bumpScale: 0.4 } : {}),
  }),
  accent: new i.MeshPhysicalMaterial({
    color: '#a9714b',
    roughness: 0.82,
    sheen: 0.2,
    sheenRoughness: 0.5,
    sheenColor: new i.Color('#ffffff'),
    ...(JAPANDI_WEAVE_FINE ? { bumpMap: JAPANDI_WEAVE_FINE, bumpScale: 0.4 } : {}),
  }),
  bedding: new i.MeshPhysicalMaterial({
    color: '#e7e0d1',
    roughness: 0.85,
    sheen: 0.2,
    sheenRoughness: 0.5,
    ...(JAPANDI_WEAVE_FINE ? { bumpMap: JAPANDI_WEAVE_FINE, bumpScale: 0.4 } : {}),
  }),
  rug: new i.MeshPhysicalMaterial({
    color: '#ded3be',
    roughness: 0.94,
    sheen: 0.15,
    ...(JAPANDI_WEAVE_RUG ? { bumpMap: JAPANDI_WEAVE_RUG, bumpScale: 0.6 } : {}),
  }),
  joinery: new i.MeshPhysicalMaterial({
    color: '#ffffff',
    ...(JAPANDI_OAK_MAP ? { map: JAPANDI_OAK_MAP } : {}),
    roughness: 0.5,
    clearcoat: 0.18,
    clearcoatRoughness: 0.4,
  }),
};

for (const mat of Object.values(BUDDIES_SLOT_MATERIALS)) {
  mat.userData.boxUV = true;
}

const _e = BUDDIES_SLOT_MATERIALS.upholstery;
const dt = BUDDIES_SLOT_MATERIALS.accent;
const R = BUDDIES_SLOT_MATERIALS.joinery;
const Zs = BUDDIES_SLOT_MATERIALS.bedding;

const D = no('#1b1c1f', { roughness: 0.4, metalness: 0.6 });
const ro = no('#c9a15e', { roughness: 0.28, metalness: 1, clearcoat: 0.5 });
const Ae = j('#222731', { roughness: 0.7 });
const lr = new i.MeshBasicMaterial({
  color: '#cfe9ff',
  transparent: true,
  opacity: 0.18,
  depthWrite: false,
  side: i.DoubleSide,
  fog: false,
});

const Hs = ['#2f5a2c', '#3b6a33', '#467a3a', '#2a4f2e', '#557f3f'].map((e) => new i.Color(e));
const _o = (e: () => number) =>
  Hs[Math.floor(e() * Hs.length)].clone().multiplyScalar(0.9 + e() * 0.25);
const Do = j('#ffffff', {
  vertexColors: true,
  side: i.DoubleSide,
  roughness: 0.48,
  envMapIntensity: 0.8,
});
const Ns = rr('#edebe6', { roughness: 0.46, clearcoat: 0.4, flatShading: true });
const js = rr('#3b3e44', { roughness: 0.5, clearcoat: 0.4 });
const en = j('#2c231b');
const $s = j('#5c4b35', { roughness: 0.8 });
const rc = j('#ffffff', { roughness: 0.75, vertexColors: true });
const sc = rr('#ffffff', { roughness: 0.4, clearcoat: 0.5, vertexColors: true });
const qs = (e: i.Material, t: string): TintMaterialRef => ({
  isTint: true,
  base: e,
  col: new i.Color(t),
});
const He = [
  '#2d3a52',
  '#d9d0c1',
  '#8a5a3c',
  '#4d5b4a',
  '#b9a27f',
  '#1f2226',
  '#a44f37',
  '#6b7686',
  '#e6dfd2',
  '#3a2f28',
].map((e) => qs(rc, e));
const me = ['#e9e4da', '#c9b59a', '#8e9a86', '#2f3136', '#b86f4c'].map((e) => qs(sc, e));
const yr = j('#efe6d4', { roughness: 0.9, side: i.DoubleSide, envMapIntensity: 0.4 });
const Ne = {
  shade: ct('#ffd6a0', 1),
  bulb: ct('#fff0d6', 1),
  led: ct('#ffc07a', 1),
  flame: ct('#ffb45c', 1),
};
Ne.shade.side = i.DoubleSide;

const vc = j('#7c7a75', { roughness: 0.5, envMapIntensity: 0.6 });
const Ks = j('#3d3c3a');
const Xs = j('#f3f0ea', { roughness: 0.85 });
const Ys = j('#d9d4cb', { roughness: 0.45, envMapIntensity: 0.7 });
const Sc = j('#2e2a27', { roughness: 0.8 });
const Ya = 3;
const Za = 2.1;

function Je(e: number, t: number, o: number, a = 0.05, n = 0.018): i.BufferGeometry {
  const r = new vs(e, t, o, 4, Math.min(a, Math.min(e, t, o) / 2.02));
  const s = r.attributes.position;
  for (let l = 0; l < s.count; l++) {
    const c = s.getX(l) / (e / 2);
    const u = s.getZ(l) / (o / 2);
    const d = s.getY(l);
    if (d > 0) {
      s.setY(l, d + n * Math.max(0, 1 - c * c) * Math.max(0, 1 - u * u) * (d / (t / 2)));
    }
  }
  return Ee(r);
}

function io(e: number, t: number, o: number): i.BufferGeometry {
  const a = new i.BoxGeometry(e, t, o, 14, 14, 2);
  const n = a.attributes.position;
  for (let r = 0; r < n.count; r++) {
    const s = n.getX(r) / (e / 2);
    const l = n.getY(r) / (t / 2);
    const c = Math.pow(Math.max(0, 1 - s * s), 0.55) * Math.pow(Math.max(0, 1 - l * l), 0.55);
    n.setZ(r, n.getZ(r) * (0.16 + 0.84 * c));
    n.setX(r, n.getX(r) * (1 - 0.07 * l * l));
    n.setY(r, n.getY(r) * (1 - 0.07 * s * s));
  }
  return Ee(a);
}

function Ft(e: [number, number][], t = 32): i.LatheGeometry {
  const o = new i.LatheGeometry(
    e.map(([s, l]) => new i.Vector2(s, l)),
    t,
  );
  const a = Math.max(...e.map((s) => s[0]));
  const n = o.attributes.uv;
  const r = o.attributes.position;
  for (let s = 0; s < n.count; s++) {
    n.setXY(s, n.getX(s) * Math.PI * 2 * a, r.getY(s));
  }
  return o;
}

function Ro(
  e: number,
  t: number,
  {
    fold: o = 0.25,
    curl: a = 0.18,
    shape: n = 'oval',
    seg: r = 9,
    edge: s = null,
  }: {
    fold?: number;
    curl?: number;
    shape?: 'oval' | 'fiddle' | 'heart' | 'paddle';
    seg?: number;
    edge?: [number, number, number] | null;
  } = {},
): i.BufferGeometry {
  const l: number[] = [];
  const c: number[] = [];
  const u: number[] = [];
  for (let f = 0; f <= r; f++) {
    const m = f / r;
    let w =
      n === 'fiddle'
        ? Math.sin(Math.PI * Math.pow(m, 0.75)) * (0.62 + 0.55 * m)
        : n === 'heart'
          ? Math.sin(Math.PI * Math.pow(m, 0.6)) * (1.1 - 0.3 * m)
          : n === 'paddle'
            ? Math.pow(Math.sin(Math.PI * m), 0.55)
            : Math.sin(Math.PI * m) * (1 - 0.2 * m);
    w = Math.max((w * t) / 2, 0.0015);
    for (let b = -3; b <= 3; b++) {
      const S = b / 3;
      l.push(S * w, m * e, -Math.abs(S) * w * o - a * e * m * m);
      const g = 1 - Math.abs(S);
      if (s && Math.abs(S) > 0.99) {
        c.push(...s);
      } else {
        c.push(0.82 + 0.3 * g * g * g, 0.86 + 0.22 * g * g * g, 0.8 + 0.2 * g * g * g);
      }
    }
  }
  const p = 7;
  for (let f = 0; f < r; f++) {
    for (let m = 0; m < p - 1; m++) {
      const w = f * p + m;
      const b = w + 1;
      const S = w + p;
      const g = S + 1;
      u.push(w, S, b, b, S, g);
    }
  }
  const h = new i.BufferGeometry();
  h.setAttribute('position', new i.Float32BufferAttribute(l, 3));
  h.setAttribute('color', new i.Float32BufferAttribute(c, 3));
  h.setIndex(u);
  h.computeVertexNormals();
  return h.toNonIndexed();
}

function Eo(
  e: i.BufferGeometry,
  t: i.Vector3,
  o: i.Vector3,
  a: number,
  n: i.Color,
): i.BufferGeometry {
  Bo.copy(o).normalize();
  Po.set(0, 1, 0).addScaledVector(Bo, -Bo.y);
  if (Po.lengthSq() < 1e-4) Po.set(0, 0, 1);
  Po.normalize();
  Vs.crossVectors(Bo, Po);
  sr.makeBasis(Vs, Bo, Po);
  e.applyMatrix4(sr.premultiply(new i.Matrix4().makeRotationAxis(Bo, a)));
  e.translate(t.x, t.y, t.z);
  const r = e.attributes.color;
  for (let s = 0; s < r.count; s++) {
    r.setXYZ(s, r.getX(s) * n.r, r.getY(s) * n.g, r.getZ(s) * n.b);
  }
  return e;
}

function lo(
  e: ReturnType<typeof O>,
  t: number,
  o: number,
  a: number,
  n = 1,
  r = 1,
  s = 8,
) {
  const l = we(r);
  e.cyl(me[0], t, o + 0.05 * n, a, 0.065 * n, 0.05 * n, 0.1 * n, { seg: 16, open: true })
    .cyl(me[0], t, o + 0.003 * n, a, 0.05 * n, 0.05 * n, 0.006 * n, { seg: 16 })
    .cyl(en, t, o + 0.088 * n, a, 0.064 * n, 0.064 * n, 0.006, { seg: 16 });
  for (let c = 0; c < s; c++) {
    const u = c * 2.4 + l();
    const d = 0.5 + l() * 0.7;
    const p = new i.Vector3(Math.cos(u) * Math.cos(d), Math.sin(d), Math.sin(u) * Math.cos(d));
    e.geo(
      Do,
      Eo(
        Ro(0.1 * n * (0.8 + l() * 0.4), 0.06 * n, { fold: 0.3, curl: 0.3, seg: 6 }),
        new i.Vector3(t, o + 0.1 * n, a),
        p,
        l() - 0.5,
        _o(l),
      ),
      0,
      0,
      0,
      { uv: 'keep' },
    );
  }
}

function et(
  e: ReturnType<typeof O>,
  t: MaterialOrTint,
  o: number,
  a: number,
  n: number,
  r: number,
  s = 0,
) {
  const profiles: [number, number][][] = [
    [
      [0, 0],
      [0.05, 0],
      [0.07, 0.05],
      [0.075, 0.12],
      [0.05, 0.2],
      [0.035, 0.24],
      [0.04, 0.27],
      [0.036, 0.27],
      [0.03, 0.24],
    ],
    [
      [0, 0],
      [0.07, 0],
      [0.08, 0.03],
      [0.08, 0.14],
      [0.078, 0.15],
      [0.07, 0.15],
    ],
    [
      [0, 0],
      [0.04, 0],
      [0.075, 0.06],
      [0.08, 0.1],
      [0.06, 0.16],
      [0.02, 0.2],
      [0.022, 0.23],
      [0.018, 0.23],
    ],
  ];
  const l = profiles[s];
  e.geo(
    t,
    Ft(
      l.map(([c, u]) => [c * r, u * r]),
      28,
    ),
    o,
    a,
    n,
    { uv: 'keep' },
  );
}

function Io(
  e: ReturnType<typeof O>,
  t: number,
  o: number,
  a: number,
  n: number,
  r: () => number,
  { flat: s = false, tilt: l = 0 }: { flat?: boolean; tilt?: number } = {},
) {
  let c = t;
  for (; c < t + n - 0.03; ) {
    const d = 0.022 + r() * 0.022;
    const p = 0.17 + r() * 0.09;
    const h = 0.13 + r() * 0.05;
    const f = He[Math.floor(r() * He.length)];
    if (s) {
      e.box(f, t + n / 2, o + 0.02, a, n * 0.9, 0.032, h, { ry: (r() - 0.5) * 0.2 });
    } else {
      e.box(f, c + d / 2, o + p / 2, a, d, p, h, { r: 0.003 });
    }
    c += d + 0.002;
    if (s) break;
  }
  if (l) {
    e.box(He[Math.floor(r() * He.length)], c + 0.04, o + 0.1, a, 0.024, 0.2, 0.15, { rz: -0.35 });
  }
}

function Mc(
  e: i.Group,
  t: ReturnType<typeof O>,
  o: number,
  a: number,
  n: number,
  r = 1,
  s = 1,
): [number, number, number, string, number, number, string] {
  t.geo(
    me[s],
    Ft(
      (
        [
          [0, 0],
          [0.06, 0],
          [0.1, 0.08],
          [0.095, 0.16],
          [0.04, 0.24],
          [0.018, 0.27],
          [0.018, 0.3],
          [0, 0.3],
        ] as [number, number][]
      ).map(([u, d]) => [u * r, d * r]),
      28,
    ),
    o,
    a,
    n,
    { uv: 'keep' },
  ).cyl(ro, o, a + 0.34 * r, n, 0.006, 0.006, 0.08 * r, { seg: 8 });
  const l = new i.Mesh(new i.CylinderGeometry(0.12 * r, 0.16 * r, 0.2 * r, 32, 1, true), yr);
  l.position.set(o, a + 0.44 * r, n);
  l.castShadow = true;
  e.add(l);
  const c = new i.Mesh(new i.CylinderGeometry(0.115 * r, 0.155 * r, 0.19 * r, 32, 1, true), Ne.shade);
  c.position.copy(l.position);
  e.add(c);
  return [o, a + 0.35 * r, n, '#ffc98a', 2.4 * r, 1.1, 'lamp'];
}

// ============================================================================
// PROCEDURAL 3D CUTAWAY INTERIOR FURNITURE BUILDERS
// ============================================================================

/** `lc`: L-Sectional Sofa (`#L427`) */
function lc(): i.Group {
  const e = new i.Group();
  const t = O();
  const o = 2.7;
  const a = 0.95;
  const n = 0.95;
  const r = 1.62;
  const s = 0.2;
  const l = 0.07;
  const c = -o / 2;
  const u = o / 2;
  const d = -a / 2;
  const p = a / 2;
  const h = d + r;
  const f = l + 0.05;
  t.box(R, 0, l + 0.025, 0, o - 0.04, 0.05, a - 0.04, { r: 0.012 }).box(
    R,
    u - n / 2,
    l + 0.025,
    (p + h) / 2 - 0.01,
    n - 0.04,
    0.05,
    h - p,
    { r: 0.012 },
  );
  for (const [S, g] of [
    [c + 0.08, d + 0.08],
    [c + 0.08, p - 0.08],
    [u - 0.08, d + 0.08],
    [u - 0.08, h - 0.08],
    [u - n + 0.08, h - 0.08],
    [u - n + 0.08, p - 0.1],
  ]) {
    t.cyl(R, S, l / 2, g, 0.024, 0.017, l, { seg: 12 });
  }
  t.geo(_e, Ee(We(o - 0.02, 0.14, a - 0.02, 0.035, 3)), 0, f + 0.07, 0)
    .geo(_e, Ee(We(n - 0.02, 0.14, r - a + 0.06, 0.035, 3)), u - n / 2, f + 0.07, (p + h) / 2 - 0.03)
    .geo(_e, Ee(We(o - 0.02, 0.36, 0.2, 0.06, 3)), 0, f + 0.32, d + 0.1)
    .geo(_e, Ee(We(s, 0.3, a - 0.02, 0.08, 3)), c + s / 2, f + 0.28, 0);
  const m = f + 0.14 + 0.08;
  const w = (o - s - n) / 2;
  t.geo(_e, Je(w - 0.02, 0.19, a - 0.26, 0.075, 0.034), c + s + w / 2, m, d + 0.26 + (a - 0.26) / 2)
    .geo(_e, Je(w - 0.02, 0.19, a - 0.26, 0.075, 0.034), c + s + w * 1.5, m, d + 0.26 + (a - 0.26) / 2)
    .geo(_e, Je(n - 0.03, 0.19, r - 0.27, 0.075, 0.034), u - n / 2, m, d + 0.26 + (r - 0.27) / 2);
  const b = (o - s) / 3;
  for (let S = 0; S < 3; S++) {
    t.geo(_e, Je(b - 0.03, 0.44, 0.17, 0.07, 0.03), c + s + b * (S + 0.5), m + 0.3, d + 0.25, {
      rx: -0.2,
    });
  }
  t.geo(dt, io(0.44, 0.42, 0.14), c + s + 0.3, m + 0.28, d + 0.43, {
    rx: -0.34,
    ry: 0.3,
    rz: 0.08,
  })
    .geo(dt, io(0.42, 0.4, 0.13), u - 0.34, m + 0.27, d + 0.43, {
      rx: -0.34,
      ry: -0.25,
      rz: -0.06,
    })
    .geo(_e, io(0.4, 0.38, 0.13), c + s + 0.78, m + 0.26, d + 0.44, {
      rx: -0.36,
      ry: 0.12,
      rz: -0.05,
    })
    .geo(dt, io(0.36, 0.34, 0.12), c + s + 1.22, m + 0.25, d + 0.45, {
      rx: -0.36,
      ry: -0.1,
      rz: 0.1,
    });
  // Piping cords along the seat-cushion front edges and back-cushion top
  // edges (silhouette seam detail), plus a softly rumpled throw on the chaise.
  const seatFrontZ = d + 0.26 + (a - 0.26) - 0.015;
  t.cyl(Ys, c + s + w / 2, m + 0.088, seatFrontZ, 0.011, 0.011, w - 0.08, {
    seg: 10,
    dir: [1, 0, 0],
  }).cyl(Ys, c + s + w * 1.5, m + 0.088, seatFrontZ, 0.011, 0.011, w - 0.08, {
    seg: 10,
    dir: [1, 0, 0],
  });
  for (let S = 0; S < 3; S++) {
    t.cyl(Ys, c + s + b * (S + 0.5), m + 0.5, d + 0.19, 0.01, 0.01, b - 0.1, {
      seg: 10,
      dir: [1, 0, 0],
    });
  }
  const throwGeo = new i.BoxGeometry(0.8, 0.035, 1.02, 10, 1, 14);
  const throwPos = throwGeo.attributes.position;
  const throwRnd = japandiRand(77031);
  const throwPhase = throwRnd() * 6.28;
  for (let vi = 0; vi < throwPos.count; vi++) {
    const vx = throwPos.getX(vi);
    const vz = throwPos.getZ(vi);
    throwPos.setY(
      vi,
      throwPos.getY(vi) +
        Math.sin(vx * 9 + throwPhase) * 0.008 +
        Math.cos(vz * 7 + throwPhase) * 0.007 +
        (throwRnd() - 0.5) * 0.006,
    );
  }
  throwGeo.computeVertexNormals();
  t.geo(dt, throwGeo, u - n / 2, m + 0.125, d + 0.26 + (r - 0.27) / 2, { ry: 0.05 });
  t.flush(e);
  return e;
}

/** `cc`: Timber Frame Lounge Armchair (`#L428`) */
function cc(): i.Group {
  const e = new i.Group();
  const t = O();
  const o = 0.74;
  const a = 0.8;
  const n = 0.56;
  for (const r of [-1, 1]) {
    const s = r * (o / 2 - 0.035);
    // Continuous side frame: the front leg rises exactly to the underside of
    // the armrest, the armrest runs flush into the back post, and the back
    // post is one piece from floor to backrest top sharing one tilt with the
    // top rail and back cushion, so no joint gaps, sinks or pokes through.
    t.box(R, s, 0.279, a / 2 - 0.08, 0.046, 0.558, 0.046, { r: 0.009 })
      .box(R, s, 0.44, -a / 2 + 0.1, 0.046, 0.88, 0.046, { r: 0.009, rx: -0.14 })
      .box(R, s, n + 0.014, 0, 0.078, 0.032, 0.68, { r: 0.012 })
      .box(R, s, 0.13, 0.03, 0.036, 0.04, 0.53, { r: 0.006 });
  }
  t.box(R, 0, 0.28, a / 2 - 0.08, o - 0.115, 0.05, 0.036, { r: 0.006 })
    .box(R, 0, 0.28, -a / 2 + 0.13, o - 0.115, 0.05, 0.036, { r: 0.006 })
    .box(R, 0, 0.8, -0.345, o - 0.115, 0.05, 0.036, { r: 0.006, rx: -0.14 })
    .geo(_e, Je(o - 0.12, 0.13, a - 0.16, 0.05, 0.016), 0, 0.37, 0.03)
    .geo(_e, Je(o - 0.13, 0.48, 0.13, 0.06, 0.01), 0, 0.64, -0.27, { rx: -0.14 })
    .geo(dt, io(0.36, 0.3, 0.12), 0, 0.58, -0.14, { rx: -0.22, rz: 0.06 });
  t.flush(e);
  return e;
}

/** `uc`: Round Chabudai / Coffee Table with Books, Plant & Glass Candle (`#L429`) */
function uc(): i.Group {
  const e = new i.Group();
  const t = O();
  const o = 0.5;
  const a = 0.05;
  const n = 0.4;
  t.geo(
    R,
    Ee(
      Ft(
        [
          [0, n - a],
          [o - 0.025, n - a],
          [o, n - a + 0.018],
          [o, n - 0.016],
          [o - 0.014, n],
          [0, n],
        ],
        56,
      ),
    ),
    0,
    0,
    0,
    { uv: 'box' },
  );
  for (let d = 0; d < 3; d++) {
    const p = (d / 3) * Math.PI * 2 + 0.5;
    const h = Math.cos(p) * 0.38;
    const f = Math.sin(p) * 0.38;
    const m = Math.cos(p) * 0.27;
    const w = Math.sin(p) * 0.27;
    const b = n - a;
    t.cyl(R, (h + m) / 2, b / 2, (f + w) / 2, 0.03, 0.018, Math.hypot(h - m, b, f - w), {
      dir: [m - h, b, w - f],
      seg: 12,
    });
  }
  t.box(He[0], -0.13, n + 0.017, 0.1, 0.28, 0.034, 0.21, { ry: 0.25 }).box(
    He[1],
    -0.12,
    n + 0.047,
    0.1,
    0.23,
    0.028,
    0.17,
    { ry: 0.1 },
  );
  lo(t, 0.14, n, -0.14, 1.35, 4, 9);
  t.flush(e);
  const s = new i.Group();
  const l = O();
  l.cyl(j('#f3ede1', { roughness: 0.6 }), 0, 0.035, 0, 0.028, 0.028, 0.07, { seg: 16 });
  l.flush(s);
  const c = new i.Mesh(new i.CylinderGeometry(0.036, 0.034, 0.09, 20, 1, true), lr);
  c.position.y = 0.045;
  s.add(c);
  const u = new i.Mesh(new i.SphereGeometry(0.009, 8, 6).scale(1, 1.8, 1), Ne.flame);
  u.position.y = 0.085;
  s.add(u);
  s.position.set(0.18, n, 0.17);
  e.add(s);
  return e;
}

/** `fc`: Lathe Upholstered Pouf Ottoman (`#L430`) */
function fc(): i.Group {
  const e = new i.Group();
  const t = O();
  const o = 0.27;
  const a = 0.4;
  t.geo(
    dt,
    Ee(
      Ft(
        [
          [0, 0],
          [o - 0.04, 0],
          [o, 0.035],
          [o + 0.014, a * 0.5],
          [o, a - 0.05],
          [o - 0.06, a - 0.004],
          [0.04, a - 0.012],
          [0.02, a - 0.022],
          [0, a - 0.024],
        ],
        40,
      ),
    ),
    0,
    0,
    0,
    { uv: 'box' },
  ).sph(dt, 0, a - 0.02, 0, 0.02, { uv: 'box' });
  t.flush(e);
  return e;
}

/** `dc`: Overarching Bezier Arc Floor Lamp (`#L431`) */
function dc(): i.Group {
  const e = new i.Group();
  const t = O();
  t.cyl(D, 0, 0.025, 0, 0.16, 0.17, 0.05, { seg: 36 }).cyl(ro, 0, 0.056, 0, 0.03, 0.035, 0.012, {
    seg: 16,
  });
  const o = new i.CubicBezierCurve3(
    new i.Vector3(0, 0.05, 0),
    new i.Vector3(0, 1.95, -0.05),
    new i.Vector3(0, 2.14, 1.1),
    new i.Vector3(0, 1.7, 1.4),
  );
  t.geo(D, new i.TubeGeometry(o, 56, 0.013, 8, false))
    .geo(D, new i.SphereGeometry(0.2, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0, 1.52, 1.4)
    .cyl(D, 0, 1.715, 1.4, 0.02, 0.02, 0.04, { seg: 12 });
  t.flush(e);
  const a = new i.Mesh(
    new i.SphereGeometry(0.195, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    Ne.shade,
  );
  a.position.set(0, 1.52, 1.4);
  e.add(a);
  const n = new i.Mesh(new i.SphereGeometry(0.045, 16, 10), Ne.bulb);
  n.position.set(0, 1.56, 1.4);
  e.add(n);
  return e;
}

/** `hc`: Pedestal Side Table with Ceramic Table Lamp & Plant (`#L432`) */
function hc(): i.Group {
  const e = new i.Group();
  const t = O();
  const o = 0.52;
  t.geo(
    R,
    Ee(
      Ft(
        [
          [0, o - 0.035],
          [0.22, o - 0.035],
          [0.24, o - 0.02],
          [0.24, o - 0.01],
          [0.228, o],
          [0, o],
        ],
        40,
      ),
    ),
    0,
    0,
    0,
    { uv: 'box' },
  )
    .cyl(R, 0, (o - 0.035) / 2 + 0.02, 0, 0.032, 0.04, o - 0.055, { seg: 16 })
    .geo(
      R,
      Ee(
        Ft(
          [
            [0, 0],
            [0.16, 0],
            [0.17, 0.012],
            [0.15, 0.03],
            [0, 0.03],
          ],
          40,
        ),
      ),
      0,
      0,
      0,
      { uv: 'box' },
    )
    .geo(
      me[1],
      Ft(
        [
          [0, 0],
          [0.06, 0],
          [0.1, 0.08],
          [0.095, 0.16],
          [0.04, 0.24],
          [0.018, 0.27],
          [0.018, 0.3],
          [0, 0.3],
        ],
        28,
      ),
      -0.02,
      o,
      0.02,
      { uv: 'keep' },
    )
    .cyl(ro, -0.02, o + 0.34, 0.02, 0.006, 0.006, 0.08, { seg: 8 });
  t.flush(e);
  const a = new i.Mesh(new i.CylinderGeometry(0.12, 0.16, 0.2, 32, 1, true), yr);
  a.position.set(-0.02, o + 0.44, 0.02);
  a.castShadow = true;
  e.add(a);
  const n = new i.Mesh(new i.CylinderGeometry(0.115, 0.155, 0.19, 32, 1, true), Ne.shade);
  n.position.copy(a.position);
  e.add(n);
  lo(t, 0.12, o, -0.1, 0.9, 17, 6);
  t.flush(e);
  return e;
}

/** `pc`: Fiddle-Leaf Fig Tree in 7-Sided Ceramic Planter (`#L433`) */
function pc(): i.Group {
  const e = new i.Group();
  const t = O();
  const o = we(5);
  t.geo(Ns, new i.CylinderGeometry(0.2, 0.155, 0.44, 7, 1, true), 0, 0.22, 0)
    .cyl(Ns, 0, 0.005, 0, 0.155, 0.155, 0.01, { seg: 7 })
    .cyl(en, 0, 0.415, 0, 0.199, 0.199, 0.02, { seg: 7 });
  for (const [a, n, r] of [
    [0.02, 1.6, 0],
    [0.2, 1.3, 0.1],
    [-0.17, 1.12, -0.12],
    [0.06, 0.95, -0.2],
  ]) {
    const s = new i.CatmullRomCurve3([
      new i.Vector3(0, 0.42, 0),
      new i.Vector3(a * 0.4, 0.42 + n * 0.35, r * 0.4),
      new i.Vector3(a * 0.9, 0.42 + n * 0.75, r * 0.9),
      new i.Vector3(a * 1.4, 0.42 + n, r * 1.4),
    ]);
    t.geo($s, new i.TubeGeometry(s, 16, 0.013, 6, false));
    const l = 12 + Math.floor(o() * 4);
    for (let c = 0; c < l; c++) {
      const u = 0.22 + (0.78 * c) / (l - 1);
      const d = s.getPoint(u);
      const p = c * 2.4 + o() * 0.5;
      const h = 0.2 + u * 0.55 + o() * 0.2;
      const f = new i.Vector3(Math.cos(p) * Math.cos(h), Math.sin(h), Math.sin(p) * Math.cos(h));
      const m = 0.36 - 0.12 * u + o() * 0.05;
      t.geo(
        Do,
        Eo(
          Ro(m, m * 0.76, { shape: 'fiddle', fold: 0.2, curl: 0.28, seg: 10 }),
          d,
          f,
          (o() - 0.5) * 0.8,
          _o(o),
        ),
        0,
        0,
        0,
        { uv: 'keep' },
      );
    }
  }
  t.flush(e);
  return e;
}

/** `mc`: Bird of Paradise in Fluted Planter (`#L434`) */
function mc(): i.Group {
  const e = new i.Group();
  const t = O();
  const o = we(9);
  const a = new i.CylinderGeometry(0.2, 0.16, 0.46, 48, 6, true);
  const n = a.attributes.position;
  for (let r = 0; r < n.count; r++) {
    const s = Math.atan2(n.getZ(r), n.getX(r));
    const l = 1 + 0.035 * Math.cos(s * 14);
    n.setX(r, n.getX(r) * l);
    n.setZ(r, n.getZ(r) * l);
  }
  a.computeVertexNormals();
  t.geo(js, a, 0, 0.23, 0)
    .cyl(js, 0, 0.005, 0, 0.16, 0.16, 0.01, { seg: 24 })
    .cyl(en, 0, 0.435, 0, 0.195, 0.195, 0.02, { seg: 24 });
  for (let r = 0; r < 9; r++) {
    const s = r * 2.4 + o() * 0.3;
    const l = 1.05 + o() * 0.35 - r * 0.02;
    const c = 0.45 + o() * 0.5;
    const u = new i.Vector3(Math.cos(s) * Math.cos(l), Math.sin(l), Math.sin(s) * Math.cos(l));
    const d = new i.Vector3(Math.cos(s) * 0.03, 0.45, Math.sin(s) * 0.03);
    const p = d.clone().addScaledVector(u, c);
    t.geo($s, new i.CylinderGeometry(0.009, 0.012, c, 6).translate(0, c / 2, 0), d.x, d.y, d.z, {
      dir: u.toArray(),
    });
    const h = u.clone();
    h.y *= 0.55;
    h.normalize();
    const f = 0.5 + o() * 0.22;
    t.geo(
      Do,
      Eo(
        Ro(f, 0.2 + o() * 0.05, { shape: 'paddle', fold: 0.14, curl: 0.12, seg: 12 }),
        p,
        h,
        (o() - 0.5) * 0.6,
        _o(o).multiplyScalar(1.12),
      ),
      0,
      0,
      0,
      { uv: 'keep' },
    );
  }
  t.flush(e);
  return e;
}

/** `wc`: Sideboard / Mid-Century Credenza with Vases, Books & Plant (`#L437`) */
function wc(): i.Group {
  const e = new i.Group();
  const t = O();
  const o = 1.8;
  const a = 0.44;
  const n = 0.58;
  const r = 0.12;
  t.box(vc, 0, r + (n - r - 0.03) / 2, 0, o, n - r - 0.03, a, { r: 0.012 }).box(
    R,
    0,
    n - 0.015,
    0,
    o + 0.02,
    0.03,
    a + 0.02,
    { r: 0.008 },
  );
  for (const [l, c] of [
    [-o / 2 + 0.08, -a / 2 + 0.07],
    [o / 2 - 0.08, -a / 2 + 0.07],
    [-o / 2 + 0.08, a / 2 - 0.07],
    [o / 2 - 0.08, a / 2 - 0.07],
  ]) {
    t.cyl(R, l, r / 2, c, 0.022, 0.015, r, { seg: 10 });
  }
  for (const l of [-o / 6, o / 6]) {
    t.box(Ks, l, r + (n - r - 0.03) / 2, a / 2 + 0.001, 0.006, n - r - 0.07, 0.004);
  }
  for (const l of [-o / 3, 0, o / 3]) {
    t.box(
      ro,
      l + 0.2 * (l > 0 ? -1 : l < 0 ? 1 : 0) + (l === 0 ? 0.24 : 0),
      r + (n - r) * 0.55,
      a / 2 + 0.012,
      0.012,
      0.12,
      0.012,
      { r: 0.004 },
    );
  }
  et(t, me[3], -0.58, n, -0.02, 1.35, 0);
  et(t, me[0], -0.42, n, 0.04, 1, 2);
  et(t, me[4], 0.02, n, -0.06, 0.9, 1);
  t.box(He[2], 0.46, n + 0.02, 0.02, 0.3, 0.04, 0.22, { ry: -0.12 }).box(
    He[8],
    0.47,
    n + 0.055,
    0.02,
    0.26,
    0.03,
    0.19,
    { ry: 0.05 },
  );
  lo(t, 0.7, n, -0.05, 1.2, 33, 8);
  t.flush(e);
  return e;
}

/** `xc`: Floating Wall Shelves with LED Strips, Books, Vases & Trailing Ivy (`#L438`) */
function xc(): i.Group {
  const e = new i.Group();
  const t = O();
  const o = we(31);
  (
    [
      [-0.12, -0.42],
      [0.1, 0],
      [-0.06, 0.42],
    ] as const
  ).forEach(([n, r], s) => {
    t.box(R, n, r, 0.125, 1.24, 0.036, 0.25, { r: 0.008 });
    const l = r + 0.018;
    if (s === 0) {
      Io(t, n - 0.58, l, 0.13, 0.4, o);
      et(t, me[0], n + 0.05, l, 0.12, 1, 0);
      lo(t, n + 0.36, l, 0.12, 1.1, 5, 8);
    } else if (s === 1) {
      et(t, me[3], n - 0.46, l, 0.12, 1.1, 2);
      Io(t, n - 0.3, l, 0.13, 0.34, o, { tilt: 1 });
      Io(t, n + 0.2, l, 0.12, 0.3, o, { flat: true });
      et(t, me[1], n + 0.46, l, 0.12, 0.9, 1);
    } else if (s === 2) {
      lo(t, n - 0.42, l, 0.12, 1.2, 13, 9);
      Io(t, n - 0.1, l, 0.13, 0.3, o);
      et(t, me[4], n + 0.36, l, 0.12, 0.9, 0);
    }
    const c = new i.Mesh(new i.BoxGeometry(1.14, 0.008, 0.012), Ne.led);
    c.position.set(n, r - 0.021, 0.22);
    e.add(c);
  });
  for (let n = 0; n < 3; n++) {
    let r = new i.Vector3(-0.48 + n * 0.04, 0.46, 0.2);
    const s = new i.Vector3(0.02, -1, 0.25).normalize();
    for (let l = 0; l < 9 + n * 2; l++) {
      r = r.clone().addScaledVector(s, 0.055);
      s.x += (o() - 0.5) * 0.2;
      s.z = 0.12 + o() * 0.1;
      s.normalize();
      t.geo(
        Do,
        Eo(
          Ro(0.07, 0.06, { shape: 'heart', fold: 0.25, curl: 0.2, seg: 6 }),
          r,
          new i.Vector3(o() - 0.5, 0.3, 1).normalize(),
          o() * 2,
          _o(o).multiplyScalar(1.15),
        ),
        0,
        0,
        0,
        { uv: 'keep' },
      );
    }
  }
  t.flush(e);
  return e;
}

/** `bc`: Woven Area Rug (`#L445`) */
function bc(): i.Group {
  const e = new i.Group();
  const t = We(Ya, 0.014, Za, 0.006, 1);
  const o = t.attributes.position;
  const a = t.attributes.uv;
  for (let r = 0; r < o.count; r++) {
    a.setXY(r, o.getX(r) + Ya / 2, o.getZ(r) + Za / 2);
  }
  t.translate(0, 0.007, 0);
  const n = new i.Mesh(t, BUDDIES_SLOT_MATERIALS.rug);
  n.receiveShadow = true;
  e.add(n);
  return e;
}

/** `Cc`: Platform Bed with Upholstered Headboard, Duvet & 4 Pillows (`#L451`) */
const JAPANDI_PANEL_GLOW = new i.MeshBasicMaterial({
  color: '#ffc98a',
  transparent: true,
  opacity: 0.9,
  fog: false,
});

function Cc(): i.Group {
  const e = new i.Group();
  const t = O();
  const o = 1.8;
  const a = 2.12;
  // Japandi platform bedroom suite (redesign Phase 2, reference sheet 2):
  // warm backlight halo + full-width oak headboard wall panel with seam grooves
  t.box(JAPANDI_PANEL_GLOW, 0, 0.82, -a / 2 - 0.008, 3.0, 1.64, 0.01)
    .box(R, 0, 0.78, -a / 2 + 0.015, 2.9, 1.56, 0.03, { r: 0.008 })
    .box(Ks, -0.97, 0.78, -a / 2 + 0.0315, 0.014, 1.5, 0.003)
    .box(Ks, 0.97, 0.78, -a / 2 + 0.0315, 0.014, 1.5, 0.003)
    // Recessed dark plinth + low floating platform slab (lip extends past the mattress)
    .box(en, 0, 0.04, 0.03, 1.66, 0.08, 1.86)
    .box(R, 0, 0.16, 0.03, o + 0.26, 0.16, a - 0.02, { r: 0.015 });
  // Upholstered fabric headboard cushion mounted on the panel
  t.geo(_e, Je(o + 0.1, 0.58, 0.12, 0.05, 0.006), 0, 0.66, -a / 2 + 0.09)
    .geo(Xs, Ee(We(o - 0.04, 0.24, a - 0.14, 0.07, 3)), 0, 0.36, 0.02)
    .geo(Zs, Ee(We(o + 0.05, 0.25, a * 0.61, 0.1, 3)), 0, 0.4, 0.4)
    .geo(Zs, Ee(We(o + 0.05, 0.07, 0.26, 0.035, 2)), 0, 0.545, -0.24, {
      rx: 0.18,
    });
  for (const n of [-1, 1]) {
    t.geo(Xs, io(0.66, 0.42, 0.17), n * 0.44, 0.56, -a / 2 + 0.28, { rx: -1.18 });
  }
  for (const n of [-1, 1]) {
    t.geo(dt, io(0.46, 0.34, 0.13), n * 0.36, 0.6, -a / 2 + 0.44, { rx: -1, rz: n * 0.06 });
  }
  t.geo(dt, Ee(We(o + 0.12, 0.035, 0.5, 0.015, 2)), 0, 0.53, a / 2 - 0.34);
  t.flush(e);
  return e;
}

/** `kc`: Bedside Nightstand with Table Lamp (`#L452`) */
function kc(): i.Group {
  const e = new i.Group();
  const t = O();
  const o = 0.5;
  const a = 0.4;
  const n = 0.5;
  t.box(R, 0, 0.3, 0, o, 0.4, a, { r: 0.012 });
  for (const [s, l] of [
    [-o / 2 + 0.05, -a / 2 + 0.05],
    [o / 2 - 0.05, -a / 2 + 0.05],
    [-o / 2 + 0.05, a / 2 - 0.05],
    [o / 2 - 0.05, a / 2 - 0.05],
  ]) {
    t.cyl(R, s, 0.05, l, 0.016, 0.012, 0.1, { seg: 8 });
  }
  t.box(Ks, 0, 0.33, a / 2 + 0.001, o - 0.05, 0.006, 0.004).box(
    He[0],
    0.1,
    n + 0.015,
    0.03,
    0.2,
    0.03,
    0.15,
    { ry: 0.2 },
  );
  Mc(e, t, -0.08, n, -0.04, 0.85, 0);
  t.flush(e);
  return e;
}

/** `zc`: Two-Door Wardrobe Closet (`#L453`) */
function zc(): i.Group {
  const e = new i.Group();
  const t = O();
  const o = 1.6;
  const a = 0.6;
  const n = 2.15;
  t.box(Ys, 0, n / 2 + 0.04, 0, o, n - 0.08, a, { r: 0.012 })
    .box(Ae, 0, 0.04, 0, o - 0.04, 0.08, a - 0.06)
    // Sliding doors (redesign Phase 2, sheet 2): oak door on the rear track,
    // warm-white door overlapping on the front track, handle-less
    .box(R, 0.38, n / 2 + 0.02, a / 2 + 0.008, 0.84, n - 0.24, 0.02, { r: 0.006 })
    .box(Ys, -0.38, n / 2 + 0.02, a / 2 + 0.032, 0.84, n - 0.24, 0.02, { r: 0.006 })
    // Oak pelmet band hiding the sliding track
    .box(R, 0, n - 0.03, a / 2 + 0.02, o - 0.02, 0.14, 0.05, { r: 0.006 });
  t.flush(e);
  return e;
}

/** `Tc`: Dining Table with Ceramic Vases & Botanical Centerpiece (`#L454`) */
function Tc(): i.Group {
  const e = new i.Group();
  const t = O();
  const o = 1.7;
  const a = 0.9;
  const n = 0.75;
  const r = we(71);
  t.box(R, 0, n - 0.022, 0, o, 0.045, a, { r: 0.012 }).box(
    R,
    0,
    n - 0.075,
    0,
    o - 0.34,
    0.06,
    a - 0.24,
    { r: 0.006 },
  );
  for (const [s, l] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const c = s * (o / 2 - 0.17);
    const u = l * (a / 2 - 0.13);
    const d = s * (o / 2 - 0.09);
    const p = l * (a / 2 - 0.07);
    const h = n - 0.05;
    t.cyl(R, (c + d) / 2, h / 2, (u + p) / 2, 0.028, 0.019, Math.hypot(c - d, h, u - p), {
      dir: [c - d, h, u - p],
      seg: 10,
    });
  }
  et(t, me[0], -0.12, n, 0.02, 1.15, 0);
  et(t, me[1], 0.3, n, -0.05, 1.3, 1);
  for (let s = 0; s < 7; s++) {
    const l = s * 2.3;
    const c = new i.Vector3(Math.cos(l) * 0.5, 1, Math.sin(l) * 0.5).normalize();
    const u = new i.Vector3(-0.12 + c.x * 0.1, n + 0.3 + s * 0.025, 0.02 + c.z * 0.1);
    t.geo(
      Do,
      Eo(Ro(0.12, 0.05, { fold: 0.2, curl: 0.3, seg: 6 }), u, c, r() * 2, _o(r)),
      0,
      0,
      0,
      { uv: 'keep' },
    );
  }
  t.flush(e);
  return e;
}

/** `Lc`: Dining Chair with Puffed Cushion (`#L455`) */
function Lc(): i.Group {
  const e = new i.Group();
  const t = O();
  // Continuous-mitred frame: the rear legs run in one piece from the floor
  // to the top of the backrest, and every apron, slat and stretcher is
  // fitted exactly between the leg faces it meets, so no member overlaps
  // another and no joint floats.
  const legX = 0.185;
  const legZ = 0.185;
  const legS = 0.036;
  const span = (legX - legS / 2) * 2;
  const postTilt = -0.07;
  const postZAt = (y: number) => -legZ + (y - 0.44) * Math.sin(postTilt);
  for (const r of [-1, 1]) {
    // front legs, floor to the seat slab (aprons butt into their back faces)
    t.box(R, r * legX, 0.215, legZ, legS, 0.43, legS, { r: 0.007 });
    // rear posts, one continuous piece from floor to backrest top
    t.box(R, r * legX, 0.44, -legZ, legS, 0.88, legS, { r: 0.007, rx: postTilt });
    // side apron + side stretcher fitted between front leg and rear post
    t.box(R, r * legX, 0.415, 0, legS, 0.03, span, { r: 0.005 });
    t.box(R, r * legX, 0.15, 0, 0.024, 0.024, span, { r: 0.005 });
  }
  // front + back aprons fitted between the legs / posts
  t.box(R, 0, 0.415, legZ, span, 0.03, legS, { r: 0.005 });
  t.box(R, 0, 0.415, -legZ, span, 0.03, legS, { r: 0.005 });
  // back stretcher fitted between the rear posts
  t.box(R, 0, 0.19, -legZ, span, 0.024, 0.024, { r: 0.005 });
  // backrest slats fitted between the rear posts, tilt matched to the posts
  t.box(R, 0, 0.68, postZAt(0.68), span, 0.09, 0.02, { r: 0.006, rx: postTilt });
  t.box(R, 0, 0.82, postZAt(0.82), span, 0.09, 0.02, { r: 0.006, rx: postTilt });
  // seat slab resting exactly on the aprons and leg tops, cushion on the slab
  t.box(R, 0, 0.4425, 0, 0.44, 0.025, 0.44, { r: 0.006 });
  t.geo(dt, Je(0.42, 0.05, 0.42, 0.02, 0.008), 0, 0.468, 0);
  t.flush(e);
  return e;
}

/** `Ac`: Upholstered Foot-of-Bed Bench (`#L456`) */
function Ac(): i.Group {
  const e = new i.Group();
  const t = O();
  const o = 1.2;
  const a = 0.4;
  const n = 0.45;
  t.geo(dt, Je(o, 0.1, a, 0.04, 0.012), 0, n - 0.05, 0)
    .box(R, 0, n - 0.115, 0, o - 0.02, 0.03, a - 0.02, { r: 0.006 })
    .box(R, 0, 0.1, 0, o - 0.14, 0.02, a - 0.1);
  for (const [r, s] of [
    [-o / 2 + 0.06, -a / 2 + 0.05],
    [o / 2 - 0.06, -a / 2 + 0.05],
    [-o / 2 + 0.06, a / 2 - 0.05],
    [o / 2 - 0.06, a / 2 - 0.05],
  ]) {
    t.cyl(R, r, (n - 0.13) / 2, s, 0.02, 0.016, n - 0.13, { seg: 8 });
  }
  t.box(He[1], 0.3, 0.125, 0, 0.3, 0.03, 0.22).box(He[4], 0.32, 0.155, 0, 0.26, 0.03, 0.2, {
    ry: 0.15,
  });
  t.flush(e);
  return e;
}

/** `Rc`: 6-Tier Tall Bookcase with Books, Vases & Top Plant (`#L457`) */
function Rc(): i.Group {
  const e = new i.Group();
  const t = O();
  const o = 1;
  const a = 0.34;
  const n = 2;
  const r = we(91);
  for (const l of [-1, 1]) {
    t.box(R, l * (o / 2 - 0.012), n / 2, 0, 0.024, n, a, { r: 0.004 });
  }
  const s = [0.06, 0.46, 0.86, 1.26, 1.66, 1.99];
  s.forEach((l) => t.box(R, 0, l, 0, o - 0.02, 0.024, a - 0.01, { r: 0.004 }));
  t.box(Sc, 0, n / 2, -a / 2 + 0.008, o - 0.04, n - 0.02, 0.012);
  s.slice(0, 5).forEach((l, c) => {
    const u = l + 0.012;
    if (c % 2 === 0) {
      Io(t, -0.44, u, -0.02, 0.5, r);
      et(t, me[(c + 1) % 5], 0.25, u, 0, 0.9, c % 3);
    } else {
      et(t, me[c % 5], -0.3, u, 0, 1, 2);
      Io(t, -0.1, u, -0.02, 0.5, r, { tilt: 1 });
    }
  });
  lo(t, 0.2, 1.99 + 0.012, 0, 1.1, 19, 8);
  t.flush(e);
  return e;
}

/** `Bc`: Study Desk with Laptop, Mug, Plant & Articulated Task Lamp (`#L458`) */
function Bc(): i.Group {
  const e = new i.Group();
  const t = O();
  const o = 1.4;
  const a = 0.65;
  const n = 0.75;
  const r = j('#232a38', { roughness: 0.3, envMapIntensity: 1 });
  t.box(R, 0, n - 0.02, 0, o, 0.04, a, { r: 0.01 });
  for (const l of [-1, 1]) {
    t.box(D, l * (o / 2 - 0.08), (n - 0.04) / 2, 0, 0.03, n - 0.04, 0.03)
      .box(D, l * (o / 2 - 0.08), 0.015, 0, 0.04, 0.03, a - 0.08)
      .box(D, l * (o / 2 - 0.08), n - 0.06, 0, 0.04, 0.03, a - 0.08);
  }
  t.box(no('#b9bdc4', { roughness: 0.3 }), -0.08, n + 0.006, 0.1, 0.34, 0.012, 0.24, {
    r: 0.004,
  })
    .box(no('#b9bdc4', { roughness: 0.3 }), -0.08, n + 0.12, -0.03, 0.34, 0.23, 0.01, {
      r: 0.004,
      rx: -0.22,
    })
    .box(r, -0.08, n + 0.12, -0.024, 0.31, 0.2, 0.004, { rx: -0.22 })
    .box(He[6], 0.35, n + 0.01, 0.12, 0.22, 0.02, 0.16, { ry: 0.3 })
    .cyl(me[3], 0.3, n + 0.05, -0.16, 0.04, 0.035, 0.1, { seg: 14 });
  lo(t, -0.55, n, -0.18, 1, 23, 7);
  t.cyl(D, 0.55, n + 0.01, -0.18, 0.07, 0.08, 0.02, { seg: 20 })
    .cyl(D, 0.55, n + 0.2, -0.18, 0.008, 0.008, 0.38, { seg: 8, rz: 0.22 })
    .cyl(D, 0.47, n + 0.38, -0.1, 0.008, 0.008, 0.22, { seg: 8, rz: -1.1 })
    .cyl(D, 0.38, n + 0.34, -0.08, 0.03, 0.07, 0.1, { seg: 20, open: true, rz: 0.5 });
  t.flush(e);
  const s = new i.Mesh(new i.CircleGeometry(0.066, 20), Ne.bulb);
  s.position.set(0.36, n + 0.29, -0.08);
  s.rotation.x = -Math.PI / 2;
  s.rotation.y = 0.4;
  e.add(s);
  return e;
}

/** `Pc`: 5-Star Swivel Task Chair (`#L459`) */
function Pc(): i.Group {
  const e = new i.Group();
  const t = O();
  for (let o = 0; o < 5; o++) {
    const a = (o / 5) * Math.PI * 2;
    // Spokes run from the hub surface outward; they no longer pile up
    // across the centre of the base.
    t.box(D, Math.sin(a) * 0.175, 0.06, Math.cos(a) * 0.175, 0.04, 0.03, 0.25, {
      ry: a,
    }).sph(D, Math.sin(a) * 0.285, 0.03, Math.cos(a) * 0.285, 0.03, { seg: 8, seg2: 6 });
  }
  t.cyl(D, 0, 0.055, 0, 0.05, 0.055, 0.05, { seg: 16 })
    .cyl(no('#9aa0a8', { roughness: 0.3 }), 0, 0.255, 0, 0.022, 0.026, 0.35, { seg: 12 })
    // Under-seat mechanism plate: the lift, the back bracket and both arm
    // posts land on it, so nothing under the cushion floats.
    .box(D, 0, 0.44, 0, 0.58, 0.025, 0.4, { r: 0.006 })
    .geo(_e, Je(0.48, 0.08, 0.46, 0.04, 0.01), 0, 0.47, 0.02)
    .box(D, 0, 0.57, -0.2, 0.06, 0.28, 0.03, { rx: -0.12 })
    .geo(_e, Je(0.44, 0.42, 0.07, 0.05, 0.006), 0, 0.8, -0.24, { rx: -0.12 });
  for (const o of [-1, 1]) {
    t.box(D, o * 0.26, 0.57, 0, 0.03, 0.235, 0.03).box(D, o * 0.26, 0.7, 0.02, 0.05, 0.025, 0.26, {
      r: 0.01,
    });
  }
  t.flush(e);
  return e;
}

/** `Ec`: Variegated Snake Plant in Turned Ceramic Pot (`#L460`) */
function Ec(): i.Group {
  const e = new i.Group();
  const t = O();
  const o = we(33);
  t.geo(
    me[4],
    Ft(
      [
        [0, 0],
        [0.12, 0],
        [0.15, 0.05],
        [0.165, 0.3],
        [0.17, 0.32],
        [0.16, 0.32],
        [0.15, 0.3],
      ],
      32,
    ),
    0,
    0,
    0,
    { uv: 'keep' },
  ).cyl(en, 0, 0.285, 0, 0.152, 0.152, 0.012, { seg: 20 });
  for (let a = 0; a < 12; a++) {
    const n = a * 2.4 + o();
    const r = 0.08 + o() * 0.2;
    const s = new i.Vector3(Math.sin(n) * r, 1, Math.cos(n) * r).normalize();
    const l = 0.5 + o() * 0.4;
    t.geo(
      Do,
      Eo(
        Ro(l, 0.07 + o() * 0.04, {
          shape: 'paddle',
          fold: 0.12,
          curl: -0.02,
          seg: 10,
          edge: [1.1, 1.02, 0.55],
        }),
        new i.Vector3(Math.sin(n) * 0.05, 0.29, Math.cos(n) * 0.05),
        s,
        n,
        _o(o).multiplyScalar(0.85),
      ),
      0,
      0,
      0,
      { uv: 'keep' },
    );
  }
  t.flush(e);
  return e;
}

/** TV entertainment wall: oak wall panel with a warm halo behind the screen,
 * low credenza with door seams, floating shelves with books and a lathe vase. */
function TvUnit(): i.Group {
  const e = new i.Group();
  const t = O();
  t.box(R, 0, 1.22, -0.21, 3.4, 2.44, 0.05, { r: 0.01 });
  const glow = new i.Mesh(new i.BoxGeometry(2.02, 1.2, 0.008), JAPANDI_PANEL_GLOW);
  glow.position.set(0, 1.62, -0.168);
  glow.raycast = () => {};
  e.add(glow);
  t.box(Ks, 0, 1.62, -0.145, 1.9, 1.08, 0.045, { r: 0.008 }).box(
    D,
    0,
    0.61,
    0.03,
    1.15,
    0.07,
    0.07,
    { r: 0.02 },
  );
  for (const [lx, lz] of [
    [-1.12, -0.16],
    [1.12, -0.16],
    [-1.12, 0.16],
    [1.12, 0.16],
  ] as const) {
    t.cyl(R, lx, 0.06, lz, 0.02, 0.013, 0.12, { seg: 10 });
  }
  t.box(R, 0, 0.33, 0, 2.4, 0.42, 0.44, { r: 0.015 })
    .box(R, 0, 0.56, 0, 2.5, 0.035, 0.48, { r: 0.01 })
    .box(Ks, -0.4, 0.33, 0.223, 0.012, 0.34, 0.004)
    .box(Ks, 0.4, 0.33, 0.223, 0.012, 0.34, 0.004);
  t.box(R, -1.32, 1.52, -0.13, 0.72, 0.04, 0.24, { r: 0.008 })
    .box(R, -1.32, 1.88, -0.13, 0.72, 0.04, 0.24, { r: 0.008 })
    .box(R, 1.32, 1.52, -0.13, 0.72, 0.04, 0.24, { r: 0.008 });
  const bookCols = [He[0], He[1], me[0], He[2], me[1], He[3]];
  let bi = 0;
  for (const [bx, by] of [
    [-1.5, 1.54],
    [-1.42, 1.54],
    [-1.34, 1.54],
    [1.2, 1.54],
    [1.28, 1.54],
    [-1.44, 1.9],
  ] as const) {
    const bh = 0.19 + (bi % 3) * 0.025;
    t.box(bookCols[bi % bookCols.length], bx, by + bh / 2, -0.13, 0.055, bh, 0.16, {
      r: 0.006,
    });
    bi++;
  }
  t.geo(
    dt,
    Ft([
      [0, 0],
      [0.055, 0.005],
      [0.07, 0.05],
      [0.045, 0.11],
      [0.03, 0.13],
    ]),
    -1.12,
    1.9,
    -0.13,
  );
  t.flush(e);
  return e;
}

export const BUDDIES_FURNITURE_BUILDERS: Record<string, () => i.Group> = {
  sofa: lc,
  armchair: cc,
  coffee: uc,
  pouf: fc,
  lamp: dc,
  side: hc,
  plant: pc,
  plant2: mc,
  credenza: wc,
  shelf: xc,
  rug: bc,
  bed: Cc,
  nightstand: kc,
  wardrobe: zc,
  dining: Tc,
  chair: Lc,
  bench: Ac,
  bookcase: Rc,
  desk: Bc,
  taskchair: Pc,
  snake: Ec,
};

/**
 * Floor colliders for the background zones, in the same placement frame as
 * `buildBuddiesInteriorBackgroundZones` (centre x/z, rotation ry, half
 * extents hw/hd). Rugs and wall-mounted shelves intentionally have none.
 */
export const BUDDIES_ZONE_COLLIDERS: ReadonlyArray<{
  x: number;
  z: number;
  ry: number;
  hw: number;
  hd: number;
}> = [
  // Dining zone
  { x: -3.25, z: 2.15, ry: 0, hw: 0.85, hd: 0.45 },
  { x: -3.7, z: 1.33, ry: 0, hw: 0.23, hd: 0.24 },
  { x: -2.8, z: 1.33, ry: 0, hw: 0.23, hd: 0.24 },
  { x: -3.7, z: 2.97, ry: Math.PI, hw: 0.23, hd: 0.24 },
  { x: -2.8, z: 2.97, ry: Math.PI, hw: 0.23, hd: 0.24 },
  { x: -4.95, z: 3.35, ry: 0, hw: 0.2, hd: 0.2 },
  // Bedroom zone
  { x: 3.4, z: -2.62, ry: 0, hw: 1.03, hd: 1.05 },
  { x: 1.95, z: -3.47, ry: 0, hw: 0.28, hd: 0.2 },
  { x: 4.85, z: -3.47, ry: 0, hw: 0.28, hd: 0.2 },
  { x: 3.4, z: -1.2, ry: 0, hw: 0.6, hd: 0.2 },
  { x: 4.95, z: -1.7, ry: -Math.PI / 2, hw: 0.8, hd: 0.3 },
  { x: 5.0, z: 0.4, ry: 0, hw: 0.22, hd: 0.22 },
  // Study zone
  { x: 4.1, z: 1.36, ry: 0, hw: 0.7, hd: 0.33 },
  { x: 4.1, z: 2.05, ry: Math.PI, hw: 0.3, hd: 0.3 },
  { x: 1.69, z: 3.05, ry: Math.PI / 2, hw: 0.5, hd: 0.17 },
  { x: 4.55, z: 3.1, ry: (-5 * Math.PI) / 8, hw: 0.4, hd: 0.42 },
  { x: 2.3, z: 3.4, ry: 0, hw: 0.2, hd: 0.2 },
  // Living zone (TV credenza first, then the sectional in two boxes)
  { x: -4.92, z: -0.6, ry: Math.PI / 2, hw: 1.2, hd: 0.38 },
  { x: -2.35, z: -0.6, ry: -Math.PI / 2, hw: 1.35, hd: 0.48 },
  { x: -3.16, z: 0.28, ry: -Math.PI / 2, hw: 0.48, hd: 0.34 },
  { x: -3.38, z: -0.95, ry: 0, hw: 0.45, hd: 0.45 },
  { x: -1.55, z: -1.95, ry: -Math.PI / 2, hw: 0.18, hd: 0.18 },
  { x: -0.75, z: -2.75, ry: (-5 * Math.PI) / 8, hw: 0.4, hd: 0.42 },
  { x: -2.9, z: 0.95, ry: 0, hw: 0.28, hd: 0.28 },
  { x: -1.8, z: 0.85, ry: 0, hw: 0.23, hd: 0.23 },
];

/**
 * Builds the static background room furniture zones (`Wr` Dining, `Ur` Bedroom, `Vr` Study, plus wall shelves)
 * so the 10.6m x 7.4m cutaway studio is populated with warm interior props.
 */
export function buildBuddiesInteriorBackgroundZones(): i.Group {
  const grp = new i.Group();
  grp.name = 'BuddiesInteriorBackgroundZones';
  const Ce = Math.PI / 8;

  const staticPlacements: [string, number, number, number][] = [
    // Dining Zone (`Wr`)
    ['dining', -3.25, 2.15, 0],
    ['chair', -3.7, 1.33, 0],
    ['chair', -2.8, 1.33, 0],
    ['chair', -3.7, 2.97, 8 * Ce],
    ['chair', -2.8, 2.97, 8 * Ce],
    ['snake', -4.95, 3.35, 0],
    // Bedroom Zone (`Ur`)
    ['bed', 3.4, -2.62, 0],
    ['nightstand', 1.95, -3.47, 0],
    ['nightstand', 4.85, -3.47, 0],
    ['bench', 3.4, -1.2, 0],
    ['rug', 3.4, -1.75, 0],
    ['wardrobe', 4.95, -1.7, -4 * Ce],
    ['plant2', 5.0, 0.4, 0],
    // Study / Office Zone (`Vr`)
    ['desk', 4.1, 1.36, 0],
    ['taskchair', 4.1, 2.05, 8 * Ce],
    ['bookcase', 1.69, 3.05, 4 * Ce],
    ['armchair', 4.55, 3.1, -5 * Ce],
    ['snake', 2.3, 3.4, 0],
    // Living Room Set: sectional facing the TV wall on the left wall
    ['sofa', -2.35, -0.6, -4 * Ce],
    ['coffee', -3.38, -0.95, 0],
    ['rug', -3.2, -0.6, 4 * Ce],
    ['lamp', -1.55, -1.95, -4 * Ce],
    ['armchair', -0.75, -2.75, -5 * Ce],
    ['pouf', -2.9, 0.95, 0],
    ['side', -1.8, 0.85, 0],
  ];

  for (const [type, x, z, ry] of staticPlacements) {
    const buildFn = BUDDIES_FURNITURE_BUILDERS[type];
    if (!buildFn) continue;
    const itemGrp = buildFn();
    itemGrp.position.set(x, 0, z);
    itemGrp.rotation.y = ry;
    itemGrp.traverse((c) => {
      c.raycast = () => {};
    });
    grp.add(itemGrp);
  }

  // Wall-mounted floating shelves (`xc`, `["shelf", "B", -4, 1.62]` on Back Wall)
  const backShelves = xc();
  backShelves.position.set(-4.0, 1.62, -3.7);
  backShelves.traverse((c) => {
    c.raycast = () => {};
  });
  grp.add(backShelves);

  // TV entertainment wall against the left wall, facing the sectional
  const tvUnit = TvUnit();
  tvUnit.position.set(-4.78, 0, -0.6);
  tvUnit.rotation.y = Math.PI / 2;
  tvUnit.traverse((c) => {
    c.raycast = () => {};
  });
  grp.add(tvUnit);

  return grp;
}

/**
 * Builds the interactive draggable catalog furniture items using the procedural 3D furniture builders.
 */
export function buildOriginalBuddiesCatalogFurnitureMesh(catalogId: string): i.Group {
  if (BUDDIES_FURNITURE_BUILDERS[catalogId]) {
    return BUDDIES_FURNITURE_BUILDERS[catalogId]();
  }
  if (catalogId === 'tatami_tea_table') {
    return uc();
  }
  if (catalogId === 'sakura_bonsai_pot') {
    return pc();
  }
  if (catalogId === 'shoji_floor_lamp') {
    return dc();
  }
  if (catalogId === 'tactical_sofa_lounge') {
    const grp = new i.Group();
    const rug = bc();
    rug.position.set(0.35, 0, 0.25);
    grp.add(rug);
    grp.add(lc());
    return grp;
  }
  if (catalogId === 'arcade_blitz_cab') {
    const grp = new i.Group();
    grp.add(Bc());
    const chair = Pc();
    chair.position.set(0, 0, 0.55);
    chair.rotation.y = Math.PI;
    grp.add(chair);
    return grp;
  }
  if (catalogId === 'nft_golden_katana_rack') {
    const grp = wc();
    // Add 3 Golden Shogun Katanas mounted on stand atop the original `wc` credenza
    const t = O();
    t.box(D, -0.34, 0.78, 0, 0.04, 0.42, 0.16, { r: 0.006 }).box(
      D,
      0.34,
      0.78,
      0,
      0.04,
      0.42,
      0.16,
      { r: 0.006 },
    );
    for (const ky of [0.68, 0.82, 0.96]) {
      t.box(ro, 0, ky, 0, 1.18, 0.028, 0.036, { r: 0.006 });
    }
    t.flush(grp);
    return grp;
  }
  if (catalogId === 'nft_holo_command_globe') {
    const grp = new i.Group();
    const table = hc();
    table.scale.setScalar(1.25);
    grp.add(table);
    const globe = new i.Mesh(
      new i.SphereGeometry(0.38, 20, 14),
      new i.MeshBasicMaterial({ color: '#00f5d4', wireframe: true }),
    );
    globe.name = 'HoloCommandGlobeSphere';
    globe.position.set(0, 1.08, 0);
    grp.add(globe);
    return grp;
  }
  return uc();
}
