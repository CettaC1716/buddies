import * as THREE from 'three';
import type { BlitzWindUniforms } from './buddiesBlitzShadersAndAssets';
import { computeInstancedBoundingVolumes } from './buddiesHubRenderOptimizer';
import {
  EAST_WATER_SURFACE_Y,
  evaluateHarborSeabedDrop,
  evaluateNwLakeSdf,
  evaluateSeHarborSdf,
  getEastCoastalShorelineX,
} from './buddiesPlanetCurvature';

export const WATER_SURFACE_Y = -0.16;
export const OASIS_LILY_PAD_BASE_Y = -0.155;
export const UNDERWATER_DRAW_CALL_LIMIT = 5;

export type EcologyWaterZoneId = 'oasis_lake' | 'ne_beach' | 'se_beach';

export interface EcologyPlacementSample {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotY: number;
  depth: number;
  zone: EcologyWaterZoneId;
  variant: number;
  colorHex: string;
  accentColorHex?: string;
  hasFlower?: boolean;
}

export interface FishSchoolTrackSpec {
  index: number;
  zone: EcologyWaterZoneId;
  cx: number;
  cz: number;
  rx: number;
  rz: number;
  baseY: number;
  ampY: number;
  speed: number;
  phase: number;
  figure8: boolean;
  scale: number;
  colorHex: string;
}

export interface FishPoseSample {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  seabedY: number;
  clearanceAboveBed: number;
}

export interface UnderwaterEcologyStats {
  drawCalls: number;
  pebblesCount: number;
  coralAndKelpCount: number;
  fishCount: number;
  lilyPadsCount: number;
  totalInstances: number;
}

export interface UnderwaterEcologyHandle {
  group: THREE.Group;
  pebblesMesh: THREE.InstancedMesh;
  coralKelpMesh: THREE.InstancedMesh;
  fishMesh: THREE.InstancedMesh;
  lilyPadsMesh: THREE.InstancedMesh;
  instancedMeshes: readonly THREE.InstancedMesh[];
  fishTracks: readonly FishSchoolTrackSpec[];
  pebblePlacements: readonly EcologyPlacementSample[];
  coralPlacements: readonly EcologyPlacementSample[];
  lilyPadPlacements: readonly EcologyPlacementSample[];
  stats: UnderwaterEcologyStats;
  evaluateFishPoseAt: (index: number, timeSec: number) => FishPoseSample;
  update: (timeSec: number, windTimeSec?: number) => void;
  dispose: () => void;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const denom = edge1 - edge0;
  if (Math.abs(denom) < 1e-6) return x >= edge1 ? 1 : 0;
  const t = clamp((x - edge0) / denom, 0, 1);
  return t * t * (3 - 2 * t);
}

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Evaluates whether `worldZ` lies along the continuous East Coast sandy shoreline (`[-105.5 .. +104.2]`).
 */
export function evaluateBeachSlopeMask(worldZ: number): number {
  return smoothstep(-105.5, -103.5, worldZ) * (1.0 - smoothstep(102.2, 104.2, worldZ));
}

/**
 * Evaluates exact procedural underwater seabed/lakebed elevation (Y in meters) across both
 * Oasis Lake (`(-31, 0)` descending to `-1.55m`) and East Ocean (`smoothstep(0.35, -14.0, waterSdf)`
 * sloped sandy beaches down to `-1.65m`, steep `-1.65m` drop at Harbor Quay & Bianglala pier).
 */
export function evaluateSeabedElevation(worldX: number, worldZ: number): number {
  const lakeSdf = evaluateNwLakeSdf(worldX, worldZ);
  let lakeBasinDepression = 0.0;
  if (lakeSdf < 0.85) {
    const lakeStep1 = (1.0 - smoothstep(-0.45, 0.85, lakeSdf)) * 0.48;
    const lakeStep2 = (1.0 - smoothstep(-2.6, -1.1, lakeSdf)) * 0.52;
    const lakeStep3 = (1.0 - smoothstep(-5.6, -3.2, lakeSdf)) * 0.55;
    lakeBasinDepression = lakeStep1 + lakeStep2 + lakeStep3;
  }

  const harborDrop = evaluateHarborSeabedDrop(worldX, worldZ);
  return harborDrop - lakeBasinDepression;
}

/**
 * Returns positive depth in meters below water surface (`-0.16m` in Oasis Lake, `-2.16m` in East Ocean).
 */
export function evaluateWaterDepthAt(worldX: number, worldZ: number): number {
  const lakeSdf = evaluateNwLakeSdf(worldX, worldZ);
  const { waterSdf } = evaluateSeHarborSdf(worldX, worldZ);
  if (lakeSdf >= 0.4 && waterSdf >= 0.35) {
    return 0;
  }
  const bedY = evaluateSeabedElevation(worldX, worldZ);
  const surfaceY = worldX >= 90.0 ? EAST_WATER_SURFACE_Y : WATER_SURFACE_Y;
  return Math.max(0, surfaceY - bedY);
}

/**
 * Guard ensuring underwater boulders, reefs, and fish schools never intrude dry sandy beach land
 * (`worldX < getEastCoastalShorelineX(z) + 2.5`) or the SE Beachfront Stilt Timber Cabin
 * piling footprint (`[130.5..137.5] x [81.5..89.0]`).
 */
export function isPointClearOfPierAndQuay(
  worldX: number,
  worldZ: number,
  paddingM = 0,
): boolean {
  // Oasis Lake region (west of East Coast) is always clear of East beach & cabin pilings
  if (worldX < 90.0) {
    return true;
  }
  const shoreX = getEastCoastalShorelineX(worldZ);
  if (worldX < shoreX + 2.5 + paddingM) {
    return false;
  }
  // Keep clear of SE Beachfront Stilt Timber Cabin piling footprint `[127.6..135.6] x [91.5..100.0]`
  if (
    worldX >= 127.6 - paddingM &&
    worldX <= 135.6 + paddingM &&
    worldZ >= 91.5 - paddingM &&
    worldZ <= 100.0 + paddingM
  ) {
    return false;
  }
  return true;
}

// ============================================================================
// DETERMINISTIC PLACEMENT & FISH TRAJECTORY GENERATORS
// ============================================================================

const PEBBLE_PALETTE = [
  '#7d8790',
  '#b39b78',
  '#6a7c76',
  '#a49f92',
  '#977e66',
  '#86959c',
] as const;

const KELP_PALETTE = ['#2ab070', '#3d9954', '#279e7a', '#52ab48', '#228e6b'] as const;

const CORAL_PALETTE = ['#fb7185', '#fb923c', '#2dd4bf', '#c084fc', '#fbbf24'] as const;

const STARFISH_PALETTE = ['#f97316', '#f43f5e', '#eab308', '#fb7185'] as const;

const OASIS_FISH_PALETTE = [
  '#ff6b1a',
  '#ffd028',
  '#f43f5e',
  '#38bdf8',
  '#fb923c',
  '#fde047',
] as const;

const OCEAN_FISH_PALETTE = [
  '#ff7a28',
  '#22d3ee',
  '#ffd426',
  '#34d399',
  '#fb7185',
  '#60a5fa',
] as const;

const LOTUS_FLOWER_PALETTE = ['#fbcfe8', '#fff1f2', '#f9a8d4', '#fde68a'] as const;
const LILY_PAD_PALETTE = ['#3a9d4f', '#46ab58', '#338c48', '#52b85e'] as const;

function hasMinSpacing(
  items: readonly EcologyPlacementSample[],
  x: number,
  z: number,
  minDist: number,
): boolean {
  const minDistSq = minDist * minDist;
  for (let i = 0; i < items.length; i++) {
    const dx = items[i].x - x;
    const dz = items[i].z - z;
    if (dx * dx + dz * dz < minDistSq) {
      return false;
    }
  }
  return true;
}

export function generateUnderwaterEcologyPlacements(): {
  pebbles: EcologyPlacementSample[];
  coralsAndKelp: EcologyPlacementSample[];
  fishTracks: FishSchoolTrackSpec[];
  lilyPads: EcologyPlacementSample[];
} {
  const rng = createSeededRng(20261118);

  const pebbles: EcologyPlacementSample[] = [];
  const coralsAndKelp: EcologyPlacementSample[] = [];
  const lilyPads: EcologyPlacementSample[] = [];

  // 1. Submerged Pebbles & Boulders (~96 total: 36 Oasis Lake, 30 NE Beach, 30 SE Beach)
  const addOasisPebbles = (targetCount: number) => {
    let attempts = 0;
    let added = 0;
    while (added < targetCount && attempts < 2200) {
      attempts++;
      const x = -43.5 + rng() * 25.0;
      const z = -14.0 + rng() * 28.0;
      const lakeSdf = evaluateNwLakeSdf(x, z);
      if (lakeSdf > -0.15) continue;
      const bedY = evaluateSeabedElevation(x, z);
      const depth = WATER_SURFACE_Y - bedY;
      if (depth < 0.18 || depth > 1.35) continue;
      if (!hasMinSpacing(pebbles, x, z, 0.92)) continue;

      const isCluster = depth < 0.56 || rng() < 0.48;
      const rawScale = isCluster ? 0.62 + rng() * 0.44 : 0.72 + rng() * 0.52;
      const maxRockLocalY = isCluster ? 0.13 : 0.25;
      const safeScale = Math.min(rawScale, Math.max(0.35, (depth - 0.05) / maxRockLocalY));
      pebbles.push({
        x,
        y: bedY + 0.01,
        z,
        scale: safeScale,
        rotY: rng() * Math.PI * 2,
        depth,
        zone: 'oasis_lake',
        variant: isCluster ? 1 : 0,
        colorHex: PEBBLE_PALETTE[added % PEBBLE_PALETTE.length],
      });
      added++;
    }
  };

  const addBeachPebbles = (zone: 'ne_beach' | 'se_beach', targetCount: number) => {
    const zMin = zone === 'ne_beach' ? -100.5 : 49.5;
    const zMax = zone === 'ne_beach' ? -50.0 : 100.5;
    let attempts = 0;
    let added = 0;
    while (added < targetCount && attempts < 2200) {
      attempts++;
      const z = zMin + rng() * (zMax - zMin);
      const shoreX = getEastCoastalShorelineX(z);
      const offshoreM = 3.8 + rng() * 8.4;
      const x = shoreX + offshoreM;
      if (!isPointClearOfPierAndQuay(x, z, 1.5)) continue;
      const { waterSdf } = evaluateSeHarborSdf(x, z);
      if (waterSdf > -0.5) continue;
      const bedY = evaluateSeabedElevation(x, z);
      const depth = EAST_WATER_SURFACE_Y - bedY;
      if (depth < 0.18 || depth > 1.35) continue;
      if (!hasMinSpacing(pebbles, x, z, 1.15)) continue;

      const isCluster = depth < 0.58 || rng() < 0.45;
      const rawScale = isCluster ? 0.65 + rng() * 0.48 : 0.75 + rng() * 0.58;
      const maxRockLocalY = isCluster ? 0.13 : 0.25;
      const safeScale = Math.min(rawScale, Math.max(0.35, (depth - 0.05) / maxRockLocalY));
      pebbles.push({
        x,
        y: bedY + 0.01,
        z,
        scale: safeScale,
        rotY: rng() * Math.PI * 2,
        depth,
        zone,
        variant: isCluster ? 1 : 0,
        colorHex: PEBBLE_PALETTE[(added + 2) % PEBBLE_PALETTE.length],
      });
      added++;
    }
  };

  addOasisPebbles(36);
  addBeachPebbles('ne_beach', 30);
  addBeachPebbles('se_beach', 30);

  // 2. Submerged Corals, Starfish & Swaying Kelp (~86 total: 26 Oasis Lake, 30 NE Beach, 30 SE Beach)
  const addOasisKelp = (targetCount: number) => {
    let attempts = 0;
    let added = 0;
    while (added < targetCount && attempts < 2200) {
      attempts++;
      const x = -43.0 + rng() * 24.0;
      const z = -13.5 + rng() * 27.0;
      const lakeSdf = evaluateNwLakeSdf(x, z);
      if (lakeSdf > -0.35) continue;
      const bedY = evaluateSeabedElevation(x, z);
      const depth = WATER_SURFACE_Y - bedY;
      if (depth < 0.28 || depth > 1.36) continue;
      if (!hasMinSpacing(coralsAndKelp, x, z, 0.85)) continue;

      const maxKelpLocalY = 0.72;
      const rawScale = 0.78 + rng() * 0.44;
      const safeScale = Math.min(rawScale, Math.max(0.36, (depth - 0.06) / maxKelpLocalY));
      coralsAndKelp.push({
        x,
        y: bedY - 0.02,
        z,
        scale: safeScale,
        rotY: rng() * Math.PI * 2,
        depth,
        zone: 'oasis_lake',
        variant: 0, // Swaying aquatic kelp / pondgrass in Oasis Lake
        colorHex: KELP_PALETTE[added % KELP_PALETTE.length],
      });
      added++;
    }
  };

  const addBeachCoralsAndKelp = (zone: 'ne_beach' | 'se_beach', targetCount: number) => {
    const zMin = zone === 'ne_beach' ? -100.0 : 50.0;
    const zMax = zone === 'ne_beach' ? -50.5 : 100.0;
    let attempts = 0;
    let added = 0;
    while (added < targetCount && attempts < 2400) {
      attempts++;
      const z = zMin + rng() * (zMax - zMin);
      const shoreX = getEastCoastalShorelineX(z);
      const offshoreM = 4.2 + rng() * 8.2;
      const x = shoreX + offshoreM;
      if (!isPointClearOfPierAndQuay(x, z, 1.5)) continue;
      const { waterSdf } = evaluateSeHarborSdf(x, z);
      if (waterSdf > -0.5) continue;
      const bedY = evaluateSeabedElevation(x, z);
      const depth = EAST_WATER_SURFACE_Y - bedY;
      if (depth < 0.24 || depth > 1.38) continue;
      if (!hasMinSpacing(coralsAndKelp, x, z, 1.05)) continue;

      // 45% swaying seagrass/kelp (0), 35% colorful mini reef coral (1), 20% starfish (2)
      const roll = rng();
      const variant = depth < 0.44 ? (roll < 0.55 ? 2 : 1) : roll < 0.46 ? 0 : roll < 0.82 ? 1 : 2;
      const maxLocalY = variant === 0 ? 0.72 : variant === 1 ? 0.36 : 0.08;
      const rawScale =
        variant === 0 ? 0.78 + rng() * 0.48 : variant === 1 ? 0.82 + rng() * 0.42 : 0.85 + rng() * 0.35;
      const safeScale = Math.min(rawScale, Math.max(0.38, (depth - 0.05) / maxLocalY));
      const colorHex =
        variant === 0
          ? KELP_PALETTE[added % KELP_PALETTE.length]
          : variant === 1
            ? CORAL_PALETTE[added % CORAL_PALETTE.length]
            : STARFISH_PALETTE[added % STARFISH_PALETTE.length];

      coralsAndKelp.push({
        x,
        y: bedY - 0.015,
        z,
        scale: safeScale,
        rotY: rng() * Math.PI * 2,
        depth,
        zone,
        variant,
        colorHex,
      });
      added++;
    }
  };

  addOasisKelp(26);
  addBeachCoralsAndKelp('ne_beach', 30);
  addBeachCoralsAndKelp('se_beach', 30);

  // 3. Swimming School Fish (~36 total: 12 Oasis Lake, 12 NE Beach, 12 SE Beach)
  const fishTracks: FishSchoolTrackSpec[] = [];
  let fishIdx = 0;

  // Oasis Lake Sub-School A (6 figure-8 koi) + Sub-School B (6 elliptical carps)
  for (let i = 0; i < 6; i++) {
    fishTracks.push({
      index: fishIdx++,
      zone: 'oasis_lake',
      cx: -31.0,
      cz: 0.0,
      rx: 4.3 + (i % 2) * 0.55,
      rz: 4.1 + ((i + 1) % 2) * 0.55,
      baseY: -0.34 - (i % 3) * 0.06,
      ampY: 0.04,
      speed: 0.36 + (i % 3) * 0.03,
      phase: i * 0.46,
      figure8: true,
      scale: 1.24 + (i % 3) * 0.14,
      colorHex: OASIS_FISH_PALETTE[i % OASIS_FISH_PALETTE.length],
    });
  }
  for (let i = 0; i < 6; i++) {
    fishTracks.push({
      index: fishIdx++,
      zone: 'oasis_lake',
      cx: -31.0,
      cz: 0.0,
      rx: 5.2 - (i % 2) * 0.65,
      rz: 3.6 + (i % 3) * 0.45,
      baseY: -0.38 - (i % 3) * 0.06,
      ampY: 0.04,
      speed: -(0.32 + (i % 2) * 0.04),
      phase: 1.8 + i * 0.52,
      figure8: false,
      scale: 1.18 + (i % 3) * 0.14,
      colorHex: OASIS_FISH_PALETTE[(i + 2) % OASIS_FISH_PALETTE.length],
    });
  }

  // NE Beach Club Coastline School A & B in sunlit shallow-to-mid crystal zone (~7.5m off 134m shoreline)
  for (let i = 0; i < 6; i++) {
    fishTracks.push({
      index: fishIdx++,
      zone: 'ne_beach',
      cx: 141.6 + (i % 2) * 0.4,
      cz: -81.0,
      rx: 2.0,
      rz: 6.8 + (i % 3) * 0.45,
      baseY: -2.33 - (i % 3) * 0.04,
      ampY: 0.035,
      speed: 0.42 + (i % 3) * 0.03,
      phase: i * 0.48,
      figure8: true,
      scale: 1.24 + (i % 3) * 0.14,
      colorHex: OCEAN_FISH_PALETTE[i % OCEAN_FISH_PALETTE.length],
    });
  }
  for (let i = 0; i < 6; i++) {
    fishTracks.push({
      index: fishIdx++,
      zone: 'ne_beach',
      cx: 141.5 - (i % 2) * 0.3,
      cz: -64.0,
      rx: 1.9,
      rz: 6.0 + (i % 2) * 0.55,
      baseY: -2.34 - (i % 3) * 0.04,
      ampY: 0.035,
      speed: -0.38 - (i % 2) * 0.04,
      phase: 1.1 + i * 0.5,
      figure8: false,
      scale: 1.2 + (i % 3) * 0.15,
      colorHex: OCEAN_FISH_PALETTE[(i + 1) % OCEAN_FISH_PALETTE.length],
    });
  }

  // SE Beachfront School A & B in sunlit shallow-to-mid crystal zone (~7.5m off 134m shoreline)
  for (let i = 0; i < 6; i++) {
    fishTracks.push({
      index: fishIdx++,
      zone: 'se_beach',
      cx: 141.6 + (i % 2) * 0.4,
      cz: 62.0,
      rx: 2.0,
      rz: 6.8 + (i % 3) * 0.45,
      baseY: -2.33 - (i % 3) * 0.04,
      ampY: 0.035,
      speed: 0.4 + (i % 3) * 0.03,
      phase: 0.6 + i * 0.48,
      figure8: true,
      scale: 1.24 + (i % 3) * 0.14,
      colorHex: OCEAN_FISH_PALETTE[(i + 3) % OCEAN_FISH_PALETTE.length],
    });
  }
  for (let i = 0; i < 6; i++) {
    fishTracks.push({
      index: fishIdx++,
      zone: 'se_beach',
      cx: 141.7 - (i % 2) * 0.3,
      cz: 84.0,
      rx: 1.9,
      rz: 6.8 + (i % 2) * 0.5,
      baseY: -2.35 - (i % 3) * 0.04,
      ampY: 0.035,
      speed: -0.37 - (i % 2) * 0.04,
      phase: 2.2 + i * 0.5,
      figure8: false,
      scale: 1.22 + (i % 3) * 0.15,
      colorHex: OCEAN_FISH_PALETTE[(i + 4) % OCEAN_FISH_PALETTE.length],
    });
  }

  // 4. Oasis Water Lily Pads & Lotus Blossoms (~24 pads strictly at lakeSdf in [-3.4 .. -0.9], y = -0.155m)
  let padAttempts = 0;
  while (lilyPads.length < 24 && padAttempts < 3200) {
    padAttempts++;
    const x = -43.0 + rng() * 24.0;
    const z = -14.0 + rng() * 28.0;
    const lakeSdf = evaluateNwLakeSdf(x, z);
    if (lakeSdf < -3.4 || lakeSdf > -0.9) continue;
    if (!hasMinSpacing(lilyPads, x, z, 1.02)) continue;

    const idx = lilyPads.length;
    const hasFlower = idx % 5 === 0 || idx % 5 === 2;
    lilyPads.push({
      x,
      y: OASIS_LILY_PAD_BASE_Y,
      z,
      scale: 0.82 + rng() * 0.42,
      rotY: rng() * Math.PI * 2,
      depth: WATER_SURFACE_Y - evaluateSeabedElevation(x, z),
      zone: 'oasis_lake',
      variant: hasFlower ? 1 : 0,
      colorHex: LILY_PAD_PALETTE[idx % LILY_PAD_PALETTE.length],
      accentColorHex: LOTUS_FLOWER_PALETTE[idx % LOTUS_FLOWER_PALETTE.length],
      hasFlower,
    });
  }

  return { pebbles, coralsAndKelp, fishTracks, lilyPads };
}

/**
 * Evaluates a fish instance's 3D world pose along its figure-8 or elliptical loop,
 * guaranteeing it remains strictly submerged (`y in [-0.68 .. -0.30]`) and at least
 * `+0.16m` above the sandy seabed.
 */
export function evaluateFishTrackPose(
  track: FishSchoolTrackSpec,
  timeSec: number,
): FishPoseSample {
  const theta = timeSec * track.speed + track.phase;
  const sinT = Math.sin(theta);
  const cosT = Math.cos(theta);

  let x: number;
  let z: number;
  let vx: number;
  let vz: number;

  if (track.figure8) {
    x = track.cx + track.rx * sinT;
    z = track.cz + track.rz * sinT * cosT;
    vx = track.rx * cosT * track.speed;
    vz = track.rz * (cosT * cosT - sinT * sinT) * track.speed;
  } else {
    x = track.cx + track.rx * cosT;
    z = track.cz + track.rz * sinT;
    vx = -track.rx * sinT * track.speed;
    vz = track.rz * cosT * track.speed;
  }

  const seabedY = evaluateSeabedElevation(x, z);
  const rawWaveY = track.baseY + Math.sin(timeSec * 1.45 + track.phase * 1.7) * track.ampY;
  const minSafeY = seabedY + 0.16;
  const isOceanZone = track.zone !== 'oasis_lake';
  const bandMinY = isOceanZone ? -2.68 : -0.68;
  const bandMaxY = isOceanZone ? -2.3 : -0.3;
  const maxSubmergedY = isOceanZone ? -2.22 : -0.22;
  const clampedTarget = clamp(rawWaveY, bandMinY, bandMaxY);
  const y = Math.min(maxSubmergedY, Math.max(minSafeY, clampedTarget));
  const vy = Math.cos(timeSec * 1.45 + track.phase * 1.7) * track.ampY * 1.45;

  const horizSpeed = Math.hypot(vx, vz) || 1e-4;
  const yaw = Math.atan2(vx, vz);
  const pitch = clamp(-vy / (horizSpeed + 0.5), -0.22, 0.22);
  const roll = clamp((vx * Math.cos(yaw) - vz * Math.sin(yaw)) * 0.08 + Math.sin(theta * 2.0) * 0.05, -0.14, 0.14);

  return {
    x,
    y,
    z,
    yaw,
    pitch,
    roll,
    seabedY,
    clearanceAboveBed: y - seabedY,
  };
}

// ============================================================================
// PROCEDURAL GEOMETRY BUILDERS (ZERO OUTLINE, SMOOTH ORGANIC SILHOUETTES)
// ============================================================================

interface PackedAcc {
  positions: number[];
  normals: number[];
  uvs: number[];
  tints: number[];
  weights: number[];
  variantIds: number[];
  seeds: number[];
}

function createPackedAcc(): PackedAcc {
  return {
    positions: [],
    normals: [],
    uvs: [],
    tints: [],
    weights: [],
    variantIds: [],
    seeds: [],
  };
}

const _accV = new THREE.Vector3();
const _accN = new THREE.Vector3();
const _accNMat = new THREE.Matrix3();
const _accCol = new THREE.Color();

function appendToPackedAcc(
  acc: PackedAcc,
  srcGeo: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  tintHex: string,
  weightFn: (localPos: THREE.Vector3, worldPos: THREE.Vector3) => number,
  variantId: number,
  seed: number,
): void {
  const nonIdx = srcGeo.index ? srcGeo.toNonIndexed() : srcGeo;
  const pos = nonIdx.getAttribute('position');
  if (!pos || pos.count === 0) {
    if (nonIdx !== srcGeo) nonIdx.dispose();
    return;
  }
  if (!nonIdx.getAttribute('normal')) {
    nonIdx.computeVertexNormals();
  }
  const norm = nonIdx.getAttribute('normal');
  const uv = nonIdx.getAttribute('uv');
  _accCol.set(tintHex);
  _accNMat.getNormalMatrix(matrix);
  const localTmp = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    localTmp.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    _accV.copy(localTmp).applyMatrix4(matrix);
    _accN.set(norm.getX(i), norm.getY(i), norm.getZ(i)).applyMatrix3(_accNMat).normalize();

    acc.positions.push(_accV.x, _accV.y, _accV.z);
    acc.normals.push(_accN.x, _accN.y, _accN.z);
    if (uv) {
      acc.uvs.push(uv.getX(i), uv.getY(i));
    } else {
      acc.uvs.push(0.5, 0.5);
    }
    acc.tints.push(_accCol.r, _accCol.g, _accCol.b);
    acc.weights.push(weightFn(localTmp, _accV));
    acc.variantIds.push(variantId);
    acc.seeds.push(seed);
  }

  if (nonIdx !== srcGeo) {
    nonIdx.dispose();
  }
}

function finalizePackedGeometry(
  acc: PackedAcc,
  weightAttrName: string,
  extraAttrs?: {
    hasVariant?: boolean;
    hasSeed?: boolean;
  },
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(acc.positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(acc.normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(acc.uvs, 2));
  geo.setAttribute('aPartTint', new THREE.Float32BufferAttribute(acc.tints, 3));
  geo.setAttribute(weightAttrName, new THREE.Float32BufferAttribute(acc.weights, 1));
  if (extraAttrs?.hasVariant) {
    geo.setAttribute('aVariantId', new THREE.Float32BufferAttribute(acc.variantIds, 1));
  }
  if (extraAttrs?.hasSeed) {
    geo.setAttribute('aPartSeed', new THREE.Float32BufferAttribute(acc.seeds, 1));
  }
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

function makeDeformedBoulderSphere(
  radius: number,
  widthSegs: number,
  heightSegs: number,
  scaleX: number,
  scaleY: number,
  scaleZ: number,
  seed: number,
): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(radius, widthSegs, heightSegs);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i) * scaleX;
    let y = pos.getY(i) * scaleY;
    let z = pos.getZ(i) * scaleZ;
    const wobble =
      1.0 +
      0.12 * Math.sin(x * 7.5 + seed * 1.7) * Math.cos(z * 6.8 - seed * 0.9) +
      0.07 * Math.cos(y * 8.2 + x * 5.0);
    x *= wobble;
    z *= wobble;
    if (y < 0) y *= 0.62;
    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function createSubmergedPebblesAndBouldersGeometry(): THREE.BufferGeometry {
  const acc = createPackedAcc();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();

  // Variant 0: Smooth organic boulder + 2 nestled companion pebbles
  const mainBoulder = makeDeformedBoulderSphere(0.28, 12, 8, 1.18, 0.78, 0.98, 1.3);
  const sidePebble1 = makeDeformedBoulderSphere(0.11, 8, 6, 1.2, 0.65, 0.95, 2.7);
  const sidePebble2 = makeDeformedBoulderSphere(0.085, 8, 6, 1.15, 0.62, 1.0, 4.1);

  appendToPackedAcc(
    acc,
    mainBoulder,
    m.compose(new THREE.Vector3(0, 0.05, 0), q.setFromEuler(e.set(0.05, 0.2, -0.04)), new THREE.Vector3(1, 1, 1)),
    '#ffffff',
    (_l, w) => smoothstep(-0.08, 0.16, w.y),
    0,
    0.1,
  );
  appendToPackedAcc(
    acc,
    sidePebble1,
    m.compose(new THREE.Vector3(0.26, -0.01, 0.14), q.setFromEuler(e.set(0, 0.8, 0)), new THREE.Vector3(1, 1, 1)),
    '#e8e4dc',
    (_l, w) => smoothstep(-0.07, 0.08, w.y),
    0,
    0.3,
  );
  appendToPackedAcc(
    acc,
    sidePebble2,
    m.compose(new THREE.Vector3(-0.22, -0.01, -0.15), q.setFromEuler(e.set(0, -0.5, 0)), new THREE.Vector3(1, 1, 1)),
    '#cfd8dc',
    (_l, w) => smoothstep(-0.07, 0.07, w.y),
    0,
    0.5,
  );

  // Variant 1: 3-stone flat river pebble cluster
  const riverStoneA = makeDeformedBoulderSphere(0.15, 10, 6, 1.32, 0.48, 1.05, 5.2);
  const riverStoneB = makeDeformedBoulderSphere(0.11, 8, 6, 1.25, 0.45, 0.98, 6.4);
  const riverStoneC = makeDeformedBoulderSphere(0.09, 8, 5, 1.18, 0.44, 1.06, 7.8);

  appendToPackedAcc(
    acc,
    riverStoneA,
    m.compose(new THREE.Vector3(-0.04, 0.015, 0.02), q.setFromEuler(e.set(0, 0.4, 0)), new THREE.Vector3(1, 1, 1)),
    '#ffffff',
    (_l, w) => smoothstep(-0.06, 0.08, w.y),
    1,
    0.2,
  );
  appendToPackedAcc(
    acc,
    riverStoneB,
    m.compose(new THREE.Vector3(0.18, 0.005, -0.11), q.setFromEuler(e.set(0, 1.3, 0)), new THREE.Vector3(1, 1, 1)),
    '#e2ddd5',
    (_l, w) => smoothstep(-0.06, 0.06, w.y),
    1,
    0.6,
  );
  appendToPackedAcc(
    acc,
    riverStoneC,
    m.compose(new THREE.Vector3(-0.16, 0.005, -0.13), q.setFromEuler(e.set(0, -0.9, 0)), new THREE.Vector3(1, 1, 1)),
    '#d0d8dc',
    (_l, w) => smoothstep(-0.06, 0.05, w.y),
    1,
    0.9,
  );

  mainBoulder.dispose();
  sidePebble1.dispose();
  sidePebble2.dispose();
  riverStoneA.dispose();
  riverStoneB.dispose();
  riverStoneC.dispose();

  return finalizePackedGeometry(acc, 'aContactAO', { hasVariant: true, hasSeed: true });
}

function createCurvedKelpBladeGeo(width: number, height: number, curveOut: number): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(width, height, 1, 5);
  geo.translate(0, height * 0.5, 0);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const t = clamp(y / Math.max(0.01, height), 0, 1);
    const taper = Math.sin(Math.pow(1.0 - t * 0.92, 0.65) * Math.PI * 0.5);
    const archZ = Math.sin(t * Math.PI * 0.85) * curveOut + Math.sin(t * Math.PI * 2.0) * 0.025;
    const twistX = x * taper;
    pos.setXYZ(i, twistX, y * (1.0 - 0.08 * t * t), archZ);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function createSubmergedCoralAndKelpGeometry(): THREE.BufferGeometry {
  const acc = createPackedAcc();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();

  // Variant 0: Swaying Seagrass & Kelp Tuft (7 curved tapered blades)
  const bladeCount = 7;
  for (let b = 0; b < bladeCount; b++) {
    const ang = (b / bladeCount) * Math.PI * 2 + (b % 2) * 0.22;
    const h = 0.44 + (b % 3) * 0.13;
    const w = 0.075 + (b % 2) * 0.02;
    const rOff = 0.03 + (b % 2) * 0.035;
    const blade = createCurvedKelpBladeGeo(w, h, 0.07 + (b % 3) * 0.035);
    const tint = b % 2 === 0 ? '#ffffff' : '#d6f5c8';
    m.compose(
      new THREE.Vector3(Math.cos(ang) * rOff, 0.0, Math.sin(ang) * rOff),
      q.setFromEuler(e.set(0.08, ang, (b % 2 === 0 ? 1 : -1) * 0.06)),
      new THREE.Vector3(1, 1, 1),
    );
    appendToPackedAcc(
      acc,
      blade,
      m,
      tint,
      (_l, worldPos) => Math.pow(clamp(worldPos.y / 0.7, 0, 1), 1.4),
      0,
      b * 0.14 + 0.05,
    );
    blade.dispose();
  }

  // Variant 1: Colorful Mini Reef Coral Cluster (mound + 6 rounded coral branches + bulbous tips)
  const coralBase = makeDeformedBoulderSphere(0.14, 8, 5, 1.15, 0.55, 1.1, 3.1);
  appendToPackedAcc(
    acc,
    coralBase,
    m.compose(new THREE.Vector3(0, 0.02, 0), q.identity(), new THREE.Vector3(1, 1, 1)),
    '#d9d4df',
    () => 0.0,
    1,
    0.1,
  );
  coralBase.dispose();

  const branchGeo = new THREE.CylinderGeometry(0.036, 0.052, 0.24, 7);
  branchGeo.translate(0, 0.12, 0);
  const tipGeo = new THREE.SphereGeometry(0.044, 7, 5);
  const branchAngles: readonly [number, number, number, number][] = [
    [0.0, 0.0, 0.0, 1.12],
    [0.42, 0.0, 0.35, 0.96],
    [0.48, 1.5, -0.32, 0.9],
    [0.45, 3.0, 0.3, 1.0],
    [0.5, 4.5, -0.28, 0.86],
    [0.36, 5.6, 0.22, 0.82],
  ];
  for (let i = 0; i < branchAngles.length; i++) {
    const [tilt, yaw, roll, sc] = branchAngles[i];
    const brMat = m
      .compose(
        new THREE.Vector3(Math.cos(yaw) * 0.04, 0.04, Math.sin(yaw) * 0.04),
        q.setFromEuler(e.set(tilt, yaw, roll)),
        new THREE.Vector3(sc, sc, sc),
      )
      .clone();
    appendToPackedAcc(
      acc,
      branchGeo,
      brMat,
      i === 0 ? '#ffffff' : '#f4e6ef',
      (_l, w) => clamp(w.y * 0.35, 0, 0.18),
      1,
      0.2 + i * 0.12,
    );
    const tipPos = new THREE.Vector3(0, 0.24, 0).applyMatrix4(brMat);
    appendToPackedAcc(
      acc,
      tipGeo,
      m.compose(tipPos, q.identity(), new THREE.Vector3(sc, sc * 0.9, sc)),
      '#ffffff',
      () => 0.18,
      1,
      0.2 + i * 0.12,
    );
  }
  branchGeo.dispose();
  tipGeo.dispose();

  // Variant 2: Coastal Five-Arm Starfish resting on sand
  const centerDome = makeDeformedBoulderSphere(0.068, 8, 5, 1.0, 0.56, 1.0, 8.1);
  appendToPackedAcc(
    acc,
    centerDome,
    m.compose(new THREE.Vector3(0, 0.025, 0), q.identity(), new THREE.Vector3(1, 1, 1)),
    '#ffffff',
    () => 0.0,
    2,
    0.5,
  );
  centerDome.dispose();

  const armGeo = new THREE.ConeGeometry(0.046, 0.22, 7);
  armGeo.rotateX(Math.PI / 2);
  armGeo.scale(1.0, 0.52, 1.0);
  armGeo.translate(0, 0.02, 0.12);
  for (let arm = 0; arm < 5; arm++) {
    const a = (arm / 5) * Math.PI * 2;
    appendToPackedAcc(
      acc,
      armGeo,
      m.compose(new THREE.Vector3(0, 0, 0), q.setFromEuler(e.set(0.04, a, 0)), new THREE.Vector3(1, 1, 1)),
      arm % 2 === 0 ? '#ffffff' : '#f9e6db',
      () => 0.0,
      2,
      arm * 0.2,
    );
  }
  armGeo.dispose();

  return finalizePackedGeometry(acc, 'aSwayWeight', { hasVariant: true, hasSeed: true });
}

function createSwimmingFishGeometry(): THREE.BufferGeometry {
  const acc = createPackedAcc();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();

  // Streamlined fusiform fish body (snout at +Z = +0.18, tail peduncle at -Z = -0.14)
  const bodyGeo = new THREE.SphereGeometry(0.085, 10, 8);
  const pos = bodyGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    // pz in [-0.085 .. +0.085] -> normalized axial t in [-1 .. +1]
    const t = pz / 0.085;
    const zNew = t * 0.165;
    const widthScale = t < 0 ? 0.56 * (1.0 + 0.55 * t) : 0.56 * Math.sqrt(Math.max(0.08, 1.0 - t * 0.68));
    const heightScale = t < 0 ? 0.92 * (1.0 + 0.58 * t) : 0.92 * Math.sqrt(Math.max(0.1, 1.0 - t * 0.6));
    pos.setXYZ(i, px * widthScale, py * heightScale, zNew);
  }
  pos.needsUpdate = true;
  bodyGeo.computeVertexNormals();

  // Separate dorsal/flank vs silvery-white belly tint encoded via aPartTint
  const nonIdxBody = bodyGeo.toNonIndexed();
  const bPos = nonIdxBody.getAttribute('position');
  const bNorm = nonIdxBody.getAttribute('normal');
  const bUv = nonIdxBody.getAttribute('uv');
  for (let i = 0; i < bPos.count; i++) {
    const vx = bPos.getX(i);
    const vy = bPos.getY(i);
    const vz = bPos.getZ(i);
    acc.positions.push(vx, vy, vz);
    acc.normals.push(bNorm.getX(i), bNorm.getY(i), bNorm.getZ(i));
    acc.uvs.push(bUv ? bUv.getX(i) : 0.5, bUv ? bUv.getY(i) : 0.5);
    const bellyMix = smoothstep(0.02, -0.045, vy);
    // Encode belly factor inside tint green/blue shift (shader reads vBellyFactor or tint)
    acc.tints.push(1.0 + bellyMix * 0.22, 1.0 + bellyMix * 0.22, 1.0 + bellyMix * 0.22);
    acc.weights.push(clamp((0.04 - vz) / 0.28, 0, 1));
    acc.variantIds.push(bellyMix);
    acc.seeds.push(0);
  }
  nonIdxBody.dispose();
  bodyGeo.dispose();

  // Forked Tail Fin
  const tailShape = new THREE.Shape();
  tailShape.moveTo(0, 0.016);
  tailShape.lineTo(-0.1, 0.072);
  tailShape.lineTo(-0.072, 0.0);
  tailShape.lineTo(-0.1, -0.072);
  tailShape.lineTo(0, -0.016);
  tailShape.closePath();
  const tailGeo = new THREE.ShapeGeometry(tailShape);
  tailGeo.rotateY(-Math.PI / 2);
  appendToPackedAcc(
    acc,
    tailGeo,
    m.compose(new THREE.Vector3(0, 0, -0.145), q.identity(), new THREE.Vector3(1, 1, 1)),
    '#e8f6ff',
    (l) => clamp(0.65 + (-l.z / 0.1) * 0.35, 0.65, 1.0),
    0.25,
    0,
  );
  tailGeo.dispose();

  // Swept Dorsal Fin
  const dorsalShape = new THREE.Shape();
  dorsalShape.moveTo(0.04, 0);
  dorsalShape.lineTo(-0.025, 0.056);
  dorsalShape.lineTo(-0.075, 0.025);
  dorsalShape.lineTo(-0.06, 0);
  dorsalShape.closePath();
  const dorsalGeo = new THREE.ShapeGeometry(dorsalShape);
  dorsalGeo.rotateY(-Math.PI / 2);
  appendToPackedAcc(
    acc,
    dorsalGeo,
    m.compose(new THREE.Vector3(0, 0.058, 0.01), q.identity(), new THREE.Vector3(1, 1, 1)),
    '#e2f4ff',
    () => 0.25,
    0.1,
    0,
  );
  dorsalGeo.dispose();

  // Twin subtle Pectoral Fins
  const pecGeo = new THREE.PlaneGeometry(0.055, 0.036);
  for (const side of [-1, 1] as const) {
    appendToPackedAcc(
      acc,
      pecGeo,
      m.compose(
        new THREE.Vector3(side * 0.044, -0.014, 0.045),
        q.setFromEuler(e.set(0.18, side * 0.55, side * -0.35)),
        new THREE.Vector3(1, 1, 1),
      ),
      '#f1f5f9',
      () => 0.15,
      0.55,
      0,
    );
  }
  pecGeo.dispose();

  const geo = finalizePackedGeometry(acc, 'aTailWeight');
  geo.setAttribute('aBellyFactor', new THREE.Float32BufferAttribute(acc.variantIds, 1));
  return geo;
}

function createWaterLilyPadAndLotusGeometry(): THREE.BufferGeometry {
  const acc = createPackedAcc();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();

  // 1. Notched Water Lily Pad Disc (`radius 0.34m`, cupped outer rim, classic V-notch wedge)
  const padRadius = 0.34;
  const padGeo = new THREE.CylinderGeometry(
    padRadius,
    padRadius * 0.98,
    0.018,
    22,
    1,
    false,
    0.24,
    Math.PI * 2 - 0.48,
  );
  const pos = padGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const rNorm = clamp(Math.hypot(px, pz) / padRadius, 0, 1);
    const rimLift = Math.pow(rNorm, 3.0) * 0.015;
    pos.setXYZ(i, px, py + rimLift + 0.004, pz);
  }
  pos.needsUpdate = true;
  padGeo.computeVertexNormals();
  appendToPackedAcc(
    acc,
    padGeo,
    m.identity(),
    '#ffffff',
    () => 0.0, // 0.0 = lily pad leaf
    0,
    0,
  );
  padGeo.dispose();

  // 2. Sculpted Multi-Petal Lotus Flower Cup (outer + inner cupped petals + golden stamen bud)
  const petalGeo = new THREE.SphereGeometry(0.056, 6, 5);
  petalGeo.scale(0.55, 1.35, 0.22);
  petalGeo.translate(0, 0.048, 0);

  const flowerCenter = new THREE.Vector3(0.04, 0.012, -0.02);
  for (let tier = 0; tier < 2; tier++) {
    const count = tier === 0 ? 6 : 5;
    const tilt = tier === 0 ? 0.92 : 0.48;
    const sc = tier === 0 ? 1.0 : 0.78;
    for (let p = 0; p < count; p++) {
      const ang = (p / count) * Math.PI * 2 + tier * 0.45;
      const pMat = new THREE.Matrix4()
        .makeTranslation(flowerCenter.x, flowerCenter.y, flowerCenter.z)
        .multiply(new THREE.Matrix4().makeRotationY(ang))
        .multiply(new THREE.Matrix4().makeRotationX(tilt))
        .multiply(new THREE.Matrix4().makeScale(sc, sc, sc));
      appendToPackedAcc(
        acc,
        petalGeo,
        pMat,
        tier === 0 ? '#ffffff' : '#fff5f8',
        () => 1.0, // 1.0 = flower petal
        1,
        0,
      );
    }
  }
  petalGeo.dispose();

  const stamenGeo = new THREE.SphereGeometry(0.032, 7, 5);
  stamenGeo.scale(1.0, 0.75, 1.0);
  appendToPackedAcc(
    acc,
    stamenGeo,
    m.compose(
      new THREE.Vector3(flowerCenter.x, flowerCenter.y + 0.032, flowerCenter.z),
      q.setFromEuler(e.set(0, 0, 0)),
      new THREE.Vector3(1, 1, 1),
    ),
    '#ffd54f',
    () => 2.0, // 2.0 = golden stamen center
    1,
    0,
  );
  stamenGeo.dispose();

  return finalizePackedGeometry(acc, 'aPartKind');
}

// ============================================================================
// CUSTOM LIGHTWEIGHT SHADERS (LINEAR THREE.FOG, ZERO BLACK OUTLINES)
// ============================================================================

function createSubmergedPebblesShaderMaterial(windUniforms: BlitzWindUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: windUniforms.uTime,
      uLightDirection: windUniforms.uLightDirection,
      uLightColor: windUniforms.uLightColor,
    },
    fog: true,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      attribute vec3 aPartTint;
      attribute float aContactAO;
      attribute float aVariantId;
      attribute float aInstanceVariant;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vColor;
      varying float vContactAO;

      void main() {
        float activeMask = 1.0 - step(0.5, abs(aVariantId - aInstanceVariant));
        #ifdef USE_INSTANCING
          mat4 worldMat = modelMatrix * instanceMatrix;
        #else
          mat4 worldMat = modelMatrix;
        #endif
        #ifdef USE_INSTANCING_COLOR
          vec3 instCol = instanceColor;
        #else
          vec3 instCol = vec3(0.58, 0.62, 0.64);
        #endif
        vColor = instCol * aPartTint;

        vec3 localPos = position * activeMask;
        vec4 worldPos = worldMat * vec4(localPos, 1.0);
        vec3 col0 = worldMat[0].xyz;
        vec3 col1 = worldMat[1].xyz;
        vec3 col2 = worldMat[2].xyz;
        vec3 invScaleSq = vec3(
          1.0 / max(1e-4, dot(col0, col0)),
          1.0 / max(1e-4, dot(col1, col1)),
          1.0 / max(1e-4, dot(col2, col2))
        );
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(mat3(worldMat) * (normal * invScaleSq));
        vContactAO = mix(0.68, 1.0, aContactAO);

        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform vec3 uLightDirection;
      uniform vec3 uLightColor;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vColor;
      varying float vContactAO;

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 L = normalize(uLightDirection);
        float halfLambert = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
        float softLit = smoothstep(0.08, 0.92, halfLambert);

        float lightLuma = max(0.24, dot(uLightColor, vec3(0.299, 0.587, 0.114)));
        vec3 litTint = mix(vec3(0.92), uLightColor, 0.62);
        vec3 baseCol = vColor * vContactAO;
        vec3 shaded = baseCol * mix(vec3(0.54, 0.66, 0.74) * lightLuma, litTint * (0.94 + 0.14 * softLit), softLit);

        // Soft bluish-teal underwater absorption based on depth below -0.16m
        float depth = clamp(-0.16 - vWorldPos.y, 0.0, 1.65);
        vec3 waterAbsorbTint = vec3(0.10, 0.48, 0.60) * lightLuma;
        shaded = mix(shaded, waterAbsorbTint, clamp(0.10 + depth * 0.30, 0.08, 0.52));

        // Subtle dual-wave underwater caustic shimmer across upward stone facets
        vec2 cUv = vWorldPos.xz * 1.45;
        float ca = sin(cUv.x * 1.9 + uTime * 1.65 + cos(cUv.y * 1.7 - uTime * 1.25));
        float cb = cos(cUv.y * 2.1 - uTime * 1.45 + sin(cUv.x * 1.5 + uTime * 1.10));
        float causticShimmer = pow(clamp((ca * 0.5 + cb * 0.5) * 0.5 + 0.5, 0.0, 1.0), 3.4);
        float upFacing = clamp(N.y * 0.8 + 0.2, 0.0, 1.0);
        shaded += vec3(0.45, 0.88, 0.96) * causticShimmer * upFacing * (1.0 - depth * 0.35) * lightLuma * 0.22;

        gl_FragColor = vec4(shaded, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
}

function createSubmergedCoralAndKelpShaderMaterial(
  windUniforms: BlitzWindUniforms,
): THREE.ShaderMaterial {
  const uWindDirection = windUniforms.uWindDirection ?? { value: new THREE.Vector2(0.7071, 0.7071) };
  const uWindStrength = windUniforms.uWindStrength ?? { value: 0.32 };

  return new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: windUniforms.uTime,
      uWindDirection,
      uWindStrength,
      uLightDirection: windUniforms.uLightDirection,
      uLightColor: windUniforms.uLightColor,
    },
    fog: true,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      attribute vec3 aPartTint;
      attribute float aSwayWeight;
      attribute float aVariantId;
      attribute float aPartSeed;
      attribute float aInstanceVariant;

      uniform float uTime;
      uniform vec2 uWindDirection;
      uniform float uWindStrength;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vColor;
      varying float vSwayWeight;

      void main() {
        float activeMask = 1.0 - step(0.5, abs(aVariantId - aInstanceVariant));
        #ifdef USE_INSTANCING
          mat4 worldMat = modelMatrix * instanceMatrix;
        #else
          mat4 worldMat = modelMatrix;
        #endif
        #ifdef USE_INSTANCING_COLOR
          vec3 instCol = instanceColor;
        #else
          vec3 instCol = vec3(0.28, 0.76, 0.56);
        #endif

        vec3 localPos = position * activeMask;
        vec4 worldPos = worldMat * vec4(localPos, 1.0);
        vec3 originW = (worldMat * vec4(0.0, 0.0, 0.0, 1.0)).xyz;

        vec2 wDir = length(uWindDirection) > 0.001 ? normalize(uWindDirection) : vec2(0.7071, 0.7071);
        vec2 pDir = vec2(-wDir.y, wDir.x);

        float phase = uTime * 2.15 + originW.x * 0.42 + originW.z * 0.36 + aPartSeed * 6.2831853;
        float amp = (0.045 + uWindStrength * 0.085) * aSwayWeight * activeMask;
        float wave1 = sin(phase);
        float wave2 = cos(phase * 1.67 + 1.1) * 0.42;

        worldPos.x += (wDir.x * wave1 + pDir.x * wave2) * amp;
        worldPos.z += (wDir.y * wave1 + pDir.y * wave2) * amp;
        worldPos.y -= abs(wave1) * amp * 0.16;

        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(mat3(worldMat) * normal);
        vColor = instCol * aPartTint * mix(0.84, 1.12, clamp(aSwayWeight, 0.0, 1.0));
        vSwayWeight = aSwayWeight;

        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform vec3 uLightDirection;
      uniform vec3 uLightColor;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vColor;
      varying float vSwayWeight;

      void main() {
        vec3 N = normalize(vWorldNormal);
        if (!gl_FrontFacing) N = -N;
        vec3 L = normalize(uLightDirection);
        float halfLambert = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
        float softLit = smoothstep(0.08, 0.90, halfLambert);

        float lightLuma = max(0.24, dot(uLightColor, vec3(0.299, 0.587, 0.114)));
        vec3 litTint = mix(vec3(0.95), uLightColor, 0.65);
        vec3 shaded = vColor * mix(vec3(0.56, 0.68, 0.78) * lightLuma, litTint * (0.96 + 0.16 * softLit), softLit);

        // Gentle translucent sunlit tip glow & subtle underwater absorption
        float depth = clamp(-0.16 - vWorldPos.y, 0.0, 1.65);
        vec3 waterAbsorb = vec3(0.10, 0.50, 0.62) * lightLuma;
        shaded = mix(shaded, waterAbsorb, clamp(0.04 + depth * 0.16, 0.04, 0.28));

        float shimmer = pow(clamp(sin(vWorldPos.x * 2.2 + uTime * 1.8) * cos(vWorldPos.z * 2.0 - uTime * 1.5) * 0.5 + 0.5, 0.0, 1.0), 3.2);
        shaded += vec3(0.35, 0.85, 0.90) * shimmer * lightLuma * 0.14;

        gl_FragColor = vec4(shaded, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
}

function createSwimmingFishShaderMaterial(windUniforms: BlitzWindUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: windUniforms.uTime,
      uLightDirection: windUniforms.uLightDirection,
      uLightColor: windUniforms.uLightColor,
    },
    fog: true,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      attribute float aTailWeight;
      attribute float aBellyFactor;
      attribute float aFishPhase;

      uniform float uTime;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vColor;
      varying float vBellyFactor;

      void main() {
        #ifdef USE_INSTANCING
          mat4 worldMat = modelMatrix * instanceMatrix;
        #else
          mat4 worldMat = modelMatrix;
        #endif
        #ifdef USE_INSTANCING_COLOR
          vec3 instCol = instanceColor;
        #else
          vec3 instCol = vec3(0.95, 0.55, 0.22);
        #endif

        float swimPhase = uTime * 10.5 + aFishPhase * 6.2831853;
        float wiggle = sin(swimPhase - position.z * 8.0) * 0.042 * aTailWeight;
        vec3 localPos = position + vec3(wiggle, 0.0, 0.0);

        vec4 worldPos = worldMat * vec4(localPos, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(mat3(worldMat) * normal);
        vColor = mix(instCol, vec3(0.93, 0.97, 0.99), aBellyFactor * 0.68);
        vBellyFactor = aBellyFactor;

        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform vec3 uLightDirection;
      uniform vec3 uLightColor;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vColor;
      varying float vBellyFactor;

      void main() {
        vec3 N = normalize(vWorldNormal);
        if (!gl_FrontFacing) N = -N;
        vec3 L = normalize(uLightDirection);
        float halfLambert = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
        float softLit = smoothstep(0.05, 0.92, halfLambert);

        float lightLuma = max(0.24, dot(uLightColor, vec3(0.299, 0.587, 0.114)));
        vec3 litCol = vColor * mix(vec3(0.96), uLightColor, 0.60) * (1.06 + 0.18 * softLit);
        vec3 shadeCol = vColor * vec3(0.68, 0.78, 0.86) * lightLuma;
        vec3 shaded = mix(shadeCol, litCol, softLit);

        // Subtle sunlit dorsal scale sheen
        vec3 halfVec = normalize(L + vec3(0.0, 0.85, 0.25));
        float dorsalSheen = pow(max(0.0, dot(N, halfVec)), 18.0) * (1.0 - vBellyFactor) * 0.28;
        shaded += uLightColor * dorsalSheen;

        // Minimal water tint (water surface overlay already applies optical depth transmittance)
        float depth = clamp(-0.16 - vWorldPos.y, 0.0, 1.2);
        shaded = mix(shaded, vec3(0.16, 0.60, 0.72) * lightLuma, clamp(0.02 + depth * 0.06, 0.02, 0.09));

        gl_FragColor = vec4(shaded, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
}

function createOasisLilyPadsShaderMaterial(windUniforms: BlitzWindUniforms): THREE.ShaderMaterial {
  const uWindStrength = windUniforms.uWindStrength ?? { value: 0.32 };

  return new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: windUniforms.uTime,
      uWindStrength,
      uLightDirection: windUniforms.uLightDirection,
      uLightColor: windUniforms.uLightColor,
    },
    fog: true,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      attribute vec3 aPartTint;
      attribute float aPartKind;
      attribute float aHasFlower;
      attribute vec3 aFlowerColor;
      attribute float aPadShoreDamp;

      uniform float uTime;
      uniform float uWindStrength;

      varying vec3 vWorldNormal;
      varying vec3 vColor;
      varying float vRadialNorm;
      varying float vPartKind;

      void main() {
        float isFlowerPart = step(0.5, aPartKind);
        float showPart = mix(1.0, aHasFlower, isFlowerPart);

        #ifdef USE_INSTANCING
          mat4 worldMat = modelMatrix * instanceMatrix;
        #else
          mat4 worldMat = modelMatrix;
        #endif
        #ifdef USE_INSTANCING_COLOR
          vec3 padCol = instanceColor;
        #else
          vec3 padCol = vec3(0.24, 0.62, 0.30);
        #endif

        vec3 localPos = position * showPart;
        vec4 worldPos = worldMat * vec4(localPos, 1.0);
        vec3 originW = (worldMat * vec4(0.0, 0.0, 0.0, 1.0)).xyz;

        // Exact OasisLakeWaterSurface wave sync (k0 + k1 + k2, uWaveScale = 0.45, shoreDamp & windWaveBoost)
        // plus +0.008m float clearance so lily pads & lotus buds sit cleanly above rippling water!
        float windWaveBoost = mix(0.85, 1.45, clamp(uWindStrength * 0.5, 0.0, 1.0));
        float effAmp = 0.45 * aPadShoreDamp * windWaveBoost;
        float k0 = 6.2831853 / 73.3;
        float k1 = 6.2831853 / 15.7;
        float k2 = 6.2831853 / 3.33;
        float p0 = originW.x * k0 * 0.88 + originW.z * k0 * 0.47 + uTime * 1.45;
        float p1 = originW.x * k1 * 0.76 - originW.z * k1 * 0.65 + uTime * 2.15;
        float p2 = -originW.x * k2 * 0.54 + originW.z * k2 * 0.84 + uTime * 3.10;
        float bobY = (sin(p0) * 0.068 + sin(p1) * 0.042 + cos(p2) * 0.018) * effAmp;
        worldPos.y += bobY + 0.008;

        vWorldNormal = normalize(mat3(worldMat) * normal);
        vRadialNorm = clamp(length(localPos.xz) / 0.34, 0.0, 1.0);
        vPartKind = aPartKind;

        vec3 flowerCol = aPartKind > 1.5 ? aPartTint : aFlowerColor * aPartTint;
        vColor = mix(padCol, flowerCol, isFlowerPart);

        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform vec3 uLightDirection;
      uniform vec3 uLightColor;

      varying vec3 vWorldNormal;
      varying vec3 vColor;
      varying float vRadialNorm;
      varying float vPartKind;

      void main() {
        vec3 N = normalize(vWorldNormal);
        if (!gl_FrontFacing) N = -N;
        vec3 L = normalize(uLightDirection);
        float halfLambert = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
        float softLit = smoothstep(0.08, 0.90, halfLambert);

        vec3 baseCol = vColor;
        if (vPartKind < 0.5) {
          // Subtle warm sunlit outer rim & cooler deep-emerald pad center
          baseCol = mix(baseCol * 0.86, baseCol * vec3(1.12, 1.14, 0.92), smoothstep(0.2, 0.95, vRadialNorm));
        }

        float lightLuma = max(0.24, dot(uLightColor, vec3(0.299, 0.587, 0.114)));
        vec3 litCol = baseCol * mix(vec3(0.95), uLightColor, 0.65) * (0.98 + 0.12 * softLit);
        vec3 shadeCol = baseCol * vec3(0.56, 0.68, 0.72) * lightLuma;
        vec3 shaded = mix(shadeCol, litCol, softLit);

        gl_FragColor = vec4(shaded, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
}

// ============================================================================
// MAIN BUILDER: buildUnderwaterEcology3D
// ============================================================================

const _fishPos = new THREE.Vector3();
const _fishEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _fishQuat = new THREE.Quaternion();
const _fishScale = new THREE.Vector3();
const _fishMat = new THREE.Matrix4();

export function buildUnderwaterEcology3D(
  scene: THREE.Scene,
  windUniforms: BlitzWindUniforms,
  _isSoftwareGl = false,
): UnderwaterEcologyHandle {
  const group = new THREE.Group();
  group.name = 'BlitzUnderwaterEcology3D';
  scene.add(group);

  const { pebbles, coralsAndKelp, fishTracks, lilyPads } = generateUnderwaterEcologyPlacements();

  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3();
  const tmpEuler = new THREE.Euler();
  const tmpMat = new THREE.Matrix4();
  const tmpCol = new THREE.Color();

  // 1. SubmergedPebblesAndBouldersInstanced (Static batch)
  const pebblesGeo = createSubmergedPebblesAndBouldersGeometry();
  const pebbleVariants = new Float32Array(pebbles.length);
  for (let i = 0; i < pebbles.length; i++) {
    pebbleVariants[i] = pebbles[i].variant;
  }
  pebblesGeo.setAttribute(
    'aInstanceVariant',
    new THREE.InstancedBufferAttribute(pebbleVariants, 1),
  );
  const pebblesMat = createSubmergedPebblesShaderMaterial(windUniforms);
  const pebblesMesh = new THREE.InstancedMesh(pebblesGeo, pebblesMat, pebbles.length);
  pebblesMesh.name = 'SubmergedPebblesAndBouldersInstanced';
  pebblesMesh.castShadow = false;
  pebblesMesh.receiveShadow = false;
  for (let i = 0; i < pebbles.length; i++) {
    const p = pebbles[i];
    tmpPos.set(p.x, p.y, p.z);
    tmpQuat.setFromEuler(tmpEuler.set(0, p.rotY, 0));
    tmpScale.setScalar(p.scale);
    tmpMat.compose(tmpPos, tmpQuat, tmpScale);
    pebblesMesh.setMatrixAt(i, tmpMat);
    pebblesMesh.setColorAt(i, tmpCol.set(p.colorHex));
  }
  pebblesMesh.instanceMatrix.needsUpdate = true;
  if (pebblesMesh.instanceColor) pebblesMesh.instanceColor.needsUpdate = true;
  computeInstancedBoundingVolumes(pebblesMesh, { padding: 0.4, frustumCulled: true });
  pebblesMesh.updateMatrix();
  pebblesMesh.matrixAutoUpdate = false;
  group.add(pebblesMesh);

  // 2. SubmergedCoralAndKelpInstanced (Static placement + GPU wind sway)
  const coralKelpGeo = createSubmergedCoralAndKelpGeometry();
  const coralVariants = new Float32Array(coralsAndKelp.length);
  for (let i = 0; i < coralsAndKelp.length; i++) {
    coralVariants[i] = coralsAndKelp[i].variant;
  }
  coralKelpGeo.setAttribute(
    'aInstanceVariant',
    new THREE.InstancedBufferAttribute(coralVariants, 1),
  );
  const coralKelpMat = createSubmergedCoralAndKelpShaderMaterial(windUniforms);
  const coralKelpMesh = new THREE.InstancedMesh(coralKelpGeo, coralKelpMat, coralsAndKelp.length);
  coralKelpMesh.name = 'SubmergedCoralAndKelpInstanced';
  coralKelpMesh.castShadow = false;
  coralKelpMesh.receiveShadow = false;
  for (let i = 0; i < coralsAndKelp.length; i++) {
    const c = coralsAndKelp[i];
    tmpPos.set(c.x, c.y, c.z);
    tmpQuat.setFromEuler(tmpEuler.set(0, c.rotY, 0));
    tmpScale.setScalar(c.scale);
    tmpMat.compose(tmpPos, tmpQuat, tmpScale);
    coralKelpMesh.setMatrixAt(i, tmpMat);
    coralKelpMesh.setColorAt(i, tmpCol.set(c.colorHex));
  }
  coralKelpMesh.instanceMatrix.needsUpdate = true;
  if (coralKelpMesh.instanceColor) coralKelpMesh.instanceColor.needsUpdate = true;
  computeInstancedBoundingVolumes(coralKelpMesh, { padding: 0.65, frustumCulled: true });
  coralKelpMesh.updateMatrix();
  coralKelpMesh.matrixAutoUpdate = false;
  group.add(coralKelpMesh);

  // 3. SwimmingSchoolFishInstanced (Dynamic 60 FPS zero-allocation orbit update)
  const fishGeo = createSwimmingFishGeometry();
  const fishPhases = new Float32Array(fishTracks.length);
  for (let i = 0; i < fishTracks.length; i++) {
    fishPhases[i] = (i * 0.37) % 1.0;
  }
  fishGeo.setAttribute('aFishPhase', new THREE.InstancedBufferAttribute(fishPhases, 1));
  const fishMat = createSwimmingFishShaderMaterial(windUniforms);
  const fishMesh = new THREE.InstancedMesh(fishGeo, fishMat, fishTracks.length);
  fishMesh.name = 'SwimmingSchoolFishInstanced';
  fishMesh.castShadow = false;
  fishMesh.receiveShadow = false;

  const fishOrbitBox = new THREE.Box3();
  for (let i = 0; i < fishTracks.length; i++) {
    const tr = fishTracks[i];
    fishMesh.setColorAt(i, tmpCol.set(tr.colorHex));
    fishOrbitBox.expandByPoint(tmpPos.set(tr.cx - tr.rx - 1.0, -0.85, tr.cz - tr.rz - 1.0));
    fishOrbitBox.expandByPoint(tmpPos.set(tr.cx + tr.rx + 1.0, -0.16, tr.cz + tr.rz + 1.0));
  }
  if (fishMesh.instanceColor) fishMesh.instanceColor.needsUpdate = true;
  fishMesh.boundingBox = fishOrbitBox.clone();
  fishMesh.boundingSphere = fishOrbitBox.getBoundingSphere(new THREE.Sphere());
  fishMesh.frustumCulled = true;
  fishMesh.updateMatrix();
  fishMesh.matrixAutoUpdate = false;
  group.add(fishMesh);

  // 4. OasisWaterLilyPadsInstanced (Static placement at y=-0.155m + GPU wave bobbing)
  const lilyGeo = createWaterLilyPadAndLotusGeometry();
  const hasFlowerArr = new Float32Array(lilyPads.length);
  const flowerColArr = new Float32Array(lilyPads.length * 3);
  const padShoreDampArr = new Float32Array(lilyPads.length);
  for (let i = 0; i < lilyPads.length; i++) {
    const pad = lilyPads[i];
    hasFlowerArr[i] = pad.hasFlower ? 1.0 : 0.0;
    tmpCol.set(pad.accentColorHex ?? '#fbcfe8');
    flowerColArr[i * 3] = tmpCol.r;
    flowerColArr[i * 3 + 1] = tmpCol.g;
    flowerColArr[i * 3 + 2] = tmpCol.b;
    padShoreDampArr[i] = smoothstep(0.2, -1.55, evaluateNwLakeSdf(pad.x, pad.z));
  }
  lilyGeo.setAttribute('aHasFlower', new THREE.InstancedBufferAttribute(hasFlowerArr, 1));
  lilyGeo.setAttribute('aFlowerColor', new THREE.InstancedBufferAttribute(flowerColArr, 3));
  lilyGeo.setAttribute('aPadShoreDamp', new THREE.InstancedBufferAttribute(padShoreDampArr, 1));
  const lilyMat = createOasisLilyPadsShaderMaterial(windUniforms);
  const lilyPadsMesh = new THREE.InstancedMesh(lilyGeo, lilyMat, lilyPads.length);
  lilyPadsMesh.name = 'OasisWaterLilyPadsInstanced';
  lilyPadsMesh.castShadow = false;
  lilyPadsMesh.receiveShadow = false;
  for (let i = 0; i < lilyPads.length; i++) {
    const pad = lilyPads[i];
    tmpPos.set(pad.x, pad.y, pad.z);
    tmpQuat.setFromEuler(tmpEuler.set(0, pad.rotY, 0));
    tmpScale.setScalar(pad.scale);
    tmpMat.compose(tmpPos, tmpQuat, tmpScale);
    lilyPadsMesh.setMatrixAt(i, tmpMat);
    lilyPadsMesh.setColorAt(i, tmpCol.set(pad.colorHex));
  }
  lilyPadsMesh.instanceMatrix.needsUpdate = true;
  if (lilyPadsMesh.instanceColor) lilyPadsMesh.instanceColor.needsUpdate = true;
  computeInstancedBoundingVolumes(lilyPadsMesh, { padding: 0.45, frustumCulled: true });
  lilyPadsMesh.updateMatrix();
  lilyPadsMesh.matrixAutoUpdate = false;
  group.add(lilyPadsMesh);

  const instancedMeshes: readonly THREE.InstancedMesh[] = [
    pebblesMesh,
    coralKelpMesh,
    fishMesh,
    lilyPadsMesh,
  ];

  const evaluateFishPoseAt = (index: number, timeSec: number): FishPoseSample =>
    evaluateFishTrackPose(fishTracks[index], timeSec);

  const update = (timeSec: number, windTimeSec?: number) => {
    if (windTimeSec !== undefined && windUniforms.uTime !== undefined) {
      windUniforms.uTime.value = windTimeSec;
    }
    if (!group.visible) return;

    for (let i = 0; i < fishTracks.length; i++) {
      const tr = fishTracks[i];
      const pose = evaluateFishTrackPose(tr, timeSec);
      _fishPos.set(pose.x, pose.y, pose.z);
      _fishEuler.set(pose.pitch, pose.yaw, pose.roll, 'YXZ');
      _fishQuat.setFromEuler(_fishEuler);
      _fishScale.setScalar(tr.scale);
      _fishMat.compose(_fishPos, _fishQuat, _fishScale);
      fishMesh.setMatrixAt(i, _fishMat);
    }
    fishMesh.instanceMatrix.needsUpdate = true;
  };

  // Initialize fish poses at t = 0 immediately so frame 0 has valid matrices
  update(0);

  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (let i = 0; i < instancedMeshes.length; i++) {
      const mesh = instancedMeshes[i];
      mesh.geometry.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) {
        for (let m = 0; m < mat.length; m++) mat[m].dispose();
      } else {
        mat.dispose();
      }
      if (typeof mesh.dispose === 'function') {
        mesh.dispose();
      }
    }
    if (group.parent) {
      group.parent.remove(group);
    }
  };

  return {
    group,
    pebblesMesh,
    coralKelpMesh,
    fishMesh,
    lilyPadsMesh,
    instancedMeshes,
    fishTracks,
    pebblePlacements: pebbles,
    coralPlacements: coralsAndKelp,
    lilyPadPlacements: lilyPads,
    stats: {
      drawCalls: instancedMeshes.length,
      pebblesCount: pebbles.length,
      coralAndKelpCount: coralsAndKelp.length,
      fishCount: fishTracks.length,
      lilyPadsCount: lilyPads.length,
      totalInstances:
        pebbles.length + coralsAndKelp.length + fishTracks.length + lilyPads.length,
    },
    evaluateFishPoseAt,
    update,
    dispose,
  };
}
