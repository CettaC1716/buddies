import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { evaluateLanternCoreAndSpriteState } from './buddiesCityLightingAndTrafficRules';

/**
 * Shared 1:1 Ornate Dual-Basket Aged-Bronze Victorian Lamppost kit matching the
 * Central Urban Plaza / Central Park bronze lampposts (`buddiesCentralParkBuilder.ts`).
 * Reused across Central Plaza promenades & the Municipal Hall planter beds so every
 * single-lantern dual-basket lamppost shares crisp fluted bronze, scrolled brackets,
 * 3-chain woven wicker baskets, brass socket, Edison pear bulb, and bevelled glass.
 */
export interface OrnateBronzeLampKit {
  spawnLamppost: (params: {
    parent: THREE.Object3D;
    x: number;
    y: number;
    z: number;
    rotY: number;
    scale: number;
    onBasketPoint?: (basketCenterLocal: THREE.Vector3, scale: number, side: -1 | 1) => void;
  }) => THREE.Group;
  updateGlow: (streetLampBrightness01: number) => void;
}

function makeLampCanvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace,
): THREE.CanvasTexture {
  const can =
    typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!can) {
    const tex = new THREE.DataTexture(new Uint8Array([140, 128, 108, 255]), 1, 1, THREE.RGBAFormat);
    tex.colorSpace = colorSpace;
    tex.needsUpdate = true;
    return tex as unknown as THREE.CanvasTexture;
  }
  can.width = w;
  can.height = h;
  const ctx = can.getContext('2d');
  if (ctx) {
    draw(ctx, w, h);
  }
  const tex = new THREE.CanvasTexture(can);
  tex.colorSpace = colorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function applyPlanarLampUvs(geo: THREE.BufferGeometry, tileMeters = 1.0): THREE.BufferGeometry {
  const pos = geo.getAttribute('position');
  const norm = geo.getAttribute('normal');
  if (!pos || !norm) return geo;
  const uvs = new Float32Array(pos.count * 2);
  const scale = 1 / Math.max(0.05, tileMeters);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));
    if (ny >= nx && ny >= nz) {
      uvs[i * 2] = x * scale;
      uvs[i * 2 + 1] = z * scale;
    } else if (nx >= nz) {
      uvs[i * 2] = z * scale;
      uvs[i * 2 + 1] = y * scale;
    } else {
      uvs[i * 2] = x * scale;
      uvs[i * 2 + 1] = y * scale;
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return geo;
}

function scaleLampUvs(geo: THREE.BufferGeometry, uScale: number, vScale: number): THREE.BufferGeometry {
  const uv = geo.getAttribute('uv');
  if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * uScale, uv.getY(i) * vScale);
  }
  uv.needsUpdate = true;
  return geo;
}

export function createOrnateBronzeLampKit(options: { isSoftwareGl: boolean }): OrnateBronzeLampKit {
  const { isSoftwareGl } = options;

  const graniteCurbTex = makeLampCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#cfc9bd';
    ctx.fillRect(0, 0, w, h);
    const shades = ['#dbd5c9', '#cbc5b8', '#e3ddd2', '#c3bdb0'];
    const cw = w / 4;
    const ch = h / 4;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        ctx.fillStyle = shades[(r * 3 + c * 5) % shades.length];
        ctx.fillRect(c * cw + 2, r * ch + 2, cw - 4, ch - 4);
      }
    }
    for (let s = 0; s < 400; s++) {
      ctx.fillStyle = s % 2 === 0 ? 'rgba(92, 86, 78, 0.14)' : 'rgba(255, 252, 246, 0.20)';
      ctx.fillRect((s * 97) % w, (s * 173) % h, 2, 2);
    }
  });

  const antiqueBronzeTex = makeLampCanvasTexture(256, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0.0, '#5e584d');
    grad.addColorStop(0.32, '#7d735f');
    grad.addColorStop(0.55, '#6a6253');
    grad.addColorStop(0.82, '#867b65');
    grad.addColorStop(1.0, '#5c554a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 64; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(220, 206, 174, 0.10)' : 'rgba(54, 48, 38, 0.14)';
      ctx.fillRect((i * 19) % w, 0, 2, h);
    }
    for (let hIdx = 0; hIdx < 24; hIdx++) {
      ctx.fillStyle = 'rgba(195, 178, 138, 0.08)';
      ctx.fillRect(0, (hIdx * 23) % h, w, 2);
    }
  });

  const wickerTex = makeLampCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#7a4f28';
    ctx.fillRect(0, 0, w, h);
    const cols = 8;
    const rows = 12;
    const cw = w / cols;
    const ch = h / rows;
    for (let r = 0; r < rows; r++) {
      const shift = (r % 2) * (cw * 0.5);
      for (let c = -1; c <= cols; c++) {
        const x = c * cw + shift;
        const y = r * ch;
        ctx.fillStyle = (r + c) % 2 === 0 ? '#b27f4b' : '#9e6c3a';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x + 2, y + 2, cw - 4, ch - 4, 6);
        } else {
          ctx.rect(x + 2, y + 2, cw - 4, ch - 4);
        }
        ctx.fill();
        ctx.fillStyle = 'rgba(255,228,185,0.22)';
        ctx.fillRect(x + 5, y + 3, cw - 10, 2.5);
      }
    }
  });

  const lanternGlassMap = makeLampCanvasTexture(256, 128, (mCtx, w, h) => {
    mCtx.clearRect(0, 0, w, h);
    const half = w / 2;
    mCtx.fillStyle = 'rgba(228, 240, 250, 0.22)';
    mCtx.fillRect(0, 0, half, h);
    mCtx.strokeStyle = 'rgba(255, 250, 232, 0.52)';
    mCtx.lineWidth = 6;
    mCtx.strokeRect(3, 3, half - 6, h - 6);
    mCtx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    mCtx.beginPath();
    mCtx.moveTo(14, 8);
    mCtx.lineTo(42, 8);
    mCtx.lineTo(24, h - 8);
    mCtx.lineTo(8, h - 8);
    mCtx.closePath();
    mCtx.fill();
  });
  lanternGlassMap.wrapS = THREE.ClampToEdgeWrapping;
  lanternGlassMap.wrapT = THREE.ClampToEdgeWrapping;

  const lanternGlassEmissiveMap = makeLampCanvasTexture(256, 128, (eCtx, w, h) => {
    const half = w / 2;
    eCtx.fillStyle = '#382510';
    eCtx.fillRect(0, 0, half, h);
    eCtx.strokeStyle = '#c48a3c';
    eCtx.lineWidth = 6;
    eCtx.strokeRect(3, 3, half - 6, h - 6);
  });
  lanternGlassEmissiveMap.wrapS = THREE.ClampToEdgeWrapping;
  lanternGlassEmissiveMap.wrapT = THREE.ClampToEdgeWrapping;

  const drawFilamentArcs = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    strokeColor: string,
    glowColor: string,
  ) => {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [color, lw] of [
      [glowColor, 5.5],
      [strokeColor, 2.0],
    ] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      for (const cx of [w * 0.25, w * 0.5, w * 0.75, 0, w]) {
        ctx.beginPath();
        ctx.moveTo(cx - 7, h * 0.8);
        ctx.lineTo(cx - 8, h * 0.34);
        ctx.quadraticCurveTo(cx, h * 0.22, cx + 8, h * 0.34);
        ctx.lineTo(cx + 7, h * 0.8);
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  const edisonBulbMap = makeLampCanvasTexture(128, 128, (mCtx, w, h) => {
    const grad = mCtx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, '#f8d27c');
    grad.addColorStop(0.55, '#eab352');
    grad.addColorStop(1.0, '#cf882a');
    mCtx.fillStyle = grad;
    mCtx.fillRect(0, 0, w, h);
    drawFilamentArcs(mCtx, w, h, '#fffcf0', 'rgba(255, 240, 180, 0.55)');
  });
  const edisonBulbEmissiveMap = makeLampCanvasTexture(128, 128, (eCtx, w, h) => {
    const grad = eCtx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, '#6a380c');
    grad.addColorStop(0.55, '#542a08');
    grad.addColorStop(1.0, '#3a1b04');
    eCtx.fillStyle = grad;
    eCtx.fillRect(0, 0, w, h);
    drawFilamentArcs(eCtx, w, h, '#ffffff', 'rgba(255, 212, 118, 0.58)');
  });

  // Materials
  const plinthMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: graniteCurbTex,
    roughness: 0.78,
    metalness: 0.04,
  });
  const bronzeMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: antiqueBronzeTex,
    roughness: 0.34,
    metalness: 0.25,
    emissive: '#221e17',
    emissiveIntensity: 0.22,
  });
  const bronzeDetailMat = new THREE.MeshStandardMaterial({
    color: '#e6dcc8',
    map: antiqueBronzeTex,
    roughness: 0.38,
    metalness: 0.22,
    emissive: '#1e1a14',
    emissiveIntensity: 0.18,
  });
  const wickerMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: wickerTex,
    roughness: 0.85,
    metalness: 0.02,
  });
  const soilMat = new THREE.MeshStandardMaterial({
    color: '#4a3525',
    roughness: 0.94,
    metalness: 0.0,
  });
  const brassSocketMat = new THREE.MeshStandardMaterial({
    color: '#d4a84e',
    roughness: 0.32,
    metalness: 0.62,
  });
  const lanternBulbMat = new THREE.MeshStandardMaterial({
    color: '#fff6d8',
    map: edisonBulbMap,
    emissive: '#ffca64',
    emissiveMap: edisonBulbEmissiveMap,
    emissiveIntensity: 0.12,
    roughness: 0.22,
    metalness: 0.05,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    toneMapped: false,
  });
  const lanternFilamentMat = new THREE.MeshStandardMaterial({
    color: '#fffef2',
    emissive: '#fff4c6',
    emissiveIntensity: 0.15,
    roughness: 0.15,
    metalness: 0.0,
    toneMapped: false,
  });
  const lanternGlassMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: lanternGlassMap,
    emissive: '#ffcf70',
    emissiveMap: lanternGlassEmissiveMap,
    emissiveIntensity: 0.02,
    roughness: 0.16,
    metalness: 0.10,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });

  // Shared Geometries matching Central Park ornate bronze lampposts 1:1
  const plinthGeo = applyPlanarLampUvs(new RoundedBoxGeometry(0.45, 0.11, 0.45, 2, 0.018), 0.9);
  const flangeGeo = new RoundedBoxGeometry(0.36, 0.045, 0.36, 2, 0.010);
  const boltGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.04, 6);
  const pedestalGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.0, 0.11),
      new THREE.Vector2(0.24, 0.11),
      new THREE.Vector2(0.21, 0.22),
      new THREE.Vector2(0.15, 0.40),
      new THREE.Vector2(0.19, 0.56),
      new THREE.Vector2(0.14, 0.72),
      new THREE.Vector2(0.10, 0.88),
      new THREE.Vector2(0.0, 0.88),
    ],
    14,
  );
  const shaftGeo = new THREE.CylinderGeometry(0.068, 0.095, 2.38, 12);
  const fluteGeo = new THREE.CylinderGeometry(0.012, 0.016, 2.15, 5);
  const collarTorusGeo = new THREE.TorusGeometry(0.115, 0.025, 6, 14);
  const collarNeckGeo = new THREE.CylinderGeometry(0.125, 0.085, 0.14, 12);
  const galleryGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.0, 3.38),
      new THREE.Vector2(0.088, 3.38),
      new THREE.Vector2(0.135, 3.43),
      new THREE.Vector2(0.165, 3.47),
      new THREE.Vector2(0.145, 3.50),
      new THREE.Vector2(0.0, 3.50),
    ],
    14,
  );
  const bracketArmGeo = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.0, 0.0),
      new THREE.Vector3(0, 0.16, 0.12),
      new THREE.Vector3(0, 0.24, 0.36),
      new THREE.Vector3(0, 0.22, 0.58),
    ]),
    12,
    0.025,
    6,
    false,
  );
  const bracketScrollGeo = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.0, 0.06),
      new THREE.Vector3(0, 0.12, 0.26),
      new THREE.Vector3(0, 0.21, 0.42),
      new THREE.Vector3(0, 0.14, 0.48),
      new THREE.Vector3(0, 0.10, 0.42),
    ]),
    12,
    0.015,
    5,
    false,
  );
  const wickerBowlGeo = scaleLampUvs(new THREE.CylinderGeometry(0.22, 0.12, 0.22, 12), 2.5, 1.0);
  const soilBedGeo = new THREE.CylinderGeometry(0.202, 0.19, 0.024, 12);
  const bezelBotGeo = new RoundedBoxGeometry(0.218, 0.022, 0.218, 2, 0.004);
  const bezelTopGeo = new RoundedBoxGeometry(0.32, 0.024, 0.32, 2, 0.005);
  const brassSocketGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.0, 3.485),
      new THREE.Vector2(0.03, 3.485),
      new THREE.Vector2(0.026, 3.512),
      new THREE.Vector2(0.022, 3.545),
      new THREE.Vector2(0.0, 3.545),
    ],
    10,
  );
  const edisonBulbGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.0, 3.54),
      new THREE.Vector2(0.021, 3.545),
      new THREE.Vector2(0.027, 3.575),
      new THREE.Vector2(0.048, 3.635),
      new THREE.Vector2(0.054, 3.685),
      new THREE.Vector2(0.04, 3.732),
      new THREE.Vector2(0.018, 3.754),
      new THREE.Vector2(0.0, 3.76),
    ],
    12,
  );
  const filamentCoreGeo = new THREE.CylinderGeometry(0.014, 0.016, 0.095, 8);
  const rawGlassCyl = new THREE.CylinderGeometry(0.198, 0.134, 0.43, 4, 1, true);
  rawGlassCyl.rotateY(Math.PI / 4);
  const lanternGlassGeo = rawGlassCyl.toNonIndexed();
  rawGlassCyl.dispose();
  lanternGlassGeo.computeVertexNormals();
  {
    const gUv = lanternGlassGeo.getAttribute('uv');
    for (let faceStart = 0; faceStart + 5 < gUv.count; faceStart += 6) {
      let minU = Infinity;
      let maxU = -Infinity;
      for (let k = 0; k < 6; k++) {
        const u = gUv.getX(faceStart + k);
        if (u < minU) minU = u;
        if (u > maxU) maxU = u;
      }
      const spanU = Math.max(1e-4, maxU - minU);
      for (let k = 0; k < 6; k++) {
        const uNorm = (gUv.getX(faceStart + k) - minU) / spanU;
        const vNorm = gUv.getY(faceStart + k);
        gUv.setXY(faceStart + k, 0.02 + uNorm * 0.46, 0.02 + vNorm * 0.96);
      }
    }
    gUv.needsUpdate = true;
  }

  const roofCapGeo = new THREE.CylinderGeometry(0.055, 0.25, 0.22, 4);
  const finialOrbGeo = new THREE.SphereGeometry(0.048, 8, 6);
  const finialTipGeo = new THREE.ConeGeometry(0.022, 0.1, 6);

  const upVec = new THREE.Vector3(0, 1, 0);
  const p0Corner = new THREE.Vector3(Math.SQRT1_2 * 0.142, 3.465, Math.SQRT1_2 * 0.142);
  const p1Corner = new THREE.Vector3(Math.SQRT1_2 * 0.208, 3.915, Math.SQRT1_2 * 0.208);
  const mullionLen = p1Corner.distanceTo(p0Corner);
  const mullionGeo = new RoundedBoxGeometry(0.024, mullionLen, 0.024, 2, 0.004);

  const chainSampleTop = new THREE.Vector3(0, 3.25, 0);
  const chainSampleBot = new THREE.Vector3(0.19, 2.68, 0);
  const chainGeo = new THREE.CylinderGeometry(0.007, 0.007, chainSampleTop.distanceTo(chainSampleBot), 4);

  const addMesh = (
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    pos: [number, number, number] = [0, 0, 0],
    rot: [number, number, number] = [0, 0, 0],
    opts?: { castShadow?: boolean; renderOrder?: number },
  ): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(pos[0], pos[1], pos[2]);
    m.rotation.set(rot[0], rot[1], rot[2]);
    m.castShadow = !isSoftwareGl && Boolean(opts?.castShadow);
    m.receiveShadow = !isSoftwareGl;
    if (opts?.renderOrder !== undefined) m.renderOrder = opts.renderOrder;
    parent.add(m);
    return m;
  };

  return {
    spawnLamppost({ parent, x, y, z, rotY, scale, onBasketPoint }) {
      const lGrp = new THREE.Group();
      lGrp.position.set(x, y, z);
      lGrp.rotation.y = rotY;
      lGrp.scale.setScalar(scale);
      parent.add(lGrp);

      // Granite square plinth + bronze anchor plate + 4 bolts
      addMesh(lGrp, plinthGeo, plinthMat, [0, 0.055, 0]);
      addMesh(lGrp, flangeGeo, bronzeMat, [0, 0.13, 0]);
      for (const bx of [-0.13, 0.13]) {
        for (const bz of [-0.13, 0.13]) {
          addMesh(lGrp, boltGeo, bronzeDetailMat, [bx, 0.16, bz]);
        }
      }

      // Fluted bronze pedestal, shaft, collar rings, lantern gallery cup
      addMesh(lGrp, pedestalGeo, bronzeMat, [0, 0, 0], [0, 0, 0], { castShadow: true });
      addMesh(lGrp, shaftGeo, bronzeMat, [0, 2.04, 0], [0, 0, 0], { castShadow: true });
      for (let fl = 0; fl < 8; fl++) {
        const ang = (fl / 8) * Math.PI * 2;
        addMesh(lGrp, fluteGeo, bronzeDetailMat, [
          Math.cos(ang) * 0.078,
          1.98,
          Math.sin(ang) * 0.078,
        ]);
      }
      addMesh(lGrp, collarTorusGeo, bronzeMat, [0, 3.24, 0], [Math.PI * 0.5, 0, 0]);
      addMesh(lGrp, collarNeckGeo, bronzeMat, [0, 3.36, 0]);
      addMesh(lGrp, galleryGeo, bronzeDetailMat);

      // Dual scrolled crossarms & 3-chain hanging woven wicker baskets
      for (const zSide of [-1, 1] as const) {
        const armRotY = zSide > 0 ? 0 : Math.PI;
        addMesh(lGrp, bracketArmGeo, bronzeMat, [0, 3.04, 0], [0, armRotY, 0]);
        addMesh(lGrp, bracketScrollGeo, bronzeDetailMat, [0, 2.98, 0], [0, armRotY, 0]);

        const bz = zSide * 0.56;
        for (let ch = 0; ch < 3; ch++) {
          const cAng = (ch / 3) * Math.PI * 2;
          const topPt = new THREE.Vector3(0, 3.25, bz);
          const botPt = new THREE.Vector3(Math.cos(cAng) * 0.19, 2.68, bz + Math.sin(cAng) * 0.19);
          const mid = topPt.clone().add(botPt).multiplyScalar(0.5);
          const dir = botPt.clone().sub(topPt).normalize();
          const chMesh = addMesh(lGrp, chainGeo, bronzeDetailMat, [mid.x, mid.y, mid.z]);
          chMesh.quaternion.setFromUnitVectors(upVec, dir);
        }
        addMesh(lGrp, wickerBowlGeo, wickerMat, [0, 2.58, bz]);
        addMesh(lGrp, soilBedGeo, soilMat, [0, 2.68, bz]);

        if (onBasketPoint) {
          const basketCenterParent = new THREE.Vector3(0, 2.58 * scale, bz * scale)
            .applyAxisAngle(upVec, rotY)
            .add(new THREE.Vector3(x, y, z));
          onBasketPoint(basketCenterParent, scale, zSide);
        }
      }

      // Square tapering glass lantern + brass socket + Edison bulb + filament + mullions + hood + finial
      addMesh(lGrp, bezelBotGeo, bronzeMat, [0, 3.475, 0]);
      addMesh(lGrp, bezelTopGeo, bronzeMat, [0, 3.905, 0]);
      addMesh(lGrp, brassSocketGeo, brassSocketMat);
      addMesh(lGrp, edisonBulbGeo, lanternBulbMat, [0, 0, 0], [0, 0, 0], { renderOrder: 1 });
      addMesh(lGrp, filamentCoreGeo, lanternFilamentMat, [0, 3.645, 0]);
      addMesh(lGrp, lanternGlassGeo, lanternGlassMat, [0, 3.685, 0], [0, 0, 0], { renderOrder: 2 });

      for (let cr = 0; cr < 4; cr++) {
        const ca = (cr / 4) * Math.PI * 2 + Math.PI / 4;
        const p0 = new THREE.Vector3(Math.cos(ca) * 0.142, 3.465, Math.sin(ca) * 0.142);
        const p1 = new THREE.Vector3(Math.cos(ca) * 0.208, 3.915, Math.sin(ca) * 0.208);
        const dir = p1.clone().sub(p0).normalize();
        const mid = p0.clone().add(p1).multiplyScalar(0.5);
        const m = addMesh(lGrp, mullionGeo, bronzeMat, [mid.x, mid.y, mid.z]);
        m.quaternion.setFromUnitVectors(upVec, dir);
      }
      addMesh(lGrp, roofCapGeo, bronzeMat, [0, 4.02, 0], [0, Math.PI / 4, 0]);
      addMesh(lGrp, finialOrbGeo, bronzeMat, [0, 4.18, 0]);
      addMesh(lGrp, finialTipGeo, bronzeMat, [0, 4.26, 0]);

      return lGrp;
    },
    updateGlow(streetLampBrightness01: number) {
      const coreState = evaluateLanternCoreAndSpriteState(streetLampBrightness01);
      lanternGlassMat.emissiveIntensity = coreState.glassEmissiveIntensity;
      lanternBulbMat.emissiveIntensity = coreState.bulbEmissiveIntensity;
      lanternFilamentMat.emissiveIntensity = coreState.filamentEmissiveIntensity;
    },
  };
}
