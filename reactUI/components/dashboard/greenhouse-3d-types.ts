import type { AssetModelVariant } from '@/lib/asset-type'

export interface GreenhouseAsset {
  _id: string
  name: string
  type?: string
  createdAt?: string
}

export interface GreenhouseDeviceAttributes {
  safe_min_soil_humidity?: number
  safe_max_soil_humidity?: number
  safe_min_water_level?: number
  safe_max_water_level?: number
}

export interface GreenhouseDevice {
  _id: string
  name: string
  type?: string
  assetId?: string | { _id: string } | null
  online?: boolean
  lastSeenAt?: string
  attributes?: GreenhouseDeviceAttributes | null
}

export interface RawTelemetry {
  temperature?: number | string | null
  humidity?: number | string | null
  soil_humidity?: number | string | null
  water_level?: number | string | null
  timestamp?: string | null
}

export interface GreenhouseTelemetry {
  temperature: number | null
  humidity: number | null
  soil_humidity: number | null
  water_level: number | null
  timestamp: string | null
}

export interface DeviceDetail extends GreenhouseDevice {
  latestTelemetry?: RawTelemetry | null
}

export interface Thresholds {
  soilMin: number
  soilMax: number
  waterMin: number
  waterMax: number
}

export type SoilHealth = 'unknown' | 'dry' | 'healthy' | 'wet'

export const TREE_GLTF_PATH = '/model/low_poly_trees.glb'

// GLTFLoader sanitizes Sketchfab node names: "Plane.007" becomes "Plane007".
export const TREE_GROUP_NAME = 'Plane007'

export const POLL_INTERVAL_MS = 5_000

export const DEFAULT_CAMERA_POSITION: [number, number, number] = [3.8, 3, 5.6]
export const DEFAULT_CAMERA_TARGET: [number, number, number] = [0, 1, 0]

export const GROUND_Y = 0.12
export const GROUND_GRID_SIZE = 20
export const GROUND_GRID_DIVISIONS = 40
export const POTTED_SOIL_Y = 0.6
export const GROUND_SOIL_Y = 0.28
export const TREE_HEIGHT_POTTED = 1.7
export const TREE_HEIGHT_GROUND = 1.75

export const DEFAULT_THRESHOLDS: Thresholds = {
  soilMin: 30,
  soilMax: 70,
  waterMin: 20,
  waterMax: 95,
}

export const SCENE_COLORS = {
  leafHealthy: '#4f9d69',
  leafDry: '#b18a43',
  leafWet: '#3f855f',
  leafUnknown: '#5b9b71',
  trunk: '#8b5e3c',
  pot: '#c47a58',
  potRim: '#ad6548',
  saucer: '#b96b4d',
  soilHealthy: '#5b3a29',
  soilDry: '#75503a',
  soilWet: '#3f2a1f',
  grass: '#6ba77c',
  stone: '#9aa89d',
  valveBody: '#2f6f5e',
  valveHandle: '#e0a458',
  pipe: '#94a3a8',
  water: '#7dd3fc',
  nodeOnline: '#10b981',
  nodeOffline: '#ef4444',
  nodeWarning: '#f59e0b',
  nodeSelected: '#0f766e',
} as const

export function soilTopForVariant(variant: AssetModelVariant): number {
  return variant === 'potted' ? POTTED_SOIL_Y : GROUND_SOIL_Y
}

export function treeHeightForVariant(variant: AssetModelVariant): number {
  return variant === 'potted' ? TREE_HEIGHT_POTTED : TREE_HEIGHT_GROUND
}

export function getDeviceAssetId(
  device: Pick<GreenhouseDevice, 'assetId'>,
): string | null {
  const value = device.assetId
  if (!value) return null
  return typeof value === 'string' ? value : value._id
}

export function getThresholds(
  device?: GreenhouseDevice | null,
): Thresholds {
  const attributes = device?.attributes

  return {
    soilMin: finiteNumber(attributes?.safe_min_soil_humidity) ?? DEFAULT_THRESHOLDS.soilMin,
    soilMax: finiteNumber(attributes?.safe_max_soil_humidity) ?? DEFAULT_THRESHOLDS.soilMax,
    waterMin: finiteNumber(attributes?.safe_min_water_level) ?? DEFAULT_THRESHOLDS.waterMin,
    waterMax: finiteNumber(attributes?.safe_max_water_level) ?? DEFAULT_THRESHOLDS.waterMax,
  }
}

export function getSoilHealth(
  soilHumidity: number | null,
  thresholds: Thresholds,
): SoilHealth {
  if (soilHumidity === null) return 'unknown'

  const min = Math.min(thresholds.soilMin, thresholds.soilMax)
  const max = Math.max(thresholds.soilMin, thresholds.soilMax)

  if (soilHumidity < min) return 'dry'
  if (soilHumidity > max) return 'wet'
  return 'healthy'
}

export function isWaterLow(
  waterLevel: number | null,
  thresholds: Thresholds,
): boolean {
  if (waterLevel === null) return false
  return waterLevel < Math.min(thresholds.waterMin, thresholds.waterMax)
}

export function normalizeTelemetry(
  raw?: RawTelemetry | null,
): GreenhouseTelemetry | null {
  if (!raw) return null

  return {
    temperature: finiteNumber(raw.temperature),
    humidity: finiteNumber(raw.humidity),
    soil_humidity: finiteNumber(raw.soil_humidity),
    water_level: finiteNumber(raw.water_level),
    timestamp: raw.timestamp ?? null,
  }
}

export function formatMetric(
  value: number | null,
  unit: string,
  digits = 0,
): string {
  if (value === null) return '--'
  const formatted = digits > 0
    ? value.toFixed(digits)
    : String(Math.round(value))
  return `${formatted}${unit}`
}

export function formatElapsed(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  if (hours > 0) {
    return [hours, minutes, seconds]
      .map((part) => String(part).padStart(2, '0'))
      .join(':')
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatTimestamp(value?: string | null): string {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleString('vi-VN')
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}
