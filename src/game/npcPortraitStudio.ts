import * as THREE from 'three';
import type { CitizenId } from './buddiesCitizenRoles';
import {
  getNpcStudioPalette,
  getPlayerStudioPalette,
  type PlayerPortraitGender,
} from './npcPortraitRegistry';
import {
  setBlitzStylizedCharViewportSize,
  type BuddyCharacterRig,
} from './buddiesBlitzShadersAndAssets';

export interface NpcPortraitCaptureResult {
  avatarUrl: string;
  coverUrl: string;
}

interface NpcPoseFramingTuning {
  /** Selfie horizontal azimuth angle in radians (subtle flattering 3/4 selfie tilt). */
  selfieYawRad: number;
  /** Full-body cover angle in radians (editorial 3/4 stance). */
  coverYawRad: number;
  /** Idle clip sample timestamp in seconds so each NPC shows a lively natural pose. */
  idleSampleSec: number;
}

const NPC_FRAMING_TUNING: Readonly<Record<CitizenId, NpcPoseFramingTuning>> = {
  npc_hana: { selfieYawRad: 0.16, coverYawRad: -0.26, idleSampleSec: 0.55 },
  npc_kai: { selfieYawRad: -0.15, coverYawRad: 0.24, idleSampleSec: 0.45 },
  city_plaza_raka: { selfieYawRad: 0.14, coverYawRad: -0.22, idleSampleSec: 0.5 },
  city_plaza_nadia: { selfieYawRad: -0.17, coverYawRad: 0.28, idleSampleSec: 0.6 },
  citizen_mira: { selfieYawRad: 0.18, coverYawRad: -0.28, idleSampleSec: 0.65 },
  citizen_bima: { selfieYawRad: -0.14, coverYawRad: 0.22, idleSampleSec: 0.45 },
  citizen_tari: { selfieYawRad: 0.15, coverYawRad: -0.25, idleSampleSec: 0.7 },
  citizen_kenji: { selfieYawRad: -0.16, coverYawRad: 0.25, idleSampleSec: 0.5 },
};

const PLAYER_FRAMING_TUNING: Readonly<Record<PlayerPortraitGender, NpcPoseFramingTuning>> = {
  male: { selfieYawRad: 0.16, coverYawRad: -0.24, idleSampleSec: 0.45 },
  female: { selfieYawRad: -0.16, coverYawRad: 0.24, idleSampleSec: 0.55 },
};

function createStudioBackdropTexture(bgTop: string, bgBottom: string, accent: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, bgTop);
    grad.addColorStop(1, bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Warm studio sunlight glow behind the subject
    const sunGlow = ctx.createRadialGradient(340, 145, 16, 340, 145, 290);
    sunGlow.addColorStop(0, 'rgba(255, 255, 255, 0.58)');
    sunGlow.addColorStop(0.55, 'rgba(255, 255, 255, 0.14)');
    sunGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, 512, 512);

    // Subtle secondary accent rim glow on lower edge
    const accentGlow = ctx.createRadialGradient(130, 410, 10, 130, 410, 260);
    accentGlow.addColorStop(0, `${accent}30`);
    accentGlow.addColorStop(1, `${accent}00`);
    ctx.fillStyle = accentGlow;
    ctx.fillRect(0, 0, 512, 512);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createSoftFloorShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.34)');
    grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.14)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Computes an accurate world-space bounding box of the visible character body meshes
 * (ignoring hidden weapons, fishing rods, or huge outline shells).
 */
function computeCleanCharacterBounds(bodyGroup: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  const tempBox = new THREE.Box3();
  bodyGroup.updateMatrixWorld(true);
  bodyGroup.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible) return;
    // Skip descendants inside hidden parents
    let p: THREE.Object3D | null = mesh.parent;
    while (p && p !== bodyGroup) {
      if (!p.visible) return;
      p = p.parent;
    }
    const lower = (mesh.name || '').toLowerCase();
    if (lower.includes('outline') || lower.includes('shadow') || lower.includes('rod') || lower.includes('weapon')) {
      return;
    }
    if (!mesh.geometry) return;
    if (!mesh.geometry.boundingBox) {
      mesh.geometry.computeBoundingBox();
    }
    if (!mesh.geometry.boundingBox) return;
    tempBox.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
    if (
      Number.isFinite(tempBox.min.x) &&
      Number.isFinite(tempBox.max.y) &&
      tempBox.max.y - tempBox.min.y < 8.0
    ) {
      box.union(tempBox);
    }
  });
  return box;
}

export interface NpcPortraitStudioController {
  captureNpcPhotos: (
    renderer: THREE.WebGLRenderer,
    citizenId: CitizenId,
    rig: BuddyCharacterRig,
    bodyGroup: THREE.Group,
    viewportW: number,
    viewportH: number,
  ) => NpcPortraitCaptureResult | null;
  capturePlayerPhotos: (
    renderer: THREE.WebGLRenderer,
    gender: PlayerPortraitGender,
    rig: BuddyCharacterRig,
    bodyGroup: THREE.Group,
    viewportW: number,
    viewportH: number,
  ) => NpcPortraitCaptureResult | null;
  dispose: () => void;
}

/**
 * Lightweight off-frame 3D portrait studio that reuses the main Three.js WebGLRenderer
 * synchronously before the regular gameplay frame renders:
 * - Zero extra WebGL contexts (never exhausts browser WebGL slots)
 * - Exact ACESFilmic tone mapping, SRGBColorSpace, MSAA, and character shaders
 * - Captures both a Chest-Up Selfie (1:1) and a Full-Body Editorial Cover (wide banner)
 */
export function createNpcPortraitStudio(): NpcPortraitStudioController {
  const studioScene = new THREE.Scene();

  // Balanced bright 3-point editorial portrait lighting
  const hemiLight = new THREE.HemisphereLight('#fffaf5', '#6b7280', 1.45);
  studioScene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight('#fff6ea', 1.75);
  keyLight.position.set(2.4, 4.8, 5.2);
  studioScene.add(keyLight);

  const fillLight = new THREE.DirectionalLight('#e0f2fe', 0.85);
  fillLight.position.set(-3.2, 2.8, 3.6);
  studioScene.add(fillLight);

  const rimLight = new THREE.DirectionalLight('#fde68a', 0.72);
  rimLight.position.set(-1.6, 4.0, -3.8);
  studioScene.add(rimLight);

  const stageGroup = new THREE.Group();
  studioScene.add(stageGroup);

  const floorShadowGeo = new THREE.PlaneGeometry(1.9, 1.9);
  const floorShadowTex = createSoftFloorShadowTexture();
  const floorShadowMat = new THREE.MeshBasicMaterial({
    map: floorShadowTex,
    transparent: true,
    depthWrite: false,
  });
  const floorShadowMesh = new THREE.Mesh(floorShadowGeo, floorShadowMat);
  floorShadowMesh.rotation.x = -Math.PI / 2;
  floorShadowMesh.position.y = 0.01;
  studioScene.add(floorShadowMesh);

  const backdropTextures = new Map<string, THREE.CanvasTexture>();
  const avatarOutCanvas = document.createElement('canvas');
  avatarOutCanvas.width = 320;
  avatarOutCanvas.height = 320;
  const coverOutCanvas = document.createElement('canvas');
  coverOutCanvas.width = 640;
  coverOutCanvas.height = 280;

  const getBackdropForKey = (
    cacheKey: string,
    pal: { bgTop: string; bgBottom: string; accent: string },
  ): THREE.CanvasTexture => {
    const existing = backdropTextures.get(cacheKey);
    if (existing) return existing;
    const tex = createStudioBackdropTexture(pal.bgTop, pal.bgBottom, pal.accent);
    backdropTextures.set(cacheKey, tex);
    return tex;
  };

  const captureViewportToDataUrl = (
    renderer: THREE.WebGLRenderer,
    camera: THREE.PerspectiveCamera,
    outCanvas: HTMLCanvasElement,
    cssW: number,
    cssH: number,
  ): string | null => {
    const srcCanvas = renderer.domElement;
    const dpr = renderer.getPixelRatio();
    const renderCssW = Math.max(64, Math.min(cssW, Math.floor(srcCanvas.width / dpr)));
    const renderCssH = Math.max(64, Math.min(cssH, Math.floor(srcCanvas.height / dpr)));
    if (renderCssW < 64 || renderCssH < 64) return null;

    camera.aspect = renderCssW / renderCssH;
    camera.updateProjectionMatrix();

    setBlitzStylizedCharViewportSize(renderCssW, renderCssH);
    renderer.setViewport(0, 0, renderCssW, renderCssH);
    renderer.setScissor(0, 0, renderCssW, renderCssH);
    renderer.setScissorTest(true);
    renderer.clear();
    renderer.render(studioScene, camera);

    const ctx = outCanvas.getContext('2d');
    if (!ctx) return null;
    const srcPxW = Math.min(srcCanvas.width, Math.round(renderCssW * dpr));
    const srcPxH = Math.min(srcCanvas.height, Math.round(renderCssH * dpr));
    // WebGL viewport (0, 0) is bottom-left; 2D canvas drawImage y=0 is top-left
    const srcY = Math.max(0, srcCanvas.height - srcPxH);
    ctx.clearRect(0, 0, outCanvas.width, outCanvas.height);
    ctx.drawImage(
      srcCanvas,
      0,
      srcY,
      srcPxW,
      srcPxH,
      0,
      0,
      outCanvas.width,
      outCanvas.height,
    );
    return outCanvas.toDataURL('image/jpeg', 0.9);
  };

  const captureRigPhotos = (
    renderer: THREE.WebGLRenderer,
    backdropKey: string,
    palette: { bgTop: string; bgBottom: string; accent: string },
    tuning: NpcPoseFramingTuning,
    rig: BuddyCharacterRig,
    bodyGroup: THREE.Group,
    viewportW: number,
    viewportH: number,
  ): NpcPortraitCaptureResult | null => {
    const ctrl = rig.customGlbController;
    if (!ctrl?.glbRoot) return null;

    const origParent = bodyGroup.parent;
    const origPos = bodyGroup.position.clone();
    const origRot = bodyGroup.rotation.clone();
    const origScale = bodyGroup.scale.clone();
    const origVis = bodyGroup.visible;

    const weaponVis = rig.weaponRigGroup ? rig.weaponRigGroup.visible : false;
    const pistolVis = rig.pistolGroup ? rig.pistolGroup.visible : false;
    const rodVis = rig.fishingRodGroup ? rig.fishingRodGroup.visible : false;

    // Snapshot animation action weights/times so we can briefly pose the character in their
    // clean standing idle pose even if they were sitting on a bench or mid-stride.
    const savedActions: Array<{
      action: THREE.AnimationAction;
      enabled: boolean;
      weight: number;
      time: number;
      paused: boolean;
    }> = [];
    const standingAction: THREE.AnimationAction | null = (() => {
      if (rig.idleClipOverrideName) {
        const overrideAct = ctrl.actions.get(rig.idleClipOverrideName);
        if (overrideAct) return overrideAct;
      }
      for (const [clipName, act] of ctrl.actions.entries()) {
        const lower = clipName.toLowerCase();
        if (lower.includes('idle') && !lower.includes('sit')) {
          return act;
        }
      }
      return ctrl.actions.get(ctrl.activeClipName) ?? ctrl.actions.values().next().value ?? null;
    })();

    const prevViewport = new THREE.Vector4();
    const prevScissor = new THREE.Vector4();
    const prevScissorTest = renderer.getScissorTest();
    const prevRenderTarget = renderer.getRenderTarget();
    const prevShadowAuto = renderer.shadowMap.autoUpdate;

    renderer.getViewport(prevViewport);
    renderer.getScissor(prevScissor);

    try {
      // Save & switch temporarily to clean standing idle pose
      if (standingAction) {
        const seen = new Set<THREE.AnimationAction>();
        const allActions: THREE.AnimationAction[] = [];
        for (const a of ctrl.actions.values()) {
          if (!seen.has(a)) {
            seen.add(a);
            allActions.push(a);
          }
        }
        for (const a of allActions) {
          savedActions.push({
            action: a,
            enabled: a.enabled,
            weight: a.getEffectiveWeight(),
            time: a.time,
            paused: a.paused,
          });
          a.setEffectiveWeight(a === standingAction ? 1 : 0);
          a.enabled = a === standingAction;
        }
        const clipDur = standingAction.getClip()?.duration || 1.0;
        standingAction.play();
        standingAction.paused = false;
        standingAction.time = Math.min(tuning.idleSampleSec, Math.max(0.05, clipDur * 0.35));
        ctrl.mixer.update(0);
      }

      if (rig.weaponRigGroup) rig.weaponRigGroup.visible = false;
      if (rig.pistolGroup) rig.pistolGroup.visible = false;
      if (rig.fishingRodGroup) rig.fishingRodGroup.visible = false;

      // Move bodyGroup temporarily onto the studio stage at origin facing +Z
      stageGroup.add(bodyGroup);
      bodyGroup.visible = true;
      bodyGroup.position.set(0, 0, 0);
      bodyGroup.rotation.set(0, 0, 0);
      bodyGroup.scale.setScalar(1);
      bodyGroup.updateMatrixWorld(true);

      const bounds = computeCleanCharacterBounds(bodyGroup);
      const minY = bounds.isEmpty() ? 0 : bounds.min.y;
      const maxY = bounds.isEmpty() ? 3.5 : bounds.max.y;
      const totalH = Math.max(1.4, maxY - minY);
      const centerX = bounds.isEmpty() ? 0 : (bounds.min.x + bounds.max.x) * 0.5;
      const centerZ = bounds.isEmpty() ? 0 : (bounds.min.z + bounds.max.z) * 0.5;

      // Ground feet cleanly at y = 0 on the studio floor
      bodyGroup.position.set(-centerX, -minY, -centerZ);
      bodyGroup.updateMatrixWorld(true);

      const headBone = ctrl.bones.get('Head') ?? null;
      const headPos = new THREE.Vector3(0, totalH * 0.85, 0);
      if (headBone) {
        headBone.getWorldPosition(headPos);
      }

      studioScene.background = getBackdropForKey(backdropKey, palette);
      renderer.setRenderTarget(null);
      renderer.shadowMap.autoUpdate = false;

      // ── Shot 1: Chest-Up Selfie Profile Photo (1:1 square, dada ke atas) ────────
      floorShadowMesh.visible = false;
      const selfieTopY = totalH * 1.04;
      const selfieBottomY = Math.max(totalH * 0.58, headPos.y - totalH * 0.25);
      const selfieSpanY = Math.max(totalH * 0.36, selfieTopY - selfieBottomY);
      const selfieTargetY = (selfieTopY + selfieBottomY) * 0.5;
      const selfieTargetX = THREE.MathUtils.clamp(headPos.x, -0.35, 0.35);
      const selfieTargetZ = THREE.MathUtils.clamp(headPos.z, -0.35, 0.35);

      const selfieFovDeg = 27;
      const selfieDist =
        (selfieSpanY * 0.52) / Math.tan(THREE.MathUtils.degToRad(selfieFovDeg * 0.5));
      const selfieCam = new THREE.PerspectiveCamera(selfieFovDeg, 1, 0.08, 30);
      selfieCam.position.set(
        selfieTargetX + Math.sin(tuning.selfieYawRad) * selfieDist,
        selfieTargetY + totalH * 0.015,
        selfieTargetZ + Math.cos(tuning.selfieYawRad) * selfieDist,
      );
      selfieCam.lookAt(selfieTargetX, selfieTargetY, selfieTargetZ);

      const selfieCssSize = Math.min(340, Math.floor(Math.min(viewportW, viewportH)));
      const avatarUrl = captureViewportToDataUrl(
        renderer,
        selfieCam,
        avatarOutCanvas,
        selfieCssSize,
        selfieCssSize,
      );

      // ── Shot 2: Full-Body Editorial Cover Photo (wide banner, head to shoes) ───
      floorShadowMesh.visible = true;
      const coverTopY = totalH * 1.055;
      const coverBottomY = -totalH * 0.045;
      const coverSpanY = coverTopY - coverBottomY;
      const coverTargetY = (coverTopY + coverBottomY) * 0.5;

      const coverFovDeg = 31;
      const coverDist =
        (coverSpanY * 0.515) / Math.tan(THREE.MathUtils.degToRad(coverFovDeg * 0.5));
      const coverAspect = coverOutCanvas.width / coverOutCanvas.height;
      const coverCam = new THREE.PerspectiveCamera(coverFovDeg, coverAspect, 0.1, 40);

      // Shift lookAt slightly left so the full-body NPC stands gracefully on the
      // center-right of the Status Cover banner, clear of the bottom-left avatar circle!
      const horizShift = -totalH * 0.36;
      const coverLookX = horizShift * Math.cos(tuning.coverYawRad);
      const coverLookZ = -horizShift * Math.sin(tuning.coverYawRad);

      coverCam.position.set(
        coverLookX + Math.sin(tuning.coverYawRad) * coverDist,
        coverTargetY + totalH * 0.03,
        coverLookZ + Math.cos(tuning.coverYawRad) * coverDist,
      );
      coverCam.lookAt(coverLookX, coverTargetY, coverLookZ);

      const maxCoverCssW = Math.min(640, Math.floor(viewportW));
      const maxCoverCssH = Math.min(280, Math.floor(viewportH));
      let coverCssW = maxCoverCssW;
      let coverCssH = Math.round(coverCssW / coverAspect);
      if (coverCssH > maxCoverCssH) {
        coverCssH = maxCoverCssH;
        coverCssW = Math.round(coverCssH * coverAspect);
      }

      const coverUrl = captureViewportToDataUrl(
        renderer,
        coverCam,
        coverOutCanvas,
        coverCssW,
        coverCssH,
      );

      if (avatarUrl && coverUrl) {
        return { avatarUrl, coverUrl };
      }
      return null;
    } catch {
      return null;
    } finally {
      // Restore NPC transform, parent, visibility, weapons, and exact animation state
      if (origParent) {
        origParent.add(bodyGroup);
      } else {
        stageGroup.remove(bodyGroup);
      }
      bodyGroup.position.copy(origPos);
      bodyGroup.rotation.copy(origRot);
      bodyGroup.scale.copy(origScale);
      bodyGroup.visible = origVis;

      if (rig.weaponRigGroup) rig.weaponRigGroup.visible = weaponVis;
      if (rig.pistolGroup) rig.pistolGroup.visible = pistolVis;
      if (rig.fishingRodGroup) rig.fishingRodGroup.visible = rodVis;

      if (savedActions.length > 0) {
        for (const s of savedActions) {
          s.action.enabled = s.enabled;
          s.action.setEffectiveWeight(s.weight);
          s.action.time = s.time;
          s.action.paused = s.paused;
        }
        ctrl.mixer.update(0);
      }
      bodyGroup.updateMatrixWorld(true);

      // Restore main renderer state cleanly before normal scene frame renders
      renderer.setRenderTarget(prevRenderTarget);
      renderer.setViewport(prevViewport);
      renderer.setScissor(prevScissor);
      renderer.setScissorTest(prevScissorTest);
      renderer.shadowMap.autoUpdate = prevShadowAuto;
      setBlitzStylizedCharViewportSize(viewportW, viewportH);
    }
  };

  const captureNpcPhotos = (
    renderer: THREE.WebGLRenderer,
    citizenId: CitizenId,
    rig: BuddyCharacterRig,
    bodyGroup: THREE.Group,
    viewportW: number,
    viewportH: number,
  ): NpcPortraitCaptureResult | null => {
    return captureRigPhotos(
      renderer,
      citizenId,
      getNpcStudioPalette(citizenId),
      NPC_FRAMING_TUNING[citizenId] ?? NPC_FRAMING_TUNING.npc_hana,
      rig,
      bodyGroup,
      viewportW,
      viewportH,
    );
  };

  const capturePlayerPhotos = (
    renderer: THREE.WebGLRenderer,
    gender: PlayerPortraitGender,
    rig: BuddyCharacterRig,
    bodyGroup: THREE.Group,
    viewportW: number,
    viewportH: number,
  ): NpcPortraitCaptureResult | null => {
    return captureRigPhotos(
      renderer,
      `player_${gender}`,
      getPlayerStudioPalette(gender),
      PLAYER_FRAMING_TUNING[gender] ?? PLAYER_FRAMING_TUNING.male,
      rig,
      bodyGroup,
      viewportW,
      viewportH,
    );
  };

  const dispose = () => {
    floorShadowGeo.dispose();
    floorShadowMat.dispose();
    floorShadowTex.dispose();
    for (const tex of backdropTextures.values()) {
      tex.dispose();
    }
    backdropTextures.clear();
  };

  return { captureNpcPhotos, capturePlayerPhotos, dispose };
}
