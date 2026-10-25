import type {
  GreenhouseAsset,
  StationLayout,
} from './greenhouse-3d-types'

export const STATION_SNAP = 0.5
export const STATION_MIN_DISTANCE = 2.4
export const STATION_BOUND = 8.5
export const STATION_SPACING_X = 3
export const STATION_SPACING_Z = 3

export function isStationLayout(value: unknown): value is StationLayout {
  if (!value || typeof value !== 'object') return false

  const { x, z } = value as Partial<StationLayout>
  return (
    typeof x === 'number' &&
    typeof z === 'number' &&
    Number.isFinite(x) &&
    Number.isFinite(z) &&
    Math.abs(x) <= STATION_BOUND &&
    Math.abs(z) <= STATION_BOUND
  )
}

export function snapStationPosition(x: number, z: number): StationLayout {
  return {
    x: clamp(
      Math.round(x / STATION_SNAP) * STATION_SNAP,
      -STATION_BOUND,
      STATION_BOUND,
    ),
    z: clamp(
      Math.round(z / STATION_SNAP) * STATION_SNAP,
      -STATION_BOUND,
      STATION_BOUND,
    ),
  }
}

export function stationDistance(
  left: StationLayout,
  right: StationLayout,
): number {
  return Math.hypot(left.x - right.x, left.z - right.z)
}

export function collidesWithStations(
  assetId: string,
  position: StationLayout,
  layout: Record<string, StationLayout>,
): boolean {
  return Object.entries(layout).some(
    ([id, other]) =>
      id !== assetId &&
      stationDistance(position, other) < STATION_MIN_DISTANCE,
  )
}

export function buildAutoLayout(
  assets: GreenhouseAsset[],
): Record<string, StationLayout> {
  if (assets.length === 0) return {}

  const columns =
    assets.length <= 3
      ? assets.length
      : Math.ceil(Math.sqrt(assets.length))
  const rows = Math.ceil(assets.length / columns)
  const layout: Record<string, StationLayout> = {}

  assets.forEach((asset, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    layout[asset._id] = {
      x: (column - (columns - 1) / 2) * STATION_SPACING_X,
      z: (row - (rows - 1) / 2) * STATION_SPACING_Z,
    }
  })

  return layout
}

/**
 * Keep positions already present in local state, then fill new assets from
 * their saved DB layout or the first free auto-layout slot.
 */
export function reconcileLayout(
  assets: GreenhouseAsset[],
  previous: Record<string, StationLayout>,
): Record<string, StationLayout> {
  const autoLayout = buildAutoLayout(assets)
  const next: Record<string, StationLayout> = {}
  const used: StationLayout[] = []

  for (const asset of assets) {
    const stored = isStationLayout(previous[asset._id])
      ? previous[asset._id]
      : isStationLayout(asset.layout)
        ? asset.layout
        : null

    if (stored) {
      next[asset._id] = stored
      used.push(stored)
      continue
    }

    const auto = autoLayout[asset._id] ?? { x: 0, z: 0 }
    const candidate = used.every(
      (position) =>
        stationDistance(position, auto) >= STATION_MIN_DISTANCE,
    )
      ? auto
      : findFreeSlot(used)

    next[asset._id] = candidate
    used.push(candidate)
  }

  return next
}

function findFreeSlot(used: StationLayout[]): StationLayout {
  for (
    let z = -STATION_BOUND;
    z <= STATION_BOUND;
    z += STATION_SPACING_Z
  ) {
    for (
      let x = -STATION_BOUND;
      x <= STATION_BOUND;
      x += STATION_SPACING_X
    ) {
      const candidate = { x, z }
      if (
        used.every(
          (position) =>
            stationDistance(position, candidate) >= STATION_MIN_DISTANCE,
        )
      ) {
        return candidate
      }
    }
  }

  return { x: 0, z: 0 }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
