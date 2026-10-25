'use client'

import {
  ChevronRight,
  Cpu,
  Droplets,
  Info,
  Sprout,
  Thermometer,
  Waves,
  Wind,
  WifiOff,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  ASSET_TYPE_LABELS,
  resolveAssetVariant,
} from '@/lib/asset-type'
import {
  formatDateTime,
  formatMetric,
  formatTimestamp,
  getSoilHealth,
  getThresholds,
  isWaterLow,
  type GreenhouseDevice,
  type GreenhouseStation,
  type SoilHealth,
} from './greenhouse-3d-types'

interface GreenhousePanelProps {
  stations: GreenhouseStation[]
  selectedAssetId: string | null
  selectedDeviceId: string | null
  pumpStatesByDevice: Record<string, boolean>
  editMode: boolean
  onSelectAsset: (assetId: string) => void
  onSelectDevice: (deviceId: string) => void
}

export function GreenhousePanel({
  stations,
  selectedAssetId,
  selectedDeviceId,
  pumpStatesByDevice,
  editMode,
  onSelectAsset,
  onSelectDevice,
}: GreenhousePanelProps) {
  const selectedStation =
    stations.find((station) => station.asset._id === selectedAssetId) ??
    null
  const selectedDevice =
    selectedStation?.devices.find(
      (device) => device._id === selectedDeviceId,
    ) ?? null
  const onlineAssets = stations.filter((station) => station.online).length

  return (
    <div className="flex min-h-[320px] flex-col rounded-2xl border border-slate-200 bg-white p-3 xl:h-[460px]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Tất cả cây
          </p>
          <h3 className="text-sm font-semibold text-slate-900">
            {stations.length} cây trong vườn
          </h3>
        </div>
        <Badge
          variant="outline"
          className={cn(
            'font-normal',
            onlineAssets > 0
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700',
          )}
        >
          <span
            className={cn(
              'inline-block size-1.5 rounded-full',
              onlineAssets > 0 ? 'bg-emerald-500' : 'bg-red-500',
            )}
          />
          {onlineAssets}/{stations.length} online
        </Badge>
      </div>

      <div className="mt-2 max-h-[158px] shrink-0 space-y-1.5 overflow-y-auto pr-1">
        {stations.map((station) => (
          <AssetRow
            key={station.asset._id}
            station={station}
            selected={station.asset._id === selectedAssetId}
            onSelect={() => onSelectAsset(station.asset._id)}
          />
        ))}
      </div>

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto border-t border-slate-100 pt-3">
        {selectedStation ? (
          <AssetDetail
            station={selectedStation}
            selectedDevice={selectedDevice}
            pumpOn={
              selectedDevice
                ? Boolean(pumpStatesByDevice[selectedDevice._id])
                : selectedStation.pumpOn
            }
            editMode={editMode}
            onSelectDevice={onSelectDevice}
          />
        ) : (
          <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center">
            <Sprout className="size-6 text-slate-400" />
            <p className="text-xs font-semibold text-slate-700">
              Chọn một cây để xem chi tiết
            </p>
            <p className="max-w-[220px] text-[10px] leading-relaxed text-slate-500">
              Click cây trên mô hình 3D hoặc chọn một dòng trong danh sách.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function AssetRow({
  station,
  selected,
  onSelect,
}: {
  station: GreenhouseStation
  selected: boolean
  onSelect: () => void
}) {
  const soil = station.primaryTelemetry?.soil_humidity
  const water = station.primaryTelemetry?.water_level
  const onlineDevices = station.devices.filter(
    (device) => device.online,
  ).length

  return (
    <button
      type="button"
      onClick={onSelect}
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
          station.online ? 'bg-emerald-500' : 'bg-red-500',
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[11px] font-semibold text-slate-800">
            {station.asset.name}
          </span>
          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[8px] text-slate-500">
            {ASSET_TYPE_LABELS[
              resolveAssetVariant(station.asset.type)
            ]}
          </span>
          {station.pumpOn && (
            <Droplets className="size-3 shrink-0 text-emerald-600" />
          )}
        </span>
        <span className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] text-slate-500">
          <span>Đất {formatMetric(soil ?? null, '%')}</span>
          <span>Nước {formatMetric(water ?? null, '%')}</span>
          <span>
            {onlineDevices}/{station.devices.length} online
          </span>
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
}

function AssetDetail({
  station,
  selectedDevice,
  pumpOn,
  editMode,
  onSelectDevice,
}: {
  station: GreenhouseStation
  selectedDevice: GreenhouseDevice | null
  pumpOn: boolean
  editMode: boolean
  onSelectDevice: (deviceId: string) => void
}) {
  const variant = resolveAssetVariant(station.asset.type)

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Chi tiết cây
          </p>
          <h3 className="truncate text-sm font-semibold text-slate-900">
            {station.asset.name}
          </h3>
          <p className="mt-0.5 text-[10px] text-slate-500">
            {ASSET_TYPE_LABELS[variant]} · {station.devices.length} node
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            'shrink-0 font-normal',
            pumpOn
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
              : 'border-slate-200 bg-slate-50 text-slate-600',
          )}
        >
          {pumpOn ? 'Đang tưới' : 'Van đóng'}
        </Badge>
      </div>

      {editMode && (
        <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-2 text-[10px] leading-relaxed text-cyan-900">
          Đang ở chế độ sắp xếp. Chọn cây, sau đó click điểm đích trên mặt
          đất.
        </div>
      )}

      {station.devices.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {station.devices.map((device) => {
            const isSelected = selectedDevice?._id === device._id

            return (
              <button
                key={device._id}
                type="button"
                onClick={() => onSelectDevice(device._id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] transition-colors',
                  isSelected
                    ? 'border-emerald-300 bg-emerald-50 font-semibold text-emerald-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                )}
              >
                <span
                  className={cn(
                    'inline-block size-1.5 rounded-full',
                    device.online ? 'bg-emerald-500' : 'bg-red-500',
                  )}
                />
                <span className="max-w-[110px] truncate">
                  {device.name || device._id}
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-relaxed text-amber-900">
          <div className="mb-1 flex items-center gap-1.5 font-semibold">
            <Cpu className="size-3.5" />
            Chưa gán cảm biến
          </div>
          Vào “Quản lý thiết bị” để gán một device cho cây này.
        </div>
      )}

      {selectedDevice ? (
        <DeviceTelemetry
          station={station}
          device={selectedDevice}
          pumpOn={pumpOn}
        />
      ) : (
        <AssetSummary station={station} />
      )}
    </div>
  )
}

function DeviceTelemetry({
  station,
  device,
  pumpOn,
}: {
  station: GreenhouseStation
  device: GreenhouseDevice
  pumpOn: boolean
}) {
  const telemetry = station.telemetryByDevice[device._id] ?? null
  const thresholds = getThresholds(device)
  const soilValue = telemetry?.soil_humidity ?? null
  const waterValue = telemetry?.water_level ?? null
  const soilHealth = getSoilHealth(soilValue, thresholds)
  const waterLow = isWaterLow(waterValue, thresholds)

  if (!telemetry) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center">
        <Waves className="size-5 text-slate-400" />
        <p className="text-xs font-semibold text-slate-700">
          Chưa có telemetry
        </p>
        <p className="max-w-[240px] text-[10px] leading-relaxed text-slate-500">
          {device.online
            ? 'Thiết bị đang online nhưng chưa gửi bản ghi nào.'
            : 'Thiết bị đang offline. Dữ liệu sẽ xuất hiện khi thiết bị gửi telemetry trở lại.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
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
              ? 'Van đang mở · Đang tưới'
              : 'Van tưới đang đóng'}
        </div>
        <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
          {!device.online
            ? 'Dữ liệu bên dưới là lần cập nhật cuối cùng trước khi mất kết nối.'
            : pumpOn
              ? 'Lệnh bơm đã được gửi và van đang mở trong mô hình 3D.'
              : 'Bật công tắc máy bơm ở phía trên để bắt đầu tưới.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <TelemetryTile
          icon={Thermometer}
          label="Nhiệt độ"
          value={formatMetric(telemetry.temperature, '°C', 1)}
          muted={telemetry.temperature == null}
        />
        <TelemetryTile
          icon={Wind}
          label="Độ ẩm không khí"
          value={formatMetric(telemetry.humidity, '%')}
          muted={telemetry.humidity == null}
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
        <span>Cập nhật: {formatTimestamp(telemetry.timestamp)}</span>
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
    </div>
  )
}

function AssetSummary({ station }: { station: GreenhouseStation }) {
  const onlineDevices = station.devices.filter(
    (device) => device.online,
  ).length

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
        <InfoRow
          label="Loại cây"
          value={
            ASSET_TYPE_LABELS[
              resolveAssetVariant(station.asset.type)
            ]
          }
        />
        <InfoRow
          label="Ngày tạo"
          value={
            station.asset.createdAt
              ? formatDateTime(station.asset.createdAt)
              : '--'
          }
        />
        <InfoRow
          label="Node cảm biến"
          value={`${onlineDevices}/${station.devices.length} online`}
        />
      </div>

      <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 p-3 text-[10px] leading-relaxed text-slate-600">
        <div className="mb-1 flex items-center gap-1.5 font-semibold text-emerald-900">
          <Info className="size-3.5" />
          Cách xem telemetry
        </div>
        Chọn một node cảm biến ở trên hoặc click trực tiếp vào node trên mô
        hình 3D.
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

function soilStatusLabel(health: SoilHealth): string {
  if (health === 'dry') return 'Đất đang thiếu nước'
  if (health === 'wet') return 'Đất đang quá ẩm'
  if (health === 'healthy') return 'Độ ẩm đất ổn định'
  return 'Chưa có dữ liệu độ ẩm đất'
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
