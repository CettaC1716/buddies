import { classifyBeachClubSurface } from './buddiesBeachClubRules';
import {
  evaluateRoadSurfaceSpeedBoost,
} from './buddiesBlitzRules';
import { CENTRAL_PARK_MASTERPLAN } from './buddiesCentralParkRules';
import {
  COASTAL_HILL_WALKABLE_HALF_WIDTH,
  evaluateCoastalHillRoadSample,
  evaluateHillVillaPlateauSdf,
} from './buddiesCoastalHillsRules';
import {
  evaluateBlitzGrassMask,
  evaluateEastCoastalSandyMask,
  evaluateHaltePlatformSdf,
  evaluateInnerTramSidewalkSdf,
  evaluateNwLakeSdf,
  evaluateOuterTramSidewalkSdf,
  evaluateRoadNetworkSdf,
  evaluateSeHarborSdf,
  evaluateWestPowerPlantSdf,
  isPointOnBeachfrontStiltCabinDeck,
} from './buddiesPlanetCurvature';

export type FootstepSurfaceType = 'sand' | 'grass' | 'wood' | 'stone_road' | 'water';

export type AmbientEnvironmentMode =
  | 'outdoor'
  | 'house_interior'
  | 'cafe_interior'
  | 'casino_interior';

export interface AmbientSoundscapeInput {
  listenerX: number;
  listenerZ: number;
  timeOfDayHours: number;
  rainIntensity01: number;
  environmentMode: AmbientEnvironmentMode;
  isUiModalOpen?: boolean;
  isCityView?: boolean;
  isFullMapOverview?: boolean;
}

export interface AmbientSoundscapeMix {
  oceanSurfGain: number;
  oceanFoamCutoffHz: number;
  lakeWaterGain: number;
  rainBedGain: number;
  rainLowPassHz: number;
  songbirdRatePerMin: number;
  songbirdGain: number;
  seagullRatePerMin: number;
  seagullGain: number;
  uiDuckMultiplier: number;
  nightFactor01: number;
}

export interface FootstepSynthSpec {
  surface: FootstepSurfaceType;
  noiseFilterType: 'bandpass' | 'lowpass';
  noiseFreqHz: number;
  noiseQ: number;
  noiseGain: number;
  noiseDurationSec: number;
  bodyFreqStartHz: number;
  bodyFreqEndHz: number;
  bodyGain: number;
  bodyDurationSec: number;
  airAccentHz: number;
  airAccentGain: number;
  panOffset: number;
}

export interface AmbientWaveCycleSample {
  swellGain01: number;
  foamGain01: number;
  swellCutoffHz: number;
  foamCutoffHz: number;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep01(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / Math.max(1e-5, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Resolves the discrete half-stride step index from accumulated `walkCycle` radians.
 * One full stride cycle = `2 * PI`; alternating Left / Right heel plants occur at integer
 * multiples of `PI` (`step = Math.floor(walkCycle / Math.PI)`).
 */
export function resolveFootstepHalfCycleIndex(walkCycleRad: number): number {
  if (!Number.isFinite(walkCycleRad) || walkCycleRad < 0) return -1;
  return Math.floor(walkCycleRad / Math.PI);
}

/**
 * Classifies ground surface material under `(worldX, worldZ)` cleanly using the
 * canonical shared SDFs for timber decks/boardwalks, coastal sand beaches, Oasis Lake,
 * asphalt/terrazzo/sidewalk paving, Coastal Switchback highway, and green grass meadows.
 */
export function classifyFootstepSurface(
  worldX: number,
  worldZ: number,
  environmentMode: AmbientEnvironmentMode = 'outdoor',
): FootstepSurfaceType {
  if (environmentMode === 'house_interior') return 'wood';
  if (environmentMode === 'cafe_interior' || environmentMode === 'casino_interior') {
    return 'stone_road';
  }

  // 1. Finns-Style Tropical Beach Club (pools, timber DJ stage/bridge, marble/terrazzo decks, sand)
  const beachClubSurface = classifyBeachClubSurface(worldX, worldZ);
  if (beachClubSurface !== 'none') {
    if (beachClubSurface === 'sand') {
      const { waterSdf } = evaluateSeHarborSdf(worldX, worldZ);
      if (waterSdf < -0.15) {
        return 'water';
      }
    }
    return beachClubSurface;
  }

  // 1B. Kai's Beachfront Timber Boardwalk & Stilt Cabin Deck
  if (
    isPointOnBeachfrontStiltCabinDeck(worldX, worldZ) ||
    (worldX >= 77.6 && worldX <= 96.6 && worldZ >= 45.2 && worldZ <= 103.2)
  ) {
    return 'wood';
  }

  // 2. Central Park Water Features, Raised Lawn Bed & Terrazzo Promenade
  const cpBounds = CENTRAL_PARK_MASTERPLAN.bounds;
  const ftn = CENTRAL_PARK_MASTERPLAN.fountainPlaza;
  const pond = CENTRAL_PARK_MASTERPLAN.pergolaPond;
  if (
    worldX >= cpBounds.minX &&
    worldX <= cpBounds.maxX &&
    worldZ >= cpBounds.minZ &&
    worldZ <= cpBounds.maxZ
  ) {
    if (
      Math.hypot(worldX - ftn.x, worldZ - ftn.z) <= ftn.copingRadius - 0.15 ||
      Math.hypot(worldX - pond.centerX, worldZ - pond.centerZ) <= pond.pondRadius - 0.1
    ) {
      return 'water';
    }
    // Check flanking perimeter vs inside chamfer polygon
    const insideCentralChamfer =
      Math.abs(worldZ) <= 10.3 ||
      (worldX >= 9.95 && worldX <= 52.45 && Math.abs(worldZ) <= 21.7);
    if (insideCentralChamfer) {
      return 'stone_road';
    }
  }

  // 3. Shallow Lake or Coastal Surf Water
  const lakeSdf = evaluateNwLakeSdf(worldX, worldZ);
  const { concreteSdf, waterSdf } = evaluateSeHarborSdf(worldX, worldZ);
  if (lakeSdf < -0.15 || waterSdf < -0.15) {
    return 'water';
  }

  // 4. Paved Asphalt Roads, Hilltop Switchback Highway, Concrete Quay, Sidewalks & Plazas
  if (
    evaluateRoadSurfaceSpeedBoost(worldX, worldZ).onRoadOrZebra ||
    evaluateRoadNetworkSdf(worldX, worldZ) <= 0.15 ||
    evaluateCoastalHillRoadSample(worldX, worldZ).distToCenterM <= COASTAL_HILL_WALKABLE_HALF_WIDTH ||
    evaluateHaltePlatformSdf(worldX, worldZ) <= 0.1 ||
    evaluateWestPowerPlantSdf(worldX, worldZ) <= 0.1 ||
    concreteSdf <= 0.15 ||
    evaluateOuterTramSidewalkSdf(worldX, worldZ) <= 0.05 ||
    evaluateInnerTramSidewalkSdf(worldX, worldZ) <= 0.05
  ) {
    return 'stone_road';
  }

  // 5. Widened Golden Sandy Beaches (Beach Club coastline & Kai's SE Beachfront east of promenade)
  if (waterSdf >= -0.15 && worldX >= 80.5 && evaluateEastCoastalSandyMask(worldZ) > 0.35) {
    return 'sand';
  }

  // 6. Hilltop Villa Plateaus & Lush Grass Meadows
  if (
    evaluateHillVillaPlateauSdf(worldX, worldZ) <= 0.8 ||
    evaluateBlitzGrassMask(worldX, worldZ) >= 0.35
  ) {
    return 'grass';
  }

  // Remaining compacted dirt / stone courtyards
  return 'stone_road';
}

/**
 * Evaluates natural nighttime suppression factor `[0..1]` from 24h game clock:
 * Daytime/Dawn/Golden Hour `[05:30 .. 19:30]` stay active for birdsong;
 * deep night `[21:00 .. 04:30]` quiets birds organically.
 */
export function computeAmbientNightFactor(timeOfDayHours: number): number {
  const h = ((timeOfDayHours % 24) + 24) % 24;
  if (h >= 7.0 && h <= 18.0) return 0;
  if (h >= 20.5 || h <= 4.5) return 1;
  if (h > 18.0 && h < 20.5) return smoothstep01(18.0, 20.5, h);
  return 1 - smoothstep01(4.5, 7.0, h);
}

/**
 * Computes spatial ambient mix weights tailored to listener position, weather, time-of-day,
 * and UI focus:
 * - Beach / Harbor / Coastal Hills -> rhythmic ocean surf (`oceanSurfGain`) + sparse seagulls
 * - NW Oasis Lake / Central Park / Hilltop Plateaus -> serene water trickle + stereo songbirds
 * - Indoors / UI Modals / City Overview -> gentle low-pass warmth & UI volume ducking
 */
export function computeAmbientSoundscapeMix(input: AmbientSoundscapeInput): AmbientSoundscapeMix {
  const isIndoor = input.environmentMode !== 'outdoor';
  const rain = clamp01(input.rainIntensity01);
  const nightFactor01 = computeAmbientNightFactor(input.timeOfDayHours);
  const isDuckedView = Boolean(input.isUiModalOpen || input.isCityView || input.isFullMapOverview);

  const uiDuckMultiplier = isIndoor ? 0.38 : isDuckedView ? 0.56 : 1.0;

  // Distance to East Ocean coastline (waterSdf <= 0 at shoreline, positive heading inland west)
  const { waterSdf } = evaluateSeHarborSdf(input.listenerX, input.listenerZ);
  const distToOcean = Math.max(0, waterSdf);
  const directCoastalOcean = 1.0 - smoothstep01(4.0, 56.0, distToOcean);
  // Coastal Ridge Switchbacks / North & South Villa Plateaus still overlook the coast softly
  const hillOverlookOcean =
    Math.abs(input.listenerZ) >= 112.0 && input.listenerX >= -40.0
      ? (1.0 - smoothstep01(112.0, 148.0, Math.abs(input.listenerZ))) * 0.22 +
        smoothstep01(-40.0, 60.0, input.listenerX) * 0.16
      : 0.0;
  const oceanSurfGain = clamp01(Math.max(directCoastalOcean, hillOverlookOcean) * (isIndoor ? 0.42 : 1.0));

  // UI/City Overview/Indoor softly rolls off upper foam frequencies (like New Character UI in Beach ref video)
  const oceanFoamCutoffHz = isIndoor ? 680 : isDuckedView ? 950 : 2350;

  // NW Oasis Lake proximity (peak near shore x ~ -31, z ~ 0; peaceful shimmer, ~21 dB calmer than open surf)
  const distToLake = Math.max(0, evaluateNwLakeSdf(input.listenerX, input.listenerZ));
  const lakeProximity = 1.0 - smoothstep01(1.5, 34.0, distToLake);
  // Central Plaza pergola pond subtle trickle
  const distPergolaPond = Math.hypot(input.listenerX - 29.5, input.listenerZ + 14.8);
  const pergolaWaterProximity = (1.0 - smoothstep01(2.0, 18.0, distPergolaPond)) * 0.65;
  const lakeWaterGain = clamp01(
    Math.max(lakeProximity, pergolaWaterProximity) * (isIndoor ? 0.15 : 0.85),
  );

  // Leafy habitats for forest songbirds: NW Lake, Central Park, Outer Greenbelt & Hilltop Villas
  const parkGreenScore =
    input.listenerX >= -18.0 && input.listenerX <= 62.0 && Math.abs(input.listenerZ) <= 28.0
      ? 0.85
      : 0.0;
  const grassHabitat = evaluateBlitzGrassMask(input.listenerX, input.listenerZ);
  const hillHabitat = evaluateHillVillaPlateauSdf(input.listenerX, input.listenerZ) < 6.0 ? 0.9 : 0.0;
  const leafyFactor = clamp01(Math.max(lakeProximity * 0.95, parkGreenScore, grassHabitat * 0.78, hillHabitat));

  // Weather & night suppression (quiet birds at night and during rain)
  const birdWeatherScale = clamp01(1.0 - rain * 1.4) * (1.0 - nightFactor01 * 0.88);
  const activeOutdoor = isIndoor || input.isFullMapOverview ? 0.0 : 1.0;

  const songbirdRatePerMin = leafyFactor * birdWeatherScale * activeOutdoor * 10.5;
  const songbirdGain = leafyFactor * birdWeatherScale * activeOutdoor * 0.85;

  // Coastal gulls near sandy/harbor shoreline & coastal bluffs
  const gullCoastFactor = (1.0 - smoothstep01(8.0, 62.0, distToOcean)) * activeOutdoor;
  const gullWeatherScale = clamp01(1.0 - rain * 1.25) * (1.0 - nightFactor01 * 0.92);
  const seagullRatePerMin = gullCoastFactor * gullWeatherScale * 3.2;
  const seagullGain = gullCoastFactor * gullWeatherScale * 0.9;

  // Soft serene ambient rain shimmer (never loud white noise)
  const rainBedGain = clamp01(rain * (isIndoor ? 0.24 : 0.72));
  const rainLowPassHz = isIndoor ? 760 : isDuckedView ? 1280 : 2200;

  return {
    oceanSurfGain,
    oceanFoamCutoffHz,
    lakeWaterGain,
    rainBedGain,
    rainLowPassHz,
    songbirdRatePerMin,
    songbirdGain,
    seagullRatePerMin,
    seagullGain,
    uiDuckMultiplier,
    nightFactor01,
  };
}

/**
 * Evaluates the twin-cycle organic ocean swell LFO at elapsed `timeSec`:
 * - Gentle wave wash every ~3.1s (`2.02 rad/s`)
 * - Deeper full breaking crest every ~7.4s (`0.85 rad/s`)
 * Mirrors the breathing trough (-40dB) -> crest (-27dB) dynamic observed in the Beach reference.
 */
export function computeAmbientWaveCycleEnvelope(
  timeSec: number,
  maxFoamCutoffHz = 2350,
): AmbientWaveCycleSample {
  const fastWash = 0.5 + 0.5 * Math.sin(timeSec * ((Math.PI * 2) / 3.1));
  const slowSwell = 0.5 + 0.5 * Math.sin(timeSec * ((Math.PI * 2) / 7.4) + 0.7);
  const combined = clamp01(fastWash * 0.52 + slowSwell * 0.48);
  const swellGain01 = 0.36 + combined * 0.64;
  // Shoreline foam fizz peaks slightly after swell crests (`Math.pow(..., 1.7)`)
  const crestShape = Math.pow(combined, 1.7);
  const foamGain01 = 0.14 + crestShape * 0.86;
  const swellCutoffHz = 185 + combined * 285;
  const foamCutoffHz = Math.min(maxFoamCutoffHz, 680 + crestShape * (maxFoamCutoffHz - 680));

  return {
    swellGain01,
    foamGain01,
    swellCutoffHz,
    foamCutoffHz,
  };
}

/**
 * Computes subtle surface-matched footstep synth profile calibrated to the reference videos:
 * - Soft, airy, fatigue-free (`<= 95ms`, minimal sub-boom)
 * - Alternating L/R stereo micro-pan (`stepParity`: 0 = Left, 1 = Right)
 */
export function computeFootstepSynthSpec(
  surface: FootstepSurfaceType,
  speedNorm = 0.65,
  stepParity = 0,
): FootstepSynthSpec {
  const spd = clamp01(speedNorm);
  const dynGain = 0.68 + spd * 0.48;
  const panOffset = (stepParity % 2 === 0 ? -1 : 1) * 0.14;

  switch (surface) {
    case 'sand':
      return {
        surface,
        noiseFilterType: 'bandpass',
        noiseFreqHz: 1120 + spd * 240,
        noiseQ: 1.35,
        noiseGain: 0.088 * dynGain,
        noiseDurationSec: 0.078,
        bodyFreqStartHz: 115,
        bodyFreqEndHz: 58,
        bodyGain: 0.024 * dynGain,
        bodyDurationSec: 0.038,
        airAccentHz: 2450,
        airAccentGain: 0.025 * dynGain,
        panOffset,
      };
    case 'grass':
      return {
        surface,
        noiseFilterType: 'bandpass',
        noiseFreqHz: 2550 + spd * 420,
        noiseQ: 1.55,
        noiseGain: 0.076 * dynGain,
        noiseDurationSec: 0.072,
        bodyFreqStartHz: 145,
        bodyFreqEndHz: 72,
        bodyGain: 0.022 * dynGain,
        bodyDurationSec: 0.032,
        airAccentHz: 3900,
        airAccentGain: 0.024 * dynGain,
        panOffset,
      };
    case 'wood':
      return {
        surface,
        noiseFilterType: 'bandpass',
        noiseFreqHz: 780 + spd * 140,
        noiseQ: 1.8,
        noiseGain: 0.052 * dynGain,
        noiseDurationSec: 0.052,
        bodyFreqStartHz: 185,
        bodyFreqEndHz: 94,
        bodyGain: 0.095 * dynGain,
        bodyDurationSec: 0.052,
        airAccentHz: 1450,
        airAccentGain: 0.02 * dynGain,
        panOffset,
      };
    case 'water':
      return {
        surface,
        noiseFilterType: 'bandpass',
        noiseFreqHz: 1380 + spd * 320,
        noiseQ: 1.1,
        noiseGain: 0.12 * dynGain,
        noiseDurationSec: 0.13,
        bodyFreqStartHz: 460,
        bodyFreqEndHz: 880,
        bodyGain: 0.048 * dynGain,
        bodyDurationSec: 0.09,
        airAccentHz: 3100,
        airAccentGain: 0.038 * dynGain,
        panOffset,
      };
    case 'stone_road':
    default:
      return {
        surface: 'stone_road',
        noiseFilterType: 'bandpass',
        noiseFreqHz: 1080 + spd * 220,
        noiseQ: 1.65,
        noiseGain: 0.065 * dynGain,
        noiseDurationSec: 0.044,
        bodyFreqStartHz: 158,
        bodyFreqEndHz: 74,
        bodyGain: 0.072 * dynGain,
        bodyDurationSec: 0.036,
        airAccentHz: 2150,
        airAccentGain: 0.016 * dynGain,
        panOffset,
      };
  }
}
