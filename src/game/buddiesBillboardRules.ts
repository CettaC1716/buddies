import * as THREE from 'three';

/**
 * Screen-space proportions (in CSS pixels) and head-clearance anchors for 3D character
 * nametag quads and overhead prompt billboards, calibrated to match the game's
 * contextual HUD prompts (`KELUAR CAFE [E]`, `PESAN MENU [E]`, ~140-150px x 32-34px).
 */
export const NAMEPLATE_SCREEN_SPEC = {
  playerAndPeerWidthPx: 146,
  playerAndPeerHeightPx: 33,
  npcMerchantWidthPx: 150,
  npcMerchantHeightPx: 34,
  overheadSignWidthPx: 168,
  overheadSignHeightPx: 44,
  cafeOrderSignWidthPx: 162,
  cafeOrderSignHeightPx: 64,
  standingHeadAnchorLocalY: 3.68,
  sittingHeadAnchorLocalY: 3.26,
  npcHeadAnchorLocalY: 3.72,
  minEyeDepthMeters: 0.35,
} as const;

export interface ConstantScreenSpaceSizeInput {
  eyeDepthMeters: number;
  cameraFovDeg: number;
  viewportHeightPx: number;
  targetWidthPx: number;
  targetHeightPx: number;
  minEyeDepthMeters?: number;
}

/**
 * Computes the world-space width & height required for a camera-aligned 1x1 quad at
 * eye-space depth `eyeDepthMeters` so that its projected size on screen stays locked
 * to `(targetWidthPx, targetHeightPx)` regardless of camera zoom, pan, or room scale.
 */
export function computeConstantScreenSpaceWorldSize(
  input: ConstantScreenSpaceSizeInput,
): { worldWidth: number; worldHeight: number } {
  const safeDepth = Math.max(
    input.minEyeDepthMeters ?? NAMEPLATE_SCREEN_SPEC.minEyeDepthMeters,
    input.eyeDepthMeters,
  );
  const safeViewportH = Math.max(1, input.viewportHeightPx);
  const safeTargetH = Math.max(1, input.targetHeightPx);
  const safeTargetW = Math.max(1, input.targetWidthPx);
  const halfFovRad = (Math.max(1, input.cameraFovDeg) * Math.PI) / 360;
  const frustumHeightAtDepth = 2 * safeDepth * Math.tan(halfFovRad);
  const worldHeight = frustumHeightAtDepth * (safeTargetH / safeViewportH);
  const worldWidth = worldHeight * (safeTargetW / safeTargetH);
  return { worldWidth, worldHeight };
}

// Pre-allocated module-scope math temporaries (zero per-frame GC allocations)
const _parentWorldPos = new THREE.Vector3();
const _parentWorldQuat = new THREE.Quaternion();
const _parentWorldScale = new THREE.Vector3();
const _quadWorldPos = new THREE.Vector3();
const _camWorldPos = new THREE.Vector3();
const _camWorldQuat = new THREE.Quaternion();
const _camForward = new THREE.Vector3();
const _camToQuad = new THREE.Vector3();
const _uprightWorldQuat = new THREE.Quaternion();
const _worldUpY = new THREE.Vector3(0, 1, 0);

/**
 * Makes a 1x1 quad (`PlaneGeometry(1, 1)`) act as a true screen-aligned billboard with
 * constant screen-space pixel dimensions:
 * 1. Sets the quad's world rotation equal to the camera's world rotation (`faces the screen`).
 * 2. Scales the quad inversely to parent world scale (e.g. 0.55x inside Rumah Kaca Cafe vs 1.0x outdoors)
 *    and proportionally to eye-space camera depth so its screen size stays locked at `(targetWidthPx, targetHeightPx)`.
 */
export function syncScreenSpaceBillboardQuad(
  quad: THREE.Object3D | null | undefined,
  camera: THREE.Camera,
  viewportHeightPx: number,
  targetWidthPx: number = NAMEPLATE_SCREEN_SPEC.playerAndPeerWidthPx,
  targetHeightPx: number = NAMEPLATE_SCREEN_SPEC.playerAndPeerHeightPx,
): void {
  if (!quad || !quad.visible || !quad.parent) return;

  quad.parent.updateWorldMatrix(true, false);
  quad.parent.matrixWorld.decompose(_parentWorldPos, _parentWorldQuat, _parentWorldScale);

  _quadWorldPos.copy(quad.position).applyMatrix4(quad.parent.matrixWorld);

  camera.getWorldPosition(_camWorldPos);
  camera.getWorldQuaternion(_camWorldQuat);

  // 1. Set quad world rotation = camera world rotation (q_local = inv(q_parent) * q_cam)
  quad.quaternion.copy(_parentWorldQuat).invert().multiply(_camWorldQuat);

  // 2. Compute constant screen-space world dimensions
  let worldWidth: number;
  let worldHeight: number;
  const safeViewportH = Math.max(1, viewportHeightPx);

  if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
    const persp = camera as THREE.PerspectiveCamera;
    _camForward.set(0, 0, -1).applyQuaternion(_camWorldQuat).normalize();
    const eyeDepth = _camToQuad.subVectors(_quadWorldPos, _camWorldPos).dot(_camForward);
    const sz = computeConstantScreenSpaceWorldSize({
      eyeDepthMeters: eyeDepth,
      cameraFovDeg: persp.fov,
      viewportHeightPx: safeViewportH,
      targetWidthPx,
      targetHeightPx,
    });
    worldWidth = sz.worldWidth;
    worldHeight = sz.worldHeight;
  } else if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
    const ortho = camera as THREE.OrthographicCamera;
    const frustumH = Math.abs(ortho.top - ortho.bottom) / Math.max(0.001, ortho.zoom);
    worldHeight = frustumH * (Math.max(1, targetHeightPx) / safeViewportH);
    worldWidth = worldHeight * (Math.max(1, targetWidthPx) / Math.max(1, targetHeightPx));
  } else {
    worldHeight = 0.35;
    worldWidth = worldHeight * (targetWidthPx / Math.max(1, targetHeightPx));
  }

  const sx = Math.max(1e-4, Math.abs(_parentWorldScale.x));
  const sy = Math.max(1e-4, Math.abs(_parentWorldScale.y));
  quad.scale.set(worldWidth / sx, worldHeight / sy, 1);
}

/**
 * Rotates trees, foliage cards, and upright world sprites/markers ONLY around the world Y axis
 * toward the camera (`up = (0, 1, 0)`), keeping them strictly vertical regardless of camera pitch.
 */
export function syncUprightCylindricalBillboard(
  obj: THREE.Object3D | null | undefined,
  camera: THREE.Camera,
  extraYawRad = 0,
): void {
  if (!obj || !obj.visible || !obj.parent) return;

  obj.parent.updateWorldMatrix(true, false);
  obj.parent.matrixWorld.decompose(_parentWorldPos, _parentWorldQuat, _parentWorldScale);

  _quadWorldPos.copy(obj.position).applyMatrix4(obj.parent.matrixWorld);
  camera.getWorldPosition(_camWorldPos);

  const dx = _camWorldPos.x - _quadWorldPos.x;
  const dz = _camWorldPos.z - _quadWorldPos.z;
  const horizLenSq = dx * dx + dz * dz;
  const worldYaw = horizLenSq > 1e-8 ? Math.atan2(dx, dz) + extraYawRad : extraYawRad;

  _uprightWorldQuat.setFromAxisAngle(_worldUpY, worldYaw);
  obj.quaternion.copy(_parentWorldQuat).invert().multiply(_uprightWorldQuat);
}
