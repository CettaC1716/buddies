import * as THREE from 'three';
import {
  CITY_LIGHTS_SCALE_BOUNDS,
  TIME_PHASE_DEFAULT_HOURS,
  WEATHER_PRESETS,
  type LightingPresetKey,
  type RainIntensityTier,
  type WeatherConditionKey,
} from './buddiesBlitzRules';
import { buildCoastalHillGlslSnippet } from './buddiesCoastalHillsRules';
import type { BlitzWindUniforms } from './buddiesBlitzShadersAndAssets';
import { SHARED_PBR_WOOD_LIGHTING_UNIFORM } from './buddiesCoastalBeachBuilder';

/**
 * Shared dynamic atmosphere contract published every frame to `scene.userData.weatherEnvState`
 * so parallel systems (e.g. streetlamps, building facade glow, vehicle headlights/brakelights)
 * react smoothly to time-of-day, storms, fog, wetness, and the user's City Lights slider.
 */
export interface WeatherEnvState {
  timeOfDayHours: number;
  phase: LightingPresetKey;
  weatherCondition: WeatherConditionKey;
  rainIntensityTier: RainIntensityTier;
  autoCycleEnabled: boolean;
  nightFactor01: number;
  duskDawnFactor01: number;
  fogFactor01: number;
  rainFactor01: number;
  wetness01: number;
  windStrength: number;
  windGust: number;
  windDirectionX: number;
  windDirectionZ: number;
  cityLightsScale: number;
  sunElevation01: number;
  petalDrift01: number;
  starVisibility01: number;
  skyColorHex?: number;
  horizonSkyColorHex?: number;
  sunColorHex?: number;
  fogColorHex?: number;
  sunDirX?: number;
  sunDirY?: number;
  sunDirZ?: number;
}

export interface WeatherControlConfig {
  timeOfDayHours: number;
  phase: LightingPresetKey;
  weatherCondition: WeatherConditionKey;
  rainIntensityTier: RainIntensityTier;
  autoCycleEnabled: boolean;
  cityLightsScale: number;
  configRevision: number;
}

export interface AnimeSkyUniformsLike {
  uTime: { value: number };
  uSunDir: { value: THREE.Vector3 };
  uZenithColor: { value: THREE.Color };
  uMidSkyColor: { value: THREE.Color };
  uHorizonSkyColor: { value: THREE.Color };
  uHorizonGlowColor: { value: THREE.Color };
  uGroundBounceColor: { value: THREE.Color };
  uSunColor: { value: THREE.Color };
  uCloudLitColor: { value: THREE.Color };
  uCloudMidColor: { value: THREE.Color };
  uCloudShadowColor: { value: THREE.Color };
}

export interface WeatherRuntimeState {
  currentHours: number;
  targetHours: number;
  rainFactor01: number;
  fogFactor01: number;
  windStrength: number;
  overcast01: number;
  wetness01: number;
  petalDrift01: number;
  windAngleRad: number;
  lastAppliedRevision: number;
}

export interface EvaluatedAtmosphereState {
  envState: WeatherEnvState;
  sky: {
    zenithColor: THREE.Color;
    midSkyColor: THREE.Color;
    horizonSkyColor: THREE.Color;
    horizonGlowColor: THREE.Color;
    groundBounceColor: THREE.Color;
    sunColor: THREE.Color;
    cloudLitColor: THREE.Color;
    cloudMidColor: THREE.Color;
    cloudShadowColor: THREE.Color;
    cloudMatColor: THREE.Color;
    cloudEmissiveColor: THREE.Color;
    sunDir: THREE.Vector3;
    starOpacity: number;
    starColor: THREE.Color;
  };
  lighting: {
    dirColor: THREE.Color;
    dirIntensity: number;
    hemiSkyColor: THREE.Color;
    hemiGroundColor: THREE.Color;
    hemiIntensity: number;
    windLightColor: THREE.Color;
    lightDir: THREE.Vector3;
  };
  fog: {
    color: THREE.Color;
    near: number;
    far: number;
    hazeCompression01: number;
  };
  terrain: {
    tintColor: THREE.Color;
    tintScale: number;
    wetnessDarken: number;
    fogDesat: number;
  };
  particles: {
    rainIntensity01: number;
    splashIntensity01: number;
    leafIntensity01: number;
    rainColor: THREE.Color;
    splashColor: THREE.Color;
  };
  viewportTint: {
    colorHex: string;
    opacity: number;
  };
}

export interface WeatherSystem3DHandle {
  rootGroup: THREE.Group;
  rainMesh: THREE.InstancedMesh;
  splashMesh: THREE.InstancedMesh;
  leafMesh: THREE.InstancedMesh;
  getWeatherEnvState(): WeatherEnvState;
  getDrawCallCounts(): { totalInstancedMeshes: number; activeDrawCalls: number; pointLights: number };
  setTimePhaseImmediate(preset: LightingPresetKey, windUniforms?: BlitzWindUniforms | null): void;
  syncExternalPresetProp(preset: LightingPresetKey, windUniforms?: BlitzWindUniforms | null): void;
  update(params: {
    dt: number;
    timeSec: number;
    pivotX: number;
    pivotZ: number;
    windUniforms?: BlitzWindUniforms | null;
    isFlatIndoorRoomMode: boolean;
    isShowcaseMode: boolean;
    isFullMapOverview: boolean;
    isCityView?: boolean;
    spanScale?: number;
  }): WeatherEnvState;
  dispose(): void;
}

export const AUTO_CYCLE_HOURS_PER_SEC = 0.2; // 1 full 24h cycle every 120 seconds

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function clampRange(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function lerpScalar(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Wraps any finite hour count cleanly into `[0, 24)`.
 */
export function normalizeHours24(hours: number): number {
  if (!Number.isFinite(hours)) return TIME_PHASE_DEFAULT_HOURS.day;
  const mod = hours % 24;
  return mod < 0 ? mod + 24 : mod;
}

/**
 * Signed shortest distance in hours around the 24-hour clock in `[-12, 12]`.
 */
export function shortestHoursDelta24(fromHours: number, toHours: number): number {
  const from = normalizeHours24(fromHours);
  const to = normalizeHours24(toHours);
  let delta = to - from;
  if (delta > 12) delta -= 24;
  if (delta < -12) delta += 24;
  return delta;
}

/**
 * Formats fractional 24h clock hours into `HH:MM`.
 */
export function formatClock24h(hours: number): string {
  const norm = normalizeHours24(hours);
  const totalMinutes = Math.round(norm * 60) % (24 * 60);
  const hh = Math.floor(totalMinutes / 60) % 24;
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * Maps 24-hour clock position to Buddies Blitz's 4 time-of-day phases (`dawn` / `day` / `dusk` / `night`).
 */
export function resolvePhaseFromHours(hours: number): LightingPresetKey {
  const h = normalizeHours24(hours);
  if (h >= 4.75 && h < 7.25) return 'dawn';
  if (h >= 7.25 && h < 17.25) return 'day';
  if (h >= 17.25 && h < 19.25) return 'dusk';
  return 'night';
}

interface SolarKeyframe {
  hour: number;
  nightFactor01: number;
  duskDawnFactor01: number;
  sunElevation01: number;
  zenithHex: string;
  midSkyHex: string;
  horizonSkyHex: string;
  horizonGlowHex: string;
  groundBounceHex: string;
  sunHex: string;
  cloudLitHex: string;
  cloudMidHex: string;
  cloudShadowHex: string;
  cloudMatHex: string;
  cloudEmissiveHex: string;
  dirLightHex: string;
  dirLightIntensity: number;
  hemiSkyHex: string;
  hemiGroundHex: string;
  hemiIntensity: number;
  windLightHex: string;
  fogHex: string;
  groundTintHex: string;
  groundTintScale: number;
}

const SOLAR_KEYFRAMES: readonly SolarKeyframe[] = [
  {
    hour: 0.0,
    nightFactor01: 1.0,
    duskDawnFactor01: 0.0,
    sunElevation01: -0.65,
    zenithHex: '#081026',
    midSkyHex: '#12244a',
    horizonSkyHex: '#234273',
    horizonGlowHex: '#42689c',
    groundBounceHex: '#14223d',
    sunHex: '#d8ecff',
    cloudLitHex: '#9ec2eb',
    cloudMidHex: '#5173a3',
    cloudShadowHex: '#273d66',
    cloudMatHex: '#9fc2eb',
    cloudEmissiveHex: '#233b63',
    dirLightHex: '#7090d8',
    dirLightIntensity: 0.44,
    hemiSkyHex: '#5a74b8',
    hemiGroundHex: '#14192e',
    hemiIntensity: 0.56,
    windLightHex: '#5872b0',
    fogHex: '#1f355c',
    groundTintHex: '#6b85c2',
    groundTintScale: 0.36,
  },
  {
    hour: 4.25,
    nightFactor01: 1.0,
    duskDawnFactor01: 0.08,
    sunElevation01: -0.35,
    zenithHex: '#0a1430',
    midSkyHex: '#172c59',
    horizonSkyHex: '#2e4e82',
    horizonGlowHex: '#5878ad',
    groundBounceHex: '#1a2b4a',
    sunHex: '#dceeff',
    cloudLitHex: '#a5c7ed',
    cloudMidHex: '#5878a8',
    cloudShadowHex: '#2c416b',
    cloudMatHex: '#a5c7ed',
    cloudEmissiveHex: '#283f69',
    dirLightHex: '#7896db',
    dirLightIntensity: 0.48,
    hemiSkyHex: '#6680c2',
    hemiGroundHex: '#191f38',
    hemiIntensity: 0.58,
    windLightHex: '#627ab8',
    fogHex: '#263d66',
    groundTintHex: '#738cc7',
    groundTintScale: 0.38,
  },
  {
    hour: 5.1,
    nightFactor01: 0.78,
    duskDawnFactor01: 0.68,
    sunElevation01: -0.04,
    zenithHex: '#1c2a59',
    midSkyHex: '#445896',
    horizonSkyHex: '#b87e99',
    horizonGlowHex: '#f2b29c',
    groundBounceHex: '#4b486b',
    sunHex: '#ffd4ad',
    cloudLitHex: '#ffdcc4',
    cloudMidHex: '#a88cb8',
    cloudShadowHex: '#545582',
    cloudMatHex: '#ffdcc4',
    cloudEmissiveHex: '#5a4e7d',
    dirLightHex: '#ffbf94',
    dirLightIntensity: 0.85,
    hemiSkyHex: '#c4a8d9',
    hemiGroundHex: '#313252',
    hemiIntensity: 0.78,
    windLightHex: '#d4a69c',
    fogHex: '#a17c91',
    groundTintHex: '#a896c2',
    groundTintScale: 0.62,
  },
  {
    hour: 5.75,
    nightFactor01: 0.58,
    duskDawnFactor01: 0.98,
    sunElevation01: 0.12,
    zenithHex: '#2c589e',
    midSkyHex: '#629be0',
    horizonSkyHex: '#f5c0b8',
    horizonGlowHex: '#ffe8c2',
    groundBounceHex: '#96a8c9',
    sunHex: '#fff3d1',
    cloudLitHex: '#fff5eb',
    cloudMidHex: '#dfcce8',
    cloudShadowHex: '#9aa7cf',
    cloudMatHex: '#fff5eb',
    cloudEmissiveHex: '#879bc7',
    dirLightHex: '#ffd4a3',
    dirLightIntensity: 1.28,
    hemiSkyHex: '#ffdfd1',
    hemiGroundHex: '#3f486b',
    hemiIntensity: 0.95,
    windLightHex: '#ffd9b0',
    fogHex: '#f2c1b0',
    groundTintHex: '#ffdbc7',
    groundTintScale: 0.82,
  },
  {
    hour: 6.85,
    nightFactor01: 0.14,
    duskDawnFactor01: 0.36,
    sunElevation01: 0.38,
    zenithHex: '#2460b0',
    midSkyHex: '#4b9de8',
    horizonSkyHex: '#b8e3fa',
    horizonGlowHex: '#fff0cf',
    groundBounceHex: '#8eb8d9',
    sunHex: '#fff8de',
    cloudLitHex: '#fffbf2',
    cloudMidHex: '#d9e7fa',
    cloudShadowHex: '#a4b9e0',
    cloudMatHex: '#fffbf2',
    cloudEmissiveHex: '#7ea6db',
    dirLightHex: '#ffe3b3',
    dirLightIntensity: 1.78,
    hemiSkyHex: '#fff3de',
    hemiGroundHex: '#3e6268',
    hemiIntensity: 1.1,
    windLightHex: '#ffefc7',
    fogHex: '#c4e4ff',
    groundTintHex: '#fff1db',
    groundTintScale: 0.95,
  },
  {
    hour: 8.25,
    nightFactor01: 0.0,
    duskDawnFactor01: 0.0,
    sunElevation01: 0.66,
    zenithHex: '#1b5eb8',
    midSkyHex: '#3b99f0',
    horizonSkyHex: '#a6dbff',
    horizonGlowHex: '#fff1cf',
    groundBounceHex: '#8ec8e8',
    sunHex: '#fff9e6',
    cloudLitHex: '#fffdf9',
    cloudMidHex: '#d7e8ff',
    cloudShadowHex: '#a6c2e8',
    cloudMatHex: '#ffffff',
    cloudEmissiveHex: '#78b0e8',
    dirLightHex: '#ffe6b1',
    dirLightIntensity: 2.05,
    hemiSkyHex: '#fffdf0',
    hemiGroundHex: '#3d7068',
    hemiIntensity: 1.2,
    windLightHex: '#fff4c8',
    fogHex: '#bae2ff',
    groundTintHex: '#ffffff',
    groundTintScale: 1.0,
  },
  {
    hour: 12.75,
    nightFactor01: 0.0,
    duskDawnFactor01: 0.0,
    sunElevation01: 1.0,
    zenithHex: '#1b5eb8',
    midSkyHex: '#3b99f0',
    horizonSkyHex: '#a6dbff',
    horizonGlowHex: '#fff1cf',
    groundBounceHex: '#8ec8e8',
    sunHex: '#fff9e6',
    cloudLitHex: '#fffdf9',
    cloudMidHex: '#d7e8ff',
    cloudShadowHex: '#a6c2e8',
    cloudMatHex: '#ffffff',
    cloudEmissiveHex: '#78b0e8',
    dirLightHex: '#ffe6b1',
    dirLightIntensity: 2.05,
    hemiSkyHex: '#fffdf0',
    hemiGroundHex: '#3d7068',
    hemiIntensity: 1.2,
    windLightHex: '#fff4c8',
    fogHex: '#bae2ff',
    groundTintHex: '#ffffff',
    groundTintScale: 1.0,
  },
  {
    hour: 16.35,
    nightFactor01: 0.0,
    duskDawnFactor01: 0.12,
    sunElevation01: 0.52,
    zenithHex: '#1d5cb3',
    midSkyHex: '#4392e8',
    horizonSkyHex: '#aadbf8',
    horizonGlowHex: '#ffe8bf',
    groundBounceHex: '#96bfe0',
    sunHex: '#fff2d4',
    cloudLitHex: '#fff8ed',
    cloudMidHex: '#d9e3f7',
    cloudShadowHex: '#9eb6db',
    cloudMatHex: '#fff8ed',
    cloudEmissiveHex: '#7ca7de',
    dirLightHex: '#ffdfa6',
    dirLightIntensity: 1.88,
    hemiSkyHex: '#fff4db',
    hemiGroundHex: '#426863',
    hemiIntensity: 1.14,
    windLightHex: '#ffebc0',
    fogHex: '#bcdfff',
    groundTintHex: '#fff0d6',
    groundTintScale: 0.96,
  },
  {
    hour: 17.4,
    nightFactor01: 0.35,
    duskDawnFactor01: 0.72,
    sunElevation01: 0.22,
    zenithHex: '#264487',
    midSkyHex: '#735c94',
    horizonSkyHex: '#eba47c',
    horizonGlowHex: '#ffda99',
    groundBounceHex: '#8c6d7d',
    sunHex: '#ffe6b3',
    cloudLitHex: '#ffebd1',
    cloudMidHex: '#d69eb0',
    cloudShadowHex: '#78628f',
    cloudMatHex: '#ffebd1',
    cloudEmissiveHex: '#87638c',
    dirLightHex: '#ffbe80',
    dirLightIntensity: 1.42,
    hemiSkyHex: '#ffd1ab',
    hemiGroundHex: '#4e3959',
    hemiIntensity: 1.0,
    windLightHex: '#ffc994',
    fogHex: '#eca679',
    groundTintHex: '#ffd1a8',
    groundTintScale: 0.86,
  },
  {
    hour: 18.0,
    nightFactor01: 0.72,
    duskDawnFactor01: 0.98,
    sunElevation01: 0.08,
    zenithHex: '#2b2d6e',
    midSkyHex: '#8c4f7e',
    horizonSkyHex: '#f28b66',
    horizonGlowHex: '#ffd08a',
    groundBounceHex: '#7a4b66',
    sunHex: '#ffe3a8',
    cloudLitHex: '#ffe4bd',
    cloudMidHex: '#d48ca6',
    cloudShadowHex: '#6e5082',
    cloudMatHex: '#ffe2bf',
    cloudEmissiveHex: '#8a527a',
    dirLightHex: '#ffa86e',
    dirLightIntensity: 1.08,
    hemiSkyHex: '#ffb896',
    hemiGroundHex: '#492b59',
    hemiIntensity: 0.88,
    windLightHex: '#ffb580',
    fogHex: '#f1925c',
    groundTintHex: '#f2a88d',
    groundTintScale: 0.74,
  },
  {
    hour: 18.85,
    nightFactor01: 0.91,
    duskDawnFactor01: 0.48,
    sunElevation01: -0.08,
    zenithHex: '#141e4d',
    midSkyHex: '#453369',
    horizonSkyHex: '#874969',
    horizonGlowHex: '#bd6b6d',
    groundBounceHex: '#3e3254',
    sunHex: '#f2b399',
    cloudLitHex: '#d1a8bd',
    cloudMidHex: '#7d5b82',
    cloudShadowHex: '#3e365c',
    cloudMatHex: '#d1a8bd',
    cloudEmissiveHex: '#493c66',
    dirLightHex: '#9488c9',
    dirLightIntensity: 0.66,
    hemiSkyHex: '#8d7db8',
    hemiGroundHex: '#242140',
    hemiIntensity: 0.68,
    windLightHex: '#8f84bf',
    fogHex: '#694362',
    groundTintHex: '#9880b8',
    groundTintScale: 0.5,
  },
  {
    hour: 19.65,
    nightFactor01: 1.0,
    duskDawnFactor01: 0.08,
    sunElevation01: -0.28,
    zenithHex: '#09132b',
    midSkyHex: '#142852',
    horizonSkyHex: '#284b7e',
    horizonGlowHex: '#4773aa',
    groundBounceHex: '#162947',
    sunHex: '#d8ecff',
    cloudLitHex: '#9ec2eb',
    cloudMidHex: '#5173a3',
    cloudShadowHex: '#273d66',
    cloudMatHex: '#9fc2eb',
    cloudEmissiveHex: '#233b63',
    dirLightHex: '#7090d8',
    dirLightIntensity: 0.44,
    hemiSkyHex: '#5a74b8',
    hemiGroundHex: '#14192e',
    hemiIntensity: 0.56,
    windLightHex: '#5872b0',
    fogHex: '#1f355c',
    groundTintHex: '#6b85c2',
    groundTintScale: 0.36,
  },
  {
    hour: 24.0,
    nightFactor01: 1.0,
    duskDawnFactor01: 0.0,
    sunElevation01: -0.65,
    zenithHex: '#081026',
    midSkyHex: '#12244a',
    horizonSkyHex: '#234273',
    horizonGlowHex: '#42689c',
    groundBounceHex: '#14223d',
    sunHex: '#d8ecff',
    cloudLitHex: '#9ec2eb',
    cloudMidHex: '#5173a3',
    cloudShadowHex: '#273d66',
    cloudMatHex: '#9fc2eb',
    cloudEmissiveHex: '#233b63',
    dirLightHex: '#7090d8',
    dirLightIntensity: 0.44,
    hemiSkyHex: '#5a74b8',
    hemiGroundHex: '#14192e',
    hemiIntensity: 0.56,
    windLightHex: '#5872b0',
    fogHex: '#1f355c',
    groundTintHex: '#6b85c2',
    groundTintScale: 0.36,
  },
];

const _kfColorCache = new Map<string, THREE.Color>();
function getCachedColor(hex: string): THREE.Color {
  let c = _kfColorCache.get(hex);
  if (!c) {
    c = new THREE.Color(hex);
    _kfColorCache.set(hex, c);
  }
  return c;
}

function lerpColorHex(out: THREE.Color, hexA: string, hexB: string, t: number): THREE.Color {
  out.copy(getCachedColor(hexA)).lerp(getCachedColor(hexB), t);
  return out;
}

function findSolarSpan(hours: number): { a: SolarKeyframe; b: SolarKeyframe; t: number } {
  const h = normalizeHours24(hours);
  for (let i = 0; i < SOLAR_KEYFRAMES.length - 1; i++) {
    const a = SOLAR_KEYFRAMES[i];
    const b = SOLAR_KEYFRAMES[i + 1];
    if (h >= a.hour && h <= b.hour) {
      const span = Math.max(1e-5, b.hour - a.hour);
      const rawT = clamp01((h - a.hour) / span);
      // Cosine ease for C1-smooth continuous transitions
      const smoothT = 0.5 - 0.5 * Math.cos(Math.PI * rawT);
      return { a, b, t: smoothT };
    }
  }
  return {
    a: SOLAR_KEYFRAMES[0],
    b: SOLAR_KEYFRAMES[1],
    t: 0,
  };
}

/**
 * Pure solar evaluation across the 24-hour clock (without weather attenuation).
 */
export function evaluateSolarClockFactors(hours: number): {
  hours: number;
  phase: LightingPresetKey;
  nightByClock01: number;
  duskDawnFactor01: number;
  sunElevation01: number;
} {
  const norm = normalizeHours24(hours);
  const { a, b, t } = findSolarSpan(norm);
  return {
    hours: norm,
    phase: resolvePhaseFromHours(norm),
    nightByClock01: lerpScalar(a.nightFactor01, b.nightFactor01, t),
    duskDawnFactor01: lerpScalar(a.duskDawnFactor01, b.duskDawnFactor01, t),
    sunElevation01: lerpScalar(a.sunElevation01, b.sunElevation01, t),
  };
}

function createInitialRuntimeState(config: WeatherControlConfig): WeatherRuntimeState {
  const preset = WEATHER_PRESETS[config.weatherCondition] ?? WEATHER_PRESETS.cerah;
  const rainScale =
    config.weatherCondition === 'hujan' && config.rainIntensityTier === 'ringan' ? 0.58 : 1.0;
  return {
    currentHours: normalizeHours24(config.timeOfDayHours),
    targetHours: normalizeHours24(config.timeOfDayHours),
    rainFactor01: preset.rainRate01 * rainScale,
    fogFactor01:
      config.weatherCondition === 'hujan'
        ? (config.rainIntensityTier === 'ringan' ? 0.32 : 0.58)
        : config.weatherCondition === 'kabut'
          ? 1.0
          : 0.0,
    windStrength:
      config.weatherCondition === 'hujan' && config.rainIntensityTier === 'ringan'
        ? 0.68
        : preset.windStrength,
    overcast01:
      config.weatherCondition === 'hujan' && config.rainIntensityTier === 'ringan'
        ? 0.62
        : preset.overcast01,
    wetness01: preset.rainRate01 > 0 ? preset.rainRate01 * rainScale : 0,
    petalDrift01: preset.petalDrift01,
    windAngleRad: Math.PI * 0.25,
    lastAppliedRevision: config.configRevision,
  };
}

export function stepWeatherRuntimeState(
  runtime: WeatherRuntimeState,
  config: WeatherControlConfig,
  dt: number,
  timeSec: number,
  snapImmediate = false,
): WeatherRuntimeState {
  const safeDt = clampRange(Number.isFinite(dt) ? dt : 0, 0, 0.1);
  if (config.autoCycleEnabled) {
    runtime.currentHours = normalizeHours24(runtime.currentHours + safeDt * AUTO_CYCLE_HOURS_PER_SEC);
    runtime.targetHours = runtime.currentHours;
    runtime.lastAppliedRevision = config.configRevision;
  } else {
    if (config.configRevision !== runtime.lastAppliedRevision) {
      runtime.targetHours = normalizeHours24(config.timeOfDayHours);
      runtime.lastAppliedRevision = config.configRevision;
    }
    if (snapImmediate) {
      runtime.currentHours = runtime.targetHours;
    } else {
      const hourAlpha = 1 - Math.exp(-safeDt * 9.0);
      const delta = shortestHoursDelta24(runtime.currentHours, runtime.targetHours);
      runtime.currentHours = normalizeHours24(runtime.currentHours + delta * hourAlpha);
    }
  }

  const preset = WEATHER_PRESETS[config.weatherCondition] ?? WEATHER_PRESETS.cerah;
  const isLightRain = config.weatherCondition === 'hujan' && config.rainIntensityTier === 'ringan';
  const targetRain =
    config.weatherCondition === 'hujan' ? (isLightRain ? 0.58 : 1.0) : 0.0;
  const targetFog =
    config.weatherCondition === 'kabut'
      ? 1.0
      : config.weatherCondition === 'hujan'
        ? (isLightRain ? 0.34 : 0.6)
        : 0.0;
  const targetWind =
    config.weatherCondition === 'hujan'
      ? (isLightRain ? 0.68 : 1.18)
      : preset.windStrength;
  const targetOvercast =
    config.weatherCondition === 'hujan'
      ? (isLightRain ? 0.64 : 0.88)
      : preset.overcast01;
  const targetPetals =
    config.weatherCondition === 'hujan'
      ? (isLightRain ? 0.18 : 0.34)
      : preset.petalDrift01;

  if (snapImmediate) {
    runtime.rainFactor01 = targetRain;
    runtime.fogFactor01 = targetFog;
    runtime.windStrength = targetWind;
    runtime.overcast01 = targetOvercast;
    runtime.wetness01 = targetRain;
    runtime.petalDrift01 = targetPetals;
  } else {
    const blendAlpha = 1 - Math.exp(-safeDt * 4.2);
    runtime.rainFactor01 = lerpScalar(runtime.rainFactor01, targetRain, blendAlpha);
    runtime.fogFactor01 = lerpScalar(runtime.fogFactor01, targetFog, blendAlpha);
    runtime.windStrength = lerpScalar(runtime.windStrength, targetWind, blendAlpha);
    runtime.overcast01 = lerpScalar(runtime.overcast01, targetOvercast, blendAlpha);
    runtime.petalDrift01 = lerpScalar(runtime.petalDrift01, targetPetals, blendAlpha);
    // Ground wets up quickly during rain and dries gradually once clear
    const wetTarget = Math.max(targetRain, runtime.rainFactor01 * 0.95);
    const wetRate = wetTarget >= runtime.wetness01 ? 1.15 : 0.15;
    runtime.wetness01 = lerpScalar(
      runtime.wetness01,
      wetTarget,
      1 - Math.exp(-safeDt * wetRate),
    );
  }

  runtime.windAngleRad = Math.PI * 0.25 + Math.sin(timeSec * 0.09) * 0.28;
  return runtime;
}

export function createReusableEvaluatedAtmosphereState(): EvaluatedAtmosphereState {
  return {
    envState: {
      timeOfDayHours: TIME_PHASE_DEFAULT_HOURS.day,
      phase: 'day',
      weatherCondition: 'cerah',
      rainIntensityTier: 'deras',
      autoCycleEnabled: false,
      nightFactor01: 0,
      duskDawnFactor01: 0,
      fogFactor01: 0,
      rainFactor01: 0,
      wetness01: 0,
      windStrength: 0.32,
      windGust: 0.25,
      windDirectionX: Math.SQRT1_2,
      windDirectionZ: Math.SQRT1_2,
      cityLightsScale: 1.0,
      sunElevation01: 1.0,
      petalDrift01: 0,
      starVisibility01: 0,
      skyColorHex: 0x6cb8f5,
      horizonSkyColorHex: 0xa6dbff,
      sunColorHex: 0xfff9e6,
      fogColorHex: 0xbae2ff,
      sunDirX: 0.45,
      sunDirY: 0.81,
      sunDirZ: 0.38,
    },
    sky: {
      zenithColor: new THREE.Color(),
      midSkyColor: new THREE.Color(),
      horizonSkyColor: new THREE.Color(),
      horizonGlowColor: new THREE.Color(),
      groundBounceColor: new THREE.Color(),
      sunColor: new THREE.Color(),
      cloudLitColor: new THREE.Color(),
      cloudMidColor: new THREE.Color(),
      cloudShadowColor: new THREE.Color(),
      cloudMatColor: new THREE.Color(),
      cloudEmissiveColor: new THREE.Color(),
      sunDir: new THREE.Vector3(),
      starOpacity: 0,
      starColor: new THREE.Color('#e0f0ff'),
    },
    lighting: {
      dirColor: new THREE.Color(),
      dirIntensity: 2.05,
      hemiSkyColor: new THREE.Color(),
      hemiGroundColor: new THREE.Color(),
      hemiIntensity: 1.2,
      windLightColor: new THREE.Color(),
      lightDir: new THREE.Vector3(0.45, 0.81, 0.38).normalize(),
    },
    fog: {
      color: new THREE.Color('#bae2ff'),
      near: 105,
      far: 215,
      hazeCompression01: 0,
    },
    terrain: {
      tintColor: new THREE.Color('#ffffff'),
      tintScale: 1.0,
      wetnessDarken: 0,
      fogDesat: 0,
    },
    particles: {
      rainIntensity01: 0,
      splashIntensity01: 0,
      leafIntensity01: 0,
      rainColor: new THREE.Color('#dbeafe'),
      splashColor: new THREE.Color('#e0f2fe'),
    },
    viewportTint: {
      colorHex: '#ffffff',
      opacity: 0,
    },
  };
}

const _stormZenithDay = new THREE.Color('#4d6078');
const _stormMidDay = new THREE.Color('#6a7e96');
const _stormHorizonDay = new THREE.Color('#95a6ba');
const _stormCloudLitDay = new THREE.Color('#b4c2d1');
const _stormCloudMidDay = new THREE.Color('#7f90a6');
const _stormCloudShadowDay = new THREE.Color('#536378');

const _stormZenithNight = new THREE.Color('#09101f');
const _stormMidNight = new THREE.Color('#142038');
const _stormHorizonNight = new THREE.Color('#223352');
const _stormCloudLitNight = new THREE.Color('#4c6082');
const _stormCloudMidNight = new THREE.Color('#2f405e');
const _stormCloudShadowNight = new THREE.Color('#19243b');

const _fogColorDay = new THREE.Color('#cad8e6');
const _fogColorNight = new THREE.Color('#1e2c45');
const _fogSkyDay = new THREE.Color('#b2c3d6');
const _fogSkyNight = new THREE.Color('#141f36');
const _overcastLightDay = new THREE.Color('#b0c4db');
const _overcastLightNight = new THREE.Color('#5870a8');
const _tmpColorA = new THREE.Color();
const _tmpColorB = new THREE.Color();
const _tmpColorC = new THREE.Color();
const _fogDisplayColor = new THREE.Color();

/**
 * Computes Linear `THREE.Fog` near/far bounds by composing the camera-mode clear baseline
 * (from `@env-horizon-optimizer` or defaults) with dynamic storm/fog haze compression.
 */
export function evaluateLinearFogParams(params: {
  baseNear?: number;
  baseFar?: number;
  rainFactor01: number;
  fogFactor01: number;
  isCityView?: boolean;
}): { near: number; far: number; hazeCompression01: number } {
  const isCityView = Boolean(params.isCityView);
  const baseNear = params.baseNear ?? (isCityView ? 210 : 105);
  const baseFar = params.baseFar ?? (isCityView ? 360 : 215);
  const hazeCompression01 = clamp01(Math.max(params.fogFactor01, params.rainFactor01 * 0.72));
  const targetNear = isCityView ? 42 : 12;
  const targetFar = isCityView ? 195 : 72;
  const near = lerpScalar(baseNear, targetNear, hazeCompression01);
  const far = Math.max(near + 12, lerpScalar(baseFar, targetFar, hazeCompression01));
  return { near, far, hazeCompression01 };
}

/**
 * Pure deterministic atmosphere evaluator mapping smoothed clock + weather state into
 * unified WebGL lighting, sky gradient, Linear THREE.Fog, terrain tints, wind gusts, particle alphas,
 * and the `WeatherEnvState` cross-system illumination bridge.
 */
export function evaluateWeatherAndTimeState(
  params: {
    timeOfDayHours: number;
    weatherCondition: WeatherConditionKey;
    rainIntensityTier?: RainIntensityTier;
    autoCycleEnabled?: boolean;
    cityLightsScale?: number;
    rainFactor01?: number;
    fogFactor01?: number;
    windStrength?: number;
    overcast01?: number;
    wetness01?: number;
    petalDrift01?: number;
    windAngleRad?: number;
    timeSec?: number;
    baseFogNear?: number;
    baseFogFar?: number;
    isCityView?: boolean;
  },
  out: EvaluatedAtmosphereState = createReusableEvaluatedAtmosphereState(),
): EvaluatedAtmosphereState {
  const hours = normalizeHours24(params.timeOfDayHours);
  const phase = resolvePhaseFromHours(hours);
  const weatherCondition = params.weatherCondition;
  const rainIntensityTier = params.rainIntensityTier ?? 'deras';
  const preset = WEATHER_PRESETS[weatherCondition] ?? WEATHER_PRESETS.cerah;
  const isLightRain = weatherCondition === 'hujan' && rainIntensityTier === 'ringan';
  const defaultRain01 = weatherCondition === 'hujan' ? (isLightRain ? 0.58 : 1.0) : 0.0;
  const defaultFog01 =
    weatherCondition === 'kabut' ? 1.0 : weatherCondition === 'hujan' ? (isLightRain ? 0.34 : 0.6) : 0.0;
  const defaultWind =
    weatherCondition === 'hujan' ? (isLightRain ? 0.68 : 1.18) : preset.windStrength;
  const defaultOvercast =
    weatherCondition === 'hujan' ? (isLightRain ? 0.64 : 0.88) : preset.overcast01;
  const defaultPetals =
    weatherCondition === 'hujan' ? (isLightRain ? 0.18 : 0.34) : preset.petalDrift01;

  const rainFactor01 = clamp01(params.rainFactor01 ?? defaultRain01);
  const fogFactor01 = clamp01(params.fogFactor01 ?? defaultFog01);
  const windStrength = clampRange(params.windStrength ?? defaultWind, 0.05, 2.5);
  const overcast01 = clamp01(params.overcast01 ?? defaultOvercast);
  const wetness01 = clamp01(params.wetness01 ?? rainFactor01);
  const petalDrift01 = clamp01(params.petalDrift01 ?? defaultPetals);
  const windAngleRad = params.windAngleRad ?? Math.PI * 0.25;
  const timeSec = params.timeSec ?? 0;
  const cityLightsScale = clampRange(
    params.cityLightsScale ?? CITY_LIGHTS_SCALE_BOUNDS.default,
    CITY_LIGHTS_SCALE_BOUNDS.min,
    CITY_LIGHTS_SCALE_BOUNDS.max,
  );

  const { a, b, t } = findSolarSpan(hours);
  const nightByClock = lerpScalar(a.nightFactor01, b.nightFactor01, t);
  const duskDawnFactor01 = lerpScalar(a.duskDawnFactor01, b.duskDawnFactor01, t);
  const sunElevation01 = lerpScalar(a.sunElevation01, b.sunElevation01, t);

  // Boost city/vehicle illumination during heavy rain or thick fog so lamps shine in storms
  const rainOrFogBoost = clampRange(rainFactor01 * 0.58 + fogFactor01 * 0.45, 0, 0.78);
  const nightFactor01 = clamp01(Math.max(nightByClock, rainOrFogBoost));

  // Wind gust oscillator scaled by active wind strength
  const gustWave =
    0.5 +
    0.35 * Math.sin(timeSec * 1.7) +
    0.15 * Math.sin(timeSec * 3.1 + 1.1);
  const windGust =
    0.18 + gustWave * (0.22 + clamp01((windStrength - 0.25) / 1.4) * 0.78);

  const windDirX = Math.cos(windAngleRad);
  const windDirZ = Math.sin(windAngleRad);

  // 1. Sky Dome Colors (smooth 24h solar gradient + overcast/fog blend)
  lerpColorHex(out.sky.zenithColor, a.zenithHex, b.zenithHex, t);
  lerpColorHex(out.sky.midSkyColor, a.midSkyHex, b.midSkyHex, t);
  lerpColorHex(out.sky.horizonSkyColor, a.horizonSkyHex, b.horizonSkyHex, t);
  lerpColorHex(out.sky.horizonGlowColor, a.horizonGlowHex, b.horizonGlowHex, t);
  lerpColorHex(out.sky.groundBounceColor, a.groundBounceHex, b.groundBounceHex, t);
  lerpColorHex(out.sky.sunColor, a.sunHex, b.sunHex, t);
  lerpColorHex(out.sky.cloudLitColor, a.cloudLitHex, b.cloudLitHex, t);
  lerpColorHex(out.sky.cloudMidColor, a.cloudMidHex, b.cloudMidHex, t);
  lerpColorHex(out.sky.cloudShadowColor, a.cloudShadowHex, b.cloudShadowHex, t);
  lerpColorHex(out.sky.cloudMatColor, a.cloudMatHex, b.cloudMatHex, t);
  lerpColorHex(out.sky.cloudEmissiveColor, a.cloudEmissiveHex, b.cloudEmissiveHex, t);

  // Day/night factor for overcast & fog color adaptation
  const dayNightBlend = clamp01(nightByClock);
  if (overcast01 > 0.001) {
    _tmpColorA.copy(_stormZenithDay).lerp(_stormZenithNight, dayNightBlend);
    out.sky.zenithColor.lerp(_tmpColorA, overcast01 * 0.85);

    _tmpColorA.copy(_stormMidDay).lerp(_stormMidNight, dayNightBlend);
    out.sky.midSkyColor.lerp(_tmpColorA, overcast01 * 0.85);

    _tmpColorA.copy(_stormHorizonDay).lerp(_stormHorizonNight, dayNightBlend);
    out.sky.horizonSkyColor.lerp(_tmpColorA, overcast01 * 0.85);
    out.sky.horizonGlowColor.lerp(_tmpColorA, overcast01 * 0.78);
    out.sky.groundBounceColor.lerp(_tmpColorA, overcast01 * 0.7);
    out.sky.sunColor.lerp(_tmpColorA, overcast01 * 0.72);

    _tmpColorA.copy(_stormCloudLitDay).lerp(_stormCloudLitNight, dayNightBlend);
    out.sky.cloudLitColor.lerp(_tmpColorA, overcast01 * 0.88);
    out.sky.cloudMatColor.lerp(_tmpColorA, overcast01 * 0.85);

    _tmpColorA.copy(_stormCloudMidDay).lerp(_stormCloudMidNight, dayNightBlend);
    out.sky.cloudMidColor.lerp(_tmpColorA, overcast01 * 0.9);

    _tmpColorA.copy(_stormCloudShadowDay).lerp(_stormCloudShadowNight, dayNightBlend);
    out.sky.cloudShadowColor.lerp(_tmpColorA, overcast01 * 0.92);
    out.sky.cloudEmissiveColor.lerp(_tmpColorA, overcast01 * 0.75);
  }

  // Thick fog softens sky horizon toward homogeneous mist
  const pureFogMix = clamp01((fogFactor01 - rainFactor01 * 0.4) * 0.82);
  if (pureFogMix > 0.001) {
    _tmpColorB.copy(_fogSkyDay).lerp(_fogSkyNight, dayNightBlend);
    out.sky.zenithColor.lerp(_tmpColorB, pureFogMix * 0.65);
    out.sky.midSkyColor.lerp(_tmpColorB, pureFogMix * 0.82);
    out.sky.horizonSkyColor.lerp(_tmpColorB, pureFogMix * 0.95);
    out.sky.horizonGlowColor.lerp(_tmpColorB, pureFogMix * 0.92);
    out.sky.groundBounceColor.lerp(_tmpColorB, pureFogMix * 0.85);
    out.sky.cloudLitColor.lerp(_tmpColorB, pureFogMix * 0.75);
  }

  // Solar arc direction for sky dome disc + subtle warm shift on windUniforms
  // 06:00 -> East (+X), 12:30 -> High Overhead-South, 18:00 -> West (-X)
  const dayArcT = clampRange((hours - 5.5) / 13.0, -0.25, 1.25);
  if (hours >= 5.25 && hours <= 19.0) {
    const theta = dayArcT * Math.PI;
    const sx = Math.cos(theta) * 0.92;
    const sy = Math.max(0.05, Math.sin(theta) * 0.86);
    const sz = 0.36;
    out.sky.sunDir.set(sx, sy, sz).normalize();
  } else {
    // Moon / night glow arc
    const nightHours = hours > 19.0 ? hours - 19.0 : hours + 5.0;
    const nightTheta = clamp01(nightHours / 10.25) * Math.PI;
    out.sky.sunDir
      .set(-Math.cos(nightTheta) * 0.68, 0.38 + Math.sin(nightTheta) * 0.25, 0.48)
      .normalize();
  }

  // Subtle cohesive key-light tilt keeping shadow hemisphere upward (y >= 0.56)
  const azimuthShift = hours >= 5.5 && hours <= 18.75 ? Math.cos(dayArcT * Math.PI) * 0.35 : 0.15;
  out.lighting.lightDir.set(0.32 + azimuthShift, 0.81, 0.44).normalize();

  // Stars / twilight sparkles fade in cleanly during dusk/night/dawn & hide behind thick clouds
  const rawStarVis = clamp01(nightByClock * 0.95 + duskDawnFactor01 * 0.45);
  const starCloudMask = 1 - clamp01(overcast01 * 0.94 + fogFactor01 * 0.85);
  const starVisibility01 = rawStarVis * starCloudMask;
  out.sky.starOpacity = starVisibility01 * 0.92;
  out.sky.starColor
    .set('#fff0d8')
    .lerp(getCachedColor('#dceeff'), clamp01(nightByClock));

  // 2. Scene Lights (`dirLight`, `hemiLight`, `windUniforms.uLightColor`)
  lerpColorHex(out.lighting.dirColor, a.dirLightHex, b.dirLightHex, t);
  lerpColorHex(out.lighting.hemiSkyColor, a.hemiSkyHex, b.hemiSkyHex, t);
  lerpColorHex(out.lighting.hemiGroundColor, a.hemiGroundHex, b.hemiGroundHex, t);
  lerpColorHex(out.lighting.windLightColor, a.windLightHex, b.windLightHex, t);

  const baseDirInt = lerpScalar(a.dirLightIntensity, b.dirLightIntensity, t);
  const baseHemiInt = lerpScalar(a.hemiIntensity, b.hemiIntensity, t);

  _tmpColorC.copy(_overcastLightDay).lerp(_overcastLightNight, dayNightBlend);
  if (overcast01 > 0.001) {
    out.lighting.dirColor.lerp(_tmpColorC, overcast01 * 0.65);
    out.lighting.hemiSkyColor.lerp(_tmpColorC, overcast01 * 0.55);
    out.lighting.windLightColor.lerp(_tmpColorC, overcast01 * 0.62);
  }
  out.lighting.dirIntensity = baseDirInt * (1 - overcast01 * 0.52);
  out.lighting.hemiIntensity = baseHemiInt * (1 - overcast01 * 0.18);

  // 3. Linear Distance Fog (`THREE.Fog`)
  lerpColorHex(out.fog.color, a.fogHex, b.fogHex, t);
  if (rainFactor01 > 0.001) {
    _tmpColorA.copy(_stormHorizonDay).lerp(_stormHorizonNight, dayNightBlend);
    out.fog.color.lerp(_tmpColorA, clamp01(rainFactor01 * 0.82));
  }
  if (fogFactor01 > 0.001) {
    _tmpColorB.copy(_fogColorDay).lerp(_fogColorNight, dayNightBlend);
    out.fog.color.lerp(_tmpColorB, clamp01(fogFactor01 * 0.88));
  }
  const linearFog = evaluateLinearFogParams({
    baseNear: params.baseFogNear,
    baseFar: params.baseFogFar,
    rainFactor01,
    fogFactor01,
    isCityView: params.isCityView,
  });
  out.fog.near = linearFog.near;
  out.fog.far = linearFog.far;
  out.fog.hazeCompression01 = linearFog.hazeCompression01;

  // 4. Terrain & Grass Tinting (0 extra draw calls — drives existing ground/grass uniforms)
  lerpColorHex(out.terrain.tintColor, a.groundTintHex, b.groundTintHex, t);
  const baseGroundScale = lerpScalar(a.groundTintScale, b.groundTintScale, t);
  const wetnessDarken = wetness01 * 0.16;
  const overcastDarken = overcast01 * 0.14 * (1 - dayNightBlend * 0.7);
  out.terrain.tintScale = clampRange(baseGroundScale * (1 - wetnessDarken - overcastDarken), 0.28, 1.0);
  out.terrain.wetnessDarken = wetnessDarken;
  out.terrain.fogDesat = clamp01(fogFactor01 * 0.38);

  // 5. GPU Particle Intensities & Colors
  out.particles.rainIntensity01 = rainFactor01;
  out.particles.splashIntensity01 = clamp01(rainFactor01 * 0.95 + wetness01 * 0.08 * (rainFactor01 > 0.02 ? 1 : 0));
  out.particles.leafIntensity01 = petalDrift01;
  out.particles.rainColor
    .set('#dbeafe')
    .lerp(getCachedColor('#ffd9c4'), duskDawnFactor01 * 0.55)
    .lerp(getCachedColor('#8cb0eb'), dayNightBlend * 0.65);
  out.particles.splashColor
    .set('#eef6ff')
    .lerp(getCachedColor('#ffe2cc'), duskDawnFactor01 * 0.45)
    .lerp(getCachedColor('#9bbcf0'), dayNightBlend * 0.58);

  // 6. Subtle UI Viewport Tint (gentle accent, never washing out night streetlamps)
  out.viewportTint.colorHex =
    rainFactor01 > 0.35
      ? '#4c6280'
      : phase === 'dusk'
        ? '#ff8e7a'
        : phase === 'night'
          ? '#1e2c5c'
          : phase === 'dawn'
            ? '#ffe0c4'
            : '#ffffff';
  out.viewportTint.opacity =
    rainFactor01 > 0.35
      ? 0.05 * rainFactor01
      : phase === 'dusk'
        ? 0.04
        : phase === 'night'
          ? 0.05
          : phase === 'dawn'
            ? 0.03
            : 0;

  // 7. Cross-system illumination contract (`scene.userData.weatherEnvState`)
  out.envState.timeOfDayHours = hours;
  out.envState.phase = phase;
  out.envState.weatherCondition = weatherCondition;
  out.envState.rainIntensityTier = rainIntensityTier;
  out.envState.autoCycleEnabled = Boolean(params.autoCycleEnabled);
  out.envState.nightFactor01 = nightFactor01;
  out.envState.duskDawnFactor01 = duskDawnFactor01;
  out.envState.fogFactor01 = fogFactor01;
  out.envState.rainFactor01 = rainFactor01;
  out.envState.wetness01 = wetness01;
  out.envState.windStrength = windStrength;
  out.envState.windGust = windGust;
  out.envState.windDirectionX = windDirX;
  out.envState.windDirectionZ = windDirZ;
  out.envState.cityLightsScale = cityLightsScale;
  out.envState.sunElevation01 = sunElevation01;
  out.envState.petalDrift01 = petalDrift01;
  out.envState.starVisibility01 = starVisibility01;
  _tmpColorA.copy(out.sky.horizonSkyColor).lerp(out.sky.midSkyColor, 0.42);
  out.envState.skyColorHex = _tmpColorA.getHex();
  out.envState.horizonSkyColorHex = out.sky.horizonSkyColor.getHex();
  out.envState.sunColorHex = out.sky.sunColor.getHex();
  out.envState.fogColorHex = out.fog.color.getHex();
  out.envState.sunDirX = out.sky.sunDir.x;
  out.envState.sunDirY = out.sky.sunDir.y;
  out.envState.sunDirZ = out.sky.sunDir.z;

  return out;
}

// ============================================================================
// SHARED WEATHER CONTROL & SYNC BRIDGE (App <-> 3D Engine)
// ============================================================================

function parseInitialWeatherConfigFromQuery(): Partial<WeatherControlConfig> {
  if (typeof window === 'undefined') return {};
  try {
    const params = new URLSearchParams(window.location.search);
    const out: Partial<WeatherControlConfig> = {};
    const qWeather = params.get('weather')?.toLowerCase();
    if (
      qWeather === 'cerah' ||
      qWeather === 'berangin' ||
      qWeather === 'kabut' ||
      qWeather === 'hujan'
    ) {
      out.weatherCondition = qWeather;
    }
    const qRain = params.get('rain')?.toLowerCase();
    if (qRain === 'ringan' || qRain === 'deras') {
      out.rainIntensityTier = qRain;
    }
    const qTime = params.get('time')?.toLowerCase();
    if (qTime === 'dawn' || qTime === 'fajar') {
      out.phase = 'dawn';
      out.timeOfDayHours = TIME_PHASE_DEFAULT_HOURS.dawn;
    } else if (qTime === 'day' || qTime === 'siang') {
      out.phase = 'day';
      out.timeOfDayHours = TIME_PHASE_DEFAULT_HOURS.day;
    } else if (qTime === 'dusk' || qTime === 'senja') {
      out.phase = 'dusk';
      out.timeOfDayHours = TIME_PHASE_DEFAULT_HOURS.dusk;
    } else if (qTime === 'night' || qTime === 'malam') {
      out.phase = 'night';
      out.timeOfDayHours = TIME_PHASE_DEFAULT_HOURS.night;
    }
    const qHour = params.get('hour');
    if (qHour !== null && qHour.trim() !== '') {
      const parsed = Number(qHour);
      if (Number.isFinite(parsed)) {
        out.timeOfDayHours = normalizeHours24(parsed);
        out.phase = resolvePhaseFromHours(out.timeOfDayHours);
      }
    }
    const qAuto = params.get('autocycle');
    if (qAuto === '1' || qAuto === 'true') {
      out.autoCycleEnabled = true;
    }
    const qLights = params.get('citylights');
    if (qLights !== null && qLights.trim() !== '') {
      const parsed = Number(qLights);
      if (Number.isFinite(parsed)) {
        out.cityLightsScale = clampRange(
          parsed,
          CITY_LIGHTS_SCALE_BOUNDS.min,
          CITY_LIGHTS_SCALE_BOUNDS.max,
        );
      }
    }
    return out;
  } catch {
    return {};
  }
}

const initialQueryWeather = parseInitialWeatherConfigFromQuery();

let sharedWeatherControlConfig: WeatherControlConfig = {
  timeOfDayHours: initialQueryWeather.timeOfDayHours ?? TIME_PHASE_DEFAULT_HOURS.day,
  phase: initialQueryWeather.phase ?? 'day',
  weatherCondition: initialQueryWeather.weatherCondition ?? 'cerah',
  rainIntensityTier: initialQueryWeather.rainIntensityTier ?? 'deras',
  autoCycleEnabled: initialQueryWeather.autoCycleEnabled ?? false,
  cityLightsScale: initialQueryWeather.cityLightsScale ?? CITY_LIGHTS_SCALE_BOUNDS.default,
  configRevision: 1,
};

const controlListeners = new Set<(cfg: WeatherControlConfig) => void>();
const displayListeners = new Set<(env: WeatherEnvState) => void>();

export function getWeatherControlConfig(): WeatherControlConfig {
  return sharedWeatherControlConfig;
}

export function setWeatherControlConfig(
  patch: Partial<Omit<WeatherControlConfig, 'configRevision'>>,
): WeatherControlConfig {
  const nextHours =
    patch.timeOfDayHours !== undefined
      ? normalizeHours24(patch.timeOfDayHours)
      : patch.phase !== undefined && patch.phase !== sharedWeatherControlConfig.phase
        ? TIME_PHASE_DEFAULT_HOURS[patch.phase]
        : sharedWeatherControlConfig.timeOfDayHours;
  const nextPhase = patch.phase ?? resolvePhaseFromHours(nextHours);
  sharedWeatherControlConfig = {
    timeOfDayHours: nextHours,
    phase: nextPhase,
    weatherCondition: patch.weatherCondition ?? sharedWeatherControlConfig.weatherCondition,
    rainIntensityTier: patch.rainIntensityTier ?? sharedWeatherControlConfig.rainIntensityTier,
    autoCycleEnabled: patch.autoCycleEnabled ?? sharedWeatherControlConfig.autoCycleEnabled,
    cityLightsScale: clampRange(
      patch.cityLightsScale ?? sharedWeatherControlConfig.cityLightsScale,
      CITY_LIGHTS_SCALE_BOUNDS.min,
      CITY_LIGHTS_SCALE_BOUNDS.max,
    ),
    configRevision: sharedWeatherControlConfig.configRevision + 1,
  };
  controlListeners.forEach((cb) => cb(sharedWeatherControlConfig));
  return sharedWeatherControlConfig;
}

export function subscribeWeatherControlConfig(
  cb: (cfg: WeatherControlConfig) => void,
): () => void {
  controlListeners.add(cb);
  return () => {
    controlListeners.delete(cb);
  };
}

export function subscribeWeatherDisplaySync(
  cb: (env: WeatherEnvState) => void,
): () => void {
  displayListeners.add(cb);
  return () => {
    displayListeners.delete(cb);
  };
}

// ============================================================================
// GPU-FIRST 3D WEATHER SYSTEM (<= 3 INSTANCED DRAW CALLS, 0 POINT LIGHTS)
// ============================================================================

function createDeterministicRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function initIdentityMatrices(mesh: THREE.InstancedMesh): void {
  const ident = new THREE.Matrix4();
  for (let i = 0; i < mesh.count; i++) {
    mesh.setMatrixAt(i, ident);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 8, 0), 9999);
}

interface TerrainBaselineColors {
  groundMat: THREE.ShaderMaterial;
  groundDefaults: Record<string, THREE.Color>;
  grassMat: THREE.ShaderMaterial | null;
  grassDefaults: Record<string, THREE.Color>;
  waterMats: THREE.ShaderMaterial[];
}

const GROUND_COLOR_UNIFORM_KEYS = [
  'uDirtMain',
  'uDirtDeep',
  'uDirtHighlight',
  'uGrassEdge',
  'uGrassFloor',
  'uGrassBright',
  'uDirtShadowTint',
  'uGrassShadowTint',
] as const;

const GRASS_COLOR_UNIFORM_KEYS = [
  'uSunBottom',
  'uSunMid',
  'uSunTop',
  'uShadowBottom',
  'uShadowMid',
  'uShadowTop',
] as const;

/**
 * Builds the 60 FPS GPU-driven Dynamic Weather & Time-of-Day 3D system:
 * - Draw call 1: Slanted velocity-stretched Rain Streaks (`InstancedMesh` + `ShaderMaterial`)
 * - Draw call 2: Expanding ground Rain Splash Ripples + wet sheen (`InstancedMesh` + `ShaderMaterial`)
 * - Draw call 3: Wind-drifting Sakura Petals & Meadow Leaves (`InstancedMesh` + `ShaderMaterial`)
 * - Zero per-frame CPU particle iteration and zero PointLights.
 */
export function buildDynamicWeatherSystem3D(params: {
  scene: THREE.Scene;
  hemiLight: THREE.HemisphereLight;
  dirLight: THREE.DirectionalLight;
  animeSkyUniforms: AnimeSkyUniformsLike;
  cloudPuffToonMat: THREE.MeshToonMaterial;
  animeSparkleMat: THREE.PointsMaterial;
  isSoftwareGl: boolean;
  initialPreset?: LightingPresetKey;
}): WeatherSystem3DHandle {
  const {
    scene,
    hemiLight,
    dirLight,
    animeSkyUniforms,
    cloudPuffToonMat,
    animeSparkleMat,
    isSoftwareGl,
    initialPreset,
  } = params;

  const rootGroup = new THREE.Group();
  rootGroup.name = 'DynamicWeatherSystem3D';
  scene.add(rootGroup);

  const uWeatherTime = { value: 0 };
  const uWeatherPivot = { value: new THREE.Vector3(0, 0, 12.5) };
  const uWeatherWindDir = { value: new THREE.Vector2(Math.SQRT1_2, Math.SQRT1_2) };
  const uWeatherWindStrength = { value: 0.32 };
  const uWeatherWindGust = { value: 0.25 };
  const uRainIntensity = { value: 0.0 };
  const uSplashIntensity = { value: 0.0 };
  const uWetness = { value: 0.0 };
  const uLeafIntensity = { value: 0.0 };
  const uRainColor = { value: new THREE.Color('#dbeafe') };
  const uSplashColor = { value: new THREE.Color('#eef6ff') };
  const uLeafLightColor = { value: new THREE.Color('#fff4c8') };

  const rng = createDeterministicRng(20261118);

  // --------------------------------------------------------------------------
  // 1. GPU Instanced Rain Streaks (1 Draw Call — gentle density, uniform frustum coverage)
  // --------------------------------------------------------------------------
  const rainCount = isSoftwareGl ? 840 : 1680;
  const rainBaseSpanXZ = 82.0;
  const rainHeightY = 26.0;
  const rainGeo: THREE.BufferGeometry = new THREE.PlaneGeometry(1, 1, 1, 1);

  const rainAnchors = new Float32Array(rainCount * 3);
  const rainSeeds = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i++) {
    // Store normalized XZ in [-0.5, +0.5] so dynamic uSpanXZ expands/contracts uniformly without clustering
    rainAnchors[i * 3] = rng() - 0.5;
    rainAnchors[i * 3 + 1] = rng() * rainHeightY;
    rainAnchors[i * 3 + 2] = rng() - 0.5;
    rainSeeds[i * 3] = rng(); // speed variance
    rainSeeds[i * 3 + 1] = 0.75 + rng() * 0.65; // length scale
    rainSeeds[i * 3 + 2] = 0.55 + rng() * 0.45; // alpha variance
  }
  rainGeo.setAttribute('aRainAnchor', new THREE.InstancedBufferAttribute(rainAnchors, 3));
  rainGeo.setAttribute('aRainSeed', new THREE.InstancedBufferAttribute(rainSeeds, 3));

  const uRainSpanXZ = { value: rainBaseSpanXZ };
  const rainMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: uWeatherTime,
      uPlanetPivot: uWeatherPivot,
      uWindDirection: uWeatherWindDir,
      uWindStrength: uWeatherWindStrength,
      uWindGust: uWeatherWindGust,
      uRainIntensity: uRainIntensity,
      uRainColor: uRainColor,
      uSpanXZ: uRainSpanXZ,
      uHeightY: { value: rainHeightY },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aRainAnchor;
      attribute vec3 aRainSeed;

      uniform float uTime;
      uniform vec3 uPlanetPivot;
      uniform vec2 uWindDirection;
      uniform float uWindStrength;
      uniform float uWindGust;
      uniform float uRainIntensity;
      uniform float uSpanXZ;
      uniform float uHeightY;

      varying vec2 vUv;
      varying float vFade;

      void main() {
        vUv = uv;
        float halfSpan = uSpanXZ * 0.5;
        float fallSpeed = (21.0 + aRainSeed.x * 9.0) * (0.85 + uRainIntensity * 0.35);
        float windHorizSpeed = (uWindStrength + uWindGust * 0.55) * 4.6;
        vec2 windDir = normalize(uWindDirection + vec2(0.0001));

        float rawX = aRainAnchor.x * uSpanXZ + windDir.x * windHorizSpeed * uTime * 1.15;
        float rawZ = aRainAnchor.z * uSpanXZ + windDir.y * windHorizSpeed * uTime * 1.15;
        float wx = mod(rawX - uPlanetPivot.x + halfSpan, uSpanXZ) - halfSpan + uPlanetPivot.x;
        float wz = mod(rawZ - uPlanetPivot.z + halfSpan, uSpanXZ) - halfSpan + uPlanetPivot.z;
        float wy = mod(aRainAnchor.y - fallSpeed * uTime, uHeightY);

        vec3 center = vec3(wx, wy, wz);
        vec3 velDir = normalize(vec3(windDir.x * windHorizSpeed, -fallSpeed, windDir.y * windHorizSpeed));
        vec3 toCam = cameraPosition - center;
        float camLen = max(length(toCam), 0.001);
        vec3 viewDir = toCam / camLen;
        vec3 right = cross(velDir, viewDir);
        float rightLen = length(right);
        right = rightLen > 0.001 ? (right / rightLen) : vec3(1.0, 0.0, 0.0);

        float streakW = 0.026 + uRainIntensity * 0.014;
        float streakL = (0.98 + uRainIntensity * 0.65) * aRainSeed.y;
        vec3 worldPos = center + right * (position.x * streakW) + velDir * (position.y * streakL);

        float distXZ = length(center.xz - uPlanetPivot.xz);
        float radialFade = 1.0 - smoothstep(halfSpan * 0.78, halfSpan * 0.99, distXZ);
        float vertFade = smoothstep(0.15, 0.95, wy) * (1.0 - smoothstep(uHeightY - 4.0, uHeightY, wy));
        vFade = radialFade * vertFade * aRainSeed.z;

        gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uRainIntensity;
      uniform vec3 uRainColor;

      varying vec2 vUv;
      varying float vFade;

      void main() {
        float edgeX = 1.0 - abs(vUv.x - 0.5) * 2.0;
        float coreX = smoothstep(0.0, 0.85, edgeX);
        float taperY = smoothstep(0.0, 0.28, vUv.y) * (1.0 - smoothstep(0.72, 1.0, vUv.y));
        float alpha = coreX * taperY * vFade * uRainIntensity * 0.50;
        if (alpha <= 0.005) discard;
        gl_FragColor = vec4(uRainColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  const rainMesh = new THREE.InstancedMesh(rainGeo, rainMat, rainCount);
  rainMesh.name = 'WeatherRainStreaksInstanced';
  rainMesh.frustumCulled = false;
  rainMesh.renderOrder = 12;
  rainMesh.visible = false;
  initIdentityMatrices(rainMesh);
  rootGroup.add(rainMesh);

  // --------------------------------------------------------------------------
  // 2. GPU Ground Rain Splash Ripples & Wet Sheen (1 InstancedMesh Draw Call)
  // --------------------------------------------------------------------------
  const splashCount = isSoftwareGl ? 160 : 320;
  const splashBaseSpanXZ = 64.0;
  const splashGeo: THREE.BufferGeometry = new THREE.PlaneGeometry(1, 1, 1, 1);
  splashGeo.rotateX(-Math.PI / 2);

  const splashAnchors = new Float32Array(splashCount * 2);
  const splashSeeds = new Float32Array(splashCount * 3);
  for (let i = 0; i < splashCount; i++) {
    // Store normalized XZ in [-0.5, +0.5] so splashes fill full camera frustum across gameplay & City View
    splashAnchors[i * 2] = rng() - 0.5;
    splashAnchors[i * 2 + 1] = rng() - 0.5;
    splashSeeds[i * 3] = rng(); // cycle phase offset
    splashSeeds[i * 3 + 1] = rng(); // speed variance
    splashSeeds[i * 3 + 2] = 0.78 + rng() * 0.68; // radius variance
  }
  splashGeo.setAttribute('aSplashAnchor', new THREE.InstancedBufferAttribute(splashAnchors, 2));
  splashGeo.setAttribute('aSplashSeed', new THREE.InstancedBufferAttribute(splashSeeds, 3));

  const uSplashSpanXZ = { value: splashBaseSpanXZ };
  const splashMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: uWeatherTime,
      uPlanetPivot: uWeatherPivot,
      uSplashIntensity: uSplashIntensity,
      uWetness: uWetness,
      uSplashColor: uSplashColor,
      uSpanXZ: uSplashSpanXZ,
    },
    vertexShader: /* glsl */ `
      attribute vec2 aSplashAnchor;
      attribute vec3 aSplashSeed;

      uniform float uTime;
      uniform vec3 uPlanetPivot;
      uniform float uSplashIntensity;
      uniform float uSpanXZ;

      varying vec2 vUv;
      varying float vAge;
      varying float vFade;

      float sdBox2D(vec2 p, vec2 c, vec2 b) {
        vec2 d = abs(p - c) - b;
        return max(d.x, d.y);
      }

      float sdRoundedBox2D(vec2 p, vec2 c, vec2 b, float r) {
        vec2 q = abs(p - c) - b + vec2(r);
        return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
      }

      ${buildCoastalHillGlslSnippet()}

      float evalSplashSurfaceY(vec2 p) {
        // Hilltop Villa Plateaus, Driveway Aprons (+8.50m) & San Francisco Coastal Switchbacks
        if (min(evaluateHillVillaPlateauSdf(p), evaluateHillVillaDrivewayApronSdf(p)) <= 0.15) {
          return 8.545;
        }
        vec3 hillRoadS = evalCoastalHillRoad(p);
        if (hillRoadS.x <= 4.10 && hillRoadS.y > 0.005) {
          return max(0.045, hillRoadS.y + 0.045);
        }
        // West Elevated Plaza (+2.50m) & Urban Staircase (-87.55 .. -79.15)
        if (p.x >= -110.85 && p.x <= -78.70 && abs(p.y) <= 38.10) {
          if (p.x >= -87.60 && abs(p.y) <= 10.05) {
            if (p.x <= -84.05) {
              return mix(2.545, 1.365, smoothstep(-87.55, -84.05, p.x));
            } else if (p.x <= -82.65) {
              return 1.365;
            }
            return mix(1.365, 0.125, smoothstep(-82.65, -79.15, p.x));
          }
          return 2.545;
        }
        // Widened West Plaza Front Sidewalk (+0.09m)
        if (p.x >= -78.85 && p.x <= -73.90 && abs(p.y) <= 38.20) {
          return 0.125;
        }
        // 4 Halte Elevated Platforms (+0.26m)
        if (
          sdBox2D(p, vec2(-58.9, 0.0), vec2(3.6, 9.4)) <= 0.0 ||
          sdBox2D(p, vec2(3.5, -40.87), vec2(9.4, 3.6)) <= 0.0 ||
          sdBox2D(p, vec2(-36.5, 40.87), vec2(9.4, 3.6)) <= 0.0 ||
          sdBox2D(p, vec2(79.63, 29.5), vec2(3.6, 9.4)) <= 0.0
        ) {
          return 0.295;
        }
        // Central Urban Plaza Island (+0.042m terrazzo, Beauty Salon Roof/Terrace, Fountain & Lily Pond)
        if (p.x >= -9.6 && p.x <= 57.4 && abs(p.y) <= 21.8) {
          float rFtn = length(p - vec2(29.5, 0.0));
          if (rFtn <= 3.12) return 0.81;
          if (rFtn <= 4.95) return 0.34;
          if (length(p - vec2(29.5, -14.8)) <= 3.45) return 0.27;
          if (abs(p.x - 29.5) <= 3.55 && abs(p.y - 14.0) <= 2.4) return 8.46;
          if (abs(p.x - 29.5) <= 4.5 && abs(p.y - 14.0) <= 3.5) return 4.98;
          return 0.095;
        }
        // Taman Ria & SE Coastal Boardwalks (+0.82m) + Lower Walkway (+0.24m)
        if (
          (p.x >= 78.2 && p.x <= 125.5 && p.y >= -104.0 && p.y <= -18.8) ||
          (p.x >= 77.6 && p.x <= 96.8 && p.y >= 45.4 && p.y <= 103.0)
        ) {
          return 0.855;
        }
        if (p.x >= 75.0 && p.x <= 77.6 && p.y >= 45.4 && p.y <= 103.0) {
          return 0.28;
        }
        // NW Oasis Lake & East Ocean Water (-0.16m)
        vec2 lakeD = vec2((p.x + 31.0) / 1.12, p.y);
        if (length(lakeD) <= 11.2 || p.x >= 104.5) {
          return -0.135;
        }
        // Grand Casino Forecourt & Tram Sidewalks (+0.09m)
        if (
          (p.x <= -63.8 && p.y <= -37.5 && p.y >= -105.0) ||
          (abs(abs(p.x) - 61.5) < 3.0 && abs(p.y) < 45.0) ||
          (abs(abs(p.y) - 41.5) < 3.0 && abs(p.x) < 62.0)
        ) {
          return 0.125;
        }
        return 0.045;
      }

      void main() {
        vUv = uv;
        float halfSpan = uSpanXZ * 0.5;
        float wx = mod(aSplashAnchor.x * uSpanXZ - uPlanetPivot.x + halfSpan, uSpanXZ) - halfSpan + uPlanetPivot.x;
        float wz = mod(aSplashAnchor.y * uSpanXZ - uPlanetPivot.z + halfSpan, uSpanXZ) - halfSpan + uPlanetPivot.z;

        float rate = 1.25 + aSplashSeed.y * 0.85;
        float age = fract(aSplashSeed.x + uTime * rate * (0.85 + uSplashIntensity * 0.45));
        float scale = (0.38 + aSplashSeed.z * 0.34) * (0.35 + age * 0.85);
        float groundY = evalSplashSurfaceY(vec2(wx, wz));

        vec3 worldPos = vec3(
          wx + position.x * scale,
          groundY,
          wz + position.z * scale
        );

        float distXZ = length(vec2(wx, wz) - uPlanetPivot.xz);
        vFade = 1.0 - smoothstep(halfSpan * 0.78, halfSpan * 0.99, distXZ);
        vAge = age;

        gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uSplashIntensity;
      uniform float uWetness;
      uniform vec3 uSplashColor;

      varying vec2 vUv;
      varying float vAge;
      varying float vFade;

      void main() {
        vec2 d = (vUv - 0.5) * 2.0;
        float r = length(d);
        if (r > 1.0) discard;

        float ringRadius = 0.12 + vAge * 0.78;
        float dRing = (r - ringRadius) * 8.5;
        float ring = exp(-(dRing * dRing));
        float crownDot = (1.0 - smoothstep(0.0, 0.24, r)) * (1.0 - smoothstep(0.0, 0.26, vAge));
        float lifeFade = (1.0 - vAge) * smoothstep(0.0, 0.08, vAge);
        float wetPuddleSheen = (1.0 - smoothstep(0.15, 0.98, r)) * uWetness * 0.11;

        float alpha = (ring * lifeFade * 0.62 + crownDot * 0.45 + wetPuddleSheen) * vFade * uSplashIntensity;
        if (alpha <= 0.005) discard;
        gl_FragColor = vec4(uSplashColor, clamp(alpha, 0.0, 0.78));
      }
    `,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  const splashMesh = new THREE.InstancedMesh(splashGeo, splashMat, splashCount);
  splashMesh.name = 'WeatherRainSplashesInstanced';
  splashMesh.frustumCulled = false;
  splashMesh.renderOrder = 4;
  splashMesh.visible = false;
  initIdentityMatrices(splashMesh);
  rootGroup.add(splashMesh);

  // --------------------------------------------------------------------------
  // 3. GPU Wind-Drifting Petals & Leaves (1 InstancedMesh Draw Call)
  // --------------------------------------------------------------------------
  const leafCount = isSoftwareGl ? 150 : 300;
  const leafBaseSpanXZ = 96.0;
  const leafHeightY = 18.0;
  const leafGeo: THREE.BufferGeometry = new THREE.PlaneGeometry(0.19, 0.12, 2, 1);
  // Give each petal/leaf a gentle organic 3D arch
  const leafPosAttr = leafGeo.attributes.position as THREE.BufferAttribute;
  for (let v = 0; v < leafPosAttr.count; v++) {
    const lx = leafPosAttr.getX(v);
    leafPosAttr.setZ(v, Math.abs(lx) * 0.28);
  }
  leafGeo.computeVertexNormals();

  const leafAnchors = new Float32Array(leafCount * 3);
  const leafSeeds = new Float32Array(leafCount * 4);
  for (let i = 0; i < leafCount; i++) {
    leafAnchors[i * 3] = rng() - 0.5;
    leafAnchors[i * 3 + 1] = 0.4 + rng() * (leafHeightY - 0.6);
    leafAnchors[i * 3 + 2] = rng() - 0.5;
    leafSeeds[i * 4] = rng() * Math.PI * 2; // wave phase
    leafSeeds[i * 4 + 1] = 0.75 + rng() * 0.65; // speed multiplier
    leafSeeds[i * 4 + 2] = (rng() - 0.5) * 3.8; // tumble spin rate
    leafSeeds[i * 4 + 3] = rng(); // color variant (pink sakura vs green leaf vs gold)
  }
  leafGeo.setAttribute('aLeafAnchor', new THREE.InstancedBufferAttribute(leafAnchors, 3));
  leafGeo.setAttribute('aLeafSeed', new THREE.InstancedBufferAttribute(leafSeeds, 4));

  const uLeafSpanXZ = { value: leafBaseSpanXZ };
  const leafMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: uWeatherTime,
      uPlanetPivot: uWeatherPivot,
      uWindDirection: uWeatherWindDir,
      uWindStrength: uWeatherWindStrength,
      uWindGust: uWeatherWindGust,
      uLeafIntensity: uLeafIntensity,
      uLightColor: uLeafLightColor,
      uSpanXZ: uLeafSpanXZ,
      uHeightY: { value: leafHeightY },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aLeafAnchor;
      attribute vec4 aLeafSeed;

      uniform float uTime;
      uniform vec3 uPlanetPivot;
      uniform vec2 uWindDirection;
      uniform float uWindStrength;
      uniform float uWindGust;
      uniform float uLeafIntensity;
      uniform float uSpanXZ;
      uniform float uHeightY;

      varying vec2 vUv;
      varying float vColorSeed;
      varying float vFade;

      void main() {
        vUv = uv;
        vColorSeed = aLeafSeed.w;
        float halfSpan = uSpanXZ * 0.5;
        vec2 windDir = normalize(uWindDirection + vec2(0.0001));
        vec2 perpDir = vec2(-windDir.y, windDir.x);

        float driftSpeed = (3.4 + uWindStrength * 4.4 + uWindGust * 1.9) * aLeafSeed.y;
        float flutter = sin(uTime * 2.6 + aLeafSeed.x) * 1.35;
        float rawX = aLeafAnchor.x * uSpanXZ + (windDir.x * driftSpeed * uTime) + perpDir.x * flutter;
        float rawZ = aLeafAnchor.z * uSpanXZ + (windDir.y * driftSpeed * uTime) + perpDir.y * flutter;

        float wx = mod(rawX - uPlanetPivot.x + halfSpan, uSpanXZ) - halfSpan + uPlanetPivot.x;
        float wz = mod(rawZ - uPlanetPivot.z + halfSpan, uSpanXZ) - halfSpan + uPlanetPivot.z;
        float fallRate = 0.72 + aLeafSeed.y * 0.36;
        float wy = mod(aLeafAnchor.y - fallRate * uTime, uHeightY - 0.5) + 0.35;
        wy += sin(uTime * 3.1 + aLeafSeed.x * 1.3) * 0.24;

        // Tumble rotation in 3D
        float yaw = uTime * aLeafSeed.z + aLeafSeed.x;
        float pitch = sin(uTime * 2.3 + aLeafSeed.x) * 0.95;
        float cy = cos(yaw);
        float sy = sin(yaw);
        float cp = cos(pitch);
        float sp = sin(pitch);

        float scale = (0.8 + aLeafSeed.y * 0.45) * clamp(uLeafIntensity * 1.15, 0.0, 1.15);
        vec3 p = position * scale;
        // Pitch around X then yaw around Y
        vec3 pPitch = vec3(p.x, p.y * cp - p.z * sp, p.y * sp + p.z * cp);
        vec3 pRot = vec3(pPitch.x * cy - pPitch.z * sy, pPitch.y, pPitch.x * sy + pPitch.z * cy);

        vec3 worldPos = vec3(wx, wy, wz) + pRot;

        float distXZ = length(vec2(wx, wz) - uPlanetPivot.xz);
        float radialFade = 1.0 - smoothstep(halfSpan * 0.82, halfSpan * 0.99, distXZ);
        float vertFade = smoothstep(0.4, 1.15, wy) * (1.0 - smoothstep(uHeightY - 2.0, uHeightY, wy));
        vFade = radialFade * vertFade * uLeafIntensity;

        gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uLightColor;

      varying vec2 vUv;
      varying float vColorSeed;
      varying float vFade;

      void main() {
        // Tapered organic leaf / cherry-blossom petal silhouette in UV space
        vec2 p = (vUv - 0.5) * 2.0;
        float envY = max(0.0, 1.0 - abs(p.x) * 0.92);
        float shape = (p.y * p.y) / max(0.06, envY * envY * 0.72) + (p.x * p.x) * 0.95;
        if (shape > 1.0) discard;

        vec3 sakuraPink = mix(vec3(1.0, 0.55, 0.76), vec3(1.0, 0.78, 0.88), vUv.x);
        vec3 meadowGreen = mix(vec3(0.24, 0.74, 0.24), vec3(0.54, 0.88, 0.28), vUv.x);
        vec3 warmGold = mix(vec3(0.95, 0.74, 0.20), vec3(1.0, 0.88, 0.42), vUv.x);

        vec3 baseCol = vColorSeed < 0.48
          ? sakuraPink
          : vColorSeed < 0.86
            ? meadowGreen
            : warmGold;

        vec3 litCol = baseCol * mix(vec3(0.65), uLightColor, 0.72);
        float alpha = (1.0 - smoothstep(0.72, 1.0, shape)) * vFade * 0.92;
        if (alpha <= 0.01) discard;
        gl_FragColor = vec4(litCol, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, leafCount);
  leafMesh.name = 'WeatherWindLeavesInstanced';
  leafMesh.frustumCulled = false;
  leafMesh.renderOrder = 11;
  leafMesh.visible = false;
  initIdentityMatrices(leafMesh);
  rootGroup.add(leafMesh);

  // Runtime & reusable evaluated buffers (zero per-frame allocations)
  const runtimeState = createInitialRuntimeState(sharedWeatherControlConfig);
  if (initialPreset && initialQueryWeather.timeOfDayHours === undefined && initialQueryWeather.phase === undefined) {
    runtimeState.currentHours = TIME_PHASE_DEFAULT_HOURS[initialPreset];
    runtimeState.targetHours = TIME_PHASE_DEFAULT_HOURS[initialPreset];
    sharedWeatherControlConfig = {
      ...sharedWeatherControlConfig,
      phase: initialPreset,
      timeOfDayHours: TIME_PHASE_DEFAULT_HOURS[initialPreset],
    };
  }
  const evaluated = createReusableEvaluatedAtmosphereState();

  let cachedTerrainBaseline: TerrainBaselineColors | null | undefined = undefined;
  const resolveTerrainBaseline = (): TerrainBaselineColors | null => {
    if (cachedTerrainBaseline !== undefined) return cachedTerrainBaseline;
    const groundObj = scene.getObjectByName('CurvedPlanetGround') as THREE.Mesh | undefined;
    if (!groundObj || !(groundObj.material instanceof THREE.ShaderMaterial)) {
      return null;
    }
    const groundMat = groundObj.material;
    const groundDefaults: Record<string, THREE.Color> = {};
    for (const k of GROUND_COLOR_UNIFORM_KEYS) {
      const u = groundMat.uniforms?.[k];
      if (u?.value instanceof THREE.Color) {
        groundDefaults[k] = u.value.clone();
      }
    }
    const grassObj = scene.getObjectByName('InfiniteGrass') as THREE.Mesh | undefined;
    const grassMat =
      grassObj && grassObj.material instanceof THREE.ShaderMaterial ? grassObj.material : null;
    const grassDefaults: Record<string, THREE.Color> = {};
    if (grassMat) {
      for (const k of GRASS_COLOR_UNIFORM_KEYS) {
        const u = grassMat.uniforms?.[k];
        if (u?.value instanceof THREE.Color) {
          grassDefaults[k] = u.value.clone();
        }
      }
    }
    const waterMats: THREE.ShaderMaterial[] = [];
    for (const waterName of ['EastOceanWaterSurface', 'OasisLakeWaterSurface']) {
      const wObj = scene.getObjectByName(waterName) as THREE.Mesh | undefined;
      if (wObj && wObj.material instanceof THREE.ShaderMaterial && !waterMats.includes(wObj.material)) {
        waterMats.push(wObj.material);
      }
    }
    cachedTerrainBaseline = { groundMat, groundDefaults, grassMat, grassDefaults, waterMats };
    return cachedTerrainBaseline;
  };

  const _terrainTargetColor = new THREE.Color();
  const _fogTintTarget = new THREE.Color();

  // Ensure Linear THREE.Fog (never FogExp2) even before @env-horizon-optimizer runs
  if (scene.fog && !(scene.fog instanceof THREE.Fog)) {
    scene.fog = new THREE.Fog('#bae2ff', 105, 215);
  }
  const capturedBaseByMode = {
    gameplay: { near: 105, far: 215 },
    city_view: { near: 210, far: 360 },
  };
  let lastWrittenFogNear = Number.NaN;
  let lastWrittenFogFar = Number.NaN;

  const applyEvaluatedToScene = (
    state: EvaluatedAtmosphereState,
    opts: {
      windUniforms?: BlitzWindUniforms | null;
      isFlatIndoorRoomMode: boolean;
      isShowcaseMode: boolean;
      isFullMapOverview: boolean;
      isCityView: boolean;
      spanScale?: number;
      timeSec: number;
      pivotX: number;
      pivotZ: number;
    },
  ) => {
    // Always publish cross-system contract on scene.userData
    scene.userData.weatherEnvState = state.envState;
    SHARED_PBR_WOOD_LIGHTING_UNIFORM.uWoodFillScale.value = Math.max(
      0.08,
      (1.0 - state.envState.nightFactor01 * 0.9) * (1.0 - state.envState.rainFactor01 * 0.25),
    );

    // 1. Update GPU weather particles (adaptive span fills full camera viewport in gameplay & City View)
    const activeSpanScale = clampRange(opts.spanScale ?? (opts.isCityView ? 1.78 : 1.0), 1.0, 1.85);
    uRainSpanXZ.value = rainBaseSpanXZ * activeSpanScale;
    uSplashSpanXZ.value = splashBaseSpanXZ * activeSpanScale;
    uLeafSpanXZ.value = leafBaseSpanXZ * activeSpanScale;
    uWeatherTime.value = opts.timeSec;
    uWeatherPivot.value.set(opts.pivotX, 0, opts.pivotZ);
    uWeatherWindDir.value.set(state.envState.windDirectionX, state.envState.windDirectionZ);
    uWeatherWindStrength.value = state.envState.windStrength;
    uWeatherWindGust.value = state.envState.windGust;
    uRainIntensity.value = state.particles.rainIntensity01;
    uSplashIntensity.value = state.particles.splashIntensity01;
    uWetness.value = state.envState.wetness01;
    uLeafIntensity.value = state.particles.leafIntensity01;
    uRainColor.value.copy(state.particles.rainColor);
    uSplashColor.value.copy(state.particles.splashColor);
    uLeafLightColor.value.copy(state.lighting.windLightColor);

    const hideWeatherMeshes =
      opts.isFlatIndoorRoomMode || opts.isShowcaseMode || opts.isFullMapOverview;
    rootGroup.visible = !hideWeatherMeshes;
    rainMesh.visible = !hideWeatherMeshes && state.particles.rainIntensity01 > 0.015;
    splashMesh.visible = !hideWeatherMeshes && state.particles.splashIntensity01 > 0.015;
    leafMesh.visible = !hideWeatherMeshes && state.particles.leafIntensity01 > 0.02;

    if (opts.isShowcaseMode) {
      return;
    }

    // 2. Indoor fog isolation (linear THREE.Fog pushed safely past indoor geometry)
    if (opts.isFlatIndoorRoomMode) {
      if (scene.fog instanceof THREE.Fog) {
        scene.fog.near = 5000;
        scene.fog.far = 6000;
        lastWrittenFogNear = 5000;
        lastWrittenFogFar = 6000;
      }
      return;
    }

    // 3. Sky Dome, Horizon Cloud Ring & Twinkle Stars
    // AnimeSkyDome draws directly without colorspace_fragment, so align its horizon band & lower bounce
    // to the exact display sRGB equivalent of scene.fog.color to blend ocean horizon seamlessly across all times/weather.
    _fogDisplayColor.copy(state.fog.color).convertLinearToSRGB();
    animeSkyUniforms.uSunDir.value.copy(state.sky.sunDir);
    animeSkyUniforms.uZenithColor.value.copy(state.sky.zenithColor);
    animeSkyUniforms.uMidSkyColor.value.copy(state.sky.midSkyColor);
    animeSkyUniforms.uHorizonSkyColor.value.copy(_fogDisplayColor);
    animeSkyUniforms.uHorizonGlowColor.value.copy(_fogDisplayColor);
    animeSkyUniforms.uGroundBounceColor.value.copy(_fogDisplayColor);
    animeSkyUniforms.uSunColor.value.copy(state.sky.sunColor);
    animeSkyUniforms.uCloudLitColor.value.copy(state.sky.cloudLitColor);
    animeSkyUniforms.uCloudMidColor.value.copy(state.sky.cloudMidColor);
    animeSkyUniforms.uCloudShadowColor.value.copy(state.sky.cloudShadowColor);

    cloudPuffToonMat.color.copy(state.sky.cloudMatColor);
    cloudPuffToonMat.emissive.copy(state.sky.cloudEmissiveColor);
    animeSparkleMat.opacity = state.sky.starOpacity;
    animeSparkleMat.color.copy(state.sky.starColor);

    if (scene.background instanceof THREE.Color) {
      scene.background.copy(state.fog.color);
    } else {
      scene.background = state.fog.color.clone();
    }

    if (!opts.isFullMapOverview) {
      if (scene.fog && !(scene.fog instanceof THREE.Fog)) {
        scene.fog = new THREE.Fog(state.fog.color.getHex(), 105, 215);
      }
      if (scene.fog instanceof THREE.Fog) {
        const modeKey = opts.isCityView ? 'city_view' : 'gameplay';
        const modeBase = capturedBaseByMode[modeKey];
        if (
          scene.fog.near > 1 &&
          scene.fog.near < 2000 &&
          scene.fog.far > scene.fog.near &&
          (Math.abs(scene.fog.near - lastWrittenFogNear) > 0.25 ||
            Math.abs(scene.fog.far - lastWrittenFogFar) > 0.25)
        ) {
          modeBase.near = scene.fog.near;
          modeBase.far = scene.fog.far;
        }
        const linearFog = evaluateLinearFogParams({
          baseNear: modeBase.near,
          baseFar: modeBase.far,
          rainFactor01: state.envState.rainFactor01,
          fogFactor01: state.envState.fogFactor01,
          isCityView: opts.isCityView,
        });
        state.fog.near = linearFog.near;
        state.fog.far = linearFog.far;
        state.fog.hazeCompression01 = linearFog.hazeCompression01;
        scene.fog.color.copy(state.fog.color);
        scene.fog.near = linearFog.near;
        scene.fog.far = linearFog.far;
        lastWrittenFogNear = linearFog.near;
        lastWrittenFogFar = linearFog.far;
      }
    }

    // 4. Outdoor Three.js Lights
    dirLight.color.copy(state.lighting.dirColor);
    dirLight.intensity = state.lighting.dirIntensity;
    hemiLight.color.copy(state.lighting.hemiSkyColor);
    hemiLight.groundColor.copy(state.lighting.hemiGroundColor);
    hemiLight.intensity = state.lighting.hemiIntensity;

    // 5. Shared World/Wind Shader Uniforms
    if (opts.windUniforms) {
      opts.windUniforms.uLightColor.value.copy(state.lighting.windLightColor);
      opts.windUniforms.uLightDirection.value.copy(state.lighting.lightDir);
      opts.windUniforms.uWindStrength.value = state.envState.windStrength;
      opts.windUniforms.uWindGust.value = state.envState.windGust;
      opts.windUniforms.uWindDirection.value.set(
        state.envState.windDirectionX,
        state.envState.windDirectionZ,
      );
    }

    // 6. Terrain & Infinite Grass Palette Adaptation (Night / Dusk / Dawn / Fog / Wetness)
    const terrain = resolveTerrainBaseline();
    if (terrain) {
      _terrainTargetColor
        .copy(state.terrain.tintColor)
        .multiplyScalar(state.terrain.tintScale);
      _fogTintTarget.copy(state.fog.color);

      for (const k of GROUND_COLOR_UNIFORM_KEYS) {
        const base = terrain.groundDefaults[k];
        const target = terrain.groundMat.uniforms?.[k]?.value;
        if (base && target instanceof THREE.Color) {
          target.copy(base).multiply(_terrainTargetColor);
          if (state.terrain.fogDesat > 0.001) {
            target.lerp(_fogTintTarget, state.terrain.fogDesat);
          }
        }
      }
      if (terrain.grassMat) {
        for (const k of GRASS_COLOR_UNIFORM_KEYS) {
          const base = terrain.grassDefaults[k];
          const target = terrain.grassMat.uniforms?.[k]?.value;
          if (base && target instanceof THREE.Color) {
            target.copy(base).multiply(_terrainTargetColor);
            if (state.terrain.fogDesat > 0.001) {
              target.lerp(_fogTintTarget, state.terrain.fogDesat);
            }
          }
        }
      }

      // Sync shared water lighting, sky reflection, rain ripples & ground ambient tint
      const groundTintU = terrain.groundMat.uniforms?.uGroundLightTint?.value;
      if (groundTintU instanceof THREE.Color) {
        groundTintU.copy(_terrainTargetColor);
      }
      const syncWaterMatUniforms = (mat: THREE.ShaderMaterial) => {
        const u = mat.uniforms;
        if (!u) return;
        if (u.uSunDirection?.value instanceof THREE.Vector3) {
          u.uSunDirection.value.copy(state.sky.sunDir);
        }
        if (u.uSunColor?.value instanceof THREE.Color) {
          u.uSunColor.value.copy(state.sky.sunColor);
        }
        if (u.uSkyColor?.value instanceof THREE.Color) {
          u.uSkyColor.value
            .copy(state.sky.horizonSkyColor)
            .lerp(state.sky.midSkyColor, 0.42);
        }
        if (u.uFogColor?.value instanceof THREE.Color) {
          u.uFogColor.value.copy(state.fog.color);
        }
        if (u.uRainFactor && typeof u.uRainFactor.value === 'number') {
          u.uRainFactor.value = state.envState.rainFactor01;
        }
        if (u.uTimeOfDayNightFactor && typeof u.uTimeOfDayNightFactor.value === 'number') {
          u.uTimeOfDayNightFactor.value = state.envState.nightFactor01;
        }
        if (u.uDuskDawnFactor && typeof u.uDuskDawnFactor.value === 'number') {
          u.uDuskDawnFactor.value = state.envState.duskDawnFactor01;
        }
        if (u.uWindStrength && typeof u.uWindStrength.value === 'number') {
          u.uWindStrength.value = state.envState.windStrength;
        }
      };
      syncWaterMatUniforms(terrain.groundMat);
      for (let wi = 0; wi < terrain.waterMats.length; wi++) {
        syncWaterMatUniforms(terrain.waterMats[wi]);
      }
    }
  };

  let lastNotifiedPhase: LightingPresetKey = evaluated.envState.phase;
  let lastNotifiedHours = runtimeState.currentHours;
  let lastNotifyTimeSec = -10;

  const applyCurrentEvaluated = (windUniforms?: BlitzWindUniforms | null) => {
    evaluateWeatherAndTimeState(
      {
        timeOfDayHours: runtimeState.currentHours,
        weatherCondition: sharedWeatherControlConfig.weatherCondition,
        rainIntensityTier: sharedWeatherControlConfig.rainIntensityTier,
        autoCycleEnabled: sharedWeatherControlConfig.autoCycleEnabled,
        cityLightsScale: sharedWeatherControlConfig.cityLightsScale,
        rainFactor01: runtimeState.rainFactor01,
        fogFactor01: runtimeState.fogFactor01,
        windStrength: runtimeState.windStrength,
        overcast01: runtimeState.overcast01,
        wetness01: runtimeState.wetness01,
        petalDrift01: runtimeState.petalDrift01,
        windAngleRad: runtimeState.windAngleRad,
        timeSec: uWeatherTime.value,
      },
      evaluated,
    );
    applyEvaluatedToScene(evaluated, {
      windUniforms,
      isFlatIndoorRoomMode: false,
      isShowcaseMode: false,
      isFullMapOverview: false,
      isCityView: false,
      timeSec: uWeatherTime.value,
      pivotX: uWeatherPivot.value.x,
      pivotZ: uWeatherPivot.value.z,
    });
  };

  const setTimePhaseImmediate = (
    preset: LightingPresetKey,
    windUniforms?: BlitzWindUniforms | null,
  ) => {
    const targetHours = TIME_PHASE_DEFAULT_HOURS[preset] ?? TIME_PHASE_DEFAULT_HOURS.day;
    setWeatherControlConfig({
      phase: preset,
      timeOfDayHours: targetHours,
    });
    runtimeState.currentHours = targetHours;
    runtimeState.targetHours = targetHours;
    runtimeState.lastAppliedRevision = sharedWeatherControlConfig.configRevision;
    applyCurrentEvaluated(windUniforms);
  };

  const syncExternalPresetProp = (
    preset: LightingPresetKey,
    windUniforms?: BlitzWindUniforms | null,
  ) => {
    if (sharedWeatherControlConfig.phase !== preset) {
      setWeatherControlConfig({
        phase: preset,
        timeOfDayHours: TIME_PHASE_DEFAULT_HOURS[preset] ?? TIME_PHASE_DEFAULT_HOURS.day,
      });
      runtimeState.targetHours = sharedWeatherControlConfig.timeOfDayHours;
      runtimeState.lastAppliedRevision = sharedWeatherControlConfig.configRevision;
    }
    applyCurrentEvaluated(windUniforms);
  };

  // Initialize immediately so frame 0 has valid state & scene.userData.weatherEnvState
  stepWeatherRuntimeState(runtimeState, sharedWeatherControlConfig, 0, 0, true);
  evaluateWeatherAndTimeState(
    {
      timeOfDayHours: runtimeState.currentHours,
      weatherCondition: sharedWeatherControlConfig.weatherCondition,
      rainIntensityTier: sharedWeatherControlConfig.rainIntensityTier,
      autoCycleEnabled: sharedWeatherControlConfig.autoCycleEnabled,
      cityLightsScale: sharedWeatherControlConfig.cityLightsScale,
      rainFactor01: runtimeState.rainFactor01,
      fogFactor01: runtimeState.fogFactor01,
      windStrength: runtimeState.windStrength,
      overcast01: runtimeState.overcast01,
      wetness01: runtimeState.wetness01,
      petalDrift01: runtimeState.petalDrift01,
      windAngleRad: runtimeState.windAngleRad,
      timeSec: 0,
    },
    evaluated,
  );
  scene.userData.weatherEnvState = evaluated.envState;
  SHARED_PBR_WOOD_LIGHTING_UNIFORM.uWoodFillScale.value = Math.max(
    0.08,
    (1.0 - evaluated.envState.nightFactor01 * 0.9) * (1.0 - evaluated.envState.rainFactor01 * 0.25),
  );

  return {
    rootGroup,
    rainMesh,
    splashMesh,
    leafMesh,
    getWeatherEnvState: () => evaluated.envState,
    getDrawCallCounts: () => {
      const meshes = [rainMesh, splashMesh, leafMesh];
      return {
        totalInstancedMeshes: meshes.length,
        activeDrawCalls: rootGroup.visible ? meshes.filter((m) => m.visible).length : 0,
        pointLights: 0,
      };
    },
    setTimePhaseImmediate,
    syncExternalPresetProp,
    update: ({
      dt,
      timeSec,
      pivotX,
      pivotZ,
      windUniforms,
      isFlatIndoorRoomMode,
      isShowcaseMode,
      isFullMapOverview,
      isCityView = false,
      spanScale,
    }) => {
      const cfg = sharedWeatherControlConfig;
      stepWeatherRuntimeState(runtimeState, cfg, dt, timeSec, false);
      evaluateWeatherAndTimeState(
        {
          timeOfDayHours: runtimeState.currentHours,
          weatherCondition: cfg.weatherCondition,
          rainIntensityTier: cfg.rainIntensityTier,
          autoCycleEnabled: cfg.autoCycleEnabled,
          cityLightsScale: cfg.cityLightsScale,
          rainFactor01: runtimeState.rainFactor01,
          fogFactor01: runtimeState.fogFactor01,
          windStrength: runtimeState.windStrength,
          overcast01: runtimeState.overcast01,
          wetness01: runtimeState.wetness01,
          petalDrift01: runtimeState.petalDrift01,
          windAngleRad: runtimeState.windAngleRad,
          timeSec,
          isCityView,
        },
        evaluated,
      );
      applyEvaluatedToScene(evaluated, {
        windUniforms,
        isFlatIndoorRoomMode,
        isShowcaseMode,
        isFullMapOverview,
        isCityView,
        spanScale,
        timeSec,
        pivotX,
        pivotZ,
      });

      // Notify UI subscribers throttled (~5 Hz or on phase shift) when auto-cycle advances
      if (
        cfg.autoCycleEnabled &&
        displayListeners.size > 0 &&
        (evaluated.envState.phase !== lastNotifiedPhase ||
          (Math.abs(shortestHoursDelta24(lastNotifiedHours, runtimeState.currentHours)) >= 0.05 &&
            timeSec - lastNotifyTimeSec >= 0.2))
      ) {
        lastNotifiedPhase = evaluated.envState.phase;
        lastNotifiedHours = runtimeState.currentHours;
        lastNotifyTimeSec = timeSec;
        sharedWeatherControlConfig = {
          ...sharedWeatherControlConfig,
          timeOfDayHours: runtimeState.currentHours,
          phase: evaluated.envState.phase,
        };
        displayListeners.forEach((cb) => cb(evaluated.envState));
      }

      return evaluated.envState;
    },
    dispose: () => {
      scene.remove(rootGroup);
      rainGeo.dispose();
      rainMat.dispose();
      splashGeo.dispose();
      splashMat.dispose();
      leafGeo.dispose();
      leafMat.dispose();
      if (scene.userData.weatherEnvState === evaluated.envState) {
        delete scene.userData.weatherEnvState;
      }
    },
  };
}
