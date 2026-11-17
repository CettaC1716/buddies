import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  createBlitzStrokeMesh,
  makeDoubleSidedFrontGeometry,
} from './buddiesBlitzShadersAndAssets';
import { CAFE_GLOBAL_SCALE_SPEC } from './buddiesCafeRules';
import {
  type CompactInteractiveChevronMarker,
  buildGlowingDoorFloorArrowPad,
} from './buddiesCafeInteriorBuilder';
import { type CafeAssetStyler } from './buddiesLShapedCafeAssets';
import {
  CASINO_INTERIOR_SEAT_SPOTS,
  CASINO_ORIGIN_Y,
  CASINO_STATION_TARGETS,
  type CasinoStationInteractionKind,
} from './buddiesGrandCasinoRules';
import {
  type CasinoTextureAtlas,
  createCasinoTextureAtlas,
  createCasinoTexturePack,
  populateCasinoInteriorProps,
} from './buddiesGrandCasinoInteriorAssets';

export interface CasinoInteriorSceneHandle {
  root: THREE.Group;
  floorSpotIndicators: Array<{
    coinRoot: THREE.Group;
    blueCoin: THREE.Object3D;
    greenCoin: THREE.Object3D;
  }>;
  interactiveMarkers: {
    cashierCage: CompactInteractiveChevronMarker;
    luxuryBar: CompactInteractiveChevronMarker;
    rouletteTable: CompactInteractiveChevronMarker;
    blackjackCenter: CompactInteractiveChevronMarker;
    blackjackMidRight: CompactInteractiveChevronMarker;
    blackjackEastSalon: CompactInteractiveChevronMarker;
    slotWestBank: CompactInteractiveChevronMarker;
    slotIslandBank: CompactInteractiveChevronMarker;
    slotNorthBank: CompactInteractiveChevronMarker;
    slotEastBank: CompactInteractiveChevronMarker;
  };
  updateVisuals: (
    timeSec: number,
    activeStationKind?: CasinoStationInteractionKind | null,
    playerX?: number,
    playerZ?: number,
  ) => void;
  dispose: () => void;
}

interface CasinoBakeSpec {
  r: number;
  g: number;
  b: number;
  emissiveLift: number;
  metal: number;
  gloss: number;
  u0: number;
  v0: number;
  uW: number;
  vH: number;
  repX: number;
  repY: number;
}

function flipNonIndexedWinding(geo: THREE.BufferGeometry): void {
  const pos = geo.getAttribute('position');
  if (!pos) return;
  const norm = geo.getAttribute('normal');
  const uv = geo.getAttribute('uv');
  for (let i = 0; i + 2 < pos.count; i += 3) {
    const x1 = pos.getX(i + 1), y1 = pos.getY(i + 1), z1 = pos.getZ(i + 1);
    const x2 = pos.getX(i + 2), y2 = pos.getY(i + 2), z2 = pos.getZ(i + 2);
    pos.setXYZ(i + 1, x2, y2, z2);
    pos.setXYZ(i + 2, x1, y1, z1);
    if (norm) {
      const nx1 = norm.getX(i + 1), ny1 = norm.getY(i + 1), nz1 = norm.getZ(i + 1);
      const nx2 = norm.getX(i + 2), ny2 = norm.getY(i + 2), nz2 = norm.getZ(i + 2);
      norm.setXYZ(i + 1, nx2, ny2, nz2);
      norm.setXYZ(i + 2, nx1, ny1, nz1);
    }
    if (uv) {
      const u1 = uv.getX(i + 1), v1 = uv.getY(i + 1);
      const u2 = uv.getX(i + 2), v2 = uv.getY(i + 2);
      uv.setXY(i + 1, u2, v2);
      uv.setXY(i + 2, u1, v1);
    }
  }
}

function createCasinoPlazaBakedMaterial(atlasTexture: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uAtlasMap: { value: atlasTexture },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aColorAndEmissive;
      attribute vec2 aSurfaceSpec;
      attribute vec4 aAtlasRect;
      attribute vec2 aTexRepeat;

      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      varying vec4 vColorAndEmissive;
      varying vec2 vSurfaceSpec;
      varying vec4 vAtlasRect;
      varying vec2 vTexRepeat;

      void main() {
        vUv = uv;
        vColorAndEmissive = aColorAndEmissive;
        vSurfaceSpec = aSurfaceSpec;
        vAtlasRect = aAtlasRect;
        vTexRepeat = aTexRepeat;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlasMap;

      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      varying vec4 vColorAndEmissive;
      varying vec2 vSurfaceSpec;
      varying vec4 vAtlasRect;
      varying vec2 vTexRepeat;

      void main() {
        vec3 albedo = vColorAndEmissive.rgb;
        if (vAtlasRect.z > 0.0001) {
          vec2 rawUv = vUv * abs(vTexRepeat);
          vec2 tileUv = vec2(
            vTexRepeat.x < 0.0 ? clamp(rawUv.x, 0.0, 1.0) : fract(rawUv.x),
            vTexRepeat.y < 0.0 ? clamp(rawUv.y, 0.0, 1.0) : fract(rawUv.y)
          );
          vec2 inset = vec2(0.5 / 2048.0);
          vec2 sampleUv = vAtlasRect.xy + inset + tileUv * max(vAtlasRect.zw - inset * 2.0, vec2(0.0001));
          albedo *= texture2D(uAtlasMap, sampleUv).rgb;
        }

        // Plaza-style fast cel shading + analytical warm chandelier pools (zero PointLight cost)
        vec3 N = normalize(vWorldNormal);
        vec3 L = normalize(vec3(0.36, 0.85, 0.42));
        float ndl = dot(N, L);
        float litFactor = clamp((ndl - 0.12) / 0.48, 0.0, 1.0);
        float shadowFactor = 1.0 - litFactor;

        vec2 localXZ = vWorldPos.xz;
        float dCenter = length(localXZ - vec2(0.0, 0.15));
        float dLeft = length(localXZ - vec2(-5.65, -0.5));
        float dRight = length(localXZ - vec2(5.65, -0.5));
        float dSouth = length(localXZ - vec2(0.0, 4.65));
        float chandelierWarmth =
          exp(-dCenter * dCenter * 0.032) * 0.18 +
          exp(-dLeft * dLeft * 0.045) * 0.11 +
          exp(-dRight * dRight * 0.045) * 0.11 +
          exp(-dSouth * dSouth * 0.036) * 0.14;

        float downFacing = smoothstep(-0.2, 0.85, -N.y);
        float heightAtten = clamp(1.0 - max(vWorldPos.y - ${CASINO_ORIGIN_Y.toFixed(1)}, 0.0) / 2.2, 0.0, 1.0);
        vec3 bounceCol = mix(albedo, vec3(0.55, 0.18, 0.16), downFacing * heightAtten * 0.18);

        vec3 litColor = bounceCol * vec3(1.06, 1.01, 0.93) * (0.94 + 0.14 * litFactor + chandelierWarmth);
        vec3 shadedColor = bounceCol * (vec3(0.68, 0.63, 0.62) + chandelierWarmth * vec3(0.32, 0.25, 0.14));

        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 H = normalize(L + V);
        float specBand = smoothstep(0.86, 0.94, max(dot(N, H), 0.0)) * (vSurfaceSpec.x * 0.42 + vSurfaceSpec.y * 0.18);

        vec3 baseShaded = mix(litColor, shadedColor, shadowFactor * 0.52) + vec3(1.0, 0.92, 0.72) * specBand;
        float emissiveAmt = clamp(vColorAndEmissive.a, 0.0, 1.0);
        vec3 finalRgb = mix(baseShaded, albedo * (1.05 + emissiveAmt * 0.35), emissiveAmt);

        gl_FragColor = vec4(finalRgb, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.FrontSide,
    fog: false,
  });
}

function createPlazaCasinoStyler(
  atlas: CasinoTextureAtlas,
  bakedMaterial: THREE.Material,
): CafeAssetStyler {
  const dummyGlassMat = new THREE.MeshBasicMaterial({
    color: '#dff6ff',
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
  });
  const tmpColor = new THREE.Color();
  const tmpEmissive = new THREE.Color();

  return {
    clearGlassMat: dummyGlassMat,
    frostedGlassMat: dummyGlassMat,
    preserveTextures: true,
    styleOpaque: (mesh, geo, colorHex, strokeW = 0.005, opts) => {
      const targetGeo = opts?.doubleSided ? makeDoubleSidedFrontGeometry(geo) : geo;
      if (targetGeo !== geo) {
        mesh.geometry = targetGeo;
      }

      const atlasEntry = opts?.tex ? atlas.entries.get(opts.tex) : undefined;
      const effectiveColorHex = opts?.tex && !opts?.tintTex ? '#ffffff' : colorHex;
      tmpColor.set(effectiveColorHex);

      const emissiveIntensity = opts?.emissiveIntensity ?? 0;
      const hasEmissive = Boolean(opts?.emissiveHex && emissiveIntensity > 0.001);
      let emissiveLift = 0;
      if (hasEmissive) {
        tmpEmissive.set(opts!.emissiveHex!);
        if (!atlasEntry) {
          tmpColor.setRGB(
            Math.min(1.4, tmpColor.r * 0.45 + tmpEmissive.r * emissiveIntensity),
            Math.min(1.4, tmpColor.g * 0.45 + tmpEmissive.g * emissiveIntensity),
            Math.min(1.4, tmpColor.b * 0.45 + tmpEmissive.b * emissiveIntensity),
          );
          emissiveLift = Math.min(1.0, Math.max(0.45, emissiveIntensity * 0.55));
        } else {
          emissiveLift = Math.min(0.85, Math.max(0.30, emissiveIntensity * 0.45));
        }
      }

      const metal = Math.min(1, Math.max(0, opts?.metalness ?? 0.05));
      const rough = Math.min(1, Math.max(0.05, opts?.roughness ?? 0.58));
      const clearcoat = Math.min(1, Math.max(0, opts?.clearcoat ?? 0.25));
      const gloss = Math.min(0.65, Math.max(0, clearcoat * 0.45 + (1 - rough) * 0.25));

      const spec: CasinoBakeSpec = {
        r: tmpColor.r,
        g: tmpColor.g,
        b: tmpColor.b,
        emissiveLift,
        metal,
        gloss,
        u0: atlasEntry ? atlasEntry.u0 : 0,
        v0: atlasEntry ? atlasEntry.v0 : 0,
        uW: atlasEntry ? atlasEntry.uW : 0,
        vH: atlasEntry ? atlasEntry.vH : 0,
        repX: atlasEntry ? (atlasEntry.wrapRepeatX ? atlasEntry.repeatX : -atlasEntry.repeatX) : -1,
        repY: atlasEntry ? (atlasEntry.wrapRepeatY ? atlasEntry.repeatY : -atlasEntry.repeatY) : -1,
      };
      mesh.userData.__casinoBakeSpec = spec;
      mesh.material = bakedMaterial;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.raycast = () => {};

      if (strokeW > 0 && !opts?.doubleSided) {
        const stroke = createBlitzStrokeMesh(geo, Math.min(strokeW, 0.008), '#12121e');
        if (stroke) {
          stroke.raycast = () => {};
          mesh.add(stroke);
        }
      }
      return mesh;
    },
  };
}

function bakeCasinoGroup(
  group: THREE.Group,
  bakedMaterial: THREE.Material,
  strokeMaterial: THREE.Material,
): void {
  group.updateMatrixWorld(true);
  const invRoot = group.matrixWorld.clone().invert();
  const relMatrix = new THREE.Matrix4();

  const opaqueGeos: THREE.BufferGeometry[] = [];
  const strokeGeos: THREE.BufferGeometry[] = [];
  const meshesToRemove: THREE.Mesh[] = [];

  const defaultSpec: CasinoBakeSpec = {
    r: 1,
    g: 1,
    b: 1,
    emissiveLift: 0,
    metal: 0.05,
    gloss: 0.2,
    u0: 0,
    v0: 0,
    uW: 0,
    vH: 0,
    repX: -1,
    repY: -1,
  };

  const walk = (node: THREE.Object3D) => {
    if (node instanceof THREE.Mesh && !(node instanceof THREE.InstancedMesh)) {
      if (!node.geometry) return;
      relMatrix.multiplyMatrices(invRoot, node.matrixWorld);
      const isNegativeDet = relMatrix.determinant() < 0;

      if (node.userData?.isModelStroke) {
        const g = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
        const pos = g.getAttribute('position');
        if (pos && pos.count > 0) {
          if (!g.getAttribute('normal')) {
            g.computeVertexNormals();
          }
          const norm = g.getAttribute('normal');
          const strokeWidth =
            (node.material as THREE.ShaderMaterial)?.uniforms?.uStrokeWidth?.value ?? 0.006;
          if (norm) {
            for (let i = 0; i < pos.count; i++) {
              const nx = norm.getX(i);
              const ny = norm.getY(i);
              const nz = norm.getZ(i);
              const len = Math.hypot(nx, ny, nz) || 1;
              pos.setXYZ(
                i,
                pos.getX(i) + (nx / len) * strokeWidth,
                pos.getY(i) + (ny / len) * strokeWidth,
                pos.getZ(i) + (nz / len) * strokeWidth,
              );
            }
          }
          for (const attrName of Object.keys(g.attributes)) {
            if (attrName !== 'position') {
              g.deleteAttribute(attrName);
            }
          }
          if (isNegativeDet) {
            flipNonIndexedWinding(g);
          }
          g.applyMatrix4(relMatrix);
          strokeGeos.push(g);
          meshesToRemove.push(node);
        } else {
          g.dispose();
        }
      } else {
        const g = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
        const pos = g.getAttribute('position');
        if (pos && pos.count > 0) {
          if (!g.getAttribute('normal')) {
            g.computeVertexNormals();
          }
          if (!g.getAttribute('uv')) {
            g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2));
          }
          for (const attrName of Object.keys(g.attributes)) {
            if (attrName !== 'position' && attrName !== 'normal' && attrName !== 'uv') {
              g.deleteAttribute(attrName);
            }
          }

          const spec: CasinoBakeSpec = node.userData?.__casinoBakeSpec ?? defaultSpec;
          const vCount = pos.count;
          const colArr = new Float32Array(vCount * 4);
          const specArr = new Float32Array(vCount * 2);
          const rectArr = new Float32Array(vCount * 4);
          const repArr = new Float32Array(vCount * 2);

          for (let i = 0; i < vCount; i++) {
            const i4 = i * 4;
            const i2 = i * 2;
            colArr[i4] = spec.r;
            colArr[i4 + 1] = spec.g;
            colArr[i4 + 2] = spec.b;
            colArr[i4 + 3] = spec.emissiveLift;

            specArr[i2] = spec.metal;
            specArr[i2 + 1] = spec.gloss;

            rectArr[i4] = spec.u0;
            rectArr[i4 + 1] = spec.v0;
            rectArr[i4 + 2] = spec.uW;
            rectArr[i4 + 3] = spec.vH;

            repArr[i2] = spec.repX;
            repArr[i2 + 1] = spec.repY;
          }

          g.setAttribute('aColorAndEmissive', new THREE.BufferAttribute(colArr, 4));
          g.setAttribute('aSurfaceSpec', new THREE.BufferAttribute(specArr, 2));
          g.setAttribute('aAtlasRect', new THREE.BufferAttribute(rectArr, 4));
          g.setAttribute('aTexRepeat', new THREE.BufferAttribute(repArr, 2));

          if (isNegativeDet) {
            flipNonIndexedWinding(g);
          }
          g.applyMatrix4(relMatrix);
          opaqueGeos.push(g);
          meshesToRemove.push(node);
        } else {
          g.dispose();
        }
      }
    }

    for (let i = 0; i < node.children.length; i++) {
      walk(node.children[i]);
    }
  };

  walk(group);

  if (opaqueGeos.length > 0) {
    const mergedOpaque = opaqueGeos.length === 1 ? opaqueGeos[0] : mergeGeometries(opaqueGeos, false);
    if (opaqueGeos.length > 1) {
      for (const g of opaqueGeos) g.dispose();
    }
    if (mergedOpaque) {
      mergedOpaque.computeBoundingBox();
      mergedOpaque.computeBoundingSphere();
      const bakedMesh = new THREE.Mesh(mergedOpaque, bakedMaterial);
      bakedMesh.name = `${group.name || 'CasinoGroup'}_BakedOpaque`;
      bakedMesh.castShadow = false;
      bakedMesh.receiveShadow = false;
      bakedMesh.frustumCulled = false;
      bakedMesh.raycast = () => {};
      group.add(bakedMesh);
    }
  }

  if (strokeGeos.length > 0) {
    const mergedStroke = strokeGeos.length === 1 ? strokeGeos[0] : mergeGeometries(strokeGeos, false);
    if (strokeGeos.length > 1) {
      for (const g of strokeGeos) g.dispose();
    }
    if (mergedStroke) {
      mergedStroke.computeBoundingBox();
      mergedStroke.computeBoundingSphere();
      const bakedStroke = new THREE.Mesh(mergedStroke, strokeMaterial);
      bakedStroke.name = `${group.name || 'CasinoGroup'}_BakedStroke`;
      bakedStroke.castShadow = false;
      bakedStroke.receiveShadow = false;
      bakedStroke.frustumCulled = false;
      bakedStroke.raycast = () => {};
      bakedStroke.userData.isModelStroke = true;
      group.add(bakedStroke);
    }
  }

  const candidateParents = new Set<THREE.Object3D>();
  for (const m of meshesToRemove) {
    if (m.parent && m.parent !== group) {
      candidateParents.add(m.parent);
    }
    m.parent?.remove(m);
  }
  for (const p of candidateParents) {
    let cur: THREE.Object3D | null = p;
    while (cur && cur !== group && !cur.name && cur.children.length === 0) {
      const parentObj: THREE.Object3D | null = cur.parent;
      parentObj?.remove(cur);
      cur = parentObj;
    }
  }
}

export function buildGrandCasinoInterior(): CasinoInteriorSceneHandle {
  const root = new THREE.Group();
  root.name = 'GrandCasinoLuxuryInterior3D';
  root.position.set(0, CASINO_ORIGIN_Y, 0);
  root.visible = false;

  // 1. Single 2048x2048 Texture Atlas + Single Plaza-Style Cel Shader Material
  const tex = createCasinoTexturePack();
  const atlas = createCasinoTextureAtlas(tex);
  const casinoBakedMaterial = createCasinoPlazaBakedMaterial(atlas.atlasTexture);
  const casinoStrokeMaterial = new THREE.MeshBasicMaterial({
    color: 0x12121e,
    side: THREE.BackSide,
    fog: false,
  });
  const styler = createPlazaCasinoStyler(atlas, casinoBakedMaterial);

  // 2. Clean Beaux-Arts Warm Cream Cutaway Sky Backdrop (matching screen_07df789a.png)
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(68, 20, 14),
    new THREE.MeshBasicMaterial({
      color: '#f2ead8',
      side: THREE.BackSide,
      fog: false,
    }),
  );
  skyDome.raycast = () => {};
  root.add(skyDome);

  // 3. Lightweight Fill Lights for Dynamic Player Avatar Only (Static Casino Uses Zero-Light Cel Shader!)
  const hemiLight = new THREE.HemisphereLight('#fff5db', '#6e2022', 1.32);
  hemiLight.position.set(0, 10, 0);
  root.add(hemiLight);

  const keyDirLight = new THREE.DirectionalLight('#fff1cc', 1.1);
  keyDirLight.position.set(5, 11, 8);
  root.add(keyDirLight);

  // 4. Static Architecture + 1:1 Reference Assets + Dynamic Roulette Wheel Rotor
  const staticIndoorGroup = new THREE.Group();
  staticIndoorGroup.name = 'GrandCasinoStaticBakedGroup';
  root.add(staticIndoorGroup);

  const dynamicIndoorGroup = new THREE.Group();
  dynamicIndoorGroup.name = 'GrandCasinoDynamicGroup';
  root.add(dynamicIndoorGroup);

  const { rouletteRotor } = populateCasinoInteriorProps(
    staticIndoorGroup,
    dynamicIndoorGroup,
    styler,
    tex,
  );

  // Bake entire room shell + 1:1 furniture into 2 draw calls (1 opaque atlas+cel + 1 stroke),
  // and bake the rotating roulette rotor into 1 draw call!
  bakeCasinoGroup(staticIndoorGroup, casinoBakedMaterial, casinoStrokeMaterial);
  bakeCasinoGroup(rouletteRotor, casinoBakedMaterial, casinoStrokeMaterial);

  // 5. Exit Door Glowing Floor Pad at North Mahogany Double Doors
  const exitPad = buildGlowingDoorFloorArrowPad();
  exitPad.group.position.set(
    CASINO_STATION_TARGETS.exitDoor.x,
    0.035,
    CASINO_STATION_TARGETS.exitDoor.z,
  );
  root.add(exitPad.group);

  // 6. GPU-Instanced Interactive Station Chevrons (10 Chevrons -> 2 Draw Calls!)
  const markerSpecs: Array<{
    key: keyof CasinoInteriorSceneHandle['interactiveMarkers'];
    target: { x: number; z: number; markerY: number };
    scaleMult: number;
    idleColor: string;
  }> = [
    { key: 'cashierCage', target: CASINO_STATION_TARGETS.cashierCage, scaleMult: 1.1, idleColor: '#38bdf8' },
    { key: 'luxuryBar', target: CASINO_STATION_TARGETS.luxuryBar, scaleMult: 1.1, idleColor: '#38bdf8' },
    { key: 'rouletteTable', target: CASINO_STATION_TARGETS.rouletteTable, scaleMult: 1.1, idleColor: '#38bdf8' },
    { key: 'blackjackCenter', target: CASINO_STATION_TARGETS.blackjackCenter, scaleMult: 1.0, idleColor: '#38bdf8' },
    { key: 'blackjackMidRight', target: CASINO_STATION_TARGETS.blackjackMidRight, scaleMult: 1.0, idleColor: '#38bdf8' },
    { key: 'blackjackEastSalon', target: CASINO_STATION_TARGETS.blackjackEastSalon, scaleMult: 1.0, idleColor: '#38bdf8' },
    { key: 'slotWestBank', target: CASINO_STATION_TARGETS.slotWestBank, scaleMult: 1.0, idleColor: '#22d3ee' },
    { key: 'slotIslandBank', target: CASINO_STATION_TARGETS.slotIslandBank, scaleMult: 1.0, idleColor: '#22d3ee' },
    { key: 'slotNorthBank', target: CASINO_STATION_TARGETS.slotNorthBank, scaleMult: 1.0, idleColor: '#22d3ee' },
    { key: 'slotEastBank', target: CASINO_STATION_TARGETS.slotEastBank, scaleMult: 1.0, idleColor: '#22d3ee' },
  ];

  const baseChevronGeo = new THREE.ConeGeometry(0.10, 0.20, 4);
  baseChevronGeo.rotateX(Math.PI);
  const baseChevronMat = new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false });
  const chevronInst = new THREE.InstancedMesh(baseChevronGeo, baseChevronMat, markerSpecs.length);
  chevronInst.name = 'CasinoStationChevronInstanced';
  chevronInst.frustumCulled = false;
  chevronInst.raycast = () => {};
  root.add(chevronInst);

  const strokeRef = createBlitzStrokeMesh(baseChevronGeo, 0.010, '#ffffff');
  let chevronStrokeInst: THREE.InstancedMesh | null = null;
  if (strokeRef) {
    chevronStrokeInst = new THREE.InstancedMesh(
      strokeRef.geometry,
      strokeRef.material,
      markerSpecs.length,
    );
    chevronStrokeInst.name = 'CasinoStationChevronStrokeInstanced';
    chevronStrokeInst.frustumCulled = false;
    chevronStrokeInst.raycast = () => {};
    root.add(chevronStrokeInst);
  }

  // Lightweight state-holder proxies preserving the exact CompactInteractiveChevronMarker contract
  const makeProxyMarker = (
    target: { x: number; z: number; markerY: number },
    idleColor: string,
  ): CompactInteractiveChevronMarker => {
    const group = new THREE.Group();
    group.position.set(target.x, target.markerY, target.z);
    const chevronMat = new THREE.MeshBasicMaterial({ color: idleColor, fog: false });
    const chevronArrow = new THREE.Mesh(baseChevronGeo, chevronMat);
    group.add(chevronArrow);
    return { group, chevronArrow, chevronMat };
  };

  const interactiveMarkers = {
    cashierCage: makeProxyMarker(CASINO_STATION_TARGETS.cashierCage, '#38bdf8'),
    luxuryBar: makeProxyMarker(CASINO_STATION_TARGETS.luxuryBar, '#38bdf8'),
    rouletteTable: makeProxyMarker(CASINO_STATION_TARGETS.rouletteTable, '#38bdf8'),
    blackjackCenter: makeProxyMarker(CASINO_STATION_TARGETS.blackjackCenter, '#38bdf8'),
    blackjackMidRight: makeProxyMarker(CASINO_STATION_TARGETS.blackjackMidRight, '#38bdf8'),
    blackjackEastSalon: makeProxyMarker(CASINO_STATION_TARGETS.blackjackEastSalon, '#38bdf8'),
    slotWestBank: makeProxyMarker(CASINO_STATION_TARGETS.slotWestBank, '#22d3ee'),
    slotIslandBank: makeProxyMarker(CASINO_STATION_TARGETS.slotIslandBank, '#22d3ee'),
    slotNorthBank: makeProxyMarker(CASINO_STATION_TARGETS.slotNorthBank, '#22d3ee'),
    slotEastBank: makeProxyMarker(CASINO_STATION_TARGETS.slotEastBank, '#22d3ee'),
  };

  // 7. GPU-Instanced Seat Disc Indicators (29 Dual-Disc Pairs -> 2 Draw Calls!)
  const seatCount = CASINO_INTERIOR_SEAT_SPOTS.length;
  const outerCoinGeo = new THREE.CylinderGeometry(1, 1, 1, 24);
  outerCoinGeo.rotateX(Math.PI / 2);
  const outerCoinMat = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.74,
    depthWrite: false,
    fog: false,
  });
  const outerCoinInst = new THREE.InstancedMesh(outerCoinGeo, outerCoinMat, seatCount);
  outerCoinInst.name = 'CasinoSeatOuterCoinInstanced';
  outerCoinInst.frustumCulled = false;
  outerCoinInst.raycast = () => {};
  root.add(outerCoinInst);

  const innerCoinGeo = new THREE.CylinderGeometry(0.68, 0.68, 1, 20);
  innerCoinGeo.rotateX(Math.PI / 2);
  const innerCoinMat = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    fog: false,
  });
  const innerCoinInst = new THREE.InstancedMesh(innerCoinGeo, innerCoinMat, seatCount);
  innerCoinInst.name = 'CasinoSeatInnerCoinInstanced';
  innerCoinInst.frustumCulled = false;
  innerCoinInst.raycast = () => {};
  root.add(innerCoinInst);

  const floorSpotIndicators = CASINO_INTERIOR_SEAT_SPOTS.map((spot) => {
    const coinRoot = new THREE.Group();
    coinRoot.position.set(spot.x, spot.indicatorHeightY, spot.z);
    const blueCoin = new THREE.Group();
    const greenCoin = new THREE.Group();
    greenCoin.visible = false;
    coinRoot.add(blueCoin, greenCoin);
    return { coinRoot, blueCoin, greenCoin };
  });

  const dummyPos = new THREE.Vector3();
  const dummyQuat = new THREE.Quaternion();
  const dummyScale = new THREE.Vector3();
  const dummyMatrix = new THREE.Matrix4();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const activeColor = new THREE.Color('#b8ff3c');
  const blueOuterCol = new THREE.Color('#38bdf8');
  const blueInnerCol = new THREE.Color('#7dd3fc');
  const greenOuterCol = new THREE.Color('#b8ff3c');
  const greenInnerCol = new THREE.Color('#d9f99d');
  const markerIdleColors = markerSpecs.map((s) => new THREE.Color(s.idleColor));

  const syncInstances = (
    timeSec: number,
    activeStationKind: CasinoStationInteractionKind | null,
    playerX: number,
    playerZ: number,
  ) => {
    // Nearest blackjack / slot bank proximity highlight
    const bjTargets = [
      CASINO_STATION_TARGETS.blackjackCenter,
      CASINO_STATION_TARGETS.blackjackMidRight,
      CASINO_STATION_TARGETS.blackjackEastSalon,
    ];
    let nearestBjIdx = -1;
    if (activeStationKind === 'blackjack_table') {
      let bestD = Infinity;
      bjTargets.forEach((bt, idx) => {
        const d = Math.hypot(playerX - bt.x, playerZ - bt.z);
        if (d < bestD) {
          bestD = d;
          nearestBjIdx = idx;
        }
      });
    }

    const slotTargets = [
      CASINO_STATION_TARGETS.slotWestBank,
      CASINO_STATION_TARGETS.slotIslandBank,
      CASINO_STATION_TARGETS.slotNorthBank,
      CASINO_STATION_TARGETS.slotEastBank,
    ];
    let nearestSlotIdx = -1;
    if (activeStationKind === 'slot_machine') {
      let bestD = Infinity;
      slotTargets.forEach((st, idx) => {
        const d = Math.hypot(playerX - st.x, playerZ - st.z);
        if (d < bestD) {
          bestD = d;
          nearestSlotIdx = idx;
        }
      });
    }

    const activeFlags = [
      activeStationKind === 'cashier_cage',
      activeStationKind === 'luxury_bar',
      activeStationKind === 'roulette_table',
      nearestBjIdx === 0,
      nearestBjIdx === 1,
      nearestBjIdx === 2,
      nearestSlotIdx === 0,
      nearestSlotIdx === 1,
      nearestSlotIdx === 2,
      nearestSlotIdx === 3,
    ];

    for (let idx = 0; idx < markerSpecs.length; idx++) {
      const spec = markerSpecs[idx];
      const isActive = activeFlags[idx];
      const proxy = interactiveMarkers[spec.key];
      const s = spec.scaleMult * (isActive ? 1.18 : 1.0);
      const bobY = spec.target.markerY + Math.sin(timeSec * 3.6 + idx * 0.5) * 0.04;
      const rotY = timeSec * 1.6 + idx * 0.4;

      proxy.chevronArrow.position.y = bobY - spec.target.markerY;
      proxy.chevronArrow.rotation.y = rotY;
      proxy.chevronArrow.scale.setScalar(s);
      proxy.chevronMat.color.copy(isActive ? activeColor : markerIdleColors[idx]);

      dummyPos.set(spec.target.x, bobY, spec.target.z);
      dummyQuat.setFromAxisAngle(yAxis, rotY);
      dummyScale.setScalar(s);
      dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);
      chevronInst.setMatrixAt(idx, dummyMatrix);
      chevronInst.setColorAt(idx, isActive ? activeColor : markerIdleColors[idx]);
      if (chevronStrokeInst) {
        chevronStrokeInst.setMatrixAt(idx, dummyMatrix);
      }
    }
    chevronInst.instanceMatrix.needsUpdate = true;
    if (chevronInst.instanceColor) chevronInst.instanceColor.needsUpdate = true;
    if (chevronStrokeInst) chevronStrokeInst.instanceMatrix.needsUpdate = true;

    for (let idx = 0; idx < seatCount; idx++) {
      const spot = CASINO_INTERIOR_SEAT_SPOTS[idx];
      const entry = floorSpotIndicators[idx];
      if (!entry.coinRoot.visible) {
        dummyPos.set(spot.x, spot.indicatorHeightY, spot.z);
        dummyQuat.identity();
        dummyScale.set(0, 0, 0);
        dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);
        outerCoinInst.setMatrixAt(idx, dummyMatrix);
        innerCoinInst.setMatrixAt(idx, dummyMatrix);
        outerCoinInst.setColorAt(idx, blueOuterCol);
        innerCoinInst.setColorAt(idx, blueInnerCol);
        continue;
      }

      const isGreen = entry.greenCoin.visible;
      const baseY = spot.indicatorHeightY;
      const posY = baseY + Math.sin(timeSec * 3.4 + idx * 0.7) * 0.022;
      const rotY = timeSec * 2.0 + idx * 0.5;
      entry.coinRoot.position.y = posY;
      entry.coinRoot.rotation.y = rotY;

      const r =
        (isGreen
          ? CAFE_GLOBAL_SCALE_SPEC.interiorSeatIndicatorGreenRadiusM
          : CAFE_GLOBAL_SCALE_SPEC.interiorSeatIndicatorBlueRadiusM) * 0.95;
      const thick = (isGreen ? 0.020 : 0.018) * 0.95;
      const innerThick = thick + 0.003 * 0.95;

      dummyPos.set(spot.x, posY, spot.z);
      dummyQuat.setFromAxisAngle(yAxis, rotY);

      dummyScale.set(r, r, thick);
      dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);
      outerCoinInst.setMatrixAt(idx, dummyMatrix);
      outerCoinInst.setColorAt(idx, isGreen ? greenOuterCol : blueOuterCol);

      dummyScale.set(r, r, innerThick);
      dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);
      innerCoinInst.setMatrixAt(idx, dummyMatrix);
      innerCoinInst.setColorAt(idx, isGreen ? greenInnerCol : blueInnerCol);
    }
    outerCoinInst.instanceMatrix.needsUpdate = true;
    innerCoinInst.instanceMatrix.needsUpdate = true;
    if (outerCoinInst.instanceColor) outerCoinInst.instanceColor.needsUpdate = true;
    if (innerCoinInst.instanceColor) innerCoinInst.instanceColor.needsUpdate = true;
  };

  // Initialize instance matrices and colors cleanly prior to first render
  syncInstances(0, null, 0, 0);

  const updateVisuals = (
    timeSec: number,
    activeStationKind: CasinoStationInteractionKind | null = null,
    playerX = 0,
    playerZ = 0,
  ) => {
    // 1. Smoothly spin the baked European Roulette rotor
    rouletteRotor.rotation.y = timeSec * 1.45;

    // 2. Exit door floor pad pulse
    const nearExit = activeStationKind === 'exit_door';
    exitPad.pulseMat.color.set(nearExit ? '#b8ff3c' : '#38bdf8');
    exitPad.innerDiscMat.color.set(nearExit ? '#84cc16' : '#0ea5e9');
    exitPad.arrowMat.color.set(nearExit ? '#b8ff3c' : '#38bdf8');
    exitPad.chevronArrow.scale.setScalar(nearExit ? 1.14 : 1.0);
    exitPad.pulseMat.opacity = 0.55 + Math.sin(timeSec * 3.8) * 0.25;
    exitPad.chevronArrow.position.y = 0.65 + Math.sin(timeSec * 3.5) * 0.12;
    exitPad.chevronArrow.rotation.y = timeSec * 1.4;

    // 3. GPU-instanced station chevrons + 29 seat discs
    syncInstances(timeSec, activeStationKind, playerX, playerZ);
  };

  const dispose = () => {
    const disposedGeos = new Set<THREE.BufferGeometry>();
    const disposedMats = new Set<THREE.Material>();
    root.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.geometry && !disposedGeos.has(m.geometry)) {
        disposedGeos.add(m.geometry);
        m.geometry.dispose();
      }
      if (m.material) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          if (!disposedMats.has(mat)) {
            disposedMats.add(mat);
            mat.dispose();
          }
        }
      }
    });
    for (const marker of Object.values(interactiveMarkers)) {
      marker.chevronMat.dispose();
    }
    atlas.atlasTexture.dispose();
    for (const t of tex.allTextures) {
      t.dispose();
    }
  };

  return {
    root,
    floorSpotIndicators,
    interactiveMarkers,
    updateVisuals,
    dispose,
  };
}
