'use client'

import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  Check,
  LoaderCircle,
  Move,
  RotateCcw,
  Sprout,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
import {
  resolveAssetVariant,
  type AssetModelVariant,
} from '@/lib/asset-type'
import { cn } from '@/lib/utils'
import { Greenhouse3DFallback } from './greenhouse-3d-fallback'
import { GreenhousePanel } from './greenhouse-3d-panel'
import { GreenhouseScene } from './greenhouse-scene'
import {
  getDeviceAssetId,
  getSoilHealth,
  getThresholds,
  isWaterLow,
  type GreenhouseAsset,
  type GreenhouseDevice,
  type GreenhouseStation,
  type GreenhouseTelemetry,
  type StationLayout,
} from './greenhouse-3d-types'
import { reconcileLayout } from './greenhouse-layout'

export interface Greenhouse3DProps {
  assets: GreenhouseAsset[]
  devices: GreenhouseDevice[]
  telemetryByDevice: Record<string, GreenhouseTelemetry>
  pumpStatesByDevice: Record<string, boolean>
  onLayoutSaved?: (assetId: string, layout: StationLayout) => void
}

export default function Greenhouse3D({
  assets,
  devices,
  telemetryByDevice,
  pumpStatesByDevice,
  onLayoutSaved,
}: Greenhouse3DProps) {
  const [layout, setLayout] = useState<Record<string, StationLayout>>(
    () => reconcileLayout(assets, {}),
  )
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [resetSignal, setResetSignal] = useState(0)
  const [sceneVisible, setSceneVisible] = useState(true)
  const [pageVisible, setPageVisible] = useState(true)
  const [savingAssetId, setSavingAssetId] = useState<string | null>(null)
  const [layoutMessage, setLayoutMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const reducedMotion = useReducedMotion()
  const webglSupported = useWebGLSupport()
  const isMobile = useIsMobile()
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const paused = !sceneVisible || !pageVisible

  useEffect(() => {
    setLayout((previous) => reconcileLayout(assets, previous))
  }, [assets])

  useEffect(() => {
    setSelectedAssetId((current) => {
      if (current && assets.some((asset) => asset._id === current)) {
        return current
      }
      return assets[0]?._id ?? null
    })
  }, [assets])

  useEffect(() => {
    if (!selectedDeviceId) return

    const device = devices.find((item) => item._id === selectedDeviceId)
    if (!device || getDeviceAssetId(device) !== selectedAssetId) {
      setSelectedDeviceId(null)
    }
  }, [devices, selectedAssetId, selectedDeviceId])

  useEffect(() => {
    if (isMobile) setEditMode(false)
  }, [isMobile])

  useEffect(() => {
    if (!layoutMessage) return

    const timeout = window.setTimeout(() => setLayoutMessage(null), 4500)
    return () => window.clearTimeout(timeout)
  }, [layoutMessage])

  useEffect(() => {
    const update = () =>
      setPageVisible(document.visibilityState === 'visible')

    update()
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  useEffect(() => {
    const node = canvasContainerRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      ([entry]) => setSceneVisible(entry.isIntersecting),
      { threshold: 0.01 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const stations = useMemo<GreenhouseStation[]>(() => {
    return assets.map((asset) => {
      const assetDevices = devices
        .filter((device) => getDeviceAssetId(device) === asset._id)
        .sort((left, right) =>
          (left.name || left._id).localeCompare(
            right.name || right._id,
            'vi',
          ),
        )
      const primaryDevice =
        assetDevices.find((device) => telemetryByDevice[device._id]) ??
        assetDevices[0] ??
        null
      const primaryTelemetry = primaryDevice
        ? telemetryByDevice[primaryDevice._id] ?? null
        : null
      const thresholds = getThresholds(primaryDevice)
      const soilHealth = getSoilHealth(
        primaryTelemetry?.soil_humidity ?? null,
        thresholds,
      )
      const waterLow = isWaterLow(
        primaryTelemetry?.water_level ?? null,
        thresholds,
      )

      return {
        asset,
        devices: assetDevices,
        telemetryByDevice,
        primaryDevice,
        primaryTelemetry,
        thresholds,
        soilHealth,
        waterLow,
        pumpOn: assetDevices.some((device) =>
          Boolean(pumpStatesByDevice[device._id]),
        ),
        online: assetDevices.some((device) => device.online),
        position: layout[asset._id] ?? { x: 0, z: 0 },
      }
    })
  }, [assets, devices, layout, pumpStatesByDevice, telemetryByDevice])

  const selectedStation =
    stations.find((station) => station.asset._id === selectedAssetId) ??
    null
  const selectedDevice =
    stations
      .flatMap((station) => station.devices)
      .find((device) => device._id === selectedDeviceId) ?? null
  const onlineAssets = stations.filter((station) => station.online).length
  const totalNodeCount = stations.reduce(
    (total, station) => total + station.devices.length,
    0,
  )
  const fallbackVariant: AssetModelVariant = stations[0]
    ? resolveAssetVariant(stations[0].asset.type)
    : 'potted'

  const handleSelectAsset = (assetId: string | null) => {
    setSelectedAssetId(assetId)
    setSelectedDeviceId(null)
  }

  const handleSelectDevice = (deviceId: string) => {
    const device = devices.find((item) => item._id === deviceId)
    if (!device) return

    setSelectedDeviceId(deviceId)
    const assetId = getDeviceAssetId(device)
    if (assetId) setSelectedAssetId(assetId)
  }

  const handleToggleEdit = () => {
    if (isMobile) return

    const next = !editMode
    setEditMode(next)
    if (next && !selectedAssetId && assets[0]) {
      setSelectedAssetId(assets[0]._id)
    }
    if (!next) setLayoutMessage(null)
  }

  const handleMoveStation = async (
    assetId: string,
    position: StationLayout,
  ) => {
    const previous = layout[assetId]
    setLayout((current) => ({ ...current, [assetId]: position }))
    setSavingAssetId(assetId)
    setLayoutMessage(null)

    try {
      const updated = await apiRequest<GreenhouseAsset>(
        `/api/assets/${encodeURIComponent(assetId)}/layout`,
        {
          method: 'PUT',
          body: JSON.stringify(position),
        },
      )
      onLayoutSaved?.(assetId, updated.layout ?? position)
      setLayoutMessage({
        type: 'success',
        text: `Đã lưu vị trí ${updated.name || 'cây'}.`,
      })
    } catch (error) {
      setLayout((current) => {
        const next = { ...current }
        if (previous) next[assetId] = previous
        else delete next[assetId]
        return next
      })
      setLayoutMessage({
        type: 'error',
        text: layoutErrorMessage(error),
      })
    } finally {
      setSavingAssetId(null)
    }
  }

  if (assets.length === 0) {
    return (
      <Card className="mb-8 overflow-hidden border-emerald-100/90 bg-white/95 shadow-xs">
        <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-2 p-6 text-center">
          <Sprout className="size-8 text-emerald-600" />
          <p className="text-sm font-semibold text-slate-900">
            Chưa có cây để hiển thị 3D
          </p>
          <p className="max-w-sm text-xs leading-relaxed text-slate-500">
            Thêm cây hoặc khu vườn trong mục “Quản lý khu vườn” để xem mô
            hình và telemetry của tất cả cảm biến.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mb-8 overflow-hidden border-emerald-100/90 bg-white/95 shadow-xs">
      <CardHeader className="border-b border-emerald-100/70 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-700">
              02 / Mô hình 3D trực quan
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base text-slate-900">
                Tất cả cây trong vườn
              </CardTitle>
              <Badge
                variant="outline"
                className="border-emerald-300 bg-emerald-50 font-normal text-emerald-800"
              >
                {assets.length} cây
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  'font-normal',
                  onlineAssets > 0
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-red-200 bg-red-50 text-red-700',
                )}
              >
                {onlineAssets}/{assets.length} online
              </Badge>
              {savingAssetId && (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500">
                  <LoaderCircle className="size-3 animate-spin" />
                  Đang lưu vị trí...
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={editMode ? 'secondary' : 'outline'}
              size="sm"
              className={cn(
                'hidden h-8 gap-1.5 border-slate-300 text-xs lg:inline-flex',
                editMode && 'border-cyan-300 bg-cyan-50 text-cyan-900',
              )}
              onClick={handleToggleEdit}
              aria-pressed={editMode}
            >
              {editMode ? (
                <Check className="size-3.5" />
              ) : (
                <Move className="size-3.5" />
              )}
              {editMode ? 'Xong' : 'Sắp xếp'}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 border-slate-300 p-0 text-slate-700"
              onClick={() => setResetSignal((current) => current + 1)}
              aria-label="Fit camera toàn bộ khu vườn"
              title="Fit camera toàn bộ khu vườn"
            >
              <RotateCcw className="size-3.5" />
            </Button>
          </div>
        </div>

        {layoutMessage && (
          <div
            className={cn(
              'mt-3 rounded-lg border px-2.5 py-2 text-[10px]',
              layoutMessage.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-700',
            )}
          >
            {layoutMessage.text}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-3 sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <div
            ref={canvasContainerRef}
            className="relative h-[340px] overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/90 via-white to-cyan-50/70 sm:h-[420px] xl:h-[460px]"
          >
            {webglSupported === null ? (
              <SceneLoading />
            ) : webglSupported ? (
              <SceneErrorBoundary
                fallback={
                  <Greenhouse3DFallback
                    variant={fallbackVariant}
                    nodeCount={totalNodeCount}
                    treeCount={assets.length}
                    message="Không tải được mô hình 3D. Dữ liệu telemetry vẫn hiển thị đầy đủ ở panel bên cạnh."
                  />
                }
              >
                <GreenhouseScene
                  stations={stations}
                  layout={layout}
                  selectedAssetId={selectedAssetId}
                  selectedDeviceId={selectedDeviceId}
                  editMode={editMode}
                  isMobile={isMobile}
                  paused={paused}
                  resetSignal={resetSignal}
                  reducedMotion={reducedMotion}
                  onSelectAsset={handleSelectAsset}
                  onSelectDevice={handleSelectDevice}
                  onMoveStation={handleMoveStation}
                  onLayoutError={(message) =>
                    setLayoutMessage({ type: 'error', text: message })
                  }
                />
              </SceneErrorBoundary>
            ) : (
              <Greenhouse3DFallback
                variant={fallbackVariant}
                nodeCount={totalNodeCount}
                treeCount={assets.length}
              />
            )}

            <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/70 bg-white/85 px-2.5 py-1 text-[10px] font-semibold text-slate-700 shadow-sm">
              <span
                className={cn(
                  'inline-block size-1.5 rounded-full',
                  onlineAssets > 0 ? 'bg-emerald-500' : 'bg-red-500',
                  onlineAssets > 0 &&
                    !reducedMotion &&
                    'motion-safe:animate-pulse',
                )}
              />
              {onlineAssets > 0 ? 'LIVE' : 'OFFLINE'} · {assets.length} cây
            </div>

            <div className="pointer-events-none absolute left-1/2 top-3 max-w-[46%] -translate-x-1/2 truncate rounded-full border border-white/70 bg-white/85 px-2.5 py-1 text-[10px] font-semibold text-slate-700 shadow-sm">
              {editMode
                ? `Đang sắp xếp: ${
                    selectedStation?.asset.name ?? 'chọn một cây'
                  } · click điểm đích`
                : selectedStation?.asset.name ?? 'Khu vườn 3D'}
            </div>

            <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 text-[10px] text-slate-500">
              <span className="rounded-full bg-white/85 px-2.5 py-1 shadow-sm">
                {editMode
                  ? 'Chọn cây, sau đó click điểm đích trên mặt đất'
                  : 'Kéo để xoay · Cuộn để zoom'}
              </span>
              <span className="hidden rounded-full bg-white/85 px-2.5 py-1 shadow-sm sm:inline">
                {editMode
                  ? 'Snap 0.5 m · Chống chồng lấn · 30 FPS'
                  : 'Click node để xem telemetry'}
              </span>
            </div>
          </div>

          <GreenhousePanel
            stations={stations}
            selectedAssetId={selectedAssetId}
            selectedDeviceId={selectedDeviceId}
            pumpStatesByDevice={pumpStatesByDevice}
            editMode={editMode}
            onSelectAsset={handleSelectAsset}
            onSelectDevice={handleSelectDevice}
          />
        </div>

        <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
          Mô hình cây: “Low Poly Trees” by{' '}
          <a
            href="https://sketchfab.com/3d-models/low-poly-trees-2e70c34af8994852acd4b9ffce596336"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-emerald-700 underline-offset-2 hover:underline"
          >
            reymarch
          </a>
          , CC BY 4.0 — đã chỉnh sửa (tách cây, đổi màu và thêm chậu).
        </p>
      </CardContent>
    </Card>
  )
}

function SceneLoading() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
      <LoaderCircle className="size-6 animate-spin text-emerald-600" />
      <p className="text-[11px] font-medium">Đang tải mô hình 3D...</p>
    </div>
  )
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)

    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return reduced
}

function useWebGLSupport(): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(null)

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas')
      const context =
        canvas.getContext('webgl2') ?? canvas.getContext('webgl')

      if (!context) {
        setSupported(false)
        return
      }

      setSupported(true)
      const loseContext = (
        context as WebGLRenderingContext
      ).getExtension('WEBGL_lose_context')
      loseContext?.loseContext()
    } catch {
      setSupported(false)
    }
  }, [])

  return supported
}

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)')
    const update = () => setIsMobile(media.matches)

    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return isMobile
}

function layoutErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ''

  if (
    !message ||
    /internal server error|failed to fetch|networkerror|load failed/i.test(
      message,
    )
  ) {
    return 'Không lưu được vị trí. Kiểm tra backend rồi thử lại.'
  }

  return message
}

class SceneErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('3D scene error:', error)
    }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}
