import * as THREE from 'three';
import {
  CAFE_APPLIANCE_TARGETS,
  CAFE_GLOBAL_SCALE_SPEC,
  CAFE_INTERIOR_BOUNDS,
  CAFE_INTERIOR_SEAT_SPOTS,
  CAFE_ORIGIN_Y,
  type CafeStationInteractionKind,
} from './buddiesCafeRules';
import { bakeStaticGroupMeshes, createBlitzStrokeMesh } from './buddiesBlitzShadersAndAssets';
import {
  type CafeAssetStyler,
  buildBentwoodRattanChair,
  buildCompleteEspressoBarAssembly,
  buildHangingMacrameFern,
  buildJoinedShiftBoardCounterWing,
  buildLShapedGlasshouseArchitecture,
  buildPottedMonsteraOnStand,
  buildRoundOakBistroTable,
  buildStandaloneArcadeCabinet,
  buildStandardBankCashAtm,
  buildTuftedLeatherBanquette,
  buildWisteriaCluster,
  createCarraraMarbleTexture,
  createChalkboardMenuTexture,
  createFlutedOakTexture,
  createFrostedConservatoryGlassMaterial,
  createHerringboneParquetTexture,
  createRattanCaneTexture,
  createSandstoneFlagstoneTexture,
  createWarmOakWoodTexture,
  makeRoundedBoxGeo,
} from './buddiesLShapedCafeAssets';

export interface CafeInteriorObbCollider {
  id: string;
  x: number;
  z: number;
  hw: number;
  hd: number;
  ry: number;
}

export const CAFE_INTERIOR_COLLIDERS: ReadonlyArray<CafeInteriorObbCollider> = [
  // Main Fluted Oak & Carrara Marble Barista Counter (shifted forward to z = -2.05 so back face sits dead-flush at baristaDeck border z = -2.47, 0.96x human scale)
  { id: 'cafe_barista_counter', x: -0.45, z: -2.05, hw: 2.54, hd: 0.49, ry: 0 },
  // Left L-Return Wing of Espresso Bar
  { id: 'cafe_barista_wing', x: -2.50, z: -3.25, hw: 0.48, hd: 1.18, ry: 0 },
  // Back Espresso Credenza Wall (front edge at z = -4.23 -> 1.76m spacious barista workspace behind front counter, flush to rear wall)
  { id: 'cafe_back_bar', x: -0.45, z: -4.72, hw: 2.54, hd: 0.50, ry: 0 },
  // Seamless Joined Wooden Base Cabinet + 1:1 Wall-Mounted Work Shift Board (flush to cafe_back_bar right edge & rear wall, zero side/rear gap)
  { id: 'cafe_rota_board', x: 3.04, z: -4.72, hw: 1.02, hd: 0.50, ry: 0 },
  // Standard Bank Cash ATM Terminal (flush against rear wall at z = -4.95, rotation.y = 0, zero rear gap)
  { id: 'cafe_atm_terminal', x: -4.25, z: -4.95, hw: 0.42, hd: 0.36, ry: 0 },
  // Standalone Arcade Cabinet Machine (flush against East conservatory wall at x = 6.50, z = 4.33, zero rear gap)
  { id: 'cafe_arcade_cabinet', x: 6.50, z: 4.33, hw: 0.38, hd: 0.42, ry: 0 },
  // Bistro Tables (East & West windows, 0.96x 1:1 human posture scale)
  { id: 'cafe_table_e1', x: 5.28, z: -0.85, hw: 0.53, hd: 0.53, ry: 0 },
  { id: 'cafe_table_e2', x: 5.28, z: 1.55, hw: 0.53, hd: 0.53, ry: 0 },
  { id: 'cafe_table_w1', x: -5.45, z: -0.65, hw: 0.53, hd: 0.53, ry: 0 },
  { id: 'cafe_table_w2', x: -5.45, z: 1.85, hw: 0.53, hd: 0.53, ry: 0 },
  // East Tufted Leather Banquette Alcove
  { id: 'cafe_banquette_e', x: 6.22, z: 0.35, hw: 0.34, hd: 1.18, ry: 0 },
  // Projecting Left (+X) L-Wing Lounge (Banquette + Bistro Table + Wing Corner Planters)
  { id: 'cafe_wing_banquette', x: 6.22, z: 7.45, hw: 0.34, hd: 1.10, ry: 0 },
  { id: 'cafe_wing_table', x: 5.28, z: 7.45, hw: 0.53, hd: 0.53, ry: 0 },
  { id: 'cafe_planter_wing_se', x: 6.02, z: 9.02, hw: 0.38, hd: 0.38, ry: 0 },
  { id: 'cafe_planter_wing_sw', x: 2.35, z: 9.02, hw: 0.38, hd: 0.38, ry: 0 },
  // Main Hall Corner Decorative Monstera Stands (leaving +X L-Wing entrance wide open!)
  { id: 'cafe_planter_nw', x: -6.02, z: -4.60, hw: 0.38, hd: 0.38, ry: 0 },
  { id: 'cafe_planter_ne', x: 6.02, z: -4.60, hw: 0.38, hd: 0.38, ry: 0 },
  { id: 'cafe_planter_sw', x: -6.02, z: 4.52, hw: 0.38, hd: 0.38, ry: 0 },
];

export interface CompactInteractiveChevronMarker {
  group: THREE.Group;
  chevronArrow: THREE.Mesh;
  chevronMat: THREE.MeshBasicMaterial;
}

export interface CafeInteriorSceneHandle {
  root: THREE.Group;
  floorSpotIndicators: Array<{
    coinRoot: THREE.Group;
    blueCoin: THREE.Object3D;
    greenCoin: THREE.Object3D;
  }>;
  baristaReadyGlow: THREE.Mesh;
  customerBubbleGroup: THREE.Group;
  customerBubbleQuad: THREE.Mesh;
  interactiveMarkers: {
    atm: CompactInteractiveChevronMarker;
    workShiftBoard: CompactInteractiveChevronMarker;
    orderPosRegister: CompactInteractiveChevronMarker;
    drinkEspressoMachine: CompactInteractiveChevronMarker;
    pastryDisplayCase: CompactInteractiveChevronMarker;
  };
  updateVisuals: (
    timeSec: number,
    isWorking: boolean,
    activeOrderCategory?: 'drink' | 'pastry' | null,
    activeStationKind?: CafeStationInteractionKind | null,
  ) => void;
  setCustomerOrderSign: (visible: boolean, label: string, accentHex: string) => void;
}

function makeHanaToonMesh(
  geo: THREE.BufferGeometry,
  colorHex: string,
  roughness = 0.56,
  metalness = 0.08,
  strokeW = 0.005,
  extraMatProps?: Partial<THREE.MeshPhysicalMaterialParameters>,
): THREE.Mesh {
  const mat = new THREE.MeshPhysicalMaterial({
    color: colorHex,
    roughness,
    metalness,
    clearcoat: 0.22,
    clearcoatRoughness: 0.25,
    envMapIntensity: 0.78,
    fog: false,
    ...extraMatProps,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.raycast = () => {};
  if (strokeW > 0) {
    const stroke = createBlitzStrokeMesh(geo, strokeW, '#12121e');
    if (stroke) {
      stroke.raycast = () => {};
      mesh.add(stroke);
    }
  }
  return mesh;
}

function createInteriorCafeStyler(withCrispInkOutlines = true): CafeAssetStyler {
  const clearGlassMat = new THREE.MeshPhysicalMaterial({
    color: '#dff6ff',
    transparent: true,
    opacity: 0.20,
    roughness: 0.08,
    metalness: 0.04,
    clearcoat: 0.65,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
  });

  const frostedGlassMat = createFrostedConservatoryGlassMaterial();
  const matCache = new Map<string, THREE.Material>();

  return {
    clearGlassMat,
    frostedGlassMat,
    preserveTextures: true,
    styleOpaque: (mesh, geo, colorHex, strokeW = 0.005, opts) => {
      const usePhysical =
        (opts?.clearcoat ?? 0) > 0 || (opts?.sheen ?? 0) > 0 || (opts?.metalness ?? 0) > 0.14;
      const effectiveColor = opts?.tex && !opts?.tintTex ? '#ffffff' : colorHex;
      const cacheKey = [
        usePhysical ? 'P' : 'S',
        effectiveColor.toLowerCase(),
        opts?.tex?.uuid ?? '',
        opts?.bumpMap?.uuid ?? '',
        (opts?.bumpScale ?? 0.008).toFixed(3),
        (opts?.roughness ?? 0.58).toFixed(2),
        (opts?.metalness ?? 0.05).toFixed(2),
        (opts?.clearcoat ?? 0.30).toFixed(2),
        (opts?.clearcoatRoughness ?? 0.24).toFixed(2),
        (opts?.sheen ?? 0).toFixed(2),
        opts?.flatShading ? '1' : '0',
        opts?.doubleSided ? '1' : '0',
        (opts?.emissiveHex ?? '').toLowerCase(),
        (opts?.emissiveIntensity ?? 0).toFixed(2),
      ].join('|');

      let sharedMat = matCache.get(cacheKey);
      if (!sharedMat) {
        const matParams: THREE.MeshPhysicalMaterialParameters = {
          color: effectiveColor,
          map: opts?.tex ?? null,
          bumpMap: opts?.bumpMap ?? null,
          bumpScale: opts?.bumpScale ?? 0.008,
          roughness: opts?.roughness ?? 0.58,
          metalness: opts?.metalness ?? 0.05,
          flatShading: opts?.flatShading ?? false,
          side: opts?.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
          emissive: opts?.emissiveHex ? new THREE.Color(opts.emissiveHex) : new THREE.Color(0x000000),
          emissiveIntensity: opts?.emissiveIntensity ?? 0,
          fog: false,
        };
        if (usePhysical) {
          matParams.clearcoat = opts?.clearcoat ?? 0.30;
          matParams.clearcoatRoughness = opts?.clearcoatRoughness ?? 0.24;
          matParams.envMapIntensity = 0.85;
          if (opts?.sheen) {
            matParams.sheen = opts.sheen;
            matParams.sheenRoughness = opts.sheenRoughness ?? 0.48;
            matParams.sheenColor = new THREE.Color('#fff7eb');
          }
          sharedMat = new THREE.MeshPhysicalMaterial(matParams);
        } else {
          sharedMat = new THREE.MeshStandardMaterial(matParams);
        }
        matCache.set(cacheKey, sharedMat);
      }

      mesh.material = sharedMat;
      mesh.castShadow = opts?.castShadow ?? false;
      mesh.receiveShadow = opts?.receiveShadow ?? true;
      mesh.raycast = () => {};
      if (withCrispInkOutlines && strokeW > 0 && !opts?.doubleSided) {
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

function createMistyConservatorySkyTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, '#bde2f5');
    grad.addColorStop(0.32, '#d8eff9');
    grad.addColorStop(0.46, '#ebf6fb');
    grad.addColorStop(0.62, '#eef7fb');
    grad.addColorStop(1.0, '#e3eff5');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createFeatheredMistVeilTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 256);
    // Soft horizontal + vertical feathered mist band (zero hard border edges)
    const vGrad = ctx.createLinearGradient(0, 0, 0, 256);
    vGrad.addColorStop(0.0, 'rgba(236, 246, 252, 0.0)');
    vGrad.addColorStop(0.24, 'rgba(236, 246, 252, 0.55)');
    vGrad.addColorStop(0.62, 'rgba(238, 247, 252, 0.85)');
    vGrad.addColorStop(0.88, 'rgba(236, 246, 252, 0.45)');
    vGrad.addColorStop(1.0, 'rgba(236, 246, 252, 0.0)');
    ctx.fillStyle = vGrad;
    ctx.fillRect(0, 0, 256, 256);

    // Multiply soft horizontal edge feathering so mist panels blend seamlessly
    ctx.globalCompositeOperation = 'destination-in';
    const hGrad = ctx.createLinearGradient(0, 0, 256, 0);
    hGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
    hGrad.addColorStop(0.16, 'rgba(255, 255, 255, 0.92)');
    hGrad.addColorStop(0.5, 'rgba(255, 255, 255, 1.0)');
    hGrad.addColorStop(0.84, 'rgba(255, 255, 255, 0.92)');
    hGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = hGrad;
    ctx.fillRect(0, 0, 256, 256);
    ctx.globalCompositeOperation = 'source-over';
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Applies distance-graded conservatory mist + contrast softening exclusively to
 * outdoor background meshes in `cafe_interior` while leaving every indoor object at 0% mist.
 */
function applyExteriorBackdropSoftMist(backdropGroup: THREE.Object3D): void {
  const patchedMaterials = new Map<THREE.Material, THREE.Material>();

  backdropGroup.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if (obj.userData.skipExteriorMistShader) return;
    const srcMat = obj.material;
    if (Array.isArray(srcMat) || !(srcMat instanceof THREE.MeshStandardMaterial)) return;

    let mistMat = patchedMaterials.get(srcMat);
    if (!mistMat) {
      const cloned = srcMat.clone();
      cloned.fog = false;
      cloned.customProgramCacheKey = () => 'cafe-exterior-soft-mist-v2';
      cloned.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            `#include <common>
varying vec3 vExtMistWorldPos;`,
          )
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
vExtMistWorldPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;`,
          );

        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>
varying vec3 vExtMistWorldPos;`,
          )
          .replace(
            '#include <opaque_fragment>',
            `{
  vec3 cafeLoc = vExtMistWorldPos - vec3( 0.0, ${CAFE_ORIGIN_Y.toFixed(1)}, 0.0 );
  vec2 dMain = max( abs( cafeLoc.xz ) - vec2( 6.80, 5.25 ), 0.0 );
  float distMain = length( dMain );
  vec2 dWing = max( abs( cafeLoc.xz - vec2( 4.225, 7.45 ) ) - vec2( 2.575, 2.20 ), 0.0 );
  float distWing = length( dWing );
  float distOutside = min( distMain, distWing );
  float mistNear = smoothstep( 0.05, 0.90, distOutside );
  float mistFar = smoothstep( 1.20, 13.0, distOutside );
  float heightSoft = 1.0 - smoothstep( 0.20, 3.8, cafeLoc.y ) * 0.16;
  float mistAmt = clamp( ( 0.24 * mistNear + 0.34 * mistFar ) * heightSoft, 0.0, 0.58 );
  float lum = dot( outgoingLight, vec3( 0.299, 0.587, 0.114 ) );
  vec3 softDesat = mix( outgoingLight, vec3( lum ), mistAmt * 0.36 );
  vec3 dreamyMistTint = vec3( 0.88, 0.945, 0.975 );
  outgoingLight = mix( softDesat, dreamyMistTint, mistAmt );
}
#include <opaque_fragment>`,
          );
      };
      patchedMaterials.set(srcMat, cloned);
      mistMat = cloned;
    }
    obj.material = mistMat;
  });
}

function createSoftFocusBlurShellMaterial(baseColor: THREE.Color, inflateMeters: number, opacity: number): THREE.MeshBasicMaterial {
  const haloColor = baseColor.clone().lerp(new THREE.Color('#eaf5fb'), 0.44);
  const mat = new THREE.MeshBasicMaterial({
    color: haloColor,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.FrontSide,
    fog: false,
  });
  const cacheKey = `cafe-soft-blur-shell-${inflateMeters.toFixed(3)}`;
  mat.customProgramCacheKey = () => cacheKey;
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vec3 blurSafeN = length( normal ) > 0.001 ? normalize( normal ) : vec3( 0.0 );
transformed += blurSafeN * ${inflateMeters.toFixed(4)};`,
    );
  };
  return mat;
}

/**
 * Adds soft normal-inflated translucent halo shells around outdoor 3D props
 * so their silhouettes appear optically out-of-focus (`efek kabut/blur lembut`)
 * when viewed from inside the tack-sharp conservatory room.
 */
function addSoftFocusBlurShells(targetRoot: THREE.Object3D, shellConfigs: ReadonlyArray<[number, number]>): void {
  const sourceMeshes: THREE.Mesh[] = [];
  targetRoot.traverse((obj) => {
    if (obj instanceof THREE.Mesh && !obj.userData.isBlurShell && obj.geometry.attributes.normal) {
      sourceMeshes.push(obj);
    }
  });

  const matCache = new Map<string, THREE.MeshBasicMaterial>();
  for (const src of sourceMeshes) {
    const baseCol =
      src.material instanceof THREE.MeshStandardMaterial || src.material instanceof THREE.MeshBasicMaterial
        ? src.material.color
        : new THREE.Color('#dbeaf2');
    const hexKey = baseCol.getHexString();

    for (const [inflate, opacity] of shellConfigs) {
      const key = `${hexKey}_${inflate.toFixed(3)}_${opacity.toFixed(2)}`;
      let haloMat = matCache.get(key);
      if (!haloMat) {
        haloMat = createSoftFocusBlurShellMaterial(baseCol, inflate, opacity);
        matCache.set(key, haloMat);
      }
      const shell = new THREE.Mesh(src.geometry, haloMat);
      shell.userData.isBlurShell = true;
      shell.userData.skipExteriorMistShader = true;
      shell.renderOrder = 1;
      shell.castShadow = false;
      shell.receiveShadow = false;
      shell.raycast = () => {};
      src.add(shell);
    }
  }
}

export function buildGlowingDoorFloorArrowPad(): {
  group: THREE.Group;
  pulseMat: THREE.MeshBasicMaterial;
  innerDiscMat: THREE.MeshBasicMaterial;
  arrowMat: THREE.MeshBasicMaterial;
  chevronArrow: THREE.Mesh;
} {
  const group = new THREE.Group();
  const pulseMat = new THREE.MeshBasicMaterial({
    color: '#38bdf8',
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const outerRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 28), pulseMat);
  outerRing.rotation.x = -Math.PI / 2;
  outerRing.position.y = 0.02;
  outerRing.raycast = () => {};
  group.add(outerRing);

  const innerDiscMat = new THREE.MeshBasicMaterial({
    color: '#0ea5e9',
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const innerDisc = new THREE.Mesh(new THREE.CircleGeometry(0.46, 24), innerDiscMat);
  innerDisc.rotation.x = -Math.PI / 2;
  innerDisc.position.y = 0.016;
  innerDisc.raycast = () => {};
  group.add(innerDisc);

  const arrowMat = new THREE.MeshBasicMaterial({ color: '#38bdf8' });
  const chevronArrow = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.42, 4), arrowMat);
  chevronArrow.rotation.x = Math.PI;
  chevronArrow.position.y = 0.65;
  chevronArrow.raycast = () => {};
  const stroke = createBlitzStrokeMesh(chevronArrow.geometry, 0.015, '#ffffff');
  if (stroke) {
    stroke.raycast = () => {};
    chevronArrow.add(stroke);
  }
  group.add(chevronArrow);

  return { group, pulseMat, innerDiscMat, arrowMat, chevronArrow };
}

/**
 * Compact ring-less floating 3D triangle indicator (`tanpa cincin, hanya bentuk segitiga kecil saja`)
 * placed cleanly above interactive trigger items (ATM, Kiosks, Work Shift Board, POS Register,
 * and contextual Pastry Display Case / Espresso Drink Machine during Barista Work Shifts).
 */
export function buildCompactInteractiveChevronMarker(
  radius = 0.095,
  height = 0.19,
  colorHex = '#38bdf8',
): CompactInteractiveChevronMarker {
  const group = new THREE.Group();
  const chevronMat = new THREE.MeshBasicMaterial({ color: colorHex, fog: false });
  const chevronArrow = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 4), chevronMat);
  chevronArrow.rotation.x = Math.PI;
  chevronArrow.raycast = () => {};
  const stroke = createBlitzStrokeMesh(chevronArrow.geometry, 0.010, '#ffffff');
  if (stroke) {
    stroke.raycast = () => {};
    chevronArrow.add(stroke);
  }
  group.add(chevronArrow);
  return { group, chevronArrow, chevronMat };
}

export function buildBotanicalGlasshouseCafeInterior(): CafeInteriorSceneHandle {
  const root = new THREE.Group();
  root.name = 'BotanicalGlasshouseCafeInterior3D';
  root.position.set(0, CAFE_ORIGIN_Y, 0);
  root.visible = false;

  const styler = createInteriorCafeStyler(true);
  // Dedicated outline-free styler for outdoor background props so they look softly defocused rather than comic-outlined
  const outdoorBackdropStyler = createInteriorCafeStyler(false);
  const herringboneTex = createHerringboneParquetTexture(1.35, 1.35);
  const flutedTex = createFlutedOakTexture(1.5, 1);
  const marbleTex = createCarraraMarbleTexture();
  const rattanTex = createRattanCaneTexture();
  const menuTex = createChalkboardMenuTexture();
  const oakTex = createWarmOakWoodTexture(1, 1);
  const plazaTileTex = createSandstoneFlagstoneTexture(1.6, 1.6);

  // 1. Soft Misty Outdoor Backdrop Group (100% isolated from sharp indoor meshes!)
  const outdoorBackdropGroup = new THREE.Group();
  outdoorBackdropGroup.name = 'CafeOutdoorSoftMistBackdrop';
  root.add(outdoorBackdropGroup);

  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(62, 24, 16),
    new THREE.MeshBasicMaterial({
      map: createMistyConservatorySkyTexture(),
      side: THREE.BackSide,
      fog: false,
    }),
  );
  skyDome.userData.skipExteriorMistShader = true;
  skyDome.raycast = () => {};
  outdoorBackdropGroup.add(skyDome);

  const gardenLawn = new THREE.Mesh(
    new THREE.PlaneGeometry(88, 88),
    new THREE.MeshStandardMaterial({ color: '#70a83b', roughness: 0.9, metalness: 0, fog: false }),
  );
  gardenLawn.rotation.x = -Math.PI / 2;
  gardenLawn.position.y = -0.22;
  gardenLawn.raycast = () => {};
  outdoorBackdropGroup.add(gardenLawn);

  // Warm Central Plaza Cream Limestone Deck surrounding the Glasshouse (softly misted outside windows)
  const plazaTerrace = new THREE.Mesh(
    makeRoundedBoxGeo(26.0, 0.14, 28.0, 0.03, 2),
    new THREE.MeshStandardMaterial({
      color: '#ede3ce',
      map: plazaTileTex,
      roughness: 0.82,
      metalness: 0.02,
      fog: false,
    }),
  );
  plazaTerrace.position.set(0, -0.12, 2.2);
  plazaTerrace.receiveShadow = true;
  plazaTerrace.raycast = () => {};
  outdoorBackdropGroup.add(plazaTerrace);

  // Plaza Perimeter Balustrade Fence + Timber Top Rail outside Conservatory Windows (outline-free + softly blurred)
  const fenceGroup = new THREE.Group();
  for (const [bx, bz, bw, bd] of [
    [0, -8.4, 22.0, 0.18],
    [-10.8, 2.2, 0.18, 21.2],
    [10.8, 2.2, 0.18, 21.2],
    [0, 12.8, 22.0, 0.18],
  ] as [number, number, number, number][]) {
    const rail = makeHanaToonMesh(makeRoundedBoxGeo(bw, 0.10, bd, 0.02, 2), '#c88d52', 0.65, 0.04, 0);
    rail.castShadow = false;
    rail.position.set(bx, 0.88, bz);
    fenceGroup.add(rail);
    const glassBalustrade = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(0.06, bw - 0.04), 0.72, Math.max(0.06, bd - 0.04)),
      outdoorBackdropStyler.frostedGlassMat ?? outdoorBackdropStyler.clearGlassMat,
    );
    glassBalustrade.userData.skipExteriorMistShader = true;
    glassBalustrade.position.set(bx, 0.45, bz);
    glassBalustrade.raycast = () => {};
    fenceGroup.add(glassBalustrade);
  }
  addSoftFocusBlurShells(fenceGroup, [
    [0.032, 0.28],
    [0.068, 0.16],
  ]);
  outdoorBackdropGroup.add(fenceGroup);

  // Outdoor Parasol Bistro Table visible across the Right (-X) Courtyard Patio (outline-free + optical blur shells)
  const outdoorParasolGrp = new THREE.Group();
  outdoorParasolGrp.position.set(-3.4, -0.02, 7.8);
  const pTbl = buildRoundOakBistroTable(outdoorBackdropStyler, 0.98, false);
  outdoorParasolGrp.add(pTbl);
  const pole = makeHanaToonMesh(new THREE.CylinderGeometry(0.038, 0.038, 2.48, 10), '#2b3036', 0.55, 0.25, 0);
  pole.castShadow = false;
  pole.position.y = 1.24;
  outdoorParasolGrp.add(pole);
  const canopy = makeHanaToonMesh(new THREE.ConeGeometry(1.74, 0.52, 8), '#f5efe2', 0.82, 0.02, 0);
  canopy.castShadow = false;
  canopy.position.y = 2.50;
  outdoorParasolGrp.add(canopy);
  addSoftFocusBlurShells(outdoorParasolGrp, [
    [0.030, 0.30],
    [0.064, 0.20],
    [0.105, 0.11],
  ]);
  outdoorBackdropGroup.add(outdoorParasolGrp);

  const exteriorPlantsGroup = new THREE.Group();
  const exteriorGardenPlants: Array<[number, number, number, 'monstera' | 'fiddle']> = [
    // Flanking outside Courtyard Entrance Doors (visible right through glass & open doorway!)
    [-1.35, 5.85, 0.98, 'monstera'],
    [-6.05, 7.55, 1.02, 'fiddle'],
    // Surrounding conservatory greenery outside windows
    [-8.4, -4.5, 1.08, 'monstera'],
    [-8.4, 1.5, 1.12, 'fiddle'],
    [8.4, 7.5, 1.08, 'monstera'],
    [8.4, -4.5, 1.08, 'fiddle'],
    [8.4, 1.5, 1.12, 'monstera'],
    [-4.2, -6.9, 1.10, 'fiddle'],
    [4.2, -6.9, 1.10, 'monstera'],
  ];
  for (const [hx, hz, hs, variant] of exteriorGardenPlants) {
    const bush = buildPottedMonsteraOnStand(outdoorBackdropStyler, hs, variant);
    bush.position.set(hx, -0.02, hz);
    exteriorPlantsGroup.add(bush);
  }
  addSoftFocusBlurShells(exteriorPlantsGroup, [
    [0.028, 0.28],
    [0.062, 0.16],
  ]);
  outdoorBackdropGroup.add(exteriorPlantsGroup);

  // Feathered Atmospheric Mist Veils outside the conservatory perimeter & across the Right (-X) Courtyard patio
  const mistVeilTex = createFeatheredMistVeilTexture();
  const mistVeilPlacements: Array<{ x: number; y: number; z: number; w: number; h: number; ry: number; opacity: number }> = [
    // Courtyard patio mist layers (softly veiling outdoor patio & parasol even through the open exit doorway!)
    { x: -2.6, y: 1.85, z: 6.55, w: 9.2, h: 4.3, ry: 0, opacity: 0.12 },
    { x: -2.6, y: 2.05, z: 9.35, w: 11.4, h: 4.8, ry: 0, opacity: 0.16 },
    // North behind barista back windows
    { x: 0.0, y: 2.15, z: -6.35, w: 18.5, h: 4.8, ry: 0, opacity: 0.14 },
    // West (-X) outside side windows
    { x: -7.85, y: 2.15, z: 1.2, w: 17.5, h: 4.8, ry: Math.PI / 2, opacity: 0.14 },
    // East (+X) outside Main Hall + Left L-Wing windows
    { x: 7.85, y: 2.15, z: 2.2, w: 18.5, h: 4.8, ry: -Math.PI / 2, opacity: 0.14 },
    // South beyond Left (+X) L-Wing gable end
    { x: 4.25, y: 2.15, z: 10.65, w: 9.5, h: 4.8, ry: Math.PI, opacity: 0.14 },
  ];
  for (const mv of mistVeilPlacements) {
    const veilMat = new THREE.MeshBasicMaterial({
      map: mistVeilTex,
      transparent: true,
      opacity: mv.opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    const veil = new THREE.Mesh(new THREE.PlaneGeometry(mv.w, mv.h), veilMat);
    veil.position.set(mv.x, mv.y, mv.z);
    veil.rotation.y = mv.ry;
    veil.renderOrder = 1;
    veil.userData.skipExteriorMistShader = true;
    veil.raycast = () => {};
    outdoorBackdropGroup.add(veil);
  }

  // Warm Botanical Glasshouse Lighting matching Hana's House sunlit interior clarity
  const cafeHemi = new THREE.HemisphereLight('#fffbeb', '#65a30d', 1.25);
  cafeHemi.position.set(0, 9, 0);
  root.add(cafeHemi);

  const cafeSun = new THREE.DirectionalLight('#fff3d6', 1.45);
  cafeSun.position.set(7, 13, 9);
  root.add(cafeSun);

  const counterWarmPt = new THREE.PointLight('#fde68a', 1.10, 12);
  counterWarmPt.position.set(-0.2, 2.75, -2.9);
  root.add(counterWarmPt);

  const wingWarmPt = new THREE.PointLight('#fef3c7', 0.85, 9);
  wingWarmPt.position.set(4.2, 2.95, 7.4);
  root.add(wingWarmPt);

  // 2. 1:1 IDENTICAL L-SHAPED GLASSHOUSE ARCHITECTURE SHELL (180-deg rotated to match Exterior South Plaza!)
  //    Main Hall: x in [-6.80 .. +6.80], z in [-5.25 .. +5.25]
  //    Left (+X) Wing: x in [+1.65 .. +6.80], z in [+5.25 .. +9.65] (Player's LEFT when facing +Z exit door!)
  //    Right (-X) Courtyard Notch: x in [-6.80 .. +1.65], z in [+5.25 .. +9.65]
  const staticIndoorGroup = new THREE.Group();
  staticIndoorGroup.name = 'CafeStaticIndoorBakedGroup';
  root.add(staticIndoorGroup);

  buildLShapedGlasshouseArchitecture(staticIndoorGroup, styler, {
    xWest: CAFE_INTERIOR_BOUNDS.minX,
    xWingEast: CAFE_INTERIOR_BOUNDS.wingMinX,
    xEast: CAFE_INTERIOR_BOUNDS.maxX,
    zBack: CAFE_INTERIOR_BOUNDS.minZ,
    zRecessed: CAFE_INTERIOR_BOUNDS.courtyardMinZ,
    zWingTip: CAFE_INTERIOR_BOUNDS.maxZ,
    wingDir: 1,
    wingSide: 1,
    doorX: CAFE_INTERIOR_BOUNDS.exitDoorX,
    doorHalfW: 1.08,
    eavesY: 3.85,
    ridgeY: 5.55,
    kneeH: 0.72,
    baysBack: 6,
    baysEast: 5,
    baysWest: 7,
    baysWingTip: 3,
    baysWingInner: 2,
    baysCourtyardLeft: 3,
    baysCourtyardRight: 1,
    floorY: -0.04,
    openDoorsOutward: true,
    includeCourtyardNotchPatio: true,
    courtyardPatioParent: outdoorBackdropGroup,
    parquetTex: herringboneTex,
  });

  // Apply distance-graded soft mist shader across all outdoor surfaces (including courtyard patio flagstones!)
  applyExteriorBackdropSoftMist(outdoorBackdropGroup);

  // Dark walnut barista deck spanning under both the bartender bar and the joined Work Shift Board cabinet
  const baristaDeck = makeHanaToonMesh(
    makeRoundedBoxGeo(7.16, 0.032, 2.72, 0.015, 2),
    '#9a6838',
    0.58,
    0.04,
    0.004,
    { map: oakTex },
  );
  baristaDeck.position.set(0.55, 0.022, -3.83);
  staticIndoorGroup.add(baristaDeck);

  // 3. 1:1 Rounded Espresso Bar, Pastry Counter, Grinders, Brass Lamps & Hanging Menu (0.96x human posture scale, front counter center z = -2.05 / back face -2.47)
  const espressoBarGroup = buildCompleteEspressoBarAssembly(
    styler,
    flutedTex,
    marbleTex,
    menuTex,
    CAFE_GLOBAL_SCALE_SPEC.interiorEspressoBarScale,
  );
  espressoBarGroup.position.set(-0.45, 0.036, -3.72);
  staticIndoorGroup.add(espressoBarGroup);

  // 4. SEAMLESS JOINED WOODEN BASE CABINET + 1:1 WALL-MOUNTED WORK SHIFT BOARD
  //    Connected flush to the right side of the bartender back credenza (`x = +2.046`) and flush to the rear glasshouse wall (`z = -5.18`) with zero side or rear gap!
  const shiftBoardWing = buildJoinedShiftBoardCounterWing(
    styler,
    marbleTex,
    CAFE_GLOBAL_SCALE_SPEC.interiorEspressoBarScale,
  );
  shiftBoardWing.position.set(
    -0.45 + 2.60 * CAFE_GLOBAL_SCALE_SPEC.interiorEspressoBarScale,
    0.036,
    -4.70,
  );
  staticIndoorGroup.add(shiftBoardWing);

  const baristaReadyGlow = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.62, 24),
    new THREE.MeshBasicMaterial({
      color: '#b8ff3c',
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  baristaReadyGlow.rotation.x = -Math.PI / 2;
  baristaReadyGlow.position.set(
    CAFE_INTERIOR_BOUNDS.baristaCounterStandX,
    0.058,
    CAFE_INTERIOR_BOUNDS.baristaCounterStandZ,
  );
  baristaReadyGlow.visible = false;
  baristaReadyGlow.raycast = () => {};
  root.add(baristaReadyGlow);

  // 5. STANDARD BANK CASH ATM TERMINAL (flush against the rear wall with zero gap behind it)
  const atmStand = buildStandardBankCashAtm(styler, CAFE_GLOBAL_SCALE_SPEC.interiorAtmScale);
  atmStand.position.set(-4.25, 0.02, -4.95);
  atmStand.rotation.y = 0;
  staticIndoorGroup.add(atmStand);

  // 5b. 1:1 STANDALONE ARCADE CABINET MACHINE ("NEO-STRIKE ARCADE" - flush against the East conservatory wall between the two banquettes with zero rear gap)
  const arcadeCabinet = buildStandaloneArcadeCabinet(styler, CAFE_GLOBAL_SCALE_SPEC.interiorAtmScale);
  arcadeCabinet.position.set(6.50, 0.02, 4.33);
  arcadeCabinet.rotation.y = -Math.PI / 2;
  staticIndoorGroup.add(arcadeCabinet);

  // 6. Round Oak Bistro Tables (0.96x = 0.77m waist height), Bentwood Rattan Armchairs (0.96x = 0.475m knee seat / 0.90m back) & Tufted Leather Banquettes (0.98x)
  const bistroLocations: Array<{
    tableX: number;
    tableZ: number;
    chairX: number;
    chairZ: number;
    chairYaw: number;
    windowChairX?: number;
    windowChairYaw?: number;
  }> = [
    { tableX: 5.28, tableZ: -0.85, chairX: 4.46, chairZ: -0.85, chairYaw: Math.PI / 2 },
    { tableX: 5.28, tableZ: 1.55, chairX: 4.46, chairZ: 1.55, chairYaw: Math.PI / 2 },
    {
      tableX: -5.45,
      tableZ: -0.65,
      chairX: -4.62,
      chairZ: -0.65,
      chairYaw: -Math.PI / 2,
      windowChairX: -6.26,
      windowChairYaw: Math.PI / 2,
    },
    {
      tableX: -5.45,
      tableZ: 1.85,
      chairX: -4.62,
      chairZ: 1.85,
      chairYaw: -Math.PI / 2,
      windowChairX: -6.26,
      windowChairYaw: Math.PI / 2,
    },
    // Projecting Left (+X) Wing L-Section Bistro Table & Armchair!
    { tableX: 5.28, tableZ: 7.45, chairX: 4.46, chairZ: 7.45, chairYaw: Math.PI / 2 },
  ];
  for (const b of bistroLocations) {
    const tbl = buildRoundOakBistroTable(styler, CAFE_GLOBAL_SCALE_SPEC.interiorTableScale, true);
    tbl.position.set(b.tableX, 0.02, b.tableZ);
    staticIndoorGroup.add(tbl);

    const chair = buildBentwoodRattanChair(styler, rattanTex, CAFE_GLOBAL_SCALE_SPEC.interiorChairScale);
    chair.position.set(b.chairX, 0.02, b.chairZ);
    chair.rotation.y = b.chairYaw;
    staticIndoorGroup.add(chair);

    if (b.windowChairX !== undefined && b.windowChairYaw !== undefined) {
      const wChair = buildBentwoodRattanChair(styler, rattanTex, CAFE_GLOBAL_SCALE_SPEC.interiorChairScale);
      wChair.position.set(b.windowChairX, 0.02, b.chairZ);
      wChair.rotation.y = b.windowChairYaw;
      staticIndoorGroup.add(wChair);
    }
  }

  // Tufted Caramel Leather Banquette along Main Hall +X Conservatory Wall
  const eastBanquette = buildTuftedLeatherBanquette(styler, 2.32, CAFE_GLOBAL_SCALE_SPEC.interiorBanquetteScale);
  eastBanquette.position.set(6.22, 0.02, 0.35);
  eastBanquette.rotation.y = -Math.PI / 2;
  staticIndoorGroup.add(eastBanquette);

  // Tufted Caramel Leather Banquette inside Projecting Left (+X) Wing (`x = 6.22, z = 7.45`)
  const leftWingBanquette = buildTuftedLeatherBanquette(styler, 2.12, CAFE_GLOBAL_SCALE_SPEC.interiorBanquetteScale);
  leftWingBanquette.position.set(6.22, 0.02, 7.45);
  leftWingBanquette.rotation.y = -Math.PI / 2;
  staticIndoorGroup.add(leftWingBanquette);

  // 7. Potted Monstera Stands (1.02x-1.08x natural human-height plants), Hanging Macrame Ferns & Cascading Wisteria
  const cornerPlants: Array<{ x: number; z: number; scale: number; variant: 'monstera' | 'fiddle' }> = [
    { x: -6.02, z: -4.60, scale: CAFE_GLOBAL_SCALE_SPEC.interiorPlantScale, variant: 'monstera' },
    { x: 6.02, z: -4.60, scale: 1.06, variant: 'fiddle' },
    { x: -6.02, z: 4.52, scale: 1.02, variant: 'fiddle' },
    // Far corners of the Projecting Left (+X) Wing
    { x: 6.02, z: 9.02, scale: CAFE_GLOBAL_SCALE_SPEC.interiorPlantScale, variant: 'monstera' },
    { x: 2.35, z: 9.02, scale: 1.02, variant: 'fiddle' },
  ];
  for (const pp of cornerPlants) {
    const pot = buildPottedMonsteraOnStand(styler, pp.scale, pp.variant);
    pot.position.set(pp.x, 0.02, pp.z);
    staticIndoorGroup.add(pot);
  }

  for (const [fx, fy, fz] of [
    [-5.85, 3.52, -2.2],
    [-5.85, 3.52, 2.9],
    [5.85, 3.52, -2.2],
    [5.85, 3.52, 2.9],
    [5.65, 3.52, 6.2],
    [2.45, 3.52, 7.6],
  ] as [number, number, number][]) {
    const fern = buildHangingMacrameFern(styler, 0.68, 0.98);
    fern.position.set(fx, fy, fz);
    staticIndoorGroup.add(fern);
  }

  for (const [wx, wy, wz, drop] of [
    [-4.8, 4.08, -3.5, 0.72],
    [-2.5, 4.58, -1.2, 0.80],
    [0.0, 5.02, 0.4, 0.86],
    [2.5, 4.58, -1.2, 0.80],
    [4.8, 4.08, -3.5, 0.72],
    [-4.8, 4.08, 3.2, 0.76],
    [4.8, 4.08, 3.2, 0.76],
    // Cascading Purple Wisteria inside Projecting Left (+X) Wing Barrel Vault
    [4.2, 4.72, 6.4, 0.82],
    [4.2, 4.72, 8.6, 0.82],
    [2.4, 3.98, 7.4, 0.72],
  ] as [number, number, number, number][]) {
    const wisteria = buildWisteriaCluster(styler, drop, 1.02);
    wisteria.position.set(wx, wy, wz);
    staticIndoorGroup.add(wisteria);
  }

  // Bake all ~2,200 static indoor meshes + ~900 outlines + frosted conservatory glass panes into ~22 static draw calls!
  bakeStaticGroupMeshes(staticIndoorGroup, { minShadowCasterSpan: 0.35 });
  for (const child of staticIndoorGroup.children) {
    if (child instanceof THREE.Mesh && child.material === styler.frostedGlassMat) {
      child.renderOrder = 2;
    }
  }

  // 8. Glowing Exit Floor Arrow Pad at South Courtyard Entrance Door & Work-Shift Boundary Pad
  const exitPad = buildGlowingDoorFloorArrowPad();
  exitPad.group.position.set(CAFE_INTERIOR_BOUNDS.exitDoorX, 0.03, CAFE_INTERIOR_BOUNDS.exitDoorZ);
  root.add(exitPad.group);

  const workShiftExitPad = buildGlowingDoorFloorArrowPad();
  workShiftExitPad.group.position.set(
    CAFE_INTERIOR_BOUNDS.workShiftExitPadX,
    0.045,
    CAFE_INTERIOR_BOUNDS.workShiftExitPadZ,
  );
  workShiftExitPad.group.scale.setScalar(0.68);
  workShiftExitPad.group.visible = false;
  root.add(workShiftExitPad.group);

  // 8B. Compact Ring-less Floating 3D Triangles above Interactive Trigger Appliances
  const interactiveMarkers = {
    atm: buildCompactInteractiveChevronMarker(0.095, 0.19, '#38bdf8'),
    workShiftBoard: buildCompactInteractiveChevronMarker(0.095, 0.19, '#38bdf8'),
    orderPosRegister: buildCompactInteractiveChevronMarker(0.090, 0.18, '#38bdf8'),
    drinkEspressoMachine: buildCompactInteractiveChevronMarker(0.090, 0.18, '#38bdf8'),
    pastryDisplayCase: buildCompactInteractiveChevronMarker(0.090, 0.18, '#38bdf8'),
  };
  interactiveMarkers.atm.group.position.set(
    CAFE_APPLIANCE_TARGETS.atmMachine.x,
    CAFE_APPLIANCE_TARGETS.atmMachine.markerY,
    CAFE_APPLIANCE_TARGETS.atmMachine.z,
  );
  interactiveMarkers.workShiftBoard.group.position.set(
    CAFE_APPLIANCE_TARGETS.workShiftBoard.x,
    CAFE_APPLIANCE_TARGETS.workShiftBoard.markerY,
    CAFE_APPLIANCE_TARGETS.workShiftBoard.z,
  );
  interactiveMarkers.orderPosRegister.group.position.set(
    CAFE_APPLIANCE_TARGETS.orderPosRegister.x,
    CAFE_APPLIANCE_TARGETS.orderPosRegister.markerY,
    CAFE_APPLIANCE_TARGETS.orderPosRegister.z,
  );
  interactiveMarkers.drinkEspressoMachine.group.position.set(
    CAFE_APPLIANCE_TARGETS.drinkEspressoMachine.x,
    CAFE_APPLIANCE_TARGETS.drinkEspressoMachine.markerY,
    CAFE_APPLIANCE_TARGETS.drinkEspressoMachine.z,
  );
  interactiveMarkers.drinkEspressoMachine.group.visible = false;
  interactiveMarkers.pastryDisplayCase.group.position.set(
    CAFE_APPLIANCE_TARGETS.pastryDisplayCase.x,
    CAFE_APPLIANCE_TARGETS.pastryDisplayCase.markerY,
    CAFE_APPLIANCE_TARGETS.pastryDisplayCase.z,
  );
  interactiveMarkers.pastryDisplayCase.group.visible = false;

  root.add(
    interactiveMarkers.atm.group,
    interactiveMarkers.workShiftBoard.group,
    interactiveMarkers.orderPosRegister.group,
    interactiveMarkers.drinkEspressoMachine.group,
    interactiveMarkers.pastryDisplayCase.group,
  );

  // 9. Compact Floating Seat Discs for Main Hall + Left Wing Bistro Chairs (proportioned cleanly over 0.475m chair seats!)
  const makeCompactSeatIndicatorCoin = (
    radius: number,
    thickness: number,
    outerHex: string,
    innerHex: string,
    opacity: number,
  ): THREE.Group => {
    const g = new THREE.Group();
    const outerMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, thickness, 24),
      new THREE.MeshBasicMaterial({
        color: outerHex,
        transparent: true,
        opacity,
        depthWrite: false,
        fog: false,
      }),
    );
    outerMesh.rotation.x = Math.PI / 2;
    outerMesh.raycast = () => {};
    g.add(outerMesh);

    const innerMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.68, radius * 0.68, thickness + 0.003, 20),
      new THREE.MeshBasicMaterial({
        color: innerHex,
        transparent: true,
        opacity: Math.min(0.95, opacity + 0.12),
        depthWrite: false,
        fog: false,
      }),
    );
    innerMesh.rotation.x = Math.PI / 2;
    innerMesh.raycast = () => {};
    g.add(innerMesh);

    return g;
  };

  const floorSpotIndicators = CAFE_INTERIOR_SEAT_SPOTS.map((spot) => {
    const coinRoot = new THREE.Group();
    const blueCoin = makeCompactSeatIndicatorCoin(
      CAFE_GLOBAL_SCALE_SPEC.interiorSeatIndicatorBlueRadiusM,
      0.018,
      '#38bdf8',
      '#7dd3fc',
      0.68,
    );
    const greenCoin = makeCompactSeatIndicatorCoin(
      CAFE_GLOBAL_SCALE_SPEC.interiorSeatIndicatorGreenRadiusM,
      0.020,
      '#b8ff3c',
      '#d9f99d',
      0.82,
    );
    greenCoin.visible = false;
    coinRoot.add(blueCoin, greenCoin);
    coinRoot.position.set(spot.x, spot.indicatorHeightY, spot.z);
    root.add(coinRoot);
    return { coinRoot, blueCoin, greenCoin };
  });

  // 10. AI Customer Order Sign Quad Overhead (camera-aligned constant-screen-size billboard)
  const customerBubbleCanvas = document.createElement('canvas');
  customerBubbleCanvas.width = 320;
  customerBubbleCanvas.height = 128;
  const customerBubbleTex = new THREE.CanvasTexture(customerBubbleCanvas);
  customerBubbleTex.colorSpace = THREE.SRGBColorSpace;
  customerBubbleTex.generateMipmaps = false;
  customerBubbleTex.minFilter = THREE.LinearFilter;
  customerBubbleTex.magFilter = THREE.LinearFilter;
  const customerBubbleMat = new THREE.MeshBasicMaterial({
    map: customerBubbleTex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    fog: false,
  });
  const customerBubbleQuad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), customerBubbleMat);
  customerBubbleQuad.scale.set(0.85, 0.34, 1);
  customerBubbleQuad.position.set(0, 2.02, 0);
  customerBubbleQuad.renderOrder = 10;
  customerBubbleQuad.castShadow = false;
  customerBubbleQuad.receiveShadow = false;
  customerBubbleQuad.raycast = () => {};
  const customerBubbleGroup = new THREE.Group();
  customerBubbleGroup.position.set(
    CAFE_INTERIOR_BOUNDS.baristaCounterFrontX,
    0,
    CAFE_INTERIOR_BOUNDS.baristaCounterFrontZ,
  );
  customerBubbleGroup.visible = false;
  customerBubbleGroup.add(customerBubbleQuad);
  root.add(customerBubbleGroup);

  const setCustomerOrderSign = (visible: boolean, label: string, accentHex: string) => {
    customerBubbleGroup.visible = visible;
    customerBubbleQuad.visible = visible;
    if (!visible) return;
    const ctx = customerBubbleCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 320, 128);
      ctx.fillStyle = '#14161d';
      ctx.fillRect(8, 12, 304, 96);
      ctx.strokeStyle = accentHex;
      ctx.lineWidth = 8;
      ctx.strokeRect(12, 16, 296, 88);
      ctx.fillStyle = accentHex;
      ctx.font = '900 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PESANAN PELANGGAN', 160, 44);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 28px sans-serif';
      ctx.fillText(label.toUpperCase().slice(0, 20), 160, 82);
    }
    customerBubbleTex.needsUpdate = true;
  };

  const applyChevronProximityFeedback = (
    marker: CompactInteractiveChevronMarker,
    isActive: boolean,
  ) => {
    marker.chevronMat.color.set(isActive ? '#b8ff3c' : '#38bdf8');
    marker.chevronArrow.scale.setScalar(isActive ? 1.16 : 1.0);
  };

  const updateVisuals = (
    timeSec: number,
    isWorking: boolean,
    activeOrderCategory: 'drink' | 'pastry' | null = null,
    activeStationKind: CafeStationInteractionKind | null = null,
  ) => {
    const isNearExit = activeStationKind === 'exit_door';
    exitPad.pulseMat.color.set(isNearExit ? '#b8ff3c' : '#38bdf8');
    exitPad.innerDiscMat.color.set(isNearExit ? '#84cc16' : '#0ea5e9');
    exitPad.arrowMat.color.set(isNearExit ? '#b8ff3c' : '#38bdf8');
    exitPad.chevronArrow.scale.setScalar(isNearExit ? 1.14 : 1.0);
    exitPad.pulseMat.opacity = 0.55 + Math.sin(timeSec * 3.8) * 0.25;
    exitPad.chevronArrow.position.y = 0.65 + Math.sin(timeSec * 3.5) * 0.12;
    exitPad.chevronArrow.rotation.y = timeSec * 1.4;

    workShiftExitPad.group.visible = isWorking;
    if (isWorking) {
      const isNearWorkExit = activeStationKind === 'rota_board';
      workShiftExitPad.pulseMat.color.set(isNearWorkExit ? '#b8ff3c' : '#38bdf8');
      workShiftExitPad.innerDiscMat.color.set(isNearWorkExit ? '#84cc16' : '#0ea5e9');
      workShiftExitPad.arrowMat.color.set(isNearWorkExit ? '#b8ff3c' : '#38bdf8');
      workShiftExitPad.chevronArrow.scale.setScalar(isNearWorkExit ? 1.14 : 1.0);
      workShiftExitPad.pulseMat.opacity = 0.55 + Math.sin(timeSec * 3.8) * 0.25;
      workShiftExitPad.chevronArrow.position.y = 0.65 + Math.sin(timeSec * 3.5) * 0.12;
      workShiftExitPad.chevronArrow.rotation.y = timeSec * 1.4;
    }

    baristaReadyGlow.visible = false;

    // Static appliance triggers vs contextual Barista Work Shift appliance triggers
    interactiveMarkers.atm.group.visible = true;
    interactiveMarkers.workShiftBoard.group.visible = !isWorking;
    interactiveMarkers.orderPosRegister.group.visible = !isWorking;
    interactiveMarkers.drinkEspressoMachine.group.visible =
      isWorking && activeOrderCategory === 'drink';
    interactiveMarkers.pastryDisplayCase.group.visible =
      isWorking && activeOrderCategory === 'pastry';

    applyChevronProximityFeedback(interactiveMarkers.atm, activeStationKind === 'atm_machine');
    applyChevronProximityFeedback(
      interactiveMarkers.workShiftBoard,
      !isWorking && activeStationKind === 'rota_board',
    );
    applyChevronProximityFeedback(
      interactiveMarkers.orderPosRegister,
      activeStationKind === 'order_counter',
    );
    applyChevronProximityFeedback(
      interactiveMarkers.drinkEspressoMachine,
      activeStationKind === 'serve_customer' && activeOrderCategory === 'drink',
    );
    applyChevronProximityFeedback(
      interactiveMarkers.pastryDisplayCase,
      activeStationKind === 'serve_customer' && activeOrderCategory === 'pastry',
    );

    const bob = Math.sin(timeSec * 3.6) * 0.038;
    const spin = timeSec * 1.65;
    interactiveMarkers.atm.chevronArrow.position.y = bob;
    interactiveMarkers.atm.chevronArrow.rotation.y = spin;
    interactiveMarkers.workShiftBoard.chevronArrow.position.y =
      Math.sin(timeSec * 3.6 + 0.8) * 0.038;
    interactiveMarkers.workShiftBoard.chevronArrow.rotation.y = spin + 0.5;
    interactiveMarkers.orderPosRegister.chevronArrow.position.y =
      Math.sin(timeSec * 3.6 + 1.6) * 0.035;
    interactiveMarkers.orderPosRegister.chevronArrow.rotation.y = spin + 1.0;
    interactiveMarkers.drinkEspressoMachine.chevronArrow.position.y =
      Math.sin(timeSec * 4.2) * 0.036;
    interactiveMarkers.drinkEspressoMachine.chevronArrow.rotation.y = timeSec * 2.0;
    interactiveMarkers.pastryDisplayCase.chevronArrow.position.y =
      Math.sin(timeSec * 4.2) * 0.036;
    interactiveMarkers.pastryDisplayCase.chevronArrow.rotation.y = timeSec * 2.0;

    floorSpotIndicators.forEach((entry, idx) => {
      const baseY = CAFE_INTERIOR_SEAT_SPOTS[idx]?.indicatorHeightY ?? 0.73;
      entry.coinRoot.position.y = baseY + Math.sin(timeSec * 3.4 + idx * 0.9) * 0.024;
      entry.coinRoot.rotation.y = timeSec * 2.1 + idx * 0.6;
    });
  };

  return {
    root,
    floorSpotIndicators,
    baristaReadyGlow,
    customerBubbleGroup,
    customerBubbleQuad,
    interactiveMarkers,
    updateVisuals,
    setCustomerOrderSign,
  };
}
