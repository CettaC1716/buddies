import {
  IndividualCommanderBaseState,
  TeamCommandMode,
  computeLandMineGrassYOffset,
  PersonalCommandCenterRadarOperatorStatus,
  WorldMode,
  DYNAMIC_CHUNK_CULLING_OUTER_RADIUS,
  DYNAMIC_CHUNK_CULLING_FADE_START_RADIUS,
  evaluateChunkSynced3DFogOfWar,
} from './buddiesBlitzRules';
import {
  evaluateBlitzGrassMask,
} from './buddiesPlanetCurvature';
import {
  BuddyUnit,
  TankVehicle,
  WorldCrate,
  WorldPickup,
  ActiveOrdnanceDevice3D,
  RadarDot,
  PlayMode,
  ActiveMapPropPhysics,
} from './buddiesBlitzTypes';

/**
 * Radius dynamic chunk culling (26.0m) around player character.
 * Only dynamic entities (crates, pickups, barrels, ordnance, enemy units) are culled.
 * Environment props (trees, buildings, roads, bridges, rails, tram, halte, grass, base buildings)
 * are NEVER culled and remain fully visible across the entire map.
 */
export const DYNAMIC_CHUNK_CULLING_RADIUS = DYNAMIC_CHUNK_CULLING_OUTER_RADIUS;
export { DYNAMIC_CHUNK_CULLING_FADE_START_RADIUS, evaluateChunkSynced3DFogOfWar };

export interface MinimapRadarEvaluationResult {
  radarDots: RadarDot[];
  operatorStatus: PersonalCommandCenterRadarOperatorStatus;
}

/**
 * Checks if a 2D position is within the dynamic culling radius (26m) of the viewer.
 */
export function isPositionInsideDynamicCullingRadius(
  x: number,
  z: number,
  viewerX: number,
  viewerZ: number,
  radius: number = DYNAMIC_CHUNK_CULLING_RADIUS,
): boolean {
  const dx = x - viewerX;
  const dz = z - viewerZ;
  return dx * dx + dz * dz <= radius * radius;
}

/**
 * Evaluates the Player's Personal Command Center Radar operator state and builds the filtered Minimap `radarDots` list.
 * Rules:
 * 1. Background map & bases remain fully visible on Minimap.
 * 2. Friendly units (allies & player) and friendly vehicles: ALWAYS visible (no radius culling).
 * 3. Supply drop beacon signal: ALWAYS visible.
 * 4. Dynamic items & enemies (enemy infantry, enemy tanks, crates, pickups, explosive barrels):
 *    ONLY shown on Minimap if within 26.0m radius of the player character, OR if MAP PREVIEW / bypassDistanceCulling is active.
 */
export function evaluatePlayerCommandCenterRadarAndMinimapDots(params: {
  myPlot: IndividualCommanderBaseState;
  buddyUnits: ReadonlyArray<BuddyUnit>;
  tanks: ReadonlyArray<TankVehicle>;
  playerUnit: BuddyUnit;
  mountedTank: TankVehicle | null;
  teamCommand: TeamCommandMode;
  actorX: number;
  actorZ: number;
  activeSupplyDropSignal?: { x: number; z: number } | null;
  worldCrates?: ReadonlyArray<WorldCrate>;
  worldPickups?: ReadonlyArray<WorldPickup>;
  activeMapProps?: ReadonlyArray<ActiveMapPropPhysics>;
  playMode?: PlayMode;
  bypassDistanceCulling?: boolean;
}): MinimapRadarEvaluationResult {
  const {
    buddyUnits,
    tanks,
    mountedTank,
    activeSupplyDropSignal,
    worldCrates = [],
    worldPickups = [],
    activeMapProps = [],
    actorX,
    actorZ,
    playMode,
    bypassDistanceCulling = false,
  } = params;

  const playerTeam = params.playerUnit.team ?? 'blue';
  const isMapPreview = playMode === 'editor' || bypassDistanceCulling;

  const operatorStatus: PersonalCommandCenterRadarOperatorStatus = {
    radarActive: true,
    operatorSource: 'player_in_command_center',
    operatorUnitId: null,
    commandCenterLevel: 3,
    coveragePct: 100,
    baseRadarRadius: 360,
    playerVisionRadius: 360,
  };

  const radarDots: RadarDot[] = [];

  // 1. Supply Drop Signal (Always visible)
  if (activeSupplyDropSignal) {
    radarDots.push({
      id: 'supply-drop-signal',
      kind: 'supply_drop',
      x: activeSupplyDropSignal.x,
      z: activeSupplyDropSignal.z,
    });
  }

  // 2. Vehicles (Tanks, Dump Trucks, Fighter Planes)
  for (let i = 0; i < tanks.length; i++) {
    const t = tanks[i];
    if (t.hp <= 0) continue;
    const isFriendlyVehicle = t.team === playerTeam;
    // Friendly vehicles always visible. Enemy vehicles only within 26m or in map preview.
    if (isFriendlyVehicle || isMapPreview || isPositionInsideDynamicCullingRadius(t.x, t.z, actorX, actorZ)) {
      radarDots.push({
        id: `t-${t.id}`,
        kind: isFriendlyVehicle ? 'tank_blue' : 'tank_red',
        x: t.x,
        z: t.z,
      });
    }
  }

  // 3. Characters / Infantry Units
  for (let i = 0; i < buddyUnits.length; i++) {
    const b = buddyUnits[i];
    if (!b.alive) continue;
    if (!b.isPlayer && tanks.some((v) => v.hp > 0 && v.occupiedByAiId === b.id)) {
      continue;
    }
    const bx = b.isPlayer && mountedTank ? mountedTank.x : b.x;
    const bz = b.isPlayer && mountedTank ? mountedTank.z : b.z;
    const isFriendlyUnit = b.isPlayer || b.team === playerTeam;

    // Friendly units always visible on minimap. Enemy units only within 26m or in map preview.
    if (isFriendlyUnit || isMapPreview || isPositionInsideDynamicCullingRadius(bx, bz, actorX, actorZ)) {
      radarDots.push({
        id: `b-${b.id}`,
        kind: b.isPlayer ? 'player' : isFriendlyUnit ? 'ally' : 'enemy',
        x: bx,
        z: bz,
      });
    }
  }

  // 4. Crates (boxes): Only shown on minimap within 26m (or in map preview)
  for (let i = 0; i < worldCrates.length; i++) {
    const c = worldCrates[i];
    if (c.state === 'carried') continue;
    if (isMapPreview || isPositionInsideDynamicCullingRadius(c.x, c.z, actorX, actorZ)) {
      radarDots.push({
        id: `crate-${c.id}`,
        kind:
          c.kind === 'legend' || c.kind === 'gold_metallic'
            ? 'crate_legend'
            : c.kind === 'super' || c.kind === 'silver_metallic'
              ? 'crate_super'
              : 'crate_red',
        x: c.x,
        z: c.z,
      });
    }
  }

  // 5. Pickups (drop items: weapon, ammo, medkit, coin): Only shown on minimap within 26m (or in map preview)
  for (let i = 0; i < worldPickups.length; i++) {
    const pk = worldPickups[i];
    if (pk.collected) continue;
    if (pk.isFromDeathDrop && pk.lifeRemainingSec <= 0) continue;
    if (isMapPreview || isPositionInsideDynamicCullingRadius(pk.x, pk.z, actorX, actorZ)) {
      radarDots.push({
        id: `pickup-${pk.id}`,
        kind: 'pickup',
        x: pk.x,
        z: pk.z,
      });
    }
  }

  // 6. Explosive Barrels: Only shown on minimap within 26m (or in map preview)
  for (let i = 0; i < activeMapProps.length; i++) {
    const prop = activeMapProps[i];
    if (prop.kind !== 'explosive_barrel' || !prop.alive) continue;
    if (isMapPreview || isPositionInsideDynamicCullingRadius(prop.x, prop.z, actorX, actorZ)) {
      radarDots.push({
        id: `barrel-${prop.id}`,
        kind: 'barrel',
        x: prop.x,
        z: prop.z,
      });
    }
  }

  return {
    radarDots,
    operatorStatus,
  };
}

/**
 * Smoothly interpolates an object's culling scale toward `targetScale` (`0..1`)
 * and guarantees `scale < 0.01` snaps cleanly to `0`.
 */
function resolveSmoothCullScale(
  holder: { userData?: Record<string, any> } | null | undefined,
  targetScale: number,
): number {
  if (!holder) return targetScale >= 0.01 ? targetScale : 0;
  if (!holder.userData) holder.userData = {};
  const prev = holder.userData.__cullScale;
  if (typeof prev !== 'number') {
    const initial = targetScale >= 0.01 ? targetScale : 0;
    holder.userData.__cullScale = initial;
    return initial;
  }
  const blended = prev + (targetScale - prev) * 0.28;
  const finalScale = blended >= 0.01 ? blended : 0;
  holder.userData.__cullScale = finalScale;
  return finalScale;
}

/**
 * Applies dynamic distance culling (26.0m radius around viewer/player, with smooth scale fade
 * between 21.5m and 26.0m via `evaluateChunkSynced3DFogOfWar`) to small dynamic gameplay entities:
 * - Crates (boxes)
 * - Pickups (drop items)
 * - Explosive barrels
 * - Ordnance devices (land mines, grenades, cluster bombs)
 * - Enemy infantry units (Warzone)
 * - Enemy combat vehicles (Warzone)
 *
 * Friendly units (allies & player) and friendly vehicles are ALWAYS visible.
 * Large environment assets (trees, buildings, roads, river, bridges, tram, halte, grass, base buildings)
 * are NEVER culled and remain fully visible across the entire map.
 * When in MAP PREVIEW mode (`playMode === 'editor'` or `bypassFogOfWar`), culling is bypassed.
 */
export function applyGrassChunkSyncedFogOfWar3D(params: {
  viewerX: number;
  viewerZ: number;
  playMode: PlayMode;
  bypassFogOfWar: boolean;
  worldCrates: ReadonlyArray<WorldCrate>;
  worldPickups: ReadonlyArray<WorldPickup>;
  activeOrdnanceDevices: ReadonlyArray<ActiveOrdnanceDevice3D>;
  buddyUnits: ReadonlyArray<BuddyUnit>;
  tanks: ReadonlyArray<TankVehicle>;
  activeMapProps?: ReadonlyArray<ActiveMapPropPhysics>;
  worldMode?: WorldMode;
  playerTeam?: 'blue' | 'red';
}): void {
  const {
    viewerX,
    viewerZ,
    playMode,
    bypassFogOfWar,
    worldCrates,
    worldPickups,
    activeOrdnanceDevices,
    buddyUnits,
    tanks,
    activeMapProps = [],
    worldMode = 'warzone',
    playerTeam = 'blue',
  } = params;

  const isMapPreview = playMode === 'editor' || bypassFogOfWar;

  // 1. World Crates (Boxes) — smooth scale transition at edge of 26m radius
  for (let i = 0; i < worldCrates.length; i++) {
    const c = worldCrates[i];
    if (c.state !== 'carried') {
      const targetScale = isMapPreview
        ? 1.0
        : evaluateChunkSynced3DFogOfWar(c.x, c.z, viewerX, viewerZ).scaleFactor;
      const smoothScale = resolveSmoothCullScale(c.mesh, targetScale);
      const isVisible = smoothScale >= 0.01;
      c.mesh.visible = isVisible;
      if (isVisible) {
        if (c.boxVisualGroup) {
          c.boxVisualGroup.scale.setScalar(smoothScale);
        } else if (c.mesh.scale) {
          c.mesh.scale.setScalar(smoothScale);
        }
      }
    }
  }

  // 2. World Pickups (Drop items: medkit, weapon, coins) — smooth scale transition
  for (let i = 0; i < worldPickups.length; i++) {
    const pk = worldPickups[i];
    if (pk.collected) {
      pk.mesh.visible = false;
      continue;
    }
    const isAlive = !pk.isFromDeathDrop || pk.lifeRemainingSec > 0;
    if (!isAlive) {
      pk.mesh.visible = false;
      continue;
    }
    const targetScale = isMapPreview
      ? 1.0
      : evaluateChunkSynced3DFogOfWar(pk.x, pk.z, viewerX, viewerZ).scaleFactor;
    const smoothScale = resolveSmoothCullScale(pk.mesh, targetScale);
    const isVisible = smoothScale >= 0.01;
    pk.mesh.visible = isVisible;
    if (isVisible) {
      pk.mesh.scale.setScalar(smoothScale);
      if (pk.kind === 'secondary' && pk.secondaryId === 'land_mine') {
        const gMask = evaluateBlitzGrassMask(pk.x, pk.z);
        pk.mesh.position.y += computeLandMineGrassYOffset(gMask);
      }
    }
  }

  // 3. Explosive Barrels (dynamic field barrels) — smooth scale transition
  for (let i = 0; i < activeMapProps.length; i++) {
    const prop = activeMapProps[i];
    if (prop.kind !== 'explosive_barrel') continue;
    if (worldMode === 'safezone' || !prop.alive) {
      prop.wrapper.visible = false;
      continue;
    }
    const targetScale = isMapPreview
      ? 1.0
      : evaluateChunkSynced3DFogOfWar(prop.x, prop.z, viewerX, viewerZ).scaleFactor;
    const smoothScale = resolveSmoothCullScale(prop.wrapper, targetScale);
    const isVisible = smoothScale >= 0.01;
    prop.wrapper.visible = isVisible;
    if (isVisible && prop.wrapper.scale) {
      prop.wrapper.scale.setScalar(smoothScale);
    }
  }

  // 4. Ordnance Devices (land mines, grenades, cluster bombs) — smooth scale transition
  for (let i = 0; i < activeOrdnanceDevices.length; i++) {
    const ord = activeOrdnanceDevices[i];
    const targetScale = isMapPreview
      ? 1.0
      : evaluateChunkSynced3DFogOfWar(ord.pos.x, ord.pos.z, viewerX, viewerZ).scaleFactor;
    const smoothScale = resolveSmoothCullScale(ord.mesh, targetScale);
    const isVisible = smoothScale >= 0.01;
    ord.mesh.visible = isVisible;
    if (isVisible) {
      const baseScale =
        ord.kind === 'cluster_bomb' ? 1.45 : ord.kind === 'land_mine' ? 1.3 : 1.25;
      ord.mesh.scale.setScalar(baseScale * smoothScale);
      if (ord.kind === 'land_mine' && ord.isGrounded) {
        const gMask = evaluateBlitzGrassMask(ord.pos.x, ord.pos.z);
        ord.mesh.position.y = ord.pos.y + computeLandMineGrassYOffset(gMask);
      }
    }
  }

  // 5. Buddy Units (Characters) — friendly always visible; enemy smoothly scales at 21.5m..26m
  for (let i = 0; i < buddyUnits.length; i++) {
    const b = buddyUnits[i];
    if (!b.alive) {
      b.root.visible = false;
      continue;
    }
    if (
      tanks.some(
        (v) =>
          v.hp > 0 &&
          (v.occupiedByAiId === b.id || (b.isPlayer && v.occupiedByPlayer)),
      )
    ) {
      b.root.visible = false;
      b.saluteSign.sprite.visible = false;
      continue;
    }
    const isFriendly = b.isPlayer || b.team === playerTeam;
    if (isFriendly || isMapPreview) {
      b.root.visible = true;
      b.bodyGroup.scale.setScalar(1);
    } else {
      const targetScale = evaluateChunkSynced3DFogOfWar(b.x, b.z, viewerX, viewerZ).scaleFactor;
      const smoothScale = resolveSmoothCullScale(b.root, targetScale);
      const isVisible = smoothScale >= 0.01;
      b.root.visible = isVisible;
      if (isVisible) {
        b.bodyGroup.scale.setScalar(smoothScale);
      }
    }
  }

  // 6. Tanks / Vehicles — friendly always visible; enemy smoothly scales at 21.5m..26m
  for (let i = 0; i < tanks.length; i++) {
    const v = tanks[i];
    if (v.hp <= 0) {
      v.root.visible = false;
      continue;
    }
    const isFriendly = v.team === playerTeam;
    if (isFriendly || isMapPreview) {
      v.root.visible = true;
      v.bodyGroup.scale.setScalar(1);
    } else {
      const targetScale = evaluateChunkSynced3DFogOfWar(v.x, v.z, viewerX, viewerZ).scaleFactor;
      const smoothScale = resolveSmoothCullScale(v.root, targetScale);
      const isVisible = smoothScale >= 0.01;
      v.root.visible = isVisible;
      if (isVisible) {
        v.bodyGroup.scale.setScalar(smoothScale);
      }
    }
  }
}
