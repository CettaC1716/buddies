import * as THREE from 'three';
import type { BlitzWindUniforms } from './buddiesBlitzShadersAndAssets';
import { GRAND_CASINO_MASTERPLAN } from './buddiesGrandCasinoRules';

export interface CasinoFlowerClusterSpec {
  matrix: THREE.Matrix4;
  mainHex: string;
  depthHex: string;
}

export interface BuildGrandCasinoOptions {
  windUniforms: BlitzWindUniforms;
  isSoftwareGl: boolean;
  sharedGlassMat: THREE.Material;
  tagFrostedGlassGeometry: (geo: THREE.BufferGeometry, frostedFactor?: number) => THREE.BufferGeometry;
  upgradeMeshToBlitzWorldMaterial: (
    mesh: THREE.Mesh,
    windUniforms: BlitzWindUniforms,
    tintHex?: string,
    bounceStrength?: number,
  ) => void;
  createBlitzStrokeMesh: (
    sourceGeometry: THREE.BufferGeometry,
    strokeWidth?: number,
    strokeColorHex?: string,
  ) => THREE.Mesh | null;
  bakeStaticGroupMeshes: (
    rootGroup: THREE.Object3D,
    options?: {
      excludeObjects?: Set<THREE.Object3D>;
      minShadowCasterSpan?: number;
    },
  ) => void;
  createLeafPetalShrubInstanced: (
    matrices: THREE.Matrix4[],
    meshName: string,
  ) => THREE.InstancedMesh;
  createFlowerPetalClusterInstanced: (
    specs: CasinoFlowerClusterSpec[],
    meshName: string,
  ) => THREE.InstancedMesh;
  sharedSidewalkPaverTex?: THREE.Texture;
  sharedCurbConcreteTex?: THREE.Texture;
}

export interface GrandCasino3DHandle {
  group: THREE.Group;
  dispose: () => void;
}

/**
 * Continuous 45-degree mitred polyline strip extruder (zero corner Z-fighting).
 */
function createMitredStripGeo(
  pts: readonly [number, number][],
  width: number,
  height: number,
  closedLoop = false,
): THREE.BufferGeometry {
  const n = pts.length;
  const halfW = width * 0.5;
  const y0 = -height * 0.5;
  const y1 = height * 0.5;
  const segCount = closedLoop ? n : n - 1;
  const segRights: [number, number][] = [];

  for (let i = 0; i < segCount; i++) {
    const pA = pts[i];
    const pB = pts[(i + 1) % n];
    const dx = pB[0] - pA[0];
    const dz = pB[1] - pA[1];
    const len = Math.hypot(dx, dz) || 1;
    segRights.push([-dz / len, dx / len]);
  }

  const leftPts: [number, number][] = [];
  const rightPts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    let mx = 0;
    let mz = 0;
    if (!closedLoop && i === 0) {
      mx = segRights[0][0] * halfW;
      mz = segRights[0][1] * halfW;
    } else if (!closedLoop && i === n - 1) {
      mx = segRights[n - 2][0] * halfW;
      mz = segRights[n - 2][1] * halfW;
    } else {
      const rPrev = segRights[(i - 1 + segCount) % segCount];
      const rNext = segRights[i % segCount];
      const sx = rPrev[0] + rNext[0];
      const sz = rPrev[1] + rNext[1];
      const sLen = Math.hypot(sx, sz);
      if (sLen > 1e-5) {
        const ux = sx / sLen;
        const uz = sz / sLen;
        const dot = Math.max(0.25, ux * rPrev[0] + uz * rPrev[1]);
        const miterLen = halfW / dot;
        mx = ux * miterLen;
        mz = uz * miterLen;
      } else {
        mx = rPrev[0] * halfW;
        mz = rPrev[1] * halfW;
      }
    }
    leftPts.push([pts[i][0] - mx, pts[i][1] - mz]);
    rightPts.push([pts[i][0] + mx, pts[i][1] + mz]);
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  const pushQuad = (
    p0: [number, number, number],
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number],
  ) => {
    const ux = p1[0] - p0[0];
    const uy = p1[1] - p0[1];
    const uz = p1[2] - p0[2];
    const vx = p2[0] - p0[0];
    const vy = p2[1] - p0[1];
    const vz = p2[2] - p0[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const nLen = Math.hypot(nx, ny, nz) || 1;
    nx /= nLen;
    ny /= nLen;
    nz /= nLen;

    positions.push(
      p0[0], p0[1], p0[2],
      p1[0], p1[1], p1[2],
      p2[0], p2[1], p2[2],
      p0[0], p0[1], p0[2],
      p2[0], p2[1], p2[2],
      p3[0], p3[1], p3[2],
    );
    for (let k = 0; k < 6; k++) {
      normals.push(nx, ny, nz);
    }
    uvs.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
  };

  for (let i = 0; i < segCount; i++) {
    const nextIdx = (i + 1) % n;
    const l0 = leftPts[i];
    const r0 = rightPts[i];
    const l1 = leftPts[nextIdx];
    const r1 = rightPts[nextIdx];

    const r0Top: [number, number, number] = [r0[0], y1, r0[1]];
    const r1Top: [number, number, number] = [r1[0], y1, r1[1]];
    const l1Top: [number, number, number] = [l1[0], y1, l1[1]];
    const l0Top: [number, number, number] = [l0[0], y1, l0[1]];
    const r0Bot: [number, number, number] = [r0[0], y0, r0[1]];
    const r1Bot: [number, number, number] = [r1[0], y0, r1[1]];
    const l1Bot: [number, number, number] = [l1[0], y0, l1[1]];
    const l0Bot: [number, number, number] = [l0[0], y0, l0[1]];

    pushQuad(r0Top, r1Top, l1Top, l0Top);
    pushQuad(l0Bot, l1Bot, r1Bot, r0Bot);
    pushQuad(r0Bot, r1Bot, r1Top, r0Top);
    pushQuad(l1Bot, l0Bot, l0Top, l1Top);
    if (!closedLoop && i === 0) {
      pushQuad(l0Bot, r0Bot, r0Top, l0Top);
    }
    if (!closedLoop && i === segCount - 1) {
      pushQuad(r1Bot, l1Bot, l1Top, r1Top);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Builds a flat horizontal polygon slab in `(worldX, worldZ)` spanning `[yBottom, yTop]`
 * with metric planar UVs so procedural paver/cobblestone textures tile without distortion.
 */
function createHorizontalPolygonSlabGeo(
  ptsWorldXZ: readonly [number, number][],
  yBottom: number,
  yTop: number,
  uvTileMeters = 2.4,
  uvMapper?: (wx: number, wz: number) => [number, number],
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i < ptsWorldXZ.length; i++) {
    const [wx, wz] = ptsWorldXZ[i];
    if (i === 0) shape.moveTo(wx, -wz);
    else shape.lineTo(wx, -wz);
  }
  shape.closePath();

  const depth = Math.max(0.01, yTop - yBottom);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 12,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, yBottom, 0);

  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  if (pos && uv) {
    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i);
      const wz = pos.getZ(i);
      if (uvMapper) {
        const [u, v] = uvMapper(wx, wz);
        uv.setXY(i, u, v);
      } else {
        uv.setXY(i, wx / uvTileMeters, wz / uvTileMeters);
      }
    }
    uv.needsUpdate = true;
  }
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Builds a Mansard hipped truncated-pyramid roof volume from `(halfX0, halfZ0)` at `y0`
 * to `(halfX1, halfZ1)` at `y1`.
 */
function createMansardFrustumGeo(
  halfX0: number,
  halfZ0: number,
  halfX1: number,
  halfZ1: number,
  height: number,
): THREE.BufferGeometry {
  const hy = height * 0.5;
  const b0: [number, number, number] = [-halfX0, -hy, -halfZ0];
  const b1: [number, number, number] = [halfX0, -hy, -halfZ0];
  const b2: [number, number, number] = [halfX0, -hy, halfZ0];
  const b3: [number, number, number] = [-halfX0, -hy, halfZ0];

  const t0: [number, number, number] = [-halfX1, hy, -halfZ1];
  const t1: [number, number, number] = [halfX1, hy, -halfZ1];
  const t2: [number, number, number] = [halfX1, hy, halfZ1];
  const t3: [number, number, number] = [-halfX1, hy, halfZ1];

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  const pushFace = (
    p0: [number, number, number],
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number],
  ) => {
    const ux = p1[0] - p0[0];
    const uy = p1[1] - p0[1];
    const uz = p1[2] - p0[2];
    const vx = p2[0] - p0[0];
    const vy = p2[1] - p0[1];
    const vz = p2[2] - p0[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;

    positions.push(
      p0[0], p0[1], p0[2],
      p1[0], p1[1], p1[2],
      p2[0], p2[1], p2[2],
      p0[0], p0[1], p0[2],
      p2[0], p2[1], p2[2],
      p3[0], p3[1], p3[2],
    );
    for (let k = 0; k < 6; k++) normals.push(nx, ny, nz);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
  };

  pushFace(b2, b1, t1, t2);
  pushFace(b0, b3, t3, t0);
  pushFace(b3, b2, t2, t3);
  pushFace(b1, b0, t0, t1);
  pushFace(t3, t2, t1, t0);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Builds a classical triangular pediment prism facing +X (`widthZ` along Z, `riseY` along Y, `depthX` along X).
 */
function createClassicalPedimentGeo(
  widthZ: number,
  riseY: number,
  depthX: number,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-widthZ * 0.5, 0);
  shape.lineTo(widthZ * 0.5, 0);
  shape.lineTo(0, riseY);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depthX,
    bevelEnabled: false,
  });
  // ExtrudeGeometry extrudes along +Z; rotateY(PI/2) maps shape X -> -Z, shape Y -> +Y, depth +Z -> +X
  geo.rotateY(Math.PI / 2);
  geo.translate(-depthX * 0.5, 0, 0);
  geo.computeVertexNormals();
  return geo;
}

export function buildGrandCasino3D(options: BuildGrandCasinoOptions): GrandCasino3DHandle {
  const {
    windUniforms,
    isSoftwareGl,
    sharedGlassMat,
    tagFrostedGlassGeometry,
    upgradeMeshToBlitzWorldMaterial,
    createBlitzStrokeMesh,
    bakeStaticGroupMeshes,
    createLeafPetalShrubInstanced,
    createFlowerPetalClusterInstanced,
    sharedSidewalkPaverTex,
    sharedCurbConcreteTex,
  } = options;

  const root = new THREE.Group();
  root.name = 'NorthGrandCasinoDistrict3D';

  const staticGroup = new THREE.Group();
  staticGroup.name = 'GrandCasinoStaticBakedGroup';
  root.add(staticGroup);

  const dynamicFoliageGroup = new THREE.Group();
  dynamicFoliageGroup.name = 'GrandCasinoFoliageGroup';
  root.add(dynamicFoliageGroup);

  const disposableTextures: THREE.Texture[] = [];
  const disposableGeos: THREE.BufferGeometry[] = [];

  // Beaux-Arts / Second Empire Palette (matching 4-View Model Sheet)
  const COL_LIMESTONE_MAIN = '#efe5d0';
  const COL_LIMESTONE_WARM = '#e4d6bc';
  const COL_LIMESTONE_PLINTH = '#d4c5a8';
  const COL_LIMESTONE_TRIM = '#f6efe0';
  const COL_GRANITE_CURB = '#cbc6bc';
  const COL_SLATE_ROOF = '#4e5b69';
  const COL_SLATE_DARK = '#38434f';
  const COL_COPPER_VERDIGRIS = '#6eb09b';
  const COL_COPPER_DEEP = '#508c79';
  const COL_COPPER_HIGHLIGHT = '#89c7b2';
  const COL_GOLD_MAIN = '#d8a83e';
  const COL_GOLD_BRIGHT = '#f0c764';
  const COL_GOLD_BRONZE = '#9a7224';
  const COL_RED_CARPET = '#b8262e';
  const COL_RED_CARPET_TRIM = '#e3b94b';
  const COL_WROUGHT_IRON = '#2d3640';
  const COL_WINDOW_FRAME = '#3d372e';
  const COL_WARM_LOBBY_GLOW = '#ffe094';
  const COL_WARM_WINDOW = '#f5d284';
  const COL_SERVICE_DOOR = '#785437';
  const COL_SOIL_DARK = '#59402b';

  // Procedural Canvas Textures (stone pavers & granite fan cobblestone)
  const sidewalkPaverTex = (() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ddd6c7';
      ctx.fillRect(0, 0, 256, 256);
      const shades = ['#e5dfd1', '#d7d0c0', '#dfd8c9', '#cfc7b6'];
      const n = 4;
      const cell = 256 / n;
      for (let r = 0; r < n; r++) {
        const off = (r % 2) * (cell * 0.5);
        for (let col = -1; col <= n; col++) {
          ctx.fillStyle = shades[(r * 3 + col + 4) % shades.length];
          ctx.fillRect(col * cell + off + 2, r * cell + 2, cell - 4, cell - 4);
        }
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    disposableTextures.push(t);
    return t;
  })();

  const valetCobbleTex = (() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#c4c9d1';
      ctx.fillRect(0, 0, 512, 512);
      const cols = ['#d5dae2', '#bfc5ce', '#dce0e7', '#b4bac4'];
      const sx = 128;
      const sy = 86;
      for (let row = -1; row <= 7; row++) {
        const cy = row * sy;
        const shift = (row % 2) * (sx * 0.5);
        for (let col = -1; col <= 5; col++) {
          const cx = col * sx + shift;
          for (let ring = 4; ring >= 1; ring--) {
            const rad = ring * 18;
            ctx.beginPath();
            ctx.arc(cx, cy, rad, Math.PI * 1.12, Math.PI * 1.88);
            ctx.strokeStyle = cols[(row + col + ring + 8) % cols.length];
            ctx.lineWidth = 14;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy, rad + 7, Math.PI * 1.1, Math.PI * 1.9);
            ctx.strokeStyle = '#8b919c';
            ctx.lineWidth = 2.0;
            ctx.stroke();
          }
        }
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    disposableTextures.push(t);
    return t;
  })();

  const addOpaquePart = (
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    colorHex: string,
    pos: [number, number, number],
    rot: [number, number, number] = [0, 0, 0],
    strokeWidth = 0.012,
    castShadow = true,
    tex?: THREE.Texture,
    emissiveHex?: string,
    bounceStrength = 0.28,
  ): THREE.Mesh => {
    const mat = new THREE.MeshStandardMaterial({
      color: tex ? 0xffffff : colorHex,
      map: tex ?? null,
      roughness: 0.65,
      metalness: 0.08,
      emissive: emissiveHex ? new THREE.Color(emissiveHex) : new THREE.Color(0x000000),
      emissiveIntensity: emissiveHex ? 0.55 : 0.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.rotation.set(rot[0], rot[1], rot[2]);
    mesh.castShadow = !isSoftwareGl && castShadow;
    mesh.receiveShadow = !isSoftwareGl;
    mesh.raycast = () => {};
    upgradeMeshToBlitzWorldMaterial(mesh, windUniforms, colorHex, bounceStrength);
    if (strokeWidth > 0) {
      const st = createBlitzStrokeMesh(geo, strokeWidth);
      if (st) mesh.add(st);
    }
    parent.add(mesh);
    return mesh;
  };

  // Shared Reusable Unit Geometries
  const unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);
  const colShaftGeo = new THREE.CylinderGeometry(0.42, 0.47, 1.0, 14);
  const colCapBellGeo = new THREE.CylinderGeometry(0.62, 0.43, 0.68, 12);
  const balusterGeo = new THREE.CylinderGeometry(0.09, 0.12, 0.72, 8);
  const urnBodyGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.28, 0.02),
      new THREE.Vector2(0.22, 0.16),
      new THREE.Vector2(0.16, 0.28),
      new THREE.Vector2(0.42, 0.56),
      new THREE.Vector2(0.48, 0.76),
      new THREE.Vector2(0.54, 0.84),
      new THREE.Vector2(0.46, 0.88),
    ],
    12,
  );
  disposableGeos.push(unitBoxGeo, colShaftGeo, colCapBellGeo, balusterGeo, urnBodyGeo);

  const addScaledBox = (
    parent: THREE.Object3D,
    sx: number,
    sy: number,
    sz: number,
    colorHex: string,
    pos: [number, number, number],
    rot: [number, number, number] = [0, 0, 0],
    strokeWidth = 0.011,
    castShadow = true,
    emissiveHex?: string,
  ) => {
    const g = new THREE.BoxGeometry(sx, sy, sz);
    disposableGeos.push(g);
    return addOpaquePart(parent, g, colorHex, pos, rot, strokeWidth, castShadow, undefined, emissiveHex);
  };

  // Leaf-Petal Shrub & Flower Collectors (calm-wind pure dark-green topiaries & garden blooms)
  const shrubMatrices: THREE.Matrix4[] = [];
  const flowerSpecs: CasinoFlowerClusterSpec[] = [];
  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3();
  const tmpEuler = new THREE.Euler();

  const pushLeafShrubCluster = (
    wx: number,
    wy: number,
    wz: number,
    rx: number,
    ry: number,
    rz: number,
    yaw = 0,
  ) => {
    tmpPos.set(wx, wy, wz);
    tmpEuler.set(0, yaw, 0);
    tmpQuat.setFromEuler(tmpEuler);
    tmpScale.set(rx, ry, rz);
    const m = new THREE.Matrix4();
    m.compose(tmpPos, tmpQuat, tmpScale);
    shrubMatrices.push(m);
  };

  const pushFlowerCluster = (
    wx: number,
    wy: number,
    wz: number,
    rx: number,
    ry: number,
    rz: number,
    isPink: boolean,
    yaw = 0,
  ) => {
    tmpPos.set(wx, wy, wz);
    tmpEuler.set(0, yaw, 0);
    tmpQuat.setFromEuler(tmpEuler);
    tmpScale.set(rx, ry, rz);
    const m = new THREE.Matrix4();
    m.compose(tmpPos, tmpQuat, tmpScale);
    flowerSpecs.push({
      matrix: m,
      mainHex: isPink ? '#f48fb1' : '#b388eb',
      depthHex: isPink ? '#c95b82' : '#7e52b8',
    });
  };

  // Helper: Classical Stone Urn with Conical or Ball Swaying Leaf-Petal Topiary
  const addUrnTopiary = (
    wx: number,
    wy: number,
    wz: number,
    style: 'conical' | 'ball',
    scale = 1.0,
  ) => {
    addScaledBox(
      staticGroup,
      0.86 * scale,
      0.34 * scale,
      0.86 * scale,
      COL_LIMESTONE_PLINTH,
      [wx, wy + 0.17 * scale, wz],
      [0, 0, 0],
      0.009,
    );
    const urnMesh = addOpaquePart(
      staticGroup,
      urnBodyGeo,
      COL_LIMESTONE_WARM,
      [wx, wy + 0.34 * scale, wz],
      [0, 0, 0],
      0.008,
    );
    urnMesh.scale.setScalar(scale);

    const soilCyl = new THREE.CylinderGeometry(0.42 * scale, 0.40 * scale, 0.08 * scale, 10);
    disposableGeos.push(soilCyl);
    addOpaquePart(
      staticGroup,
      soilCyl,
      COL_SOIL_DARK,
      [wx, wy + 1.16 * scale, wz],
      [0, 0, 0],
      0,
      false,
    );

    if (style === 'ball') {
      pushLeafShrubCluster(
        wx,
        wy + 1.62 * scale,
        wz,
        0.64 * scale,
        0.62 * scale,
        0.64 * scale,
        wx * 0.37 + wz * 0.23,
      );
    } else {
      pushLeafShrubCluster(wx, wy + 1.52 * scale, wz, 0.62 * scale, 0.50 * scale, 0.62 * scale, 0.4);
      pushLeafShrubCluster(wx, wy + 2.02 * scale, wz, 0.46 * scale, 0.46 * scale, 0.46 * scale, 1.7);
      pushLeafShrubCluster(wx, wy + 2.44 * scale, wz, 0.30 * scale, 0.42 * scale, 0.30 * scale, 3.1);
    }
  };

  // =========================================================================
  // 1. LOT-CONFORMING SIDEWALKS, VALET COBBLESTONE APRON, MEDIAN ISLAND,
  //    CURVED SOUTH PLAZA CONNECTOR & CURVED NORTH HILL-CONTOUR GARDEN
  // =========================================================================
  const cz = GRAND_CASINO_MASTERPLAN.centerZ; // -70.6
  const mb = GRAND_CASINO_MASTERPLAN.mainBuilding;
  const pc = GRAND_CASINO_MASTERPLAN.porteCochere;
  const vl = GRAND_CASINO_MASTERPLAN.valetLoop;
  const mainCx = (mb.minX + mb.maxX) * 0.5; // -88.8
  const innerCurbX = vl.boxCenterX - vl.boxHalfX - vl.laneHalfWidth; // -76.20
  const valetCenterX = vl.boxCenterX - vl.boxHalfX; // -73.50
  const outerIslandWestX = vl.boxCenterX - vl.boxHalfX + vl.laneHalfWidth; // -70.80
  const valetLaneWidth = vl.laneHalfWidth * 2; // 5.40m

  // 1A. Continuous Urban Pedestrian Concrete Sidewalk:
  // - Joins Central Plaza NE Sidewalk at `worldZ = -38.10` with ZERO cross-curb, ZERO height step (`yTop = +0.09m`),
  //   exact matching `#bcc3cc` (`#e6e9ed` post-0.65-lerp) + `lobbySidewalkPaverTex` (`tile = 2.2m`) flagstone grid,
  //   and continuous `#8f96a0` (`#d8dade` post-0.65-lerp) granite curb (`width = 0.20m, yTop = +0.105m`)!
  // - Fills the entire SE roadside island (`"PENUHI JUGA TANAH INI MENJADI TROTOAR"`) smoothly hugging:
  //   1) `dWest` Tram Road West edge (`x = -73.93`, `z = -38.10 .. -44.00`),
  //   2) `dCornerW` Tram Road outer curve (`center (-62.00, -44.00), R = 11.93m` up to `(-63.93, -55.773)`),
  //   3) `dBaseWestOuter` Main Road West edge (`x = -63.93`, `z = -55.773 .. -60.56`) right up to the South Valet Crosswalk,
  //   4) South Valet Loop throat & outer bend (`z = -60.56` + arc `center (-68.30, -68.45), R = 7.91m` up to `(-76.20, -68.45)`),
  //   while leaving the West garden lawn (`x < -76.58`, `z in [-50.2 .. -38.1]`) lush green beside the Plaza railing!
  const valetArcCx = vl.boxCenterX - vl.boxHalfX + vl.cornerRadius; // -68.30
  const valetArcSouthCz = cz + vl.boxHalfZ - vl.cornerRadius; // -68.45
  const valetOuterCurbR = vl.cornerRadius + vl.laneHalfWidth + 0.01; // 7.91m

  const casinoOpenCurbPts: [number, number][] = [
    [-73.93, -38.10], // Flush continuation of Central Plaza East Granite Curb (x = -73.93, z = -38.10)
    [-73.93, -44.00], // Straight northward along dWest Tram Road
  ];
  const tramArcTheta0 = Math.PI;
  const tramArcTheta1 = Math.acos(-1.93 / 11.93);
  for (let s = 1; s <= 14; s++) {
    const th = tramArcTheta0 + (s / 14) * (tramArcTheta1 - tramArcTheta0);
    casinoOpenCurbPts.push([
      -62.0 + Math.cos(th) * 11.93,
      -44.0 - Math.sin(th) * 11.93,
    ]);
  }
  casinoOpenCurbPts.push([-63.93, -60.56]); // Straight northward along x = -60 Main Road to South Valet Crosswalk
  for (let s = 0; s <= 12; s++) {
    const ang = Math.PI * 0.5 + (s / 12) * (Math.PI * 0.5);
    casinoOpenCurbPts.push([
      valetArcCx + Math.cos(ang) * valetOuterCurbR,
      valetArcSouthCz + Math.sin(ang) * valetOuterCurbR,
    ]);
  }
  casinoOpenCurbPts.push(
    [innerCurbX, -87.20], // Continuous East Staging & Valet Drop-Off inner curb
    [-75.05, -90.60], // Curves into North Garden Promenade
    [-74.85, -95.20], // Tapering NE along the curved North lot
    [-76.50, -100.20], // North tip of formal Casino garden (keeps (-66.5, -82.0) > 10m away!)
    [-80.40, -101.40], // Rounded North garden apex
    [-87.20, -98.80], // Follows graded NW hill toe contour
    [-94.80, -94.80], // Follows graded NW hill toe contour
    [-101.55, -90.80], // Joins rear West service sidewalk NW corner
    [-101.55, -50.20], // Rear West service sidewalk SW corner
    [-77.45, -50.20], // South Casino edge framing North side of West green lawn
    [-76.58, -46.80], // Aligns smoothly with Central Plaza West sidewalk edge (-76.58)
    [-76.58, -38.10], // Terminates flush at Central Plaza Retaining Wall NE corner (leaving z = -38.10 walkway 100% open!)
  );

  const plazaMatchedSidewalkTint = `#${new THREE.Color('#bcc3cc')
    .lerp(new THREE.Color('#ffffff'), 0.65)
    .getHexString()}`;
  const plazaMatchedCurbTint = `#${new THREE.Color('#8f96a0')
    .lerp(new THREE.Color('#ffffff'), 0.65)
    .getHexString()}`;

  const mainSidewalkSlabGeo = createHorizontalPolygonSlabGeo(
    casinoOpenCurbPts,
    -0.06,
    0.09,
    2.2,
    (wx, wz) => [(wx + 76.58) / 2.2, (-10.0 - wz) / 2.2],
  );
  disposableGeos.push(mainSidewalkSlabGeo);
  addOpaquePart(
    staticGroup,
    mainSidewalkSlabGeo,
    sharedSidewalkPaverTex ? plazaMatchedSidewalkTint : '#e5dfd2',
    [0, 0, 0],
    [0, 0, 0],
    0,
    false,
    sharedSidewalkPaverTex ?? sidewalkPaverTex,
    undefined,
    0.08,
  );

  // Open-Ended Continuous Mitred Granite Curb (`closedLoop = false` so NO curb crosses the z = -38.10 Plaza seam!)
  const mainSidewalkCurbGeo = createMitredStripGeo(casinoOpenCurbPts, 0.20, 0.145, false);
  disposableGeos.push(mainSidewalkCurbGeo);
  addOpaquePart(
    staticGroup,
    mainSidewalkCurbGeo,
    sharedCurbConcreteTex ? plazaMatchedCurbTint : '#8f96a0',
    [0, 0.0325, 0],
    [0, 0, 0],
    0.009,
    false,
    sharedCurbConcreteTex,
    undefined,
    0.08,
  );

  // 1B. Fan-Pattern Granite Cobblestone Valet Drop-Off Apron under Porte-Cochere (`y = +0.022m`)
  const cobbleHalfZ = pc.halfZ + 0.35; // 4.50m
  const cobbleApronPts: [number, number][] = [
    [innerCurbX, cz + cobbleHalfZ],
    [outerIslandWestX, cz + cobbleHalfZ],
    [outerIslandWestX, cz - cobbleHalfZ],
    [innerCurbX, cz - cobbleHalfZ],
  ];
  const cobbleApronGeo = createHorizontalPolygonSlabGeo(cobbleApronPts, -0.02, 0.022, 2.8);
  disposableGeos.push(cobbleApronGeo);
  addOpaquePart(
    staticGroup,
    cobbleApronGeo,
    '#dadde4',
    [0, 0, 0],
    [0, 0, 0],
    0,
    false,
    valetCobbleTex,
  );
  // Crisp Granite Threshold Strips framing North & South ends of the Cobblestone Valet Apron
  for (const zSign of [-1, 1] as const) {
    addScaledBox(
      staticGroup,
      valetLaneWidth,
      0.032,
      0.24,
      COL_GRANITE_CURB,
      [valetCenterX, 0.016, cz + zSign * cobbleHalfZ],
      [0, 0, 0],
      0.005,
      false,
    );
  }

  // 1C. D-Shaped Landscaped Median Island between Semi-Circular Valet Loop & x = -60.0 Main Road
  // Exact match to `sdRoundedBox2D(-64.05, -70.60, 9.45, 7.35, 5.20)` inner edge:
  // Arc centers at `(-68.30, -68.45)` and `(-68.30, -72.75)` with inner asphalt radius `R_in = 2.50m`!
  const arcCx = vl.boxCenterX - vl.boxHalfX + vl.cornerRadius; // -68.30
  const arcSouthCz = cz + vl.boxHalfZ - vl.cornerRadius; // -68.45
  const arcNorthCz = cz - vl.boxHalfZ + vl.cornerRadius; // -72.75
  const islandArcRad = vl.cornerRadius - vl.laneHalfWidth - 0.10; // 2.40m (curb outer face at 2.56m)

  const medianPts: [number, number][] = [];
  medianPts.push([-64.05, arcSouthCz + islandArcRad]);
  for (let s = 0; s <= 10; s++) {
    const ang = Math.PI * 0.5 + (s / 10) * (Math.PI * 0.5);
    medianPts.push([
      arcCx + Math.cos(ang) * islandArcRad,
      arcSouthCz + Math.sin(ang) * islandArcRad,
    ]);
  }
  for (let s = 0; s <= 10; s++) {
    const ang = Math.PI + (s / 10) * (Math.PI * 0.5);
    medianPts.push([
      arcCx + Math.cos(ang) * islandArcRad,
      arcNorthCz + Math.sin(ang) * islandArcRad,
    ]);
  }
  medianPts.push([-64.05, arcNorthCz - islandArcRad]);

  const medianSlabGeo = createHorizontalPolygonSlabGeo(medianPts, -0.06, 0.14, 2.4);
  disposableGeos.push(medianSlabGeo);
  addOpaquePart(
    staticGroup,
    medianSlabGeo,
    '#dcd5c6',
    [0, 0, 0],
    [0, 0, 0],
    0,
    false,
    sidewalkPaverTex,
  );
  const medianCurbGeo = createMitredStripGeo(medianPts, 0.32, 0.24, true);
  disposableGeos.push(medianCurbGeo);
  addOpaquePart(
    staticGroup,
    medianCurbGeo,
    COL_GRANITE_CURB,
    [0, 0.06, 0],
    [0, 0, 0],
    0.008,
    false,
  );

  // Recessed Lush Turf Bed & 4 Signature Ball Topiaries along the East Roadside of the Median Island
  const topiaryX = vl.medianIsland.topiaryX; // -65.55
  addScaledBox(
    staticGroup,
    1.88,
    0.06,
    7.10,
    '#3d8c40',
    [topiaryX, 0.16, cz],
    [0, 0, 0],
    0.006,
    false,
  );
  const medianBedCurbPts: [number, number][] = [
    [topiaryX - 0.96, cz - 3.58],
    [topiaryX + 0.96, cz - 3.58],
    [topiaryX + 0.96, cz + 3.58],
    [topiaryX - 0.96, cz + 3.58],
  ];
  const medianBedCurbGeo = createMitredStripGeo(medianBedCurbPts, 0.20, 0.12, true);
  disposableGeos.push(medianBedCurbGeo);
  addOpaquePart(staticGroup, medianBedCurbGeo, COL_LIMESTONE_WARM, [0, 0.19, 0], [0, 0, 0], 0.007, false);

  for (const topZ of vl.medianIsland.topiaryZs) {
    const ringCyl = new THREE.CylinderGeometry(0.56, 0.60, 0.18, 12);
    disposableGeos.push(ringCyl);
    addOpaquePart(
      staticGroup,
      ringCyl,
      COL_LIMESTONE_PLINTH,
      [topiaryX, 0.24, topZ],
      [0, 0, 0],
      0.007,
      false,
    );
    pushLeafShrubCluster(topiaryX, 0.68, topZ, 0.68, 0.64, 0.68, topZ * 0.41);
  }

  // Outer Curved Granite Road Curbs framing the North & South Valet Loop Sweeps (`R_outer = 7.90m`)
  const outerSweepRad = vl.cornerRadius + vl.laneHalfWidth + 0.12; // 8.02m
  for (const side of [-1, 1] as const) {
    const arcCenterZ = side < 0 ? arcNorthCz : arcSouthCz;
    const outerArcPts: [number, number][] = [];
    outerArcPts.push([-64.0, arcCenterZ + side * outerSweepRad]);
    const steps = 10;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const ang =
        side > 0
          ? Math.PI * 0.5 + t * (Math.PI * 0.5)
          : Math.PI * 1.5 - t * (Math.PI * 0.5);
      outerArcPts.push([
        arcCx + Math.cos(ang) * outerSweepRad,
        arcCenterZ + Math.sin(ang) * outerSweepRad,
      ]);
    }
    const outerCurbGeo = createMitredStripGeo(outerArcPts, 0.34, 0.20, false);
    disposableGeos.push(outerCurbGeo);
    addOpaquePart(staticGroup, outerCurbGeo, COL_GRANITE_CURB, [0, 0.04, 0], [0, 0, 0], 0.007, false);
  }

  // =========================================================================
  // 2. MONUMENTAL BEAUX-ARTS MAIN BUILDING (`33.6m x 18.0m x 23.25m`)
  // =========================================================================
  const mainW = mb.maxX - mb.minX; // 18.0
  const mainL = mb.maxZ - mb.minZ; // 33.6
  const foyerSpanZ = mb.foyerHalfZ * 2; // 14.4

  // 2A. Stepped Granite & Rusticated Limestone Plinth Base (`y = 0.08 .. 0.72m`)
  addScaledBox(staticGroup, mainW + 0.68, 0.64, mainL + 0.68, COL_LIMESTONE_PLINTH, [mainCx, 0.40, cz], [0, 0, 0], 0.014);
  addScaledBox(staticGroup, 1.95, 0.64, foyerSpanZ + 0.68, COL_LIMESTONE_PLINTH, [mb.foyerEastMaxX - 0.72, 0.40, cz], [0, 0, 0], 0.014);
  addScaledBox(staticGroup, 1.45, 0.64, 12.8, COL_LIMESTONE_PLINTH, [mb.foyerWestMinX + 0.55, 0.40, cz], [0, 0, 0], 0.014);

  // 2B. Main 2-Story Cream Limestone Architectural Volumes (`y = 0.72 .. 11.55m`)
  addScaledBox(staticGroup, mainW, 10.85, mainL, COL_LIMESTONE_MAIN, [mainCx, 6.14, cz], [0, 0, 0], 0.016);
  addScaledBox(staticGroup, 1.65, 10.85, foyerSpanZ, COL_LIMESTONE_WARM, [mb.foyerEastMaxX - 0.62, 6.14, cz], [0, 0, 0], 0.015);
  addScaledBox(staticGroup, 1.15, 10.85, 12.4, COL_LIMESTONE_WARM, [mb.foyerWestMinX + 0.45, 6.14, cz], [0, 0, 0], 0.015);

  // Ground-Story Horizontal Rustication Bands & Mid-Story Belt Course (`y = 6.42m`)
  for (let bandIdx = 0; bandIdx < 4; bandIdx++) {
    const by = 1.65 + bandIdx * 1.12;
    addScaledBox(staticGroup, mainW + 0.16, 0.10, mainL + 0.16, COL_LIMESTONE_PLINTH, [mainCx, by, cz], [0, 0, 0], 0, false);
  }
  addScaledBox(staticGroup, mainW + 0.56, 0.38, mainL + 0.56, COL_LIMESTONE_TRIM, [mainCx, 6.42, cz], [0, 0, 0], 0.011);
  addScaledBox(staticGroup, 1.95, 0.38, foyerSpanZ + 0.56, COL_LIMESTONE_TRIM, [mb.foyerEastMaxX - 0.62, 6.42, cz], [0, 0, 0], 0.011);
  addScaledBox(staticGroup, 1.45, 0.38, 12.8, COL_LIMESTONE_TRIM, [mb.foyerWestMinX + 0.45, 6.42, cz], [0, 0, 0], 0.011);

  // 2C. Full Classical Entablature (`y = 11.55 .. 12.85m`): Architrave + Gilded Frieze + Modillion Cornice
  addScaledBox(staticGroup, mainW + 0.48, 0.36, mainL + 0.48, COL_LIMESTONE_TRIM, [mainCx, 11.73, cz], [0, 0, 0], 0.011);
  addScaledBox(staticGroup, mainW + 0.42, 0.48, mainL + 0.42, COL_GOLD_MAIN, [mainCx, 12.15, cz], [0, 0, 0], 0.010);
  addScaledBox(staticGroup, mainW + 1.18, 0.46, mainL + 1.18, COL_LIMESTONE_TRIM, [mainCx, 12.62, cz], [0, 0, 0], 0.014);

  addScaledBox(staticGroup, 2.05, 0.36, foyerSpanZ + 0.48, COL_LIMESTONE_TRIM, [mb.foyerEastMaxX - 0.60, 11.73, cz], [0, 0, 0], 0.011);
  addScaledBox(staticGroup, 2.00, 0.48, foyerSpanZ + 0.42, COL_GOLD_MAIN, [mb.foyerEastMaxX - 0.60, 12.15, cz], [0, 0, 0], 0.010);
  addScaledBox(staticGroup, 2.45, 0.46, foyerSpanZ + 1.18, COL_LIMESTONE_TRIM, [mb.foyerEastMaxX - 0.52, 12.62, cz], [0, 0, 0], 0.014);

  addScaledBox(staticGroup, 1.55, 1.28, 13.1, COL_LIMESTONE_TRIM, [mb.foyerWestMinX + 0.42, 12.20, cz], [0, 0, 0], 0.012);

  for (let mz = mb.minZ + 1.2; mz <= mb.maxZ - 1.1; mz += 1.6) {
    const eastX = Math.abs(mz - cz) <= mb.foyerHalfZ ? mb.foyerEastMaxX + 0.35 : mb.maxX + 0.35;
    addScaledBox(staticGroup, 0.42, 0.22, 0.24, COL_LIMESTONE_PLINTH, [eastX, 12.34, mz], [0, 0, 0], 0, false);
  }
  for (let mx = mb.minX + 1.5; mx <= mb.maxX - 1.4; mx += 1.8) {
    addScaledBox(staticGroup, 0.24, 0.22, 0.42, COL_LIMESTONE_PLINTH, [mx, 12.34, mb.minZ - 0.35], [0, 0, 0], 0, false);
    addScaledBox(staticGroup, 0.24, 0.22, 0.42, COL_LIMESTONE_PLINTH, [mx, 12.34, mb.maxZ + 0.35], [0, 0, 0], 0, false);
  }

  // 2D. Paired Corinthian Columns & Engaged Pilasters Helper (`y = 0.72 .. 11.55m`)
  const addCorinthianColumn = (
    wx: number,
    wz: number,
    baseY: number,
    topY: number,
    radiusScale = 1.0,
  ) => {
    const totalH = topY - baseY;
    addScaledBox(
      staticGroup,
      1.26 * radiusScale,
      0.42,
      1.26 * radiusScale,
      COL_LIMESTONE_PLINTH,
      [wx, baseY + 0.21, wz],
      [0, 0, 0],
      0.009,
    );
    const torusGeo = new THREE.CylinderGeometry(0.55 * radiusScale, 0.60 * radiusScale, 0.24, 12);
    disposableGeos.push(torusGeo);
    addOpaquePart(staticGroup, torusGeo, COL_LIMESTONE_TRIM, [wx, baseY + 0.54, wz], [0, 0, 0], 0.008);

    const shaftH = Math.max(1.0, totalH - 1.52);
    const shaftMesh = addOpaquePart(
      staticGroup,
      colShaftGeo,
      COL_LIMESTONE_TRIM,
      [wx, baseY + 0.66 + shaftH * 0.5, wz],
      [0, 0, 0],
      0.010,
    );
    shaftMesh.scale.set(radiusScale, shaftH, radiusScale);

    const collarGeo = new THREE.CylinderGeometry(0.49 * radiusScale, 0.49 * radiusScale, 0.12, 12);
    disposableGeos.push(collarGeo);
    addOpaquePart(staticGroup, collarGeo, COL_GOLD_MAIN, [wx, topY - 0.82, wz], [0, 0, 0], 0.006, false);

    const capBell = addOpaquePart(
      staticGroup,
      colCapBellGeo,
      COL_GOLD_BRIGHT,
      [wx, topY - 0.44, wz],
      [0, 0, 0],
      0.008,
    );
    capBell.scale.set(radiusScale, 1.0, radiusScale);

    addScaledBox(
      staticGroup,
      1.34 * radiusScale,
      0.16,
      1.34 * radiusScale,
      COL_LIMESTONE_TRIM,
      [wx, topY - 0.08, wz],
      [0, 0, 0],
      0.008,
    );
  };

  // Place Monumental Engaged Corinthian Columns across East Front, Side Elevations & West Rear
  for (const colZ of [cz - 15.8, cz - 11.4, cz - 7.8, cz + 7.8, cz + 11.4, cz + 15.8]) {
    addCorinthianColumn(mb.maxX + 0.18, colZ, 0.72, 11.55, 0.92);
  }
  for (const colZ of [cz - 6.35, cz - 4.95, cz + 4.95, cz + 6.35]) {
    addCorinthianColumn(mb.foyerEastMaxX + 0.22, colZ, 0.72, 11.55, 0.96);
  }
  for (const colX of [mainCx - 7.6, mainCx - 2.8, mainCx + 2.8, mainCx + 7.6]) {
    addCorinthianColumn(colX, mb.minZ - 0.16, 0.72, 11.55, 0.90);
    addCorinthianColumn(colX, mb.maxZ + 0.16, 0.72, 11.55, 0.90);
  }
  for (const colZ of [cz - 15.4, cz - 10.4, cz - 5.4, cz + 5.4, cz + 10.4, cz + 15.4]) {
    const westX = Math.abs(colZ - cz) <= 6.2 ? mb.foyerWestMinX - 0.15 : mb.minX - 0.15;
    addCorinthianColumn(westX, colZ, 0.72, 11.55, 0.88);
  }

  // 2E. Beaux-Arts Windows Helper (matching 4-View Model Sheet):
  // - Ground Floor (`Lantai 1`): Classical Triangular Pediment (`fronton` segitiga) on twin carved
  //   stone console corbels + moulded limestone architrave + recessed `2x3` casement panes + sill.
  // - Upper Piano Nobile (`Lantai 2`): Classical Horizontal Cornice Lintel + Carved Center Keystone
  //   + end brackets + moulded limestone architrave + recessed `2x3` casement panes + sill.
  const normalAxisToYaw = (normalAxis: '+X' | '-X' | '+Z' | '-Z') =>
    normalAxis === '+X'
      ? 0
      : normalAxis === '-X'
        ? Math.PI
        : normalAxis === '+Z'
          ? -Math.PI * 0.5
          : Math.PI * 0.5;

  const addUpperPianoNobileWindow = (winGrp: THREE.Object3D) => {
    // Projecting Moulded Stone Sill + Twin Sill Apron Blocks (`y = 7.00 .. 7.34m`)
    addScaledBox(winGrp, 0.36, 0.22, 2.34, COL_LIMESTONE_TRIM, [0.14, 7.22, 0], [0, 0, 0], 0.008);
    addScaledBox(winGrp, 0.24, 0.22, 0.22, COL_LIMESTONE_PLINTH, [0.10, 7.02, -0.82], [0, 0, 0], 0.006, false);
    addScaledBox(winGrp, 0.24, 0.22, 0.22, COL_LIMESTONE_PLINTH, [0.10, 7.02, 0.82], [0, 0, 0], 0.006, false);

    // Deep Recessed Dark Casement Surround + Warm-Lit Glass (`2x3` Muntin Grid)
    addScaledBox(winGrp, 0.14, 2.74, 1.80, COL_WINDOW_FRAME, [0.05, 8.68, 0], [0, 0, 0], 0, false);
    addScaledBox(winGrp, 0.12, 2.58, 1.62, COL_WARM_WINDOW, [0.09, 8.68, 0], [0, 0, 0], 0.005, false, COL_WARM_WINDOW);
    addScaledBox(winGrp, 0.18, 2.62, 0.09, COL_WINDOW_FRAME, [0.13, 8.68, 0], [0, 0, 0], 0, false);
    addScaledBox(winGrp, 0.18, 0.08, 1.64, COL_WINDOW_FRAME, [0.13, 8.22, 0], [0, 0, 0], 0, false);
    addScaledBox(winGrp, 0.18, 0.08, 1.64, COL_WINDOW_FRAME, [0.13, 9.14, 0], [0, 0, 0], 0, false);

    // Moulded Stone Architrave Jambs
    addScaledBox(winGrp, 0.30, 2.78, 0.22, COL_LIMESTONE_TRIM, [0.12, 8.70, -0.94], [0, 0, 0], 0.008);
    addScaledBox(winGrp, 0.30, 2.78, 0.22, COL_LIMESTONE_TRIM, [0.12, 8.70, 0.94], [0, 0, 0], 0.008);

    // Classical Frieze Lintel + Projecting Cornice Hood + Carved Center Keystone + End Corbels
    addScaledBox(winGrp, 0.30, 0.26, 2.18, COL_LIMESTONE_WARM, [0.13, 10.20, 0], [0, 0, 0], 0.008);
    addScaledBox(winGrp, 0.44, 0.22, 2.52, COL_LIMESTONE_TRIM, [0.19, 10.44, 0], [0, 0, 0], 0.009);
    addScaledBox(winGrp, 0.38, 0.42, 0.30, COL_LIMESTONE_PLINTH, [0.17, 10.24, 0], [0, 0, 0], 0.008);
    addScaledBox(winGrp, 0.34, 0.32, 0.18, COL_LIMESTONE_TRIM, [0.15, 10.18, -1.04], [0, 0, 0], 0.007);
    addScaledBox(winGrp, 0.34, 0.32, 0.18, COL_LIMESTONE_TRIM, [0.15, 10.18, 1.04], [0, 0, 0], 0.007);
  };

  const addFacadeWindowPair = (
    wx: number,
    wz: number,
    normalAxis: '+X' | '-X' | '+Z' | '-Z',
  ) => {
    const winGrp = new THREE.Group();
    winGrp.position.set(wx, 0, wz);
    winGrp.rotation.y = normalAxisToYaw(normalAxis);
    staticGroup.add(winGrp);

    // 1) Ground-Floor Classical Pedimented Window (`y = 1.48 .. 5.88m`, matching Front Elevation!)
    addScaledBox(winGrp, 0.38, 0.24, 2.40, COL_LIMESTONE_TRIM, [0.15, 1.78, 0], [0, 0, 0], 0.008);
    addScaledBox(winGrp, 0.26, 0.26, 0.22, COL_LIMESTONE_PLINTH, [0.11, 1.54, -0.86], [0, 0, 0], 0.006, false);
    addScaledBox(winGrp, 0.26, 0.26, 0.22, COL_LIMESTONE_PLINTH, [0.11, 1.54, 0.86], [0, 0, 0], 0.006, false);

    // Deep Recessed Casement Surround + Warm-Lit Glass (`2x3` Casement Panes)
    addScaledBox(winGrp, 0.14, 3.04, 1.84, COL_WINDOW_FRAME, [0.05, 3.42, 0], [0, 0, 0], 0, false);
    addScaledBox(winGrp, 0.12, 2.86, 1.66, COL_WARM_WINDOW, [0.09, 3.42, 0], [0, 0, 0], 0.005, false, COL_WARM_WINDOW);
    addScaledBox(winGrp, 0.18, 2.90, 0.09, COL_WINDOW_FRAME, [0.13, 3.42, 0], [0, 0, 0], 0, false);
    addScaledBox(winGrp, 0.18, 0.08, 1.68, COL_WINDOW_FRAME, [0.13, 2.92, 0], [0, 0, 0], 0, false);
    addScaledBox(winGrp, 0.18, 0.08, 1.68, COL_WINDOW_FRAME, [0.13, 3.92, 0], [0, 0, 0], 0, false);

    // Moulded Limestone Architrave Jambs + Twin Carved Console Corbel Brackets
    addScaledBox(winGrp, 0.30, 3.08, 0.24, COL_LIMESTONE_TRIM, [0.12, 3.44, -0.96], [0, 0, 0], 0.008);
    addScaledBox(winGrp, 0.30, 3.08, 0.24, COL_LIMESTONE_TRIM, [0.12, 3.44, 0.96], [0, 0, 0], 0.008);
    for (const cSign of [-1, 1] as const) {
      addScaledBox(winGrp, 0.40, 0.44, 0.22, COL_LIMESTONE_PLINTH, [0.17, 4.82, cSign * 0.98], [0, 0, 0], 0.007);
      addScaledBox(winGrp, 0.46, 0.18, 0.26, COL_LIMESTONE_TRIM, [0.20, 5.02, cSign * 0.98], [0, 0, 0], 0.006, false);
    }

    // Horizontal Bed-Mould Cornice + Classical Triangular Pediment (`fronton` segitiga)
    addScaledBox(winGrp, 0.38, 0.22, 2.48, COL_LIMESTONE_TRIM, [0.16, 5.10, 0], [0, 0, 0], 0.008);
    const groundPedOuterGeo = createClassicalPedimentGeo(2.58, 0.66, 0.40);
    const groundPedTympGeo = createClassicalPedimentGeo(1.94, 0.42, 0.16);
    disposableGeos.push(groundPedOuterGeo, groundPedTympGeo);
    addOpaquePart(winGrp, groundPedOuterGeo, COL_LIMESTONE_TRIM, [0.17, 5.21, 0], [0, 0, 0], 0.009);
    addOpaquePart(winGrp, groundPedTympGeo, COL_LIMESTONE_WARM, [0.31, 5.28, 0], [0, 0, 0], 0.006, false);

    // 2) Upper-Floor Corniced Piano Nobile Window (`y = 7.00 .. 10.55m`)
    addUpperPianoNobileWindow(winGrp);
  };

  // East Front Wing Windows (2 bays on North Wing + 2 bays on South Wing)
  for (const wz of [cz - 13.6, cz - 9.6, cz + 9.6, cz + 13.6]) {
    addFacadeWindowPair(mb.maxX, wz, '+X');
  }
  // North & South Side Wing Outer Windows (flanking the central Side Service Doors!)
  for (const wx of [mainCx - 5.2, mainCx + 5.2]) {
    addFacadeWindowPair(wx, mb.minZ, '-Z');
    addFacadeWindowPair(wx, mb.maxZ, '+Z');
  }
  // West Rear Elevation Windows (5 symmetrical bays)
  for (const wz of [cz - 12.9, cz - 7.9, cz, cz + 7.9, cz + 12.9]) {
    const westX = Math.abs(wz - cz) <= 6.0 ? mb.foyerWestMinX : mb.minX;
    addFacadeWindowPair(westX, wz, '-X');
  }

  // 2F. North & South Side Service Doors + Upper Piano Nobile Window (matching Side Profile Elevation)
  for (const sideSign of [-1, 1] as const) {
    const sz = sideSign < 0 ? mb.minZ : mb.maxZ;
    const srvGrp = new THREE.Group();
    srvGrp.position.set(mainCx, 0, sz);
    srvGrp.rotation.y = sideSign < 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
    staticGroup.add(srvGrp);

    addScaledBox(srvGrp, 1.45, 0.22, 3.2, COL_GRANITE_CURB, [0.72, 0.19, 0], [0, 0, 0], 0.008);
    addScaledBox(srvGrp, 1.02, 0.22, 2.9, COL_GRANITE_CURB, [0.51, 0.41, 0], [0, 0, 0], 0.008);
    addScaledBox(srvGrp, 0.60, 0.22, 2.6, COL_GRANITE_CURB, [0.30, 0.63, 0], [0, 0, 0], 0.008);

    addScaledBox(srvGrp, 0.32, 3.65, 2.38, COL_LIMESTONE_TRIM, [0.12, 2.55, 0], [0, 0, 0], 0.009);
    addScaledBox(srvGrp, 0.18, 3.25, 1.72, COL_SERVICE_DOOR, [0.10, 2.36, 0], [0, 0, 0], 0.008);
    addScaledBox(srvGrp, 0.22, 0.52, 1.48, COL_WARM_WINDOW, [0.12, 3.55, 0], [0, 0, 0], 0.005, false, COL_WARM_WINDOW);
    addScaledBox(srvGrp, 0.48, 0.28, 2.76, COL_LIMESTONE_TRIM, [0.20, 4.48, 0], [0, 0, 0], 0.009);

    addUpperPianoNobileWindow(srvGrp);

    addUrnTopiary(mainCx - 2.4, 0.09, sz + sideSign * 0.95, 'conical', 0.92);
    addUrnTopiary(mainCx + 2.4, 0.09, sz + sideSign * 0.95, 'conical', 0.92);
  }

  // =========================================================================
  // 3. ROOFTOP BALUSTRADE, STEEP SLATE & COPPER MANSARD ROOF, ORNATE DORMERS
  //    & MONUMENTAL RIBBED VERDIGRIS COPPER DOME (`+23.25m`)
  // =========================================================================
  const roofBalustradePts: [number, number][] = [
    [mb.minX - 0.15, mb.minZ - 0.15],
    [mb.maxX + 0.15, mb.minZ - 0.15],
    [mb.maxX + 0.15, cz - mb.foyerHalfZ - 0.15],
    [mb.foyerEastMaxX + 0.20, cz - mb.foyerHalfZ - 0.15],
    [mb.foyerEastMaxX + 0.20, cz + mb.foyerHalfZ + 0.15],
    [mb.maxX + 0.15, cz + mb.foyerHalfZ + 0.15],
    [mb.maxX + 0.15, mb.maxZ + 0.15],
    [mb.minX - 0.15, mb.maxZ + 0.15],
  ];
  const roofBalBaseGeo = createMitredStripGeo(roofBalustradePts, 0.42, 0.24, true);
  const roofBalRailGeo = createMitredStripGeo(roofBalustradePts, 0.46, 0.18, true);
  disposableGeos.push(roofBalBaseGeo, roofBalRailGeo);
  addOpaquePart(staticGroup, roofBalBaseGeo, COL_LIMESTONE_PLINTH, [0, 12.97, 0], [0, 0, 0], 0.009);
  addOpaquePart(staticGroup, roofBalRailGeo, COL_LIMESTONE_TRIM, [0, 13.86, 0], [0, 0, 0], 0.009);

  for (let bz = mb.minZ + 0.6; bz <= mb.maxZ - 0.5; bz += 0.95) {
    const eastX = Math.abs(bz - cz) <= mb.foyerHalfZ + 0.15 ? mb.foyerEastMaxX + 0.20 : mb.maxX + 0.15;
    addOpaquePart(staticGroup, balusterGeo, COL_LIMESTONE_WARM, [eastX, 13.43, bz], [0, 0, 0], 0, false);
    addOpaquePart(staticGroup, balusterGeo, COL_LIMESTONE_WARM, [mb.minX - 0.15, 13.43, bz], [0, 0, 0], 0, false);
  }
  for (let bx = mb.minX + 0.8; bx <= mb.maxX - 0.7; bx += 0.95) {
    addOpaquePart(staticGroup, balusterGeo, COL_LIMESTONE_WARM, [bx, 13.43, mb.minZ - 0.15], [0, 0, 0], 0, false);
    addOpaquePart(staticGroup, balusterGeo, COL_LIMESTONE_WARM, [bx, 13.43, mb.maxZ + 0.15], [0, 0, 0], 0, false);
  }
  for (const [px, pz] of roofBalustradePts) {
    addScaledBox(staticGroup, 0.68, 1.24, 0.68, COL_LIMESTONE_TRIM, [px, 13.47, pz], [0, 0, 0], 0.009);
    const finSpire = new THREE.ConeGeometry(0.18, 0.68, 8);
    disposableGeos.push(finSpire);
    addOpaquePart(staticGroup, finSpire, COL_COPPER_VERDIGRIS, [px, 14.43, pz], [0, 0, 0], 0.007);
  }

  // 3B. Steep Second-Empire Slate Mansard Roof + Verdigris Copper Ribs & Cresting (`y = 12.90 .. 17.55m`)
  const mainMansardGeo = createMansardFrustumGeo(8.35, 16.05, 6.25, 13.85, 4.65);
  const foyerMansardGeo = createMansardFrustumGeo(4.85, 6.65, 3.55, 5.35, 4.85);
  disposableGeos.push(mainMansardGeo, foyerMansardGeo);
  addOpaquePart(staticGroup, mainMansardGeo, COL_SLATE_ROOF, [mainCx, 15.22, cz], [0, 0, 0], 0.016);
  addOpaquePart(staticGroup, foyerMansardGeo, COL_SLATE_DARK, [mb.foyerEastMaxX - 4.45, 15.32, cz], [0, 0, 0], 0.015);

  const mansardDeckPts: [number, number][] = [
    [mainCx - 6.25, cz - 13.85],
    [mainCx + 6.25, cz - 13.85],
    [mainCx + 6.25, cz + 13.85],
    [mainCx - 6.25, cz + 13.85],
  ];
  const mansardCurbGeo = createMitredStripGeo(mansardDeckPts, 0.44, 0.30, true);
  disposableGeos.push(mansardCurbGeo);
  addOpaquePart(staticGroup, mansardCurbGeo, COL_COPPER_VERDIGRIS, [0, 17.58, 0], [0, 0, 0], 0.010);

  const crestRailGeo = createMitredStripGeo(mansardDeckPts, 0.10, 0.10, true);
  disposableGeos.push(crestRailGeo);
  addOpaquePart(staticGroup, crestRailGeo, COL_WROUGHT_IRON, [0, 18.22, 0], [0, 0, 0], 0.006);
  for (let czIdx = -13.2; czIdx <= 13.25; czIdx += 0.85) {
    addScaledBox(staticGroup, 0.08, 0.62, 0.08, COL_WROUGHT_IRON, [mainCx + 6.25, 18.02, cz + czIdx], [0, 0, 0], 0, false);
    addScaledBox(staticGroup, 0.08, 0.62, 0.08, COL_WROUGHT_IRON, [mainCx - 6.25, 18.02, cz + czIdx], [0, 0, 0], 0, false);
  }
  for (let cxIdx = -5.6; cxIdx <= 5.65; cxIdx += 0.85) {
    addScaledBox(staticGroup, 0.08, 0.62, 0.08, COL_WROUGHT_IRON, [mainCx + cxIdx, 18.02, cz - 13.85], [0, 0, 0], 0, false);
    addScaledBox(staticGroup, 0.08, 0.62, 0.08, COL_WROUGHT_IRON, [mainCx + cxIdx, 18.02, cz + 13.85], [0, 0, 0], 0, false);
  }
  for (const [cpx, cpz] of mansardDeckPts) {
    const spireGeo = new THREE.ConeGeometry(0.16, 1.15, 8);
    disposableGeos.push(spireGeo);
    addOpaquePart(staticGroup, spireGeo, COL_COPPER_VERDIGRIS, [cpx, 18.30, cpz], [0, 0, 0], 0.007);
  }

  // 3C. Ornate Mansard Dormer Windows (Central Grand Segmental Dormer + 6 Wing Dormers)
  const addMansardDormer = (
    wx: number,
    wy: number,
    wz: number,
    rotY: number,
    isGrandCenter = false,
  ) => {
    const dGrp = new THREE.Group();
    dGrp.position.set(wx, wy, wz);
    dGrp.rotation.y = rotY;
    staticGroup.add(dGrp);

    const s = isGrandCenter ? 1.48 : 1.0;
    addScaledBox(dGrp, 1.85 * s, 2.35 * s, 1.86 * s, COL_LIMESTONE_MAIN, [0, 1.18 * s, 0], [0, 0, 0], 0.011);
    addScaledBox(dGrp, 0.18, 1.65 * s, 1.12 * s, COL_WARM_WINDOW, [0.92 * s, 1.12 * s, 0], [0, 0, 0], 0.006, false, COL_WARM_WINDOW);
    addScaledBox(dGrp, 0.24, 1.65 * s, 0.08, COL_WINDOW_FRAME, [0.96 * s, 1.12 * s, 0], [0, 0, 0], 0, false);

    addScaledBox(dGrp, 0.42 * s, 1.45 * s, 0.28 * s, COL_LIMESTONE_TRIM, [0.76 * s, 0.88 * s, -0.98 * s], [0, 0, 0], 0.008);
    addScaledBox(dGrp, 0.42 * s, 1.45 * s, 0.28 * s, COL_LIMESTONE_TRIM, [0.76 * s, 0.88 * s, 0.98 * s], [0, 0, 0], 0.008);

    // Note: `.rotateZ(Math.PI / 2)` alone aligns CylinderGeometry's theta=[0..PI] arch upright facing +X!
    const hoodGeo = new THREE.CylinderGeometry(1.06 * s, 1.06 * s, 1.95 * s, 14, 1, false, 0, Math.PI);
    hoodGeo.rotateZ(Math.PI / 2);
    disposableGeos.push(hoodGeo);
    addOpaquePart(dGrp, hoodGeo, COL_COPPER_VERDIGRIS, [0.02 * s, 2.28 * s, 0], [0, 0, 0], 0.010);

    const ringGeo = new THREE.CylinderGeometry(1.14 * s, 1.14 * s, 0.26 * s, 14, 1, false, 0, Math.PI);
    ringGeo.rotateZ(Math.PI / 2);
    disposableGeos.push(ringGeo);
    addOpaquePart(dGrp, ringGeo, COL_LIMESTONE_TRIM, [0.90 * s, 2.28 * s, 0], [0, 0, 0], 0.009);

    const dormSpire = new THREE.ConeGeometry(0.12 * s, 0.52 * s, 8);
    disposableGeos.push(dormSpire);
    addOpaquePart(dGrp, dormSpire, COL_GOLD_MAIN, [0.88 * s, 3.58 * s, 0], [0, 0, 0], 0.006);
  };

  addMansardDormer(mb.foyerEastMaxX - 1.35, 13.05, cz, 0, true);
  addMansardDormer(mb.maxX - 1.45, 13.55, cz - 11.4, 0, false);
  addMansardDormer(mb.maxX - 1.45, 13.55, cz + 11.4, 0, false);
  addMansardDormer(mainCx, 13.55, mb.minZ + 1.45, Math.PI * 0.5, false);
  addMansardDormer(mainCx, 13.55, mb.maxZ - 1.45, -Math.PI * 0.5, false);
  addMansardDormer(mb.minX + 1.45, 13.55, cz - 9.8, Math.PI, false);
  addMansardDormer(mb.minX + 1.45, 13.55, cz + 9.8, Math.PI, false);

  // 3D. Monumental Ribbed Verdigris Copper Dome (`y = 17.25 .. 24.38m`)
  const domeCx = mb.foyerEastMaxX - 5.2;
  const drumBaseGeo = new THREE.CylinderGeometry(4.75, 4.95, 1.85, 16);
  const drumCorniceGeo = new THREE.CylinderGeometry(5.05, 4.82, 0.34, 16);
  disposableGeos.push(drumBaseGeo, drumCorniceGeo);
  addOpaquePart(staticGroup, drumBaseGeo, COL_LIMESTONE_WARM, [domeCx, 18.05, cz], [0, 0, 0], 0.014);
  addOpaquePart(staticGroup, drumCorniceGeo, COL_COPPER_DEEP, [domeCx, 19.12, cz], [0, 0, 0], 0.011);

  for (let dIdx = 0; dIdx < 12; dIdx++) {
    const ang = (dIdx / 12) * Math.PI * 2;
    const dx = Math.cos(ang);
    const dz = Math.sin(ang);
    const colGeo = new THREE.CylinderGeometry(0.16, 0.18, 1.55, 8);
    disposableGeos.push(colGeo);
    addOpaquePart(staticGroup, colGeo, COL_LIMESTONE_TRIM, [domeCx + dx * 4.82, 18.12, cz + dz * 4.82], [0, 0, 0], 0.006, false);

    const midAng = ang + Math.PI / 12;
    addScaledBox(
      staticGroup,
      0.18,
      0.96,
      0.56,
      COL_WARM_WINDOW,
      [domeCx + Math.cos(midAng) * 4.72, 18.15, cz + Math.sin(midAng) * 4.72],
      [0, -midAng, 0],
      0.005,
      false,
      COL_WARM_WINDOW,
    );
  }

  const domeCupolaGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(4.72, 0.0),
      new THREE.Vector2(4.65, 0.55),
      new THREE.Vector2(4.28, 1.35),
      new THREE.Vector2(3.55, 2.15),
      new THREE.Vector2(2.45, 2.78),
      new THREE.Vector2(1.22, 3.15),
      new THREE.Vector2(0.0, 3.24),
    ],
    20,
  );
  disposableGeos.push(domeCupolaGeo);
  addOpaquePart(staticGroup, domeCupolaGeo, COL_COPPER_VERDIGRIS, [domeCx, 19.26, cz], [0, 0, 0], 0.016);

  const ribCurvePts = [
    new THREE.Vector3(4.74, 0.02, 0),
    new THREE.Vector3(4.32, 1.36, 0),
    new THREE.Vector3(2.50, 2.80, 0),
    new THREE.Vector3(1.10, 3.18, 0),
  ];
  const singleRibGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ribCurvePts), 12, 0.09, 6, false);
  disposableGeos.push(singleRibGeo);
  for (let rIdx = 0; rIdx < 12; rIdx++) {
    addOpaquePart(
      staticGroup,
      singleRibGeo,
      COL_COPPER_HIGHLIGHT,
      [domeCx, 19.26, cz],
      [0, (rIdx / 12) * Math.PI * 2, 0],
      0.005,
      false,
    );
  }

  const lanternDrumGeo = new THREE.CylinderGeometry(1.08, 1.18, 1.15, 10);
  const lanternCapGeo = new THREE.SphereGeometry(1.12, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const orbGeo = new THREE.SphereGeometry(0.28, 10, 8);
  const finialSpireGeo = new THREE.ConeGeometry(0.14, 1.45, 8);
  disposableGeos.push(lanternDrumGeo, lanternCapGeo, orbGeo, finialSpireGeo);
  addOpaquePart(staticGroup, lanternDrumGeo, COL_COPPER_DEEP, [domeCx, 22.85 - 0.88, cz], [0, 0, 0], 0.009);
  addOpaquePart(staticGroup, lanternCapGeo, COL_COPPER_VERDIGRIS, [domeCx, 22.45, cz], [0, 0, 0], 0.009);
  addOpaquePart(staticGroup, orbGeo, COL_GOLD_BRIGHT, [domeCx, 23.62, cz], [0, 0, 0], 0.006);
  addOpaquePart(staticGroup, finialSpireGeo, COL_GOLD_MAIN, [domeCx, 24.38, cz], [0, 0, 0], 0.007);

  // =========================================================================
  // 4. GRAND COVERED PORTE-COCHERE (`5.45m` Valet Clearance, Inset Column
  //    Pedestals Squarely Inside the Median Island, Barrel-Vault Skylight)
  // =========================================================================
  const pcSpanX = pc.maxX - pc.minX; // 10.35m
  const pcCenterX = (pc.minX + pc.maxX) * 0.5;
  const pcWidthZ = pc.halfZ * 2; // 8.30m

  // 4A. Twin Outer Clustered Corinthian Column Piers Inset on the Median Island (`x = -68.85, z = cz ± 2.72`)
  // Compact `1.28m x 1.38m` pedestal footprint guarantees >= 0.75m clearance from the curved asphalt road!
  for (const zSign of [-1, 1] as const) {
    const pierZ = cz + zSign * pc.frontColumnOffsetZ;
    const pierX = pc.frontColumnX;
    // Paneled Limestone Pedestal Base (`y = 0.14 .. 1.48m`, sitting cleanly on `y = 0.14m` Median Island!)
    addScaledBox(staticGroup, 1.28, 0.30, 1.38, COL_GRANITE_CURB, [pierX, 0.27, pierZ], [0, 0, 0], 0.010);
    addScaledBox(staticGroup, 1.12, 0.92, 1.22, COL_LIMESTONE_WARM, [pierX, 0.88, pierZ], [0, 0, 0], 0.011);
    addScaledBox(staticGroup, 1.24, 0.18, 1.34, COL_LIMESTONE_TRIM, [pierX, 1.43, pierZ], [0, 0, 0], 0.009);

    // Paired Clustered Corinthian Columns on each Pedestal (`y = 1.52 .. 5.45m`)
    addCorinthianColumn(pierX, pierZ - 0.32, 1.52, pc.valetClearanceY, 0.54);
    addCorinthianColumn(pierX, pierZ + 0.32, 1.52, pc.valetClearanceY, 0.54);

    // Engaged Matching Columns at the Lobby Foyer Wall (`x = mb.foyerEastMaxX + 0.35`)
    const engagedX = mb.foyerEastMaxX + 0.35;
    addScaledBox(staticGroup, 1.06, 1.36, 1.36, COL_LIMESTONE_WARM, [engagedX - 0.12, 0.78, pierZ], [0, 0, 0], 0.010);
    addCorinthianColumn(engagedX, pierZ - 0.32, 1.46, pc.valetClearanceY, 0.54);
    addCorinthianColumn(engagedX, pierZ + 0.32, 1.46, pc.valetClearanceY, 0.54);
  }

  // 4B. Porte-Cochere Entablature Ring (`y = 5.45 .. 6.55m`) & Coffered Ceiling Soffit
  addScaledBox(staticGroup, pcSpanX, 0.34, pcWidthZ, COL_LIMESTONE_TRIM, [pcCenterX, 5.62, cz], [0, 0, 0], 0.012);
  addScaledBox(staticGroup, pcSpanX - 0.12, 0.44, pcWidthZ - 0.12, COL_GOLD_MAIN, [pcCenterX, 6.01, cz], [0, 0, 0], 0.010);
  addScaledBox(staticGroup, pcSpanX + 0.48, 0.34, pcWidthZ + 0.56, COL_LIMESTONE_TRIM, [pcCenterX + 0.08, 6.40, cz], [0, 0, 0], 0.013);

  for (let cxOff = -3.2; cxOff <= 3.3; cxOff += 3.2) {
    for (const czOff of [-1.95, 1.95]) {
      addScaledBox(
        staticGroup,
        2.5,
        0.08,
        2.1,
        COL_LIMESTONE_WARM,
        [pcCenterX + cxOff, 5.42, cz + czOff],
        [0, 0, 0],
        0.006,
        false,
      );
      addScaledBox(
        staticGroup,
        1.9,
        0.05,
        1.5,
        COL_GOLD_BRIGHT,
        [pcCenterX + cxOff, 5.39, cz + czOff],
        [0, 0, 0],
        0,
        false,
        COL_WARM_LOBBY_GLOW,
      );
    }
  }

  // 4C. Ornate Gilded Classical Triangular Pediment (`x = pc.maxX`, `y = 6.55 .. 8.35m`)
  const pcPedOuterGeo = createClassicalPedimentGeo(pcWidthZ + 0.68, 1.78, 0.70);
  const pcPedTympanumGeo = createClassicalPedimentGeo(pcWidthZ - 1.05, 1.30, 0.34);
  disposableGeos.push(pcPedOuterGeo, pcPedTympanumGeo);
  addOpaquePart(staticGroup, pcPedOuterGeo, COL_LIMESTONE_TRIM, [pc.maxX - 0.12, 6.56, cz], [0, 0, 0], 0.013);
  addOpaquePart(staticGroup, pcPedTympanumGeo, COL_GOLD_MAIN, [pc.maxX + 0.10, 6.68, cz], [0, 0, 0], 0.009);

  const crestMedallionGeo = new THREE.CylinderGeometry(0.56, 0.56, 0.22, 16);
  crestMedallionGeo.rotateZ(Math.PI / 2);
  disposableGeos.push(crestMedallionGeo);
  addOpaquePart(staticGroup, crestMedallionGeo, COL_GOLD_BRIGHT, [pc.maxX + 0.26, 7.28, cz], [0, 0, 0], 0.008, false, undefined, '#ffd56b');
  for (const sSign of [-1, 1] as const) {
    addScaledBox(staticGroup, 0.18, 0.26, 1.55, COL_GOLD_BRIGHT, [pc.maxX + 0.24, 7.06, cz + sSign * 1.35], [sSign * -0.18, 0, 0], 0.006, false);
  }

  // 4D. Barrel-Vaulted Verdigris Copper & Frosted Skylight Glass Canopy (`y = 6.55 .. 8.45m`)
  const vaultArc = Math.PI * 0.56;
  const vaultRadius = 4.75;
  const vaultLength = pcSpanX - 0.55;
  const vaultBaseY = 6.55 - Math.cos(vaultArc * 0.5) * vaultRadius + 0.04;

  const innerSkylightLinerGeo = new THREE.CylinderGeometry(
    vaultRadius - 0.04,
    vaultRadius - 0.04,
    vaultLength - 0.08,
    22,
    1,
    true,
    (Math.PI - vaultArc) * 0.5,
    vaultArc,
  );
  innerSkylightLinerGeo.rotateZ(Math.PI / 2);
  disposableGeos.push(innerSkylightLinerGeo);
  addOpaquePart(
    staticGroup,
    innerSkylightLinerGeo,
    '#bde4ef',
    [pcCenterX - 0.18, vaultBaseY, cz],
    [0, 0, 0],
    0,
    false,
    undefined,
    '#8ac9dc',
  );

  const archVaultGlassGeo = new THREE.CylinderGeometry(
    vaultRadius,
    vaultRadius,
    vaultLength,
    22,
    1,
    true,
    (Math.PI - vaultArc) * 0.5,
    vaultArc,
  );
  archVaultGlassGeo.rotateZ(Math.PI / 2);
  tagFrostedGlassGeometry(archVaultGlassGeo, 0.55);
  disposableGeos.push(archVaultGlassGeo);

  const glassVaultMesh = new THREE.Mesh(archVaultGlassGeo, sharedGlassMat);
  glassVaultMesh.position.set(pcCenterX - 0.18, vaultBaseY, cz);
  glassVaultMesh.raycast = () => {};
  staticGroup.add(glassVaultMesh);

  const vaultRibGeo = new THREE.TorusGeometry(vaultRadius + 0.045, 0.08, 8, 22, vaultArc);
  vaultRibGeo.rotateZ((Math.PI - vaultArc) * 0.5);
  vaultRibGeo.rotateY(Math.PI / 2);
  disposableGeos.push(vaultRibGeo);
  for (let rIdx = 0; rIdx < 7; rIdx++) {
    const rx = pc.minX + 0.45 + (rIdx / 6) * (vaultLength - 0.35);
    addOpaquePart(staticGroup, vaultRibGeo, COL_COPPER_DEEP, [rx, vaultBaseY, cz], [0, 0, 0], 0.006);
  }
  for (const purlinAng of [-vaultArc * 0.28, 0, vaultArc * 0.28]) {
    const py = vaultBaseY + Math.cos(purlinAng) * (vaultRadius + 0.05);
    const pz = cz + Math.sin(purlinAng) * (vaultRadius + 0.05);
    addScaledBox(
      staticGroup,
      vaultLength + 0.16,
      0.12,
      0.15,
      COL_COPPER_VERDIGRIS,
      [pcCenterX - 0.18, py, pz],
      [-purlinAng, 0, 0],
      0.005,
    );
  }

  // 4E. Grand Tiered Brass & Warm-Crystal Chandelier under Porte-Cochere (`lowest point y = 4.54m`)
  const chandX = valetCenterX;
  const chandChainGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.55, 6);
  const chandTier1Geo = new THREE.CylinderGeometry(0.92, 0.80, 0.22, 12);
  const chandTier2Geo = new THREE.CylinderGeometry(0.60, 0.46, 0.20, 12);
  const chandDropGeo = new THREE.SphereGeometry(0.24, 10, 8);
  disposableGeos.push(chandChainGeo, chandTier1Geo, chandTier2Geo, chandDropGeo);
  addOpaquePart(staticGroup, chandChainGeo, COL_GOLD_BRONZE, [chandX, 5.15, cz], [0, 0, 0], 0, false);
  addOpaquePart(staticGroup, chandTier1Geo, COL_GOLD_MAIN, [chandX, 4.88, cz], [0, 0, 0], 0.007, false);
  addOpaquePart(staticGroup, chandTier2Geo, COL_GOLD_BRIGHT, [chandX, 4.68, cz], [0, 0, 0], 0.006, false, undefined, '#ffdf85');
  addOpaquePart(staticGroup, chandDropGeo, COL_WARM_LOBBY_GLOW, [chandX, 4.54, cz], [0, 0, 0], 0, false, undefined, COL_WARM_LOBBY_GLOW);
  for (let cArm = 0; cArm < 8; cArm++) {
    const ca = (cArm / 8) * Math.PI * 2;
    const bulbGeo = new THREE.SphereGeometry(0.11, 8, 6);
    disposableGeos.push(bulbGeo);
    addOpaquePart(
      staticGroup,
      bulbGeo,
      COL_WARM_LOBBY_GLOW,
      [chandX + Math.cos(ca) * 0.92, 4.96, cz + Math.sin(ca) * 0.92],
      [0, 0, 0],
      0,
      false,
      undefined,
      COL_WARM_LOBBY_GLOW,
    );
  }

  // =========================================================================
  // 5. GRAND LOBBY ENTRANCE, CRIMSON RED CARPET, GILDED DOUBLE DOORS,
  //    REFINED BRASS BIRDCAGE BELLHOP CARTS & CENTRAL PLAZA VINTAGE BENCHES
  // =========================================================================
  // 5A. Wide Granite Lobby Steps (`x = -78.40 .. -76.55`) + Plush Crimson Red Carpet Runner
  const stairWidthsZ = [5.1, 4.8, 4.5, 4.2];
  for (let sIdx = 0; sIdx < 4; sIdx++) {
    const stepX = innerCurbX - 0.38 - sIdx * 0.46;
    const stepY = 0.16 + sIdx * 0.14;
    addScaledBox(
      staticGroup,
      0.60,
      0.16,
      stairWidthsZ[sIdx],
      COL_GRANITE_CURB,
      [stepX, stepY, cz],
      [0, 0, 0],
      0.007,
      false,
    );
    addScaledBox(
      staticGroup,
      0.54,
      0.032,
      3.10,
      COL_RED_CARPET,
      [stepX + 0.02, stepY + 0.096, cz],
      [0, 0, 0],
      0.004,
      false,
    );
    addScaledBox(
      staticGroup,
      0.54,
      0.036,
      0.13,
      COL_RED_CARPET_TRIM,
      [stepX + 0.02, stepY + 0.098, cz - 1.48],
      [0, 0, 0],
      0,
      false,
    );
    addScaledBox(
      staticGroup,
      0.54,
      0.036,
      0.13,
      COL_RED_CARPET_TRIM,
      [stepX + 0.02, stepY + 0.098, cz + 1.48],
      [0, 0, 0],
      0,
      false,
    );
  }
  addScaledBox(staticGroup, 1.25, 0.028, 3.10, COL_RED_CARPET, [innerCurbX - 0.68, 0.108, cz], [0, 0, 0], 0.005, false);

  // 5B. Gilded Grand Double Lobby Doors, Sidelights & Transom (`x = mb.foyerEastMaxX`, `y = 0.72 .. 5.20m`)
  const doorWallX = mb.foyerEastMaxX; // -78.40
  addScaledBox(staticGroup, 0.36, 4.55, 4.40, COL_GOLD_BRONZE, [doorWallX + 0.08, 3.00, cz], [0, 0, 0], 0.011);
  addScaledBox(staticGroup, 0.18, 4.15, 3.92, COL_WARM_LOBBY_GLOW, [doorWallX + 0.18, 2.86, cz], [0, 0, 0], 0, false, COL_WARM_LOBBY_GLOW);
  for (const dz of [-1.96, -0.98, 0.0, 0.98, 1.96]) {
    addScaledBox(staticGroup, 0.24, 4.20, 0.13, COL_GOLD_MAIN, [doorWallX + 0.24, 2.88, cz + dz], [0, 0, 0], 0.006, false);
  }
  addScaledBox(staticGroup, 0.26, 0.18, 3.96, COL_GOLD_MAIN, [doorWallX + 0.25, 3.92, cz], [0, 0, 0], 0.006, false);
  addScaledBox(staticGroup, 0.28, 0.92, 0.08, COL_GOLD_BRIGHT, [doorWallX + 0.32, 2.25, cz - 0.18], [0, 0, 0], 0, false);
  addScaledBox(staticGroup, 0.28, 0.92, 0.08, COL_GOLD_BRIGHT, [doorWallX + 0.32, 2.25, cz + 0.18], [0, 0, 0], 0, false);

  // Upper Foyer Piano Nobile Windows flanking the Porte-Cochere Roof Vault (`cz ± 3.55`)
  for (const fz of [cz - 3.55, cz + 3.55]) {
    const fWinGrp = new THREE.Group();
    fWinGrp.position.set(mb.foyerEastMaxX, 0, fz);
    staticGroup.add(fWinGrp);
    addUpperPianoNobileWindow(fWinGrp);
  }

  // 2 Potted Ball Topiaries flanking the Grand Lobby Doors + 4 Conical Topiaries along the Front Wing Facade
  addUrnTopiary(doorWallX + 0.72, 0.09, cz - 3.65, 'ball', 0.92);
  addUrnTopiary(doorWallX + 0.72, 0.09, cz + 3.65, 'ball', 0.92);
  addUrnTopiary(mb.maxX + 0.85, 0.09, cz - 8.15, 'conical', 0.94);
  addUrnTopiary(mb.maxX + 0.85, 0.09, cz + 8.15, 'conical', 0.94);
  addUrnTopiary(mb.maxX + 0.85, 0.09, cz - 15.6, 'conical', 0.94);
  addUrnTopiary(mb.maxX + 0.85, 0.09, cz + 15.6, 'conical', 0.94);

  // 5C. Showcase 12-Part Luxury Hotel Brass Birdcage Bellhop Luggage Carts (`sempurnakan ini`)
  // Uses true hollow tubular brass `TorusGeometry` & `TubeGeometry` arches (zero solid yellow plates!),
  // dark rubber bumper perimeter, beveled brass deck with crimson velvet carpet, 4 swivel brass casters,
  // garment hanging bar, side push handles, top finial ball, and 3 detailed vintage leather luggage pieces!
  const cartWheelGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.07, 12);
  cartWheelGeo.rotateZ(Math.PI / 2);
  const cartPostGeo = new THREE.CylinderGeometry(0.026, 0.026, 1.34, 10);
  const cartCollarGeo = new THREE.CylinderGeometry(0.046, 0.052, 0.08, 10);
  // Hollow tubular semicircular brass arch hoop in the YZ plane (`u in [0..PI]` -> rotated +90 deg around Y)
  const cartSideArchGeo = new THREE.TorusGeometry(0.58, 0.027, 8, 22, Math.PI);
  cartSideArchGeo.rotateY(Math.PI / 2);
  // Transverse crown cross-arch hoop in the XY plane meeting the 2 longitudinal arches at y = +0.58m
  const cartCrossArchGeo = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.36, 0.0, 0),
      new THREE.Vector3(-0.32, 0.34, 0),
      new THREE.Vector3(0.0, 0.58, 0),
      new THREE.Vector3(0.32, 0.34, 0),
      new THREE.Vector3(0.36, 0.0, 0),
    ]),
    18,
    0.025,
    8,
    false,
  );
  const cartGarmentBarGeo = new THREE.CylinderGeometry(0.020, 0.020, 1.12, 8);
  cartGarmentBarGeo.rotateX(Math.PI / 2);
  const cartPushHandleGeo = new THREE.CylinderGeometry(0.020, 0.020, 0.72, 8);
  cartPushHandleGeo.rotateZ(Math.PI / 2);
  const cartFinialNeckGeo = new THREE.CylinderGeometry(0.042, 0.058, 0.07, 10);
  const cartFinialBallGeo = new THREE.SphereGeometry(0.086, 12, 10);
  const hatboxBodyGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.20, 12);
  const hatboxLidGeo = new THREE.CylinderGeometry(0.182, 0.182, 0.055, 12);
  disposableGeos.push(
    cartWheelGeo,
    cartPostGeo,
    cartCollarGeo,
    cartSideArchGeo,
    cartCrossArchGeo,
    cartGarmentBarGeo,
    cartPushHandleGeo,
    cartFinialNeckGeo,
    cartFinialBallGeo,
    hatboxBodyGeo,
    hatboxLidGeo,
  );

  const addBellhopLuggageCart = (wx: number, wz: number, yaw: number) => {
    const cGrp = new THREE.Group();
    cGrp.position.set(wx, 0.09, wz);
    cGrp.rotation.y = yaw;
    staticGroup.add(cGrp);

    // 1) Dark Protective Rubber Bumper Base + Polished Brass Chassis Rim + Plush Crimson Carpet Deck
    addScaledBox(cGrp, 0.90, 0.08, 1.48, '#252a32', [0, 0.28, 0], [0, 0, 0], 0.006);
    addScaledBox(cGrp, 0.84, 0.09, 1.42, COL_GOLD_MAIN, [0, 0.31, 0], [0, 0, 0], 0.007);
    addScaledBox(cGrp, 0.74, 0.04, 1.32, COL_RED_CARPET, [0, 0.365, 0], [0, 0, 0], 0.004, false);

    // 2) 4 Swivel Brass Caster Yokes & Dark Rubber Wheels
    for (const [ox, oz] of [
      [-0.31, -0.54],
      [0.31, -0.54],
      [-0.31, 0.54],
      [0.31, 0.54],
    ] as const) {
      addScaledBox(cGrp, 0.10, 0.11, 0.12, COL_GOLD_BRONZE, [ox, 0.19, oz], [0, 0, 0], 0.004, false);
      addOpaquePart(cGrp, cartWheelGeo, COL_WROUGHT_IRON, [ox, 0.11, oz], [0, 0, 0], 0.005, false);
    }

    // 3) 4 Slender Brass Uprights + Turned Base Collars + End Push-Handle Crossbars
    for (const [px, pz] of [
      [-0.36, -0.58],
      [0.36, -0.58],
      [-0.36, 0.58],
      [0.36, 0.58],
    ] as const) {
      addOpaquePart(cGrp, cartCollarGeo, COL_GOLD_BRONZE, [px, 0.39, pz], [0, 0, 0], 0.004, false);
      addOpaquePart(cGrp, cartPostGeo, COL_GOLD_BRIGHT, [px, 1.06, pz], [0, 0, 0], 0.005, false);
      addOpaquePart(cGrp, cartCollarGeo, COL_GOLD_MAIN, [px, 1.72, pz], [0, 0, 0], 0.004, false);
    }
    addOpaquePart(cGrp, cartPushHandleGeo, COL_GOLD_MAIN, [0, 1.18, -0.58], [0, 0, 0], 0.004, false);
    addOpaquePart(cGrp, cartPushHandleGeo, COL_GOLD_MAIN, [0, 1.18, 0.58], [0, 0, 0], 0.004, false);

    // 4) Hollow Tubular Brass Birdcage Arch Loops (2 Longitudinal + 1 Crown Cross-Arch + Garment Rod + Finial)
    addOpaquePart(cGrp, cartSideArchGeo, COL_GOLD_BRIGHT, [-0.36, 1.73, 0], [0, 0, 0], 0.005, false);
    addOpaquePart(cGrp, cartSideArchGeo, COL_GOLD_BRIGHT, [0.36, 1.73, 0], [0, 0, 0], 0.005, false);
    addOpaquePart(cGrp, cartCrossArchGeo, COL_GOLD_MAIN, [0, 1.73, 0], [0, 0, 0], 0.005, false);
    addOpaquePart(cGrp, cartGarmentBarGeo, COL_GOLD_BRONZE, [0, 2.08, 0], [0, 0, 0], 0.004, false);
    addOpaquePart(cGrp, cartFinialNeckGeo, COL_GOLD_BRONZE, [0, 2.34, 0], [0, 0, 0], 0.004, false);
    addOpaquePart(cGrp, cartFinialBallGeo, COL_GOLD_BRIGHT, [0, 2.45, 0], [0, 0, 0], 0.005, false);

    // 5) 3 Detailed Vintage Luxury Luggage Pieces on the Crimson Deck:
    //    (a) Banded Cognac Leather Steamer Trunk with Tan Buckled Straps & Brass Lock Clasp
    const trunkGrp = new THREE.Group();
    trunkGrp.position.set(-0.02, 0.385, -0.18);
    trunkGrp.rotation.y = 0.06;
    cGrp.add(trunkGrp);
    addScaledBox(trunkGrp, 0.54, 0.40, 0.68, '#7a4626', [0, 0.20, 0], [0, 0, 0], 0.006);
    addScaledBox(trunkGrp, 0.56, 0.06, 0.70, '#5e341b', [0, 0.37, 0], [0, 0, 0], 0.005);
    addScaledBox(trunkGrp, 0.57, 0.42, 0.07, '#c79052', [0, 0.20, -0.20], [0, 0, 0], 0.004, false);
    addScaledBox(trunkGrp, 0.57, 0.42, 0.07, '#c79052', [0, 0.20, 0.20], [0, 0, 0], 0.004, false);
    addScaledBox(trunkGrp, 0.06, 0.11, 0.10, COL_GOLD_BRIGHT, [0.28, 0.28, 0], [0, 0, 0], 0, false);

    //    (b) Upright Saddle-Tan Hardcase Valise with Brass Latches & Top Handle
    const suitGrp = new THREE.Group();
    suitGrp.position.set(0.04, 0.385, 0.36);
    suitGrp.rotation.y = -0.14;
    cGrp.add(suitGrp);
    addScaledBox(suitGrp, 0.46, 0.52, 0.24, '#a66b3c', [0, 0.26, 0], [0, 0, 0], 0.006);
    addScaledBox(suitGrp, 0.48, 0.54, 0.05, '#784825', [0, 0.26, -0.08], [0, 0, 0], 0, false);
    addScaledBox(suitGrp, 0.48, 0.54, 0.05, '#784825', [0, 0.26, 0.08], [0, 0, 0], 0, false);
    addScaledBox(suitGrp, 0.16, 0.06, 0.05, '#5c3519', [0, 0.55, 0], [0, 0, 0], 0.004, false);

    //    (c) Vintage Cream & Burgundy Ribbon Hatbox perched atop the Steamer Trunk
    addOpaquePart(cGrp, hatboxBodyGeo, '#ead9be', [-0.03, 0.885, -0.18], [0, 0.2, 0], 0.005);
    addOpaquePart(cGrp, hatboxLidGeo, '#8f232c', [-0.03, 0.995, -0.18], [0, 0.2, 0], 0.005);
  };

  for (const cart of GRAND_CASINO_MASTERPLAN.luggageCarts) {
    addBellhopLuggageCart(cart.x, cart.z, cart.yaw);
  }

  // 5D. Exact Central Plaza Vintage Park Bench (Strictly Bench ONLY — Zero Flower Pots/Planter Boxes!)
  // Ported verbatim from `buildVintageParkBenchWithPlanterBox` in `buddiesBlitzShadersAndAssets.ts`
  // (`BENCH_GOLDEN_SCALE = 1.58`, cast-iron end frames `#3d4b42` with volute armrests & heart scroll,
  // contoured honey-teak slats `#df9b52` + bullnose & crest rail `#cf8940`, and 3 rear iron straps).
  const addPlazaVintageParkBenchOnly = (wx: number, wz: number, rotY: number) => {
    const BENCH_GOLDEN_SCALE = 1.58;
    const bGrp = new THREE.Group();
    bGrp.position.set(wx, 0.09, wz);
    bGrp.rotation.y = rotY;
    bGrp.scale.setScalar(BENCH_GOLDEN_SCALE);
    staticGroup.add(bGrp);

    const COL_CAST_IRON = '#3d4b42';
    const COL_CAST_IRON_DARK = '#2f3b34';
    const COL_CAST_IRON_HIGHLIGHT = '#506357';
    const COL_TIMBER_SLAT = '#df9b52';
    const COL_TIMBER_CREST = '#cf8940';

    const addToonBenchPart = (
      parent: THREE.Object3D,
      geo: THREE.BufferGeometry,
      colorHex: string,
      pos: [number, number, number],
      rot: [number, number, number],
      toonStrokeWidth = 0.009,
      castShad = true,
    ) => {
      disposableGeos.push(geo);
      return addOpaquePart(parent, geo, colorHex, pos, rot, toonStrokeWidth, castShad);
    };

    const addCurvedIronBar = (
      pts: [number, number, number][],
      radius: number,
      tubularSegments: number,
      colorHex: string,
      scaleX = 1.18,
      toonStrokeWidth = 0.0075,
    ) => {
      const curve = new THREE.CatmullRomCurve3(
        pts.map(([px, py, pz]) => new THREE.Vector3(px, py, pz)),
        false,
        'centripetal',
        0.5,
      );
      const lowSegs = Math.max(8, Math.round(tubularSegments * 0.45));
      const tubeGeo = new THREE.TubeGeometry(curve, lowSegs, radius, 6, false);
      if (scaleX !== 1) {
        const avgX = pts.reduce((acc, p) => acc + p[0], 0) / pts.length;
        tubeGeo.translate(-avgX, 0, 0);
        tubeGeo.scale(scaleX, 1, 1);
        tubeGeo.translate(avgX, 0, 0);
      }
      addToonBenchPart(bGrp, tubeGeo, colorHex, [0, 0, 0], [0, 0, 0], toonStrokeWidth, false);
    };

    // 1. Cast-Iron End Frames (Left x = -1.00m & Right x = +1.00m)
    for (const sideSign of [-1, 1]) {
      const fx = sideSign * 1.00;
      const flareOut = sideSign * 0.042;
      const frontFootX = fx + flareOut;
      const rearFootX = fx + flareOut;

      addToonBenchPart(
        bGrp,
        new THREE.CylinderGeometry(0.046, 0.058, 0.036, 6),
        COL_CAST_IRON_DARK,
        [frontFootX, 0.018, 0.295],
        [0, 0, 0],
        0.007,
        false,
      );
      addToonBenchPart(
        bGrp,
        new THREE.CylinderGeometry(0.046, 0.058, 0.036, 6),
        COL_CAST_IRON_DARK,
        [rearFootX, 0.018, -0.285],
        [0, 0, 0],
        0.007,
        false,
      );

      // Ergonomic Backrest & Seat Cradle Frame
      addCurvedIronBar(
        [
          [fx, 1.078, -0.352],
          [fx, 1.148, -0.330],
          [fx, 1.010, -0.268],
          [fx, 0.710, -0.198],
          [fx, 0.520, -0.120],
          [fx, 0.504, 0.095],
          [fx, 0.536, 0.278],
          [fx, 0.468, 0.312],
          [fx, 0.458, 0.272],
        ],
        0.028,
        24,
        COL_CAST_IRON,
        1.25,
        0.0085,
      );

      // Front & Rear Legs
      addCurvedIronBar(
        [
          [frontFootX, 0.025, 0.295],
          [fx + flareOut * 0.5, 0.16, 0.252],
          [fx, 0.36, 0.268],
          [fx, 0.525, 0.255],
        ],
        0.029,
        14,
        COL_CAST_IRON,
        1.22,
        0.0085,
      );
      addCurvedIronBar(
        [
          [rearFootX, 0.025, -0.285],
          [fx + flareOut * 0.5, 0.18, -0.228],
          [fx, 0.38, -0.185],
          [fx, 0.680, -0.196],
        ],
        0.029,
        14,
        COL_CAST_IRON,
        1.22,
        0.0085,
      );

      // Curved Armrest + Front Volute Loop
      addCurvedIronBar(
        [
          [fx, 0.768, -0.212],
          [fx, 0.788, 0.015],
          [fx, 0.770, 0.238],
          [fx, 0.715, 0.278],
          [fx, 0.638, 0.188],
          [fx, 0.728, 0.168],
          [fx, 0.686, 0.224],
        ],
        0.026,
        24,
        COL_CAST_IRON_HIGHLIGHT,
        1.25,
        0.008,
      );

      // Lower Armrest Strut
      addCurvedIronBar(
        [
          [fx, 0.528, 0.245],
          [fx, 0.642, 0.222],
          [fx, 0.636, 0.115],
          [fx, 0.748, -0.202],
        ],
        0.020,
        14,
        COL_CAST_IRON,
        1.18,
        0.0065,
      );

      // Under-Seat Arch & Heart Scroll
      addCurvedIronBar(
        [
          [fx + flareOut * 0.35, 0.155, 0.248],
          [fx, 0.252, 0.025],
          [fx + flareOut * 0.35, 0.155, -0.212],
        ],
        0.019,
        12,
        COL_CAST_IRON_DARK,
        1.18,
        0.0065,
      );
      addCurvedIronBar(
        [
          [fx, 0.252, 0.025],
          [fx, 0.355, 0.092],
          [fx, 0.455, 0.058],
          [fx, 0.415, 0.025],
        ],
        0.016,
        12,
        COL_CAST_IRON_HIGHLIGHT,
        1.15,
        0.006,
      );
      addCurvedIronBar(
        [
          [fx, 0.252, 0.025],
          [fx, 0.355, -0.042],
          [fx, 0.455, -0.008],
          [fx, 0.415, 0.025],
        ],
        0.016,
        12,
        COL_CAST_IRON_HIGHLIGHT,
        1.15,
        0.006,
      );
    }

    // 2. Contoured Honey-Teak Timber Seat & Backrest Slats + Bullnose & Crest Rail
    const benchSpanW = 2.04;
    const bullnoseGeo = new THREE.CylinderGeometry(0.028, 0.028, benchSpanW, 8);
    bullnoseGeo.rotateZ(Math.PI / 2);
    bullnoseGeo.scale(1, 0.85, 1.25);
    addToonBenchPart(bGrp, bullnoseGeo, COL_TIMBER_SLAT, [0, 0.542, 0.282], [0.24, 0, 0], 0.0085, true);

    const seatSlats: [number, number, number, number][] = [
      [0.546, 0.212, 0.070, 0.12],
      [0.532, 0.132, 0.076, 0.05],
      [0.522, 0.048, 0.076, -0.01],
      [0.524, -0.036, 0.076, -0.06],
      [0.538, -0.118, 0.076, -0.12],
    ];
    for (const [sy, sz, sDepth, sPitch] of seatSlats) {
      addToonBenchPart(
        bGrp,
        new THREE.BoxGeometry(benchSpanW, 0.034, sDepth),
        COL_TIMBER_SLAT,
        [0, sy, sz],
        [sPitch, 0, 0],
        0.0085,
        true,
      );
    }

    const backSlats: [number, number, number, number][] = [
      [0.665, -0.182, 0.094, -0.19],
      [0.778, -0.208, 0.094, -0.22],
      [0.892, -0.238, 0.094, -0.24],
      [1.006, -0.270, 0.096, -0.26],
    ];
    for (const [by, bz, bHeight, bPitch] of backSlats) {
      addToonBenchPart(
        bGrp,
        new THREE.BoxGeometry(benchSpanW, bHeight, 0.034),
        COL_TIMBER_SLAT,
        [0, by, bz],
        [bPitch, 0, 0],
        0.0085,
        true,
      );
    }

    const crestGeo = new THREE.CylinderGeometry(0.030, 0.030, benchSpanW + 0.02, 8);
    crestGeo.rotateZ(Math.PI / 2);
    crestGeo.scale(1, 0.95, 0.80);
    addToonBenchPart(bGrp, crestGeo, COL_TIMBER_CREST, [0, 1.088, -0.298], [-0.28, 0, 0], 0.0085, true);

    // 3. 3 Rear Support Straps (strictly NO planter boxes / flower pots!)
    for (const strapX of [-0.64, 0.0, 0.64]) {
      addCurvedIronBar(
        [
          [strapX, 0.518, 0.235],
          [strapX, 0.502, -0.105],
          [strapX, 0.565, -0.182],
          [strapX, 0.895, -0.258],
          [strapX, 1.095, -0.328],
        ],
        0.020,
        12,
        COL_CAST_IRON,
        1.35,
        0.007,
      );
    }
  };

  for (const bench of GRAND_CASINO_MASTERPLAN.stagingBenches) {
    addPlazaVintageParkBenchOnly(bench.x, bench.z, bench.rotY);
  }

  // 5E. 6 Vintage Cast-Iron Street Lamps (`~4.95m` tall, matching Front Elevation & 3/4 Isometric View)
  const lampBasePedGeo = new THREE.CylinderGeometry(0.22, 0.30, 0.72, 10);
  const lampPoleGeo = new THREE.CylinderGeometry(0.08, 0.13, 3.35, 10);
  const lampLanternGlassGeo = new THREE.CylinderGeometry(0.26, 0.18, 0.58, 8);
  const lampLanternCapGeo = new THREE.ConeGeometry(0.32, 0.32, 8);
  disposableGeos.push(lampBasePedGeo, lampPoleGeo, lampLanternGlassGeo, lampLanternCapGeo);

  const addVintageStreetLamp = (wx: number, wz: number, baseY = 0.09) => {
    const lGrp = new THREE.Group();
    lGrp.position.set(wx, baseY, wz);
    staticGroup.add(lGrp);

    addOpaquePart(lGrp, lampBasePedGeo, COL_WROUGHT_IRON, [0, 0.36, 0], [0, 0, 0], 0.007);
    addOpaquePart(lGrp, lampPoleGeo, COL_WROUGHT_IRON, [0, 2.38, 0], [0, 0, 0], 0.006);
    addOpaquePart(lGrp, lampLanternGlassGeo, COL_WARM_LOBBY_GLOW, [0, 4.35, 0], [0, 0, 0], 0.006, false, undefined, COL_WARM_LOBBY_GLOW);
    addOpaquePart(lGrp, lampLanternCapGeo, COL_WROUGHT_IRON, [0, 4.80, 0], [0, 0, 0], 0.006);
  };
  for (const lamp of GRAND_CASINO_MASTERPLAN.streetLamps) {
    const isMedian = lamp.id.includes('median');
    addVintageStreetLamp(lamp.x, lamp.z, isMedian ? 0.14 : 0.09);
  }

  // =========================================================================
  // 6. CURVED NORTH HILL-CONTOUR FORMAL GARDEN & SOUTH PLAZA CONNECTOR HEDGES
  //    (Follows the curved empty-lot perimeter with Leaf-Petal Shrubs & Flowers!)
  // =========================================================================
  const northGardenWallPts: [number, number][] = [
    [-97.1, -91.0],
    [-92.6, -94.8],
    [-86.6, -98.6],
    [-80.2, -100.8],
    [-76.6, -99.4],
  ];
  const northWallBaseGeo = createMitredStripGeo(northGardenWallPts, 0.56, 0.42, false);
  const northWallCapGeo = createMitredStripGeo(northGardenWallPts, 0.68, 0.14, false);
  disposableGeos.push(northWallBaseGeo, northWallCapGeo);
  addOpaquePart(staticGroup, northWallBaseGeo, COL_LIMESTONE_WARM, [0, 0.30, 0], [0, 0, 0], 0.009);
  addOpaquePart(staticGroup, northWallCapGeo, COL_LIMESTONE_TRIM, [0, 0.58, 0], [0, 0, 0], 0.009);

  // Ornamental Classical Urn Pedestal centerpiece in the North Garden (`(-85.4, -95.6)`)
  const gardenPlinthGeo = new THREE.CylinderGeometry(1.32, 1.48, 0.62, 12);
  disposableGeos.push(gardenPlinthGeo);
  addOpaquePart(staticGroup, gardenPlinthGeo, COL_LIMESTONE_PLINTH, [-85.4, 0.40, -95.6], [0, 0, 0], 0.010);
  addUrnTopiary(-85.4, 0.71, -95.6, 'conical', 1.25);

  // Curved North Garden Swaying Leaf-Petal Hedges + Pink & Purple Flower Accents
  const northGardenShrubCoords: [number, number, boolean][] = [
    [-94.8, -92.2, true],
    [-93.0, -93.8, false],
    [-90.8, -95.4, true],
    [-88.4, -97.0, false],
    [-85.8, -98.2, true],
    [-83.0, -99.2, false],
    [-80.2, -99.8, true],
    [-77.8, -98.8, false],
  ];
  for (let i = 0; i < northGardenShrubCoords.length; i++) {
    const [gx, gz, isPink] = northGardenShrubCoords[i];
    pushLeafShrubCluster(gx, 0.78, gz, 0.88, 0.72, 0.88, i * 0.77);
    pushFlowerCluster(gx + 0.15, 1.12, gz + 0.12, 0.46, 0.42, 0.46, isPink, i * 1.13);
  }

  // South Connector Planter Shrubs & Flowers framing the West lawn edge beside the walk from Central Plaza
  const southConnectorShrubCoords: [number, number, boolean][] = [
    [-77.55, -45.6, true],
    [-77.45, -41.8, false],
    [-80.6, -51.0, true],
    [-84.2, -51.0, false],
  ];
  for (let i = 0; i < southConnectorShrubCoords.length; i++) {
    const [sx, sz, isPink] = southConnectorShrubCoords[i];
    addScaledBox(staticGroup, 1.24, 0.42, 1.24, COL_LIMESTONE_WARM, [sx, 0.21, sz], [0, 0, 0], 0.008);
    pushLeafShrubCluster(sx, 0.68, sz, 0.74, 0.64, 0.74, i * 0.95);
    pushFlowerCluster(sx, 0.98, sz, 0.44, 0.40, 0.44, isPink, i * 1.4);
  }

  // Instantiate all Grand Casino Swaying Leaf-Petal Shrubs & Blossom Clusters (2 draw calls total!)
  if (shrubMatrices.length > 0) {
    const shrubInst = createLeafPetalShrubInstanced(
      shrubMatrices,
      'GrandCasinoLeafPetalShrubsInstanced',
    );
    dynamicFoliageGroup.add(shrubInst);
  }
  if (flowerSpecs.length > 0) {
    const flowerInst = createFlowerPetalClusterInstanced(
      flowerSpecs,
      'GrandCasinoFlowerPetalClustersInstanced',
    );
    dynamicFoliageGroup.add(flowerInst);
  }

  // Bake ALL static Grand Casino meshes into minimal vertex-color + stroke + glass draw calls!
  bakeStaticGroupMeshes(staticGroup, { minShadowCasterSpan: 0.55 });

  return {
    group: root,
    dispose() {
      for (const g of disposableGeos) g.dispose();
      for (const t of disposableTextures) t.dispose();
    },
  };
}
