export type AssetModelVariant = 'potted' | 'ground'

export const ASSET_TYPE_OPTIONS: ReadonlyArray<{
  value: AssetModelVariant
  label: string
}> = [
  { value: 'potted', label: 'Có chậu' },
  { value: 'ground', label: 'Không chậu / Trồng đất' },
]

export const ASSET_TYPE_LABELS: Record<AssetModelVariant, string> = {
  potted: 'Có chậu',
  ground: 'Không chậu',
}

const GROUND_HINTS = [
  'ground',
  'unpotted',
  'without-pot',
  'no-pot',
  'khong chau',
  'không chậu',
  'dat',
  'đất',
  'garden',
  'bed',
]

/**
 * Assets in the current database can contain free text. Keep the 3D scene
 * stable by mapping known "ground" values to the unpotted variant and treating
 * everything else (including the legacy "plant" value) as potted.
 */
export function resolveAssetVariant(value: unknown): AssetModelVariant {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()

  if (!normalized) return 'potted'
  if (GROUND_HINTS.some((hint) => normalized.includes(hint))) return 'ground'
  return 'potted'
}

export function assetTypeLabel(value: unknown): string {
  return ASSET_TYPE_LABELS[resolveAssetVariant(value)]
}
