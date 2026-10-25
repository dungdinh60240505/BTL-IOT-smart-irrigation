'use client'

import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  ArrowLeft,
  ChevronRight,
  Cpu,
  Droplets,
  Info,
  LoaderCircle,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Sprout,
  Thermometer,
  Waves,
  Wind,
  WifiOff,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
import {
  ASSET_TYPE_LABELS,
  resolveAssetVariant,
  type AssetModelVariant,
} from '@/lib/asset-type'
import { cn } from '@/lib/utils'
import { Greenhouse3DFallback } from './greenhouse-3d-fallback'
import { GreenhouseScene } from './greenhouse-scene'
import {
  POLL_INTERVAL_MS,
  formatDateTime,
  formatElapsed,
  formatMetric,
  formatTimestamp,
  getDeviceAssetId,
  getSoilHealth,
  getThresholds,
  isWaterLow,
  normalizeTelemetry,
  type DeviceDetail,
  type GreenhouseAsset,
  type GreenhouseDevice,
  type GreenhouseTelemetry,
  type SoilHealth,
  type Thresholds,
} from './greenhouse-3d-types'

export interface Greenhouse3DProps {
  asset: GreenhouseAsset | null
  devices: GreenhouseDevice[]
  pumpOn: boolean
  waitingForTelemetry: boolean
  elapsedSeconds: number
}

type PanelFocus = 'asset' | 'device'

export default function Greenhouse3D({
  asset,
  devices,
  pumpOn,
  waitingForTelemetry,
  elapsedSeconds,
}: Greenhouse3DProps) {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [focus, setFocus] = useState<PanelFocus>('asset')
  const [autoRotate, setAutoRotate] = useState(false)
  const [resetSignal, setResetSignal] = useState(0)
  const reducedMotion = useReducedMotion()
  const webglSupported = useWebGLSupport()

  const variant = asset ? resolveAssetVariant(asset.type) : 'potted'
  const assetDevices = useMemo(() => {
    if (!asset) return []

    return devices
      .filter((device) => getDeviceAssetId(device) === asset._id)
      .sort((left, right) =>
        (left.name || left._id).localeCompare(right.name || right._id, 'vi'),
      )
  }, [asset, devices])

  const selectedDevice = useMemo(
    () => assetDevices.find((device) => device._id === selectedDeviceId) ?? null,
    [assetDevices, selectedDeviceId],
  )
  const thresholds = useMemo(
    () => getThresholds(selectedDevice ?? assetDevices[0]),
    [assetDevices, selectedDevice],
  )
  const { telemetry, loading, error, refresh } = useDeviceTelemetry(selectedDeviceId)

  const previousAssetIdRef = useRef<string | null>(null)
  const hadDevicesRef = useRef(false)

  useEffect(() => {
    const firstDevice = assetDevices[0]
    const assetChanged = previousAssetIdRef.current !== (asset?._id ?? null)

    if (assetChanged) {
      previousAssetIdRef.current = asset?._id ?? null
      setSelectedDeviceId(firstDevice?._id ?? null)
      setFocus(firstDevice ? 'device' : 'asset')
      return
    }

    setSelectedDeviceId((current) => {
      if (current && assetDevices.some((device) => device._id === current)) {
        return current
      }
      return firstDevice?._id ?? null
    })

    if (assetDevices.length === 0) setFocus('asset')
  }, [asset?._id, assetDevices])

  useEffect(() => {
    if (assetDevices.length > 0 && !hadDevicesRef.current) {
      hadDevicesRef.current = true
      setFocus('device')
    }
    if (assetDevices.length === 0) hadDevicesRef.current = false
  }, [assetDevices.length])

  const handleSelectDevice = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId)
    setFocus('device')
  }, [])

  const handleSelectAsset = useCallback(() => {
    setFocus('asset')
  }, [])

  const soilHealth = getSoilHealth(telemetry?.soil_humidity ?? null, thresholds)
  const waterLow = isWaterLow(telemetry?.water_level ?? null, thresholds)
  const onlineCount = assetDevices.filter((device) => device.online).length
  const sceneOnline = onlineCount > 0

  if (!asset) {
    return (
      <Card className="mb-8 overflow-hidden border-emerald-100/90 bg-white/95 shadow-xs">
        <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-2 p-6 text-center">
          <Sprout className="size-8 text-emerald-600" />
          <p className="text-sm font-semibold text-slate-900">
            Chưa có cây để hiển thị 3D
          </p>
          <p className="max-w-sm text-xs leading-relaxed text-slate-500">
            Thêm cây hoặc khu vườn trong mục “Quản lý khu vườn” để xem mô hình
            và telemetry của cảm biến.
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
                Cây đang theo dõi
              </CardTitle>
              <Badge
                variant="outline"
                className="max-w-[220px] truncate border-emerald-300 bg-emerald-50 font-normal text-emerald-800"
              >
                {asset.name}
              </Badge>
              <Badge
                variant="outline"
                className="border-slate-300 bg-slate-50 font-normal text-slate-600"
              >
                {ASSET_TYPE_LABELS[variant]}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                'font-normal',
                onlineCount > 0
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-700',
              )}
            >
              <span
                className={cn(
                  'inline-block size-1.5 rounded-full',
                  onlineCount > 0 ? 'bg-emerald-500' : 'bg-red-500',
                )}
              />
              {assetDevices.length === 0
                ? 'Chưa gán cảm biến'
                : `${onlineCount}/${assetDevices.length} online`}
            </Badge>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-slate-300 text-xs text-slate-700"
              onClick={() => setAutoRotate((current) => !current)}
              aria-pressed={autoRotate}
            >
              {autoRotate ? (
                <Pause className="size-3.5" />
              ) : (
                <Play className="size-3.5" />
              )}
              Tự xoay
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 border-slate-300 p-0 text-slate-700"
              onClick={() => setResetSignal((current) => current + 1)}
              aria-label="Đưa camera về góc mặc định"
              title="Đưa camera về góc mặc định"
            >
              <RotateCcw className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
          <div className="relative h-[320px] overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/90 via-white to-cyan-50/70 sm:h-[380px] xl:h-[460px]">
            {webglSupported === null ? (
              <SceneLoading />
            ) : webglSupported ? (
              <SceneErrorBoundary
                fallback={
                  <Greenhouse3DFallback
                    variant={variant}
                    nodeCount={assetDevices.length}
                    message="Không tải được mô hình 3D. Dữ liệu telemetry vẫn hiển thị đầy đủ ở panel bên cạnh."
                  />
                }
              >
                <GreenhouseScene
                  variant={variant}
                  devices={assetDevices}
                  selectedDeviceId={
                    focus === 'device' ? selectedDeviceId : null
                  }
                  telemetry={telemetry}
                  soilHealth={soilHealth}
                  waterLow={waterLow}
                  pumpOn={pumpOn}
                  waitingForTelemetry={waitingForTelemetry}
                  autoRotate={autoRotate}
                  resetSignal={resetSignal}
                  reducedMotion={reducedMotion}
                  onSelectDevice={handleSelectDevice}
                  onSelectAsset={handleSelectAsset}
                />
              </SceneErrorBoundary>
            ) : (
              <Greenhouse3DFallback
                variant={variant}
                nodeCount={assetDevices.length}
              />
            )}

            <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/70 bg-white/85 px-2.5 py-1 text-[10px] font-semibold text-slate-700 shadow-sm backdrop-blur">
              <span
                className={cn(
                  'inline-block size-1.5 rounded-full',
                  sceneOnline ? 'bg-emerald-500' : 'bg-red-500',
                  sceneOnline &&
                    !reducedMotion &&
                    'motion-safe:animate-pulse',
                )}
              />
              {assetDevices.length === 0
                ? 'NO SENSOR'
                : sceneOnline
                  ? 'LIVE'
                  : 'OFFLINE'}
            </div>

            <div className="pointer-events-none absolute left-1/2 top-3 max-w-[46%] -translate-x-1/2 truncate rounded-full border border-white/70 bg-white/85 px-2.5 py-1 text-[10px] font-semibold text-slate-700 shadow-sm backdrop-blur">
              {asset.name}
            </div>

            <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 text-[10px] text-slate-500">
              <span className="rounded-full bg-white/85 px-2.5 py-1 shadow-sm backdrop-blur">
                Kéo để xoay · Cuộn để zoom
              </span>
              <span className="hidden rounded-full bg-white/85 px-2.5 py-1 shadow-sm backdrop-blur sm:inline">
                Click node để xem telemetry
              </span>
            </div>
          </div>

          <InfoPanel
            asset={asset}
            variant={variant}
            devices={assetDevices}
            selectedDevice={selectedDevice}
            focus={focus}
            telemetry={telemetry}
            loading={loading}
            error={error}
            thresholds={thresholds}
            soilHealth={soilHealth}
            waterLow={waterLow}
            pumpOn={pumpOn}
            waitingForTelemetry={waitingForTelemetry}
            elapsedSeconds={elapsedSeconds}
            onBack={handleSelectAsset}
            onSelectDevice={handleSelectDevice}
            onRefresh={refresh}
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

interface InfoPanelProps {
  asset: GreenhouseAsset
  variant: AssetModelVariant
  devices: GreenhouseDevice[]
  selectedDevice: GreenhouseDevice | null
  focus: PanelFocus
  telemetry: GreenhouseTelemetry | null
  loading: boolean
  error: string | null
  thresholds: Thresholds
  soilHealth: SoilHealth
  waterLow: boolean
  pumpOn: boolean
  waitingForTelemetry: boolean
  elapsedSeconds: number
  onBack: () => void
  onSelectDevice: (deviceId: string) => void
  onRefresh: () => void
}

function InfoPanel({
  asset,
  variant,
  devices,
  selectedDevice,
  focus,
  telemetry,
  loading,
  error,
  thresholds,
  soilHealth,
  waterLow,
  pumpOn,
  waitingForTelemetry,
  elapsedSeconds,
  onBack,
  onSelectDevice,
  onRefresh,
}: InfoPanelProps) {
  const showingDevice = focus === 'device' && Boolean(selectedDevice)
  const onlineCount = devices.filter((device) => device.online).length

  return (
    <div className="flex min-h-[320px] flex-col rounded-2xl border border-slate-200 bg-white p-4 xl:h-[460px]">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {showingDevice ? 'Node cảm biến' : 'Thông tin cây'}
          </p>
          <h3 className="mt-1 truncate text-sm font-semibold text-slate-900">
            {showingDevice && selectedDevice
              ? selectedDevice.name || selectedDevice._id
              : asset.name}
          </h3>
          <p className="mt-0.5 truncate text-[10px] text-slate-500">
            {showingDevice && selectedDevice
              ? `${selectedDevice.type || 'sensor'} · ${
                  selectedDevice.online ? 'Online' : 'Offline'
                }`
              : `${ASSET_TYPE_LABELS[variant]} · ${devices.length} node cảm biến`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {showingDevice && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 text-slate-500"
              onClick={onBack}
              aria-label="Quay lại thông tin cây"
              title="Quay lại thông tin cây"
            >
              <ArrowLeft className="size-3.5" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-slate-500"
            onClick={onRefresh}
            disabled={!selectedDevice || loading}
            aria-label="Làm mới telemetry"
            title="Làm mới telemetry"
          >
            <RefreshCw
              className={cn('size-3.5', loading && 'animate-spin')}
            />
          </Button>
        </div>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
        {showingDevice && selectedDevice ? (
          <DeviceDetails
            device={selectedDevice}
            telemetry={telemetry}
            loading={loading}
            error={error}
            thresholds={thresholds}
            soilHealth={soilHealth}
            waterLow={waterLow}
            pumpOn={pumpOn}
            waitingForTelemetry={waitingForTelemetry}
            elapsedSeconds={elapsedSeconds}
          />
        ) : (
          <AssetDetails
            asset={asset}
            variant={variant}
            devices={devices}
          />
        )}
      </div>

      <DeviceList
        devices={devices}
        onlineCount={onlineCount}
        selectedDeviceId={showingDevice ? selectedDevice?._id ?? null : null}
        onSelect={onSelectDevice}
      />
    </div>
  )
}

function AssetDetails({
  asset,
  variant,
  devices,
}: {
  asset: GreenhouseAsset
  variant: AssetModelVariant
  devices: GreenhouseDevice[]
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
        <InfoRow label="Loại cây" value={ASSET_TYPE_LABELS[variant]} />
        <InfoRow
          label="Ngày tạo"
          value={asset.createdAt ? formatDateTime(asset.createdAt) : '--'}
        />
        <InfoRow label="Node cảm biến" value={`${devices.length} thiết bị`} />
      </div>

      <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 p-3 text-[11px] leading-relaxed text-slate-600">
        <div className="mb-1 flex items-center gap-1.5 font-semibold text-emerald-900">
          <Info className="size-3.5" />
          Cách xem telemetry
        </div>
        Click vào một node cảm biến trên mô hình 3D, hoặc chọn thiết bị ở danh
        sách bên dưới. Dữ liệu sẽ được tải từ DB và tự cập nhật mỗi{' '}
        {POLL_INTERVAL_MS / 1000} giây.
      </div>

      {devices.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
          <div className="mb-1 flex items-center gap-1.5 font-semibold">
            <Cpu className="size-3.5" />
            Chưa gán cảm biến
          </div>
          Vào “Quản lý thiết bị” để gán một device cho cây này. Node cảm biến sẽ
          xuất hiện trên mô hình 3D sau khi gán.
        </div>
      )}
    </div>
  )
}

function DeviceDetails({
  device,
  telemetry,
  loading,
  error,
  thresholds,
  soilHealth,
  waterLow,
  pumpOn,
  waitingForTelemetry,
  elapsedSeconds,
}: {
  device: GreenhouseDevice
  telemetry: GreenhouseTelemetry | null
  loading: boolean
  error: string | null
  thresholds: Thresholds
  soilHealth: SoilHealth
  waterLow: boolean
  pumpOn: boolean
  waitingForTelemetry: boolean
  elapsedSeconds: number
}) {
  const hasTelemetry = Boolean(telemetry)
  const soilValue = telemetry?.soil_humidity ?? null
  const waterValue = telemetry?.water_level ?? null

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          'rounded-xl border px-3 py-2',
          device.online
            ? pumpOn
              ? 'border-emerald-200 bg-emerald-50/80'
              : 'border-slate-200 bg-slate-50'
            : 'border-red-200 bg-red-50',
        )}
      >
        <div
          className={cn(
            'flex items-center gap-2 text-xs font-semibold',
            device.online
              ? pumpOn
                ? 'text-emerald-900'
                : 'text-slate-700'
              : 'text-red-800',
          )}
        >
          {device.online ? (
            <Droplets className="size-3.5" />
          ) : (
            <WifiOff className="size-3.5" />
          )}
          {!device.online
            ? 'Thiết bị đang offline'
            : pumpOn
              ? waitingForTelemetry
                ? 'Đang chờ telemetry để chốt thời gian tưới'
                : `Đang tưới · ${formatElapsed(elapsedSeconds)}`
              : 'Van tưới đang đóng'}
        </div>
        <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
          {!device.online
            ? 'Dữ liệu bên dưới là lần cập nhật cuối cùng trước khi mất kết nối.'
            : pumpOn
              ? 'Lệnh bơm đã được gửi. Van mở và nước đang chảy trong mô hình 3D.'
              : 'Bật công tắc máy bơm ở phía trên để bắt đầu tưới.'}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-[11px] text-red-700">
          {error}
        </div>
      )}

      {hasTelemetry ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <TelemetryTile
              icon={Thermometer}
              label="Nhiệt độ"
              value={formatMetric(telemetry?.temperature ?? null, '°C', 1)}
              muted={telemetry?.temperature == null}
            />
            <TelemetryTile
              icon={Wind}
              label="Độ ẩm không khí"
              value={formatMetric(telemetry?.humidity ?? null, '%')}
              muted={telemetry?.humidity == null}
            />
            <TelemetryTile
              icon={Sprout}
              label="Độ ẩm đất"
              value={formatMetric(soilValue, '%')}
              muted={soilValue == null}
            />
            <TelemetryTile
              icon={Waves}
              label="Mực nước"
              value={formatMetric(waterValue, '%')}
              muted={waterValue == null}
            />
          </div>

          <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 p-3">
            <RangeBar
              label="Độ ẩm đất"
              value={soilValue}
              min={thresholds.soilMin}
              max={thresholds.soilMax}
            />
            <RangeBar
              label="Mực nước"
              value={waterValue}
              min={thresholds.waterMin}
              max={thresholds.waterMax}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
            <span>Cập nhật: {formatTimestamp(telemetry?.timestamp)}</span>
            <span
              className={cn(
                'inline-flex items-center gap-1 font-medium',
                soilHealth === 'dry'
                  ? 'text-amber-700'
                  : soilHealth === 'wet'
                    ? 'text-cyan-700'
                    : 'text-emerald-700',
              )}
            >
              <span className="inline-block size-1.5 rounded-full bg-current" />
              {soilStatusLabel(soilHealth)}
            </span>
          </div>

          {waterLow && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] font-medium text-amber-800">
              Mực nước đang thấp hơn ngưỡng an toàn. Kiểm tra nguồn nước trước
              khi tưới tiếp.
            </p>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center">
          {loading ? (
            <LoaderCircle className="size-5 animate-spin text-emerald-600" />
          ) : (
            <Waves className="size-5 text-slate-400" />
          )}
          <p className="text-xs font-semibold text-slate-700">
            {loading ? 'Đang tải telemetry...' : 'Chưa có telemetry'}
          </p>
          <p className="max-w-[240px] text-[10px] leading-relaxed text-slate-500">
            {device.online
              ? 'Thiết bị đang online nhưng chưa gửi bản ghi nào. Thử làm mới sau vài giây.'
              : 'Thiết bị đang offline. Dữ liệu sẽ xuất hiện khi thiết bị gửi telemetry trở lại.'}
          </p>
        </div>
      )}
    </div>
  )
}

function DeviceList({
  devices,
  onlineCount,
  selectedDeviceId,
  onSelect,
}: {
  devices: GreenhouseDevice[]
  onlineCount: number
  selectedDeviceId: string | null
  onSelect: (deviceId: string) => void
}) {
  if (devices.length === 0) return null

  return (
    <div className="mt-3 shrink-0 border-t border-slate-100 pt-3">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Node cảm biến
        </p>
        <span className="text-[10px] text-slate-400">
          {onlineCount}/{devices.length} online
        </span>
      </div>
      <div className="flex max-h-[126px] flex-col gap-1.5 overflow-y-auto pr-1">
        {devices.map((device) => {
          const selected = device._id === selectedDeviceId

          return (
            <button
              key={device._id}
              type="button"
              onClick={() => onSelect(device._id)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors',
                selected
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-slate-200 bg-white hover:bg-slate-50',
              )}
            >
              <span
                className={cn(
                  'inline-block size-1.5 shrink-0 rounded-full',
                  device.online ? 'bg-emerald-500' : 'bg-red-500',
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-semibold text-slate-800">
                  {device.name || device._id}
                </span>
                <span className="block truncate text-[9px] text-slate-500">
                  {device.type || 'sensor'} ·{' '}
                  {device.online ? 'Online' : 'Offline'}
                </span>
              </span>
              <ChevronRight
                className={cn(
                  'size-3 shrink-0',
                  selected ? 'text-emerald-600' : 'text-slate-400',
                )}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TelemetryTile({
  icon: Icon,
  label,
  value,
  muted,
}: {
  icon: typeof Thermometer
  label: string
  value: string
  muted: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500">
        <Icon className="size-3.5 text-emerald-600" />
        {label}
      </div>
      <p
        className={cn(
          'mt-1 text-lg font-semibold',
          muted ? 'text-slate-400' : 'text-slate-900',
        )}
      >
        {value}
      </p>
    </div>
  )
}

function RangeBar({
  label,
  value,
  min,
  max,
}: {
  label: string
  value: number | null
  min: number
  max: number
}) {
  const safeMin = clamp(Math.min(min, max), 0, 100)
  const safeMax = clamp(Math.max(min, max), 0, 100)
  const marker = value === null ? null : clamp(value, 0, 100)
  const inRange =
    value !== null && value >= safeMin && value <= safeMax

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px]">
        <span className="font-medium text-slate-600">{label}</span>
        <span
          className={cn(
            'font-semibold',
            value === null
              ? 'text-slate-400'
              : inRange
                ? 'text-emerald-700'
                : 'text-amber-700',
          )}
        >
          {value === null ? '--' : `${Math.round(value)}%`}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-slate-100">
        <div
          className="absolute inset-y-0 rounded-full bg-emerald-100"
          style={{ left: `${safeMin}%`, width: `${safeMax - safeMin}%` }}
        />
        {marker !== null && (
          <span
            className={cn(
              'absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm',
              inRange ? 'bg-cyan-600' : 'bg-amber-500',
            )}
            style={{ left: `${marker}%` }}
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-slate-400">
        <span>0%</span>
        <span>
          An toàn {safeMin}–{safeMax}%
        </span>
        <span>100%</span>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 py-1 text-[11px] last:border-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="truncate font-medium text-slate-800">{value}</span>
    </div>
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

function soilStatusLabel(health: SoilHealth): string {
  if (health === 'dry') return 'Đất đang thiếu nước'
  if (health === 'wet') return 'Đất đang quá ẩm'
  if (health === 'healthy') return 'Độ ẩm đất ổn định'
  return 'Chưa có dữ liệu độ ẩm đất'
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function useDeviceTelemetry(deviceId: string | null) {
  const [telemetry, setTelemetry] = useState<GreenhouseTelemetry | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef<AbortController | null>(null)

  const load = useCallback(
    async (silent = false) => {
      if (!deviceId) {
        setTelemetry(null)
        setError(null)
        setLoading(false)
        return
      }

      requestRef.current?.abort()
      const controller = new AbortController()
      requestRef.current = controller

      if (!silent) setLoading(true)

      try {
        const detail = await apiRequest<DeviceDetail>(
          `/api/devices/${encodeURIComponent(deviceId)}`,
          { signal: controller.signal },
        )

        if (
          controller.signal.aborted ||
          requestRef.current !== controller
        ) {
          return
        }

        setTelemetry(normalizeTelemetry(detail.latestTelemetry))
        setError(null)
      } catch (requestError) {
        if (
          controller.signal.aborted ||
          requestRef.current !== controller
        ) {
          return
        }
        if (
          requestError instanceof DOMException &&
          requestError.name === 'AbortError'
        ) {
          return
        }
        setError(friendlyTelemetryError(requestError))
      } finally {
        if (requestRef.current === controller) requestRef.current = null
        if (!silent && !controller.signal.aborted) setLoading(false)
      }
    },
    [deviceId],
  )

  useEffect(() => {
    setTelemetry(null)
    setError(null)

    if (!deviceId) return

    void load()

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !requestRef.current) {
        void load(true)
      }
    }, POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(interval)
      requestRef.current?.abort()
      requestRef.current = null
    }
  }, [deviceId, load])

  return {
    telemetry,
    loading,
    error,
    refresh: () => void load(false),
  }
}

function friendlyTelemetryError(error: unknown): string {
  const message = error instanceof Error ? error.message : ''

  if (
    !message ||
    /internal server error|failed to fetch|networkerror|load failed/i.test(
      message,
    )
  ) {
    return 'Không kết nối được backend. Kiểm tra server rồi thử làm mới.'
  }

  return message
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
