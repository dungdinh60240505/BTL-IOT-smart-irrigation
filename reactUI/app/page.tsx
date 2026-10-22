'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  Droplets,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  PanelLeft,
  Settings,
  Sprout,
  Thermometer,
  UserRound,
  Waves,
  Wind,
  X,
  RefreshCw,
  Plus,
  Cpu,
  ChevronLeft,
  ChevronRight,
  Radio,
  Sliders,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { apiRequest } from '@/lib/api'

export interface DeviceItem {
  _id: string
  name: string
  type?: string
  assetId?: string | null
  online?: boolean
  pumpState?: 'ON' | 'OFF'
  lastSeenAt?: string
  attributes?: {
    firmware_version?: string
    safe_min_soil_humidity?: number
    safe_max_soil_humidity?: number
    safe_min_water_level?: number
    safe_max_water_level?: number
    flow_rate_lpm?: number
  } | null
}

export interface WateringEventItem {
  _id: string
  deviceId: string
  assetId?: string | null
  startedAt: string
  endedAt?: string | null
  durationSec?: number | null
  liters?: number | null
}

export interface TelemetryPoint {
  time: string
  temp?: number
  humidity?: number
  soil?: number
  water?: number
}

export interface AssetItem {
  _id: string
  name: string
  type?: string
  createdAt?: string
  updatedAt?: string
}

type View = 'dashboard' | 'assets' | 'sensors' | 'telemetry' | 'history' | 'profile' | 'settings'

const nav = [
  { id: 'dashboard' as View, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'assets' as View, label: 'Quản lý khu vườn', icon: Sprout },
  { id: 'sensors' as View, label: 'Quản lý thiết bị', icon: Cpu },
  { id: 'telemetry' as View, label: 'Lịch sử nhận dữ liệu', icon: Radio },
  { id: 'history' as View, label: 'Lịch sử tưới', icon: Droplets },
  { id: 'profile' as View, label: 'Thông tin tài khoản', icon: UserRound },
  { id: 'settings' as View, label: 'Cài đặt', icon: Settings },
]

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-4">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
        {eyebrow}
      </p>
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
    </div>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  unit,
  detail,
  children,
}: {
  icon: typeof Thermometer
  label: string
  value: string
  unit: string
  detail: string
  children?: React.ReactNode
}) {
  return (
    <Card className="border-emerald-100/90 bg-white/95 shadow-xs">
      <CardContent className="p-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-black">
          <Icon className="size-4 text-emerald-600" />
          {label}
        </div>
        <div className="flex items-end justify-between gap-2">
          <div>
            <span className="text-2xl font-semibold text-slate-900">{value}</span>
            <span className="ml-1 text-xs text-slate-500">{unit}</span>
            <p className="mt-1 text-[10px] text-slate-500">{detail}</p>
          </div>
          {children}
        </div>
      </CardContent>
    </Card>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-emerald-100/90 bg-white/95 shadow-xs">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm text-slate-900">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[220px] w-full">{children}</div>
      </CardContent>
    </Card>
  )
}

function DualRangeSlider({
  min = 0,
  max = 100,
  step = 1,
  minValue,
  maxValue,
  onChange,
  unit = '%',
  trackColor = 'bg-emerald-500',
}: {
  min?: number
  max?: number
  step?: number
  minValue: number
  maxValue: number
  onChange: (minVal: number, maxVal: number) => void
  unit?: string
  trackColor?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  const minPercent = Math.max(0, Math.min(100, ((minValue - min) / (max - min)) * 100))
  const maxPercent = Math.max(0, Math.min(100, ((maxValue - min) / (max - min)) * 100))

  const handlePointerDown = (type: 'min' | 'max') => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)

    const onPointerMove = (moveEv: PointerEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const percent = Math.max(0, Math.min(1, (moveEv.clientX - rect.left) / rect.width))
      const rawVal = Math.round((min + percent * (max - min)) / step) * step

      if (type === 'min') {
        const nextMin = Math.min(rawVal, maxValue)
        onChange(Math.max(min, nextMin), maxValue)
      } else {
        const nextMax = Math.max(rawVal, minValue)
        onChange(minValue, Math.min(max, nextMax))
      }
    }

    const onPointerUp = (upEv: PointerEvent) => {
      target.removeEventListener('pointermove', onPointerMove)
      target.removeEventListener('pointerup', onPointerUp)
      target.removeEventListener('pointercancel', onPointerUp)
      try {
        target.releasePointerCapture(upEv.pointerId)
      } catch {}
    }

    target.addEventListener('pointermove', onPointerMove)
    target.addEventListener('pointerup', onPointerUp)
    target.addEventListener('pointercancel', onPointerUp)
  }

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const clickVal = Math.round((min + percent * (max - min)) / step) * step
    if (Math.abs(clickVal - minValue) <= Math.abs(clickVal - maxValue)) {
      const nextMin = Math.min(clickVal, maxValue)
      onChange(Math.max(min, nextMin), maxValue)
    } else {
      const nextMax = Math.max(clickVal, minValue)
      onChange(minValue, Math.min(max, nextMax))
    }
  }

  return (
    <div className="flex flex-col gap-2.5 w-full select-none py-1">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-300 text-slate-800 shadow-2xs">
          <span className="text-[10px] text-slate-500 font-normal">Tối thiểu:</span> {minValue}{unit}
        </span>
        <span className="text-[11px] text-slate-500 font-medium">Khoảng cách an toàn: {maxValue - minValue}{unit}</span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-300 text-slate-800 shadow-2xs">
          <span className="text-[10px] text-slate-500 font-normal">Tối đa:</span> {maxValue}{unit}
        </span>
      </div>

      <div
        ref={containerRef}
        onClick={handleTrackClick}
        className="relative h-7 flex items-center cursor-pointer touch-none"
      >
        <div className="w-full h-2.5 rounded-full bg-slate-200" />

        <div
          className={`absolute h-2.5 rounded-full ${trackColor}`}
          style={{
            left: `${minPercent}%`,
            width: `${Math.max(0, maxPercent - minPercent)}%`,
          }}
        />

        {/* Min Thumb (hình tròn kéo 1) */}
        <div
          role="slider"
          aria-valuenow={minValue}
          aria-label="Hình tròn chọn ngưỡng tối thiểu"
          onPointerDown={handlePointerDown('min')}
          className="absolute size-6 -translate-x-1/2 rounded-full bg-white border-2 border-emerald-600 shadow-md cursor-grab active:cursor-grabbing hover:scale-125 transition-transform flex items-center justify-center z-10"
          style={{ left: `${minPercent}%` }}
        >
          <div className="size-2 rounded-full bg-emerald-600" />
        </div>

        {/* Max Thumb (hình tròn kéo 2) */}
        <div
          role="slider"
          aria-valuenow={maxValue}
          aria-label="Hình tròn chọn ngưỡng tối đa"
          onPointerDown={handlePointerDown('max')}
          className="absolute size-6 -translate-x-1/2 rounded-full bg-white border-2 border-emerald-600 shadow-md cursor-grab active:cursor-grabbing hover:scale-125 transition-transform flex items-center justify-center z-20"
          style={{ left: `${maxPercent}%` }}
        >
          <div className="size-2 rounded-full bg-emerald-600" />
        </div>
      </div>

      <div className="flex justify-between text-[10px] text-slate-400 font-medium px-0.5">
        <span>0{unit}</span>
        <span>25{unit}</span>
        <span>50{unit}</span>
        <span>75{unit}</span>
        <span>100{unit}</span>
      </div>
    </div>
  )
}

function DataTable({
  kind,
  devices,
  wateringEvents,
  assets,
  loading,
  onAdd,
  onSelectAssetHistory,
  selectedAssetId,
  onRowClick,
}: {
  kind: 'sensors' | 'history' | 'assets'
  devices: DeviceItem[]
  wateringEvents: WateringEventItem[]
  assets: AssetItem[]
  loading?: boolean
  onAdd?: (kind: 'sensors' | 'assets') => void
  onSelectAssetHistory?: (assetId: string) => void
  selectedAssetId?: string
  onRowClick?: (data: any, title: string) => void
}) {
  const [localAssetFilter, setLocalAssetFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const PAGE_SIZE = 5

  const getTitle = () => {
    if (kind === 'sensors') return 'Danh sách thiết bị & Cảm biến'
    if (kind === 'history') return 'Nhật ký tưới nước (Watering history)'
    return 'Danh mục Cây & Khu vườn (Assets)'
  }

  const activeAssetFilter = onSelectAssetHistory ? (selectedAssetId || 'all') : localAssetFilter

  const filteredWateringEvents = onSelectAssetHistory
    ? wateringEvents
    : wateringEvents.filter((w) => {
        if (localAssetFilter === 'all') return true
        return w.assetId === localAssetFilter
      })

  // Reset về trang 1 khi thay đổi filter hoặc kind
  useEffect(() => {
    setCurrentPage(1)
  }, [localAssetFilter, selectedAssetId, kind, wateringEvents])

  const totalItems =
    kind === 'assets'
      ? assets.length
      : kind === 'sensors'
      ? devices.length
      : filteredWateringEvents.length

  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  const safePage = Math.min(Math.max(1, currentPage), totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const endIndex = startIndex + PAGE_SIZE

  const displayedAssets = assets.slice(startIndex, endIndex)
  const displayedDevices = devices.slice(startIndex, endIndex)
  const displayedWateringEvents = filteredWateringEvents.slice(startIndex, endIndex)

  return (
    <Card className="overflow-hidden border-emerald-100/90 bg-white/95 shadow-xs flex flex-col gap-0 py-0 h-full">
      <CardHeader className="border-b border-emerald-100/70 px-4 py-3 flex flex-row items-center justify-between space-y-0 gap-2">
        <CardTitle className="text-sm text-slate-900 font-semibold">{getTitle()}</CardTitle>
        {kind === 'history' && assets.length > 0 && (
          <div className="flex items-center gap-1.5">
            <select
              value={activeAssetFilter}
              onChange={(e) => {
                const val = e.target.value
                setLocalAssetFilter(val)
                if (onSelectAssetHistory) onSelectAssetHistory(val)
              }}
              className="h-8 rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-black outline-none transition-colors hover:bg-slate-100 focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600"
            >
              <option value="all">-- Tất cả cây/khu vườn --</option>
              {assets.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name} ({a.type})
                </option>
              ))}
            </select>
          </div>
        )}
        {onAdd && (kind === 'assets' || kind === 'sensors') && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAdd(kind)}
            className="h-8 gap-1 border-slate-300 bg-slate-100 hover:bg-slate-200 text-black text-xs font-semibold px-2.5 shadow-none"
          >
            <Plus className="size-3.5 text-black" />
            Thêm
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0 flex-1 flex flex-col justify-between">
        <div className="flex-1 w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {kind === 'assets' ? (
                  <>
                    <TableHead>Tên cây / Khu vực</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead>Số cảm biến</TableHead>
                    <TableHead className="text-right">Ngày tạo</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead>{kind === 'sensors' ? 'Tên thiết bị' : 'Thời gian bắt đầu'}</TableHead>
                    <TableHead>{kind === 'sensors' ? 'Loại thiết bị' : 'Thời lượng tưới'}</TableHead>
                    <TableHead>{kind === 'sensors' ? 'Trạng thái kết nối' : 'Lượng nước đã tưới'}</TableHead>
                    <TableHead className="text-right">
                      {kind === 'sensors' ? 'Lần cuối hoạt động' : 'Mã thiết bị tưới'}
                    </TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-sm text-slate-500">
                    Đang tải dữ liệu...
                  </TableCell>
                </TableRow>
              ) : kind === 'assets' ? (
                assets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-sm text-slate-500">
                      Chưa có cây / khu vườn nào
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedAssets.map((a) => {
                    const sensorCount = devices.filter((d) => String(d.assetId) === String(a._id)).length
                    return (
                      <TableRow
                        key={a._id}
                        onClick={() => onRowClick?.(a, `Chi tiết Cây / Khu vườn: ${a.name}`)}
                      >
                        <TableCell className="font-semibold text-xs text-black">
                          {a.name}
                        </TableCell>
                        <TableCell className="text-xs text-black">
                          <Badge variant="outline" className="border-emerald-300 text-emerald-800 bg-emerald-50 font-normal">
                            {a.type || 'plant'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-black font-medium">
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-800 border border-slate-200">
                            {sensorCount} thiết bị
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs text-black">
                          {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : 'Hôm nay'}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )
              ) : kind === 'sensors' ? (
                devices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-sm text-slate-400">
                      Chưa có thiết bị nào
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedDevices.map((s) => (
                    <TableRow
                      key={s._id}
                      onClick={() => onRowClick?.(s, `Chi tiết Thiết bị: ${s.name || s._id}`)}
                    >
                      <TableCell className="font-mono text-xs font-medium text-black">
                        {s.name || s._id}
                      </TableCell>
                      <TableCell className="text-xs text-black">{s.type || 'Sensor Node'}</TableCell>
                      <TableCell>
                        <Badge
                          variant="default"
                          className={
                            s.online
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-medium'
                              : 'bg-red-500 hover:bg-red-600 text-white font-medium'
                          }
                        >
                          {s.online ? 'Online' : 'Offline'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs text-black">
                        {s.lastSeenAt ? new Date(s.lastSeenAt).toLocaleTimeString() : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))
                )
              ) : (
                filteredWateringEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-sm text-slate-500">
                      Chưa có lịch sử tưới cho cây này
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedWateringEvents.map((w) => (
                    <TableRow
                      key={w._id}
                      onClick={() => onRowClick?.(w, `Chi tiết Lần tưới: ${new Date(w.startedAt).toLocaleString()}`)}
                    >
                      <TableCell className="text-xs text-black">
                        {new Date(w.startedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-black">
                        {w.durationSec !== null && w.durationSec !== undefined ? `${w.durationSec}s` : 'Đang tưới'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-black border-slate-300">
                          {w.liters !== null && w.liters !== undefined ? `${w.liters} L` : '0 L'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-black">
                        {w.deviceId}
                      </TableCell>
                    </TableRow>
                  ))
                )
              )}
            </TableBody>
          </Table>
        </div>

        {/* Thanh phân trang Pagination (limit = 5) */}
        <div className="border-t border-slate-200 bg-slate-50/80 px-3 py-2 flex items-center justify-between text-xs text-slate-700 mt-auto select-none">
          <span className="font-medium text-[11px] sm:text-xs">
            Trang {safePage} / {totalPages} <span className="text-slate-400 font-normal">({totalItems} {kind === 'assets' ? 'mục' : kind === 'sensors' ? 'thiết bị' : 'lần tưới'})</span>
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs text-black border-slate-300 hover:bg-slate-200 gap-0.5"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
            >
              <ChevronLeft className="size-3.5" />
              <span>Trước</span>
            </Button>
            <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-xs font-semibold text-slate-800 min-w-6 text-center">
              {safePage}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs text-black border-slate-300 hover:bg-slate-200 gap-0.5"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
            >
              <span>Sau</span>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function TelemetryTable({
  data,
  devices,
  loading,
  selectedDevId,
  onSelectDev,
  onRefresh,
  onRowClick,
}: {
  data: any[]
  devices: DeviceItem[]
  loading?: boolean
  selectedDevId: string
  onSelectDev: (id: string) => void
  onRefresh: () => void
  onRowClick: (data: any, title: string) => void
}) {
  const [currentPage, setCurrentPage] = useState<number>(1)
  const PAGE_SIZE = 50

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedDevId, data.length])

  const totalItems = data.length
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  const safePage = Math.min(Math.max(1, currentPage), totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const endIndex = startIndex + PAGE_SIZE
  const displayed = data.slice(startIndex, endIndex)

  return (
    <Card className="overflow-hidden border-emerald-100/90 bg-white/95 shadow-xs flex flex-col gap-0 py-0 h-full">
      <CardHeader className="border-b border-emerald-100/70 px-4 py-3 flex flex-row items-center justify-between space-y-0 gap-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm text-slate-900 font-semibold flex items-center gap-2">
            <Radio className="size-4 text-emerald-600" />
            Lịch sử nhận dữ liệu cảm biến (Telemetry)
          </CardTitle>
          <Badge variant="outline" className="border-emerald-300 text-emerald-800 bg-emerald-50 font-normal text-xs">
            {totalItems} bản ghi
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {devices.length > 0 && (
            <select
              value={selectedDevId}
              onChange={(e) => onSelectDev(e.target.value)}
              className="h-8 rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-black outline-none transition-colors hover:bg-slate-100 focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600"
            >
              <option value="all">-- Tất cả thiết bị --</option>
              {devices.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name || d._id} ({d.type || 'Thiết bị'})
                </option>
              ))}
            </select>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onRefresh}
            disabled={loading}
            className="h-8 gap-1 border-slate-300 bg-slate-100 hover:bg-slate-200 text-black text-xs font-semibold px-2.5 shadow-none"
          >
            <RefreshCw className={`size-3.5 text-black ${loading ? 'animate-spin' : ''}`} />
            Tải lại
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 flex flex-col justify-between">
        <div className="flex-1 w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thời gian nhận</TableHead>
                <TableHead>Mã thiết bị</TableHead>
                <TableHead>Nhiệt độ</TableHead>
                <TableHead>Độ ẩm không khí</TableHead>
                <TableHead>Độ ẩm đất</TableHead>
                <TableHead className="text-right">Mực nước bể</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-sm text-slate-500">
                    Đang tải dữ liệu telemetry...
                  </TableCell>
                </TableRow>
              ) : displayed.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-sm text-slate-500">
                    Chưa có bản ghi telemetry nào
                  </TableCell>
                </TableRow>
              ) : (
                displayed.map((item, idx) => (
                  <TableRow
                    key={item._id || `${item.deviceId}-${item.timestamp}-${idx}`}
                    onClick={() =>
                      onRowClick?.(
                        item,
                        `Chi tiết Bản ghi Telemetry: ${item.deviceId} (${item.timestamp ? new Date(item.timestamp).toLocaleString() : 'N/A'})`
                      )
                    }
                  >
                    <TableCell className="font-mono text-xs text-black whitespace-nowrap">
                      {item.timestamp ? new Date(item.timestamp).toLocaleString() : 'N/A'}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-black">
                      {item.deviceId}
                    </TableCell>
                    <TableCell className="text-xs text-black">
                      <Badge variant="outline" className="border-amber-300 text-amber-800 bg-amber-50 font-normal">
                        {item.temperature !== undefined && item.temperature !== null ? `${item.temperature} °C` : 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-black">
                      <Badge variant="outline" className="border-cyan-300 text-cyan-800 bg-cyan-50 font-normal">
                        {item.humidity !== undefined && item.humidity !== null ? `${item.humidity} %` : 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-black">
                      <Badge variant="outline" className="border-emerald-300 text-emerald-800 bg-emerald-50 font-normal">
                        {item.soil_humidity !== undefined && item.soil_humidity !== null ? `${item.soil_humidity} %` : 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-black">
                      <Badge variant="outline" className="border-blue-300 text-blue-800 bg-blue-50 font-normal">
                        {item.water_level !== undefined && item.water_level !== null ? `${item.water_level} %` : 'N/A'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Thanh phân trang limit = 50 */}
        <div className="border-t border-slate-200 bg-slate-50/80 px-3 py-2 flex items-center justify-between text-xs text-slate-700 mt-auto select-none">
          <span className="font-medium text-[11px] sm:text-xs">
            Trang {safePage} / {totalPages} <span className="text-slate-400 font-normal">({totalItems} bản ghi · 50 bản ghi/trang)</span>
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs text-black border-slate-300 hover:bg-slate-200 gap-0.5"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
            >
              <ChevronLeft className="size-3.5" />
              <span>Trước</span>
            </Button>
            <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-xs font-semibold text-slate-800 min-w-6 text-center">
              {safePage}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs text-black border-slate-300 hover:bg-slate-200 gap-0.5"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
            >
              <span>Sau</span>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function AuthScreen({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: (user: any) => void
}) {
  const [register, setRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const endpoint = register ? '/api/auth/register' : '/api/auth/login'
      const res = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      if (res.token) {
        localStorage.setItem('auth_token', res.token)
      }
      onSuccess(res.user)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Lỗi xác thực')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <Card className="w-full max-w-md border-slate-200 bg-white shadow-xl">
        <CardHeader>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Droplets className="size-5 text-cyan-600" />
              <span className="font-semibold">AquaSense</span>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X />
            </Button>
          </div>
          <CardTitle>{register ? 'Đăng ký tài khoản' : 'Đăng nhập hệ thống'}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {register ? 'Thiết lập tài khoản quản lý tưới nước thông minh.' : 'Đăng nhập vào bảng điều khiển vườn.'}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="p-2 text-xs text-red-600 bg-red-50 rounded border border-red-200">
                {error}
              </div>
            )}
            <div>
              <Label htmlFor="username">Tên người dùng (Username)</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="vd: admin"
                className="text-black"
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="text-black"
                required
              />
            </div>
            <Button disabled={submitting} type="submit" className="w-full bg-emerald-600 text-white hover:bg-emerald-700">
              {submitting ? 'Đang xử lý...' : register ? 'Đăng ký' : 'Đăng nhập'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setRegister(!register)
                setError('')
              }}
            >
              {register ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký ngay'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function AddModal({
  kind,
  assets,
  onClose,
  onSuccess,
}: {
  kind: 'assets' | 'sensors'
  assets: AssetItem[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState(kind === 'assets' ? 'plant' : 'sensor')
  const [deviceId, setDeviceId] = useState('')
  const [selectedAssetId, setSelectedAssetId] = useState(assets[0]?._id || '')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (kind === 'assets') {
        if (!name.trim()) throw new Error('Vui lòng nhập tên cây / khu vườn')
        await apiRequest('/api/assets', {
          method: 'POST',
          body: JSON.stringify({ name: name.trim(), type }),
        })
      } else {
        if (!deviceId.trim()) throw new Error('Vui lòng nhập ID thiết bị (dùng trong MQTT topic)')
        await apiRequest('/api/devices', {
          method: 'POST',
          body: JSON.stringify({
            id: deviceId.trim(),
            name: name.trim() || deviceId.trim(),
            type,
            assetId: selectedAssetId || null,
          }),
        })
      }
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu dữ liệu')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <Card className="w-full max-w-md border-slate-200 bg-white shadow-2xl">
        <CardHeader className="border-b border-slate-100 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-slate-900 font-semibold">
              {kind === 'assets' ? 'Thêm Cây / Khu vườn mới' : 'Thêm Thiết bị / Cảm biến mới'}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Đóng" className="size-8">
              <X className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="p-2.5 text-xs text-red-600 bg-red-50 rounded border border-red-200">
                {error}
              </div>
            )}

            {kind === 'assets' ? (
              <>
                <div>
                  <Label htmlFor="asset-name">Tên cây / Khu vực</Label>
                  <Input
                    id="asset-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="vd: Cây hoa hồng / Luống rau số 1"
                    className="text-black mt-1"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="asset-type">Loại cây / Mục đích</Label>
                  <Input
                    id="asset-type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    placeholder="vd: plant, greenhouse, garden..."
                    className="text-black mt-1"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor="device-id">Mã thiết bị (Device ID)</Label>
                  <Input
                    id="device-id"
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                    placeholder="vd: ESP32-01, SENSOR-DHT22..."
                    className="text-black mt-1"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="device-name">Tên hiển thị</Label>
                  <Input
                    id="device-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="vd: Cảm biến độ ẩm đất khu A"
                    className="text-black mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="device-type">Loại thiết bị</Label>
                  <Input
                    id="device-type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    placeholder="vd: sensor, pump, light..."
                    className="text-black mt-1"
                  />
                </div>
                {assets.length > 0 && (
                  <div>
                    <Label htmlFor="device-asset">Thuộc cây / khu vực nào</Label>
                    <select
                      id="device-asset"
                      value={selectedAssetId}
                      onChange={(e) => setSelectedAssetId(e.target.value)}
                      className="mt-1 flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-black outline-none"
                    >
                      <option value="">-- Không gán --</option>
                      {assets.map((a) => (
                        <option key={a._id} value={a._id}>
                          {a.name} ({a.type})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={submitting}
                className="border-slate-300 text-black hover:bg-slate-100"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {submitting ? 'Đang lưu...' : 'Lưu vào DB'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

const FIELD_LABELS: Record<string, string> = {
  _id: 'Mã định danh (ID)',
  name: 'Tên đối tượng',
  type: 'Loại / Phân loại',
  deviceId: 'Mã thiết bị',
  assetId: 'Thuộc cây / Khu vườn',
  online: 'Trạng thái hoạt động',
  pumpState: 'Trạng thái máy bơm',
  lastSeenAt: 'Hoạt động lần cuối',
  startedAt: 'Thời gian bắt đầu tưới',
  endedAt: 'Thời gian kết thúc tưới',
  durationSec: 'Thời lượng tưới (giây)',
  liters: 'Lượng nước tiêu thụ (Lít)',
  createdAt: 'Ngày tạo',
  flow_rate_lpm: 'Lưu lượng bơm (Lít/phút)',
  safe_min_soil_humidity: 'Độ ẩm đất tối thiểu an toàn (%)',
  safe_max_soil_humidity: 'Độ ẩm đất tối đa an toàn (%)',
  firmware_version: 'Phiên bản Firmware',
  timestamp: 'Thời gian nhận dữ liệu',
  temperature: 'Nhiệt độ (°C)',
  humidity: 'Độ ẩm không khí (%)',
  soil_humidity: 'Độ ẩm đất (%)',
  water_level: 'Mực nước bể (%)',
}

const IGNORED_FIELDS = new Set(['__v', 'id', 'updatedAt'])

function DetailModal({
  title,
  data,
  kind,
  assets,
  onClose,
  onUpdated,
}: {
  title: string
  data: Record<string, any>
  kind?: 'sensors' | 'assets' | 'history' | 'telemetry'
  assets: AssetItem[]
  onClose: () => void
  onUpdated?: () => void
}) {
  const isDevice = kind === 'sensors' || Boolean(data._id && ('pumpState' in data || 'online' in data))
  const isAsset = kind === 'assets' || Boolean(data._id && 'name' in data && !('deviceId' in data) && !('pumpState' in data))
  const canEdit = isDevice || isAsset

  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(data.name || '')
  const [type, setType] = useState(data.type || '')
  const [assetId, setAssetId] = useState(data.assetId || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const formatValue = (key: string, val: any): string => {
    if (val === null || val === undefined) return 'Chưa có'
    if (key === 'online') return val ? 'Trực tuyến (Online)' : 'Ngoại tuyến (Offline)'
    if (key === 'pumpState') return val === 'ON' ? 'Đang bật' : 'Đang tắt'
    if (key === 'assetId') {
      const ast = assets.find((a) => a._id === val)
      return ast ? `${ast.name} (${val})` : String(val)
    }
    if (typeof val === 'boolean') return val ? 'Bật' : 'Tắt'
    if (key === 'temperature' && typeof val === 'number') return `${val} °C`
    if (key === 'humidity' && typeof val === 'number') return `${val} %`
    if (key === 'soil_humidity' && typeof val === 'number') return `${val} %`
    if (key === 'water_level' && typeof val === 'number') return `${val} %`
    if (key === 'timestamp' && val) {
      try {
        const d = new Date(val)
        if (!isNaN(d.getTime())) return d.toLocaleString('vi-VN')
      } catch {}
    }
    if (key.includes('At') && typeof val === 'string') {
      try {
        const d = new Date(val)
        if (!isNaN(d.getTime())) return d.toLocaleString('vi-VN')
      } catch {}
    }
    if (key === 'durationSec') return `${val} giây`
    if (key === 'liters') return `${val} Lít`
    if (typeof val === 'object') {
      if (Array.isArray(val)) return val.length ? val.join(', ') : 'Trống'
      return JSON.stringify(val, null, 2)
    }
    return String(val)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (isDevice) {
        await apiRequest(`/api/devices/${data._id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: name.trim(),
            type: type.trim(),
            assetId: assetId || null,
          }),
        })
      } else if (isAsset) {
        await apiRequest(`/api/assets/${data._id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: name.trim(),
            type: type.trim(),
          }),
        })
      }
      if (onUpdated) onUpdated()
      setIsEditing(false)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Lỗi khi cập nhật dữ liệu')
    } finally {
      setSubmitting(false)
    }
  }

  // Nếu là thiết bị hoặc asset thì không hiển thị _id; device không lặp lại createdAt, lastSeenAt, online ở danh sách
  const ignoredForList = new Set([
    ...IGNORED_FIELDS,
    ...(canEdit ? ['_id'] : []),
    ...(isDevice ? ['createdAt', 'lastSeenAt', 'online'] : []),
  ])
  const entries = Object.entries(data).filter(([key]) => !ignoredForList.has(key))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <Card className="w-full max-w-lg border-slate-200 bg-white shadow-2xl flex flex-col max-h-[88vh]">
        <CardHeader className="border-b border-slate-100 pb-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base text-slate-900 font-semibold">{title}</CardTitle>
              {canEdit && (
                <div className="flex items-center gap-1.5 ml-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5">
                  <span className="text-[11px] font-medium text-black">Chỉnh sửa</span>
                  <Switch
                    checked={isEditing}
                    onCheckedChange={setIsEditing}
                    aria-label="Chế độ chỉnh sửa"
                  />
                </div>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Đóng" className="size-8">
              <X className="size-4" />
            </Button>
          </div>

          {/* Badges trên Header Modal cho Thiết bị (online, lastSeenAt, createdAt) */}
          {isDevice && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <Badge
                variant="default"
                className={
                  data.online
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px]'
                    : 'bg-red-500 hover:bg-red-600 text-white font-medium text-[11px]'
                }
              >
                {data.online ? '● Online' : '○ Offline'}
              </Badge>
              {data.lastSeenAt && (
                <Badge variant="outline" className="border-slate-300 text-black text-[11px] font-normal bg-slate-50">
                  Lần cuối: {new Date(data.lastSeenAt).toLocaleString('vi-VN')}
                </Badge>
              )}
              {data.createdAt && (
                <Badge variant="outline" className="border-slate-300 text-black text-[11px] font-normal bg-slate-50">
                  Tạo ngày: {new Date(data.createdAt).toLocaleDateString('vi-VN')}
                </Badge>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="overflow-y-auto p-4 flex-1">
          {error && (
            <div className="mb-3 p-2 text-xs text-red-600 bg-red-50 rounded border border-red-200">
              {error}
            </div>
          )}

          {isEditing ? (
            <form onSubmit={handleSave} id="edit-form" className="flex flex-col gap-3.5">
              <div>
                <Label htmlFor="edit-name">
                  {isDevice ? 'Tên thiết bị' : 'Tên cây / Khu vực'}
                </Label>
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-black mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="edit-type">
                  {isDevice ? 'Loại thiết bị' : 'Loại cây / Mục đích'}
                </Label>
                <Input
                  id="edit-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="text-black mt-1"
                />
              </div>

              {isDevice && (
                <div>
                  <Label htmlFor="edit-asset">Thuộc cây / Khu vườn nào</Label>
                  <select
                    id="edit-asset"
                    value={assetId}
                    onChange={(e) => setAssetId(e.target.value)}
                    className="mt-1 flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-black outline-none"
                  >
                    <option value="">-- Không gán --</option>
                    {assets.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.name} ({a.type})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </form>
          ) : (
            <div className="flex flex-col gap-2.5">
              {entries.map(([key, val]) => (
                <div
                  key={key}
                  className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-slate-100 pb-2.5 text-xs"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-900">
                      {FIELD_LABELS[key] || key}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">{key}</span>
                  </div>
                  <span className="font-medium text-black break-all text-left sm:text-right bg-slate-50 px-2.5 py-1 rounded border border-slate-200/80 max-w-full">
                    {formatValue(key, val)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>

        <div className="border-t border-slate-100 p-3 flex justify-end gap-2 bg-slate-50 rounded-b-xl">
          {isEditing ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setName(data.name || '')
                  setType(data.type || '')
                  setAssetId(data.assetId || '')
                  setIsEditing(false)
                  setError('')
                }}
                disabled={submitting}
                className="border-slate-300 bg-white text-black hover:bg-slate-100 text-xs font-semibold px-4"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                form="edit-form"
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4"
              >
                {submitting ? 'Đang lưu...' : 'Lưu vào DB'}
              </Button>
            </>
          ) : (
            <Button
              variant="default"
              onClick={onClose}
              className="border border-slate-300 bg-slate-200 text-black text-xs font-semibold px-5"
            >
              Đóng
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}

export default function Page() {
  const [view, setView] = useState<View>('dashboard')
  const [open, setOpen] = useState(true)
  const [pumpOn, setPumpOn] = useState(false)
  const [auth, setAuth] = useState(false)
  const [addModalKind, setAddModalKind] = useState<'assets' | 'sensors' | null>(null)
  const [detailModalData, setDetailModalData] = useState<{
    data: any
    title: string
    kind?: 'sensors' | 'assets' | 'history' | 'telemetry'
  } | null>(null)
  const [user, setUser] = useState<any>(null)

  // Data states
  const [devices, setDevices] = useState<DeviceItem[]>([])
  const [wateringEvents, setWateringEvents] = useState<WateringEventItem[]>([])
  const [assets, setAssets] = useState<AssetItem[]>([])
  const [telemetryLogs, setTelemetryLogs] = useState<any[]>([])
  const [telemetryLogsLoading, setTelemetryLogsLoading] = useState<boolean>(false)
  const [selectedTelemetryDevId, setSelectedTelemetryDevId] = useState<string>('all')
  const [selectedDashboardAssetId, setSelectedDashboardAssetId] = useState<string>('')
  const selectedDashboardAssetIdRef = useRef<string>(selectedDashboardAssetId)
  const devicesRef = useRef<DeviceItem[]>(devices)
  const [pumpStartTime, setPumpStartTime] = useState<number | null>(null)
  const [waitingFirstTelemetry, setWaitingFirstTelemetry] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const waitingFirstTelemetryRef = useRef(false)
  const pumpStartTimeRef = useRef<number | null>(null)

  // Settings view states (cấu hình Attribute ngưỡng an toàn)
  const [selectedSettingsAssetId, setSelectedSettingsAssetId] = useState<string>('')
  const [settingSoilMin, setSettingSoilMin] = useState<number>(30)
  const [settingSoilMax, setSettingSoilMax] = useState<number>(70)
  const [settingWaterMin, setSettingWaterMin] = useState<number>(20)
  const [settingWaterMax, setSettingWaterMax] = useState<number>(95)
  const [savingSettings, setSavingSettings] = useState<boolean>(false)
  const [settingsSaveMsg, setSettingsSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    selectedDashboardAssetIdRef.current = selectedDashboardAssetId
  }, [selectedDashboardAssetId])

  useEffect(() => {
    devicesRef.current = devices
  }, [devices])

  // Đồng bộ chọn cây mặc định ở Settings
  useEffect(() => {
    if (!selectedSettingsAssetId && assets.length > 0) {
      setSelectedSettingsAssetId(assets[0]._id)
    }
  }, [assets, selectedSettingsAssetId])

  // Nạp dữ liệu Attribute của device tương ứng vào 2 thanh bar khi chọn cây
  useEffect(() => {
    if (!selectedSettingsAssetId) return
    const matchedDev = devices.find((d) => {
      const dAssetId = typeof d.assetId === 'object' && d.assetId !== null ? (d.assetId as any)._id : d.assetId
      return String(dAssetId) === String(selectedSettingsAssetId)
    })
    const attr = matchedDev?.attributes
    setSettingSoilMin(typeof attr?.safe_min_soil_humidity === 'number' ? attr.safe_min_soil_humidity : 30)
    setSettingSoilMax(typeof attr?.safe_max_soil_humidity === 'number' ? attr.safe_max_soil_humidity : 70)
    setSettingWaterMin(typeof attr?.safe_min_water_level === 'number' ? attr.safe_min_water_level : 20)
    setSettingWaterMax(typeof attr?.safe_max_water_level === 'number' ? attr.safe_max_water_level : 95)
    setSettingsSaveMsg(null)
  }, [selectedSettingsAssetId, devices])

  // Lưu cấu hình Attribute vào DB
  const handleSaveAttributes = async () => {
    const matchedDev = devices.find((d) => {
      const dAssetId = typeof d.assetId === 'object' && d.assetId !== null ? (d.assetId as any)._id : d.assetId
      return String(dAssetId) === String(selectedSettingsAssetId)
    })
    if (!matchedDev) {
      setSettingsSaveMsg({ type: 'error', text: 'Cây đã chọn chưa được gán thiết bị nào!' })
      return
    }

    setSavingSettings(true)
    setSettingsSaveMsg(null)
    try {
      const payload = {
        safe_min_soil_humidity: settingSoilMin,
        safe_max_soil_humidity: settingSoilMax,
        safe_min_water_level: settingWaterMin,
        safe_max_water_level: settingWaterMax,
      }

      const devIdParam = encodeURIComponent(matchedDev._id)
      let saved = false

      // 1. Thử gửi tới PUT /api/devices/:id/attributes
      try {
        await apiRequest(`/api/devices/${devIdParam}/attributes`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        saved = true
      } catch (err: any) {
        // 2. Nếu server chưa restart (trả về 404 Not Found), fallback sang PUT /api/devices/:id
        if (err.message?.includes('Not Found') || err.message?.includes('404')) {
          try {
            await apiRequest(`/api/devices/${devIdParam}`, {
              method: 'PUT',
              body: JSON.stringify(payload),
            })
            saved = true
          } catch (err2: any) {
            // 3. Nếu thiết bị chưa có trong DB, tự động upsert qua POST /api/devices
            if (err2.message?.includes('Not Found') || err2.message?.includes('404') || err2.message?.includes('Khong tim thay')) {
              await apiRequest(`/api/devices`, {
                method: 'POST',
                body: JSON.stringify({ id: matchedDev._id, name: matchedDev.name || matchedDev._id, ...payload }),
              })
              saved = true
            } else {
              throw err2
            }
          }
        } else {
          throw err
        }
      }

      // Cập nhật ngay trong state devices để Dashboard nhận tức thì
      setDevices((prev) =>
        prev.map((d) =>
          d._id === matchedDev._id
            ? { ...d, attributes: { ...d.attributes, ...payload } }
            : d
        )
      )

      setSettingsSaveMsg({
        type: 'success',
        text: `Đã lưu thành công cấu hình Attribute cho thiết bị ${matchedDev.name || matchedDev._id}!`,
      })
      setTimeout(() => setSettingsSaveMsg(null), 4000)
    } catch (err: any) {
      console.error('Lỗi lưu Attribute:', err)
      setSettingsSaveMsg({ type: 'error', text: err.message || 'Lỗi khi lưu cấu hình vào cơ sở dữ liệu' })
    } finally {
      setSavingSettings(false)
    }
  }

  const [telemetryHistory, setTelemetryHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [latestTelemetry, setLatestTelemetry] = useState<{
    temperature: number | null
    humidity: number | null
    soil_humidity: number | null
    water_level: number | null
  }>({
    temperature: null,
    humidity: null,
    soil_humidity: null,
    water_level: null,
  })

  // Định dạng thời gian trôi qua (hh:mm:ss hoặc mm:ss)
  const formatDuration = (totalSeconds: number): string => {
    const hrs = Math.floor(totalSeconds / 3600)
    const mins = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  // Đếm thời gian khi máy bơm đã bật và đã nhận bản tin telemetry đầu tiên
  useEffect(() => {
    if (!pumpOn || pumpStartTime === null) {
      return
    }

    const interval = setInterval(() => {
      const now = Date.now()
      const diffSec = Math.max(0, Math.floor((now - pumpStartTime) / 1000))
      setElapsedSeconds(diffSec)
    }, 1000)

    return () => clearInterval(interval)
  }, [pumpOn, pumpStartTime])

  const [selectedHistoryAssetId, setSelectedHistoryAssetId] = useState<string>('all')
  const [historyLoading, setHistoryLoading] = useState<boolean>(false)

  // Hàm tải lại lịch sử tưới nước từ Backend (hỗ trợ filter theo assetId)
  const refreshWateringHistory = async (targetAssets?: AssetItem[], targetAssetId?: string) => {
    const listToFetch = targetAssets || assets
    const filterId = targetAssetId !== undefined ? targetAssetId : selectedHistoryAssetId
    if (!listToFetch || listToFetch.length === 0) return
    try {
      if (filterId && filterId !== 'all') {
        const list = await apiRequest<WateringEventItem[]>(`/api/assets/${filterId}/watering-history`).catch(() => [])
        if (Array.isArray(list)) {
          const formatted = list.map((item) => ({ ...item, assetId: item.assetId || filterId }))
          formatted.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
          setWateringEvents(formatted)
        }
      } else {
        const allHistories: WateringEventItem[] = []
        for (const ast of listToFetch) {
          const list = await apiRequest<WateringEventItem[]>(`/api/assets/${ast._id}/watering-history`).catch(() => [])
          if (Array.isArray(list)) {
            list.forEach((item) => {
              allHistories.push({ ...item, assetId: item.assetId || ast._id })
            })
          }
        }
        allHistories.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        setWateringEvents(allHistories)
      }
    } catch (err) {
      console.error('Lỗi tải lại lịch sử tưới:', err)
    }
  }

  // Hàm gửi request GET khi người dùng chọn lọc cây ở bảng Nhật ký tưới nước
  const handleSelectAssetHistory = async (assetId: string) => {
    setSelectedHistoryAssetId(assetId)
    setHistoryLoading(true)
    try {
      if (assetId === 'all') {
        await refreshWateringHistory(assets, 'all')
      } else {
        const list = await apiRequest<WateringEventItem[]>(`/api/assets/${assetId}/watering-history`).catch(() => [])
        if (Array.isArray(list)) {
          const formatted = list.map((item) => ({ ...item, assetId: item.assetId || assetId }))
          formatted.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
          setWateringEvents(formatted)
        } else {
          setWateringEvents([])
        }
      }
    } catch (err) {
      console.error('Lỗi tải lịch sử tưới theo cây:', err)
    } finally {
      setHistoryLoading(false)
    }
  }

  // Hàm tải dữ liệu Telemetry cho view Lịch sử nhận dữ liệu
  const fetchTelemetryLogs = async (devId: string, currentDevs?: DeviceItem[]) => {
    setTelemetryLogsLoading(true)
    try {
      const devSource = currentDevs || devices
      if (devId && devId !== 'all') {
        const data = await apiRequest<any[]>(`/api/devices/${devId}/telemetry?limit=500`).catch(() => [])
        setTelemetryLogs(Array.isArray(data) ? data : [])
      } else {
        if (devSource.length > 0) {
          const all: any[] = []
          for (const d of devSource) {
            const list = await apiRequest<any[]>(`/api/devices/${d._id}/telemetry?limit=200`).catch(() => [])
            if (Array.isArray(list)) all.push(...list)
          }
          all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          setTelemetryLogs(all)
        } else {
          setTelemetryLogs([])
        }
      }
    } catch (err) {
      console.error('Lỗi nạp lịch sử telemetry:', err)
    } finally {
      setTelemetryLogsLoading(false)
    }
  }

  // Hàm cập nhật telemetry theo Asset (quan hệ device - asset là 1 - 1)
  const loadTelemetryForAsset = async (targetAssetId: string, currentDevices?: DeviceItem[]) => {
    if (!targetAssetId) {
      setLatestTelemetry({
        temperature: null,
        humidity: null,
        soil_humidity: null,
        water_level: null,
      })
      setTelemetryHistory([])
      return
    }

    const devSource = currentDevices || devicesRef.current || devices
    // Quan hệ device - asset là 1 - 1: query device tương ứng với assetId
    const matchedDev = devSource.find((d) => {
      const dAssetId = typeof d.assetId === 'object' && d.assetId !== null ? (d.assetId as any)._id : d.assetId
      return String(dAssetId) === String(targetAssetId)
    })

    if (!matchedDev) {
      // Cây này chưa được gán thiết bị nào -> hiển thị placeholder "--"
      setLatestTelemetry({
        temperature: null,
        humidity: null,
        soil_humidity: null,
        water_level: null,
      })
      setTelemetryHistory([])
      setPumpOn(false)
      return
    }

    // Có thiết bị tương ứng (1 - 1) -> nạp telemetry của device này
    if (matchedDev.pumpState) {
      setPumpOn(matchedDev.pumpState === 'ON')
    }

    try {
      const telem = await apiRequest<any[]>(`/api/devices/${matchedDev._id}/telemetry?limit=100`).catch(() => [])
      if (telem && telem.length > 0) {
        const latest = telem[0]
        setLatestTelemetry({
          temperature: latest.temperature ?? null,
          humidity: latest.humidity ?? null,
          soil_humidity: latest.soil_humidity ?? null,
          water_level: latest.water_level ?? null,
        })
        const chartData = telem
          .slice()
          .reverse()
          .map((item) => ({
            time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            temp: item.temperature,
            humidity: item.humidity,
            soil: item.soil_humidity,
            water: item.water_level,
          }))
        setTelemetryHistory(chartData)

        if (waitingFirstTelemetryRef.current && pumpStartTimeRef.current === null) {
          waitingFirstTelemetryRef.current = false
          setWaitingFirstTelemetry(false)
          const now = Date.now()
          setPumpStartTime(now)
          pumpStartTimeRef.current = now
        }
      } else {
        // Thiết bị chưa có bản ghi telemetry nào -> placeholder "--"
        setLatestTelemetry({
          temperature: null,
          humidity: null,
          soil_humidity: null,
          water_level: null,
        })
        setTelemetryHistory([])
      }
    } catch (err) {
      console.error('Lỗi nạp telemetry cho cây:', err)
      setLatestTelemetry({
        temperature: null,
        humidity: null,
        soil_humidity: null,
        water_level: null,
      })
      setTelemetryHistory([])
    }
  }

  // Tải dữ liệu ban đầu
  const fetchData = async () => {
    setLoading(true)
    try {
      // 1. Lấy danh sách thiết bị
      const devList = await apiRequest<DeviceItem[]>('/api/devices').catch(() => [])
      setDevices(devList)

      // 2. Lấy danh sách Assets (Cây / Khu vườn)
      const assetList = await apiRequest<AssetItem[]>('/api/assets').catch(() => [])
      setAssets(assetList)

      // Thiết lập cây được chọn mặc định nếu chưa có
      let currentAssetId = selectedDashboardAssetId
      if (!currentAssetId && assetList.length > 0) {
        currentAssetId = assetList[0]._id
        setSelectedDashboardAssetId(currentAssetId)
      }

      // Nạp telemetry cho cây được chọn (query device tương ứng)
      if (currentAssetId) {
        await loadTelemetryForAsset(currentAssetId, devList)
      }

      // 3. Lịch sử tưới
      await refreshWateringHistory(assetList)

      // 4. Lịch sử Telemetry
      await fetchTelemetryLogs('all', devList)

      // 5. Lấy thông tin user hiện tại nếu có token
      const me = await apiRequest('/api/auth/me').catch(() => null)
      if (me?.user) setUser(me.user)
    } catch (err) {
      console.error('Lỗi nạp dữ liệu:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Kết nối WebSocket để nhận dữ liệu Telemetry thời gian thực
  useEffect(() => {
    if (typeof window === 'undefined') return
    const wsUrl = `ws://${window.location.hostname}:3001/ws`
    let ws: WebSocket | null = null

    try {
      ws = new WebSocket(wsUrl)
      ws.onopen = () => {
        // Đăng ký nhận dữ liệu từ tất cả các thiết bị đang có
        if (devices.length > 0) {
          ws?.send(
            JSON.stringify({
              type: 'subscribe',
              deviceIds: devices.map((d) => d._id),
            })
          )
        }
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'TELEMETRY' && msg.data) {
            // Tìm deviceId tương ứng với Asset đang chọn trên Dashboard (quan hệ 1 - 1)
            const currentAssetId = selectedDashboardAssetIdRef.current
            const devList = devicesRef.current
            const matchedDev = devList.find((d) => {
              const dAssetId = typeof d.assetId === 'object' && d.assetId !== null ? (d.assetId as any)._id : d.assetId
              return String(dAssetId) === String(currentAssetId)
            })
            const targetDeviceId = matchedDev ? matchedDev._id : null

            // Check dữ liệu telemetry mqtt gửi, nếu deviceId trùng thì hiển thị các dữ liệu lên các card tương ứng
            if (targetDeviceId && msg.deviceId === targetDeviceId) {
              setLatestTelemetry({
                temperature: msg.data.temperature ?? null,
                humidity: msg.data.humidity ?? null,
                soil_humidity: msg.data.soil_humidity ?? null,
                water_level: msg.data.water_level ?? null,
              })

              // Thêm điểm dữ liệu mới vào biểu đồ (duy trì 100 bản ghi mới nhất)
              const newPoint = {
                time: new Date(msg.data.timestamp || Date.now()).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                }),
                temp: msg.data.temperature,
                humidity: msg.data.humidity,
                soil: msg.data.soil_humidity,
                water: msg.data.water_level,
              }
              setTelemetryHistory((prev) => [...prev.slice(-99), newPoint])
            }

            // Đồng thời thêm bản tin mới vào bảng lịch sử nhận dữ liệu Telemetry
            const newLogDoc = {
              deviceId: msg.deviceId,
              timestamp: msg.data.timestamp || new Date().toISOString(),
              temperature: msg.data.temperature,
              humidity: msg.data.humidity,
              soil_humidity: msg.data.soil_humidity,
              water_level: msg.data.water_level,
            }
            setTelemetryLogs((prev) => [newLogDoc, ...prev.slice(0, 499)])

            // Khi bật toggle, thời gian được tính từ lúc nhận telemetry đầu tiên sau khi bật toggle
            if (targetDeviceId && msg.deviceId === targetDeviceId && waitingFirstTelemetryRef.current) {
              waitingFirstTelemetryRef.current = false
              setWaitingFirstTelemetry(false)
              const now = Date.now()
              setPumpStartTime(now)
              pumpStartTimeRef.current = now
              setElapsedSeconds(0)
            }
          } else if (msg.type === 'PUMP_STATE') {
            const currentAssetId = selectedDashboardAssetIdRef.current
            const devList = devicesRef.current
            const matchedDev = devList.find((d) => {
              const dAssetId = typeof d.assetId === 'object' && d.assetId !== null ? (d.assetId as any)._id : d.assetId
              return String(dAssetId) === String(currentAssetId)
            })
            const targetDeviceId = matchedDev ? matchedDev._id : null

            if (targetDeviceId && msg.deviceId === targetDeviceId) {
              const isTurnedOn = msg.data?.state === 'ON'
              setPumpOn(isTurnedOn)
              if (!isTurnedOn) {
                waitingFirstTelemetryRef.current = false
                setWaitingFirstTelemetry(false)
                setPumpStartTime(null)
                pumpStartTimeRef.current = null
                setElapsedSeconds(0)
                refreshWateringHistory()
              }
            }
          }
        } catch (e) {
          console.error('Lỗi phân tích WebSocket message:', e)
        }
      }
    } catch (e) {
      console.warn('Không thể mở WebSocket connection:', e)
    }

    return () => {
      if (ws) ws.close()
    }
  }, [devices])

  // Điều khiển máy bơm
  const handleTogglePump = async (checked: boolean) => {
    setPumpOn(checked)
    const currentAssetId = selectedDashboardAssetIdRef.current
    const devList = devicesRef.current
    const matchedDev = devList.find((d) => {
      const dAssetId = typeof d.assetId === 'object' && d.assetId !== null ? (d.assetId as any)._id : d.assetId
      return String(dAssetId) === String(currentAssetId)
    })
    const targetDevId = matchedDev ? matchedDev._id : (devList.length > 0 ? devList[0]._id : '')

    if (checked) {
      // Bật toggle: Đánh dấu chờ telemetry đầu tiên để tính giờ
      waitingFirstTelemetryRef.current = true
      setWaitingFirstTelemetry(true)
      setPumpStartTime(null)
      pumpStartTimeRef.current = null
      setElapsedSeconds(0)
    } else {
      // Tắt toggle: Dừng đếm giờ và tải lại dữ liệu bảng Nhật ký tưới nước
      waitingFirstTelemetryRef.current = false
      setWaitingFirstTelemetry(false)
      setPumpStartTime(null)
      pumpStartTimeRef.current = null
      setElapsedSeconds(0)

      // Render lại dữ liệu table Nhật ký tưới nước
      await refreshWateringHistory()
      setTimeout(() => refreshWateringHistory(), 800)
      setTimeout(() => refreshWateringHistory(), 1800)
    }

    if (targetDevId) {
      try {
        await apiRequest(`/api/devices/${targetDevId}/command`, {
          method: 'POST',
          body: JSON.stringify({ action: 'WATER', state: checked ? 'ON' : 'OFF' }),
        })
      } catch (err: any) {
        console.error('Lỗi gửi lệnh bơm:', err)
        // Rollback nếu gửi lệnh lỗi
        setPumpOn(!checked)
        waitingFirstTelemetryRef.current = false
        setWaitingFirstTelemetry(false)
        setPumpStartTime(null)
        pumpStartTimeRef.current = null
      }
    }
  }

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' })
    } catch { }
    localStorage.removeItem('auth_token')
    setUser(null)
  }

  if (auth) {
    return (
      <AuthScreen
        onClose={() => setAuth(false)}
        onSuccess={(u) => setUser(u)}
      />
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#ebf5ee] via-[#f2faf4] to-[#e7f3ea] text-black">
      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-emerald-100 bg-white/95 p-4 shadow-xs backdrop-blur transition-transform ${open ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-xl bg-emerald-100/80">
              <Droplets className="size-5 text-emerald-700" />
            </div>
            <div>
              <p className="font-semibold text-emerald-950">AquaSense</p>
              <p className="text-[10px] text-emerald-700/80">Hệ thống tưới tự động</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close sidebar">
            <PanelLeft />
          </Button>
        </div>

        {/* Các nút điều hướng view */}
        <nav className="flex flex-col gap-1">
          {nav.map((item) => (
            <Button
              key={item.id}
              variant={view === item.id ? 'secondary' : 'ghost'}
              className="justify-start gap-3"
              onClick={() => setView(item.id)}
            >
              <item.icon />
              {item.label}
            </Button>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2 border-t border-slate-100 pt-4">
          {user ? (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold px-2 text-slate-800">Xin chào, {user.username}</p>
              <Button variant="ghost" size="sm" className="justify-start gap-2 text-red-600" onClick={handleLogout}>
                <LogOut className="size-4" /> Đăng xuất
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="justify-start gap-3"
              onClick={() => setAuth(true)}
            >
              <LogIn />
              Đăng nhập / Đăng ký
            </Button>
          )}
          <p className="px-2 text-[10px] text-muted-foreground">Greenhouse 01 · North plot</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`min-h-screen transition-[padding] ${open ? 'lg:pl-64' : ''}`}>
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-emerald-100 bg-white/85 px-5 backdrop-blur">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(!open)}
              aria-label="Toggle sidebar"
            >
              {open ? <Menu /> : <PanelLeft />}
            </Button>
            <div>
              <p className="text-sm font-semibold">{nav.find((n) => n.id === view)?.label}</p>
              <p className="text-xs text-muted-foreground">Hệ thống điều khiển & Giám sát thông minh</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (user ? setView('profile') : setAuth(true))}
              className="gap-2 text-black font-medium"
            >
              <UserRound className="size-4" /> {user ? user.username : 'Tài khoản'}
            </Button>
          </div>
        </header>

        {/* View Details */}
        <div className="mx-auto max-w-[1500px] p-5 sm:p-8">
          {view === 'dashboard' && (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-700">
                    01 / Giám sát trực tiếp
                  </p>
                  <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                    Thông số thời gian thực
                  </h2>
                </div>

                <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 shadow-xs">
                  <Sprout className="size-4 text-emerald-600 shrink-0" />
                  <Label htmlFor="dashboard-tree-select" className="text-xs font-semibold text-black whitespace-nowrap">
                    Theo dõi theo Cây:
                  </Label>
                  <select
                    id="dashboard-tree-select"
                    value={selectedDashboardAssetId}
                    onChange={(e) => {
                      const newAssetId = e.target.value
                      setSelectedDashboardAssetId(newAssetId)
                      selectedDashboardAssetIdRef.current = newAssetId
                      loadTelemetryForAsset(newAssetId, devices)
                    }}
                    className="h-8 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-black outline-none transition-colors hover:bg-slate-100 focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600"
                  >
                    {assets.length === 0 ? (
                      <option value="">-- Chưa có cây/khu vườn nào --</option>
                    ) : (
                      assets.map((a) => {
                        const linkedDev = devices.find((d) => {
                          const dAssetId = typeof d.assetId === 'object' && d.assetId !== null ? (d.assetId as any)._id : d.assetId
                          return String(dAssetId) === String(a._id)
                        })
                        return (
                          <option key={a._id} value={a._id}>
                            {a.name} ({a.type}) {linkedDev ? `[${linkedDev.name || linkedDev._id}]` : '[Chưa có thiết bị]'}
                          </option>
                        )
                      })
                    )}
                  </select>
                </div>
              </div>

              {(() => {
                const matchedDev = devices.find((d) => {
                  const dAssetId = typeof d.assetId === 'object' && d.assetId !== null ? (d.assetId as any)._id : d.assetId
                  return String(dAssetId) === String(selectedDashboardAssetId)
                })
                const attr = matchedDev?.attributes
                const minSoil = typeof attr?.safe_min_soil_humidity === 'number' ? attr.safe_min_soil_humidity : 30
                const maxSoil = typeof attr?.safe_max_soil_humidity === 'number' ? attr.safe_max_soil_humidity : 70
                const minWater = typeof attr?.safe_min_water_level === 'number' ? attr.safe_min_water_level : 20
                const maxWater = typeof attr?.safe_max_water_level === 'number' ? attr.safe_max_water_level : 95

                return (
                  <div className="mb-8 grid grid-cols-4 gap-2">
                    <Metric
                      icon={Thermometer}
                      label="Nhiệt độ"
                      value={latestTelemetry.temperature !== null && latestTelemetry.temperature !== undefined ? `${latestTelemetry.temperature}` : '--'}
                      unit={latestTelemetry.temperature !== null && latestTelemetry.temperature !== undefined ? '°C' : ''}
                      detail={latestTelemetry.temperature !== null && latestTelemetry.temperature !== undefined ? 'Cập nhật từ cảm biến' : 'Chưa có dữ liệu'}
                    />
                    <Metric
                      icon={Wind}
                      label="Độ ẩm không khí"
                      value={latestTelemetry.humidity !== null && latestTelemetry.humidity !== undefined ? `${latestTelemetry.humidity}` : '--'}
                      unit={latestTelemetry.humidity !== null && latestTelemetry.humidity !== undefined ? '%' : ''}
                      detail={latestTelemetry.humidity !== null && latestTelemetry.humidity !== undefined ? 'Mức chuẩn 45–65%' : 'Chưa có dữ liệu'}
                    />
                    <Metric
                      icon={Sprout}
                      label="Độ ẩm đất"
                      value={latestTelemetry.soil_humidity !== null && latestTelemetry.soil_humidity !== undefined ? `${latestTelemetry.soil_humidity}` : '--'}
                      unit={latestTelemetry.soil_humidity !== null && latestTelemetry.soil_humidity !== undefined ? '%' : ''}
                      detail={
                        matchedDev
                          ? `Ngưỡng an toàn: ${minSoil}% – ${maxSoil}%`
                          : 'Chưa có thiết bị liên kết'
                      }
                    >
                      <div className="relative size-14">
                        {latestTelemetry.soil_humidity !== null && latestTelemetry.soil_humidity !== undefined ? (
                          <>
                            <ResponsiveContainer width="100%" height="100%">
                              <RadialBarChart
                                innerRadius="72%"
                                outerRadius="100%"
                                startAngle={90}
                                endAngle={-270}
                                data={[{ value: latestTelemetry.soil_humidity, fill: '#0891b2' }]}
                              >
                                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                                <RadialBar background={{ fill: '#e2e8f0' }} dataKey="value" />
                              </RadialBarChart>
                            </ResponsiveContainer>
                            <span className="absolute inset-0 grid place-items-center text-[10px] font-semibold">
                              {latestTelemetry.soil_humidity}%
                            </span>
                          </>
                        ) : (
                          <div className="size-full rounded-full border-2 border-dashed border-slate-200 grid place-items-center text-xs font-semibold text-slate-400">
                            --
                          </div>
                        )}
                      </div>
                    </Metric>
                    <Metric
                      icon={Waves}
                      label="Mực nước bể chứa"
                      value={latestTelemetry.water_level !== null && latestTelemetry.water_level !== undefined ? `${latestTelemetry.water_level}` : '--'}
                      unit={latestTelemetry.water_level !== null && latestTelemetry.water_level !== undefined ? '%' : ''}
                      detail={
                        matchedDev
                          ? `Ngưỡng an toàn: ${minWater}% – ${maxWater}%`
                          : 'Chưa có thiết bị liên kết'
                      }
                    >
                      <div className="flex h-14 w-4 items-end overflow-hidden rounded-full bg-cyan-50">
                        <div
                          className="w-full bg-cyan-500 transition-all duration-300"
                          style={{
                            height: `${latestTelemetry.water_level !== null && latestTelemetry.water_level !== undefined ? latestTelemetry.water_level : 0}%`,
                          }}
                        />
                      </div>
                    </Metric>
                  </div>
                )
              })()}

              {/* Thanh điều khiển dưới 4 Cards */}
              <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-200/80 bg-emerald-100/40 p-4 shadow-xs">
                <Button
                  variant="default"
                  size="lg"
                  onClick={fetchData}
                  disabled={loading}
                  className="h-12 border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-950 text-sm font-semibold gap-2.5 px-6 shadow-xs"
                >
                  <RefreshCw className={`size-5 text-emerald-700 ${loading ? 'animate-spin' : ''}`} />
                  Làm mới dữ liệu
                </Button>

                <div className="flex items-center gap-4 rounded-lg border border-emerald-200/90 bg-white/95 px-5 py-2.5 shadow-xs">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-black">
                      Máy bơm nước:{' '}
                      {pumpOn ? (
                        <span className="text-emerald-700 font-bold">
                          ĐÃ BẬT {pumpStartTime !== null ? formatDuration(elapsedSeconds) : '00:00'}
                        </span>
                      ) : (
                        <span className="text-slate-600">ĐANG TẮT</span>
                      )}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {pumpOn
                        ? (pumpStartTime !== null
                            ? 'Thời gian tính từ lúc nhận telemetry đầu tiên'
                            : 'Đang chờ nhận telemetry đầu tiên để tính giờ...')
                        : 'Gửi lệnh điều khiển bật/tắt thiết bị'}
                    </span>
                  </div>
                  <Switch
                    checked={pumpOn}
                    onCheckedChange={handleTogglePump}
                    aria-label="Toggle water pump"
                    className="scale-125 data-[state=checked]:bg-emerald-600 ml-2"
                  />
                </div>
              </div>

              <SectionHeading eyebrow="02 / Dữ liệu lịch sử đo đạc" title="Biểu đồ phân tích" />
              <div className="grid gap-4 xl:grid-cols-3">
                <ChartCard title="Lịch sử nhiệt độ & độ ẩm (100 bản ghi mới nhất)">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={telemetryHistory.length ? telemetryHistory : [{ time: 'N/A', temp: 25, humidity: 60 }]}>
                      <CartesianGrid stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="temp" tick={{ fontSize: 10 }} domain={[10, 45]} />
                      <YAxis
                        yAxisId="humidity"
                        orientation="right"
                        tick={{ fontSize: 10 }}
                        domain={[20, 100]}
                      />
                      <Tooltip />
                      <Line
                        yAxisId="temp"
                        type="monotone"
                        dataKey="temp"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                        name="Nhiệt độ (°C)"
                      />
                      <Line
                        yAxisId="humidity"
                        type="monotone"
                        dataKey="humidity"
                        stroke="#0891b2"
                        strokeWidth={2}
                        dot={false}
                        name="Độ ẩm không khí (%)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Độ ẩm đất theo thời gian (100 bản ghi mới nhất)">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={telemetryHistory.length ? telemetryHistory : [{ time: 'N/A', soil: 60 }]}>
                      <CartesianGrid stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="soil"
                        stroke="#0891b2"
                        fill="#cffafe"
                        name="Độ ẩm đất (%)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Mực nước bể chứa">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={telemetryHistory.length ? telemetryHistory : [{ time: 'N/A', water: 70 }]}>
                      <CartesianGrid stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="water"
                        stroke="#0e7490"
                        fill="#bae6fd"
                        name="Mực nước (%)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <div className="mt-8 grid gap-4 xl:grid-cols-3">
                <DataTable
                  kind="assets"
                  devices={devices}
                  wateringEvents={wateringEvents}
                  assets={assets}
                  loading={loading}
                  onAdd={setAddModalKind}
                  onRowClick={(data, title) => setDetailModalData({ data, title, kind: 'assets' })}
                />
                <DataTable
                  kind="sensors"
                  devices={devices}
                  wateringEvents={wateringEvents}
                  assets={assets}
                  loading={loading}
                  onAdd={setAddModalKind}
                  onRowClick={(data, title) => setDetailModalData({ data, title, kind: 'sensors' })}
                />
                <DataTable
                  kind="history"
                  devices={devices}
                  wateringEvents={wateringEvents}
                  assets={assets}
                  loading={loading || historyLoading}
                  selectedAssetId={selectedHistoryAssetId}
                  onSelectAssetHistory={handleSelectAssetHistory}
                  onRowClick={(data, title) => setDetailModalData({ data, title, kind: 'history' })}
                />
              </div>
            </>
          )}

          {view === 'assets' && (
            <>
              <SectionHeading eyebrow="Quản lý khu vườn" title="Danh mục Cây & Khu vườn (Assets)" />
              <DataTable
                kind="assets"
                devices={devices}
                wateringEvents={wateringEvents}
                assets={assets}
                loading={loading}
                onAdd={setAddModalKind}
                onRowClick={(data, title) => setDetailModalData({ data, title, kind: 'assets' })}
              />
            </>
          )}

          {view === 'sensors' && (
            <>
              <SectionHeading eyebrow="Quản lý thiết bị" title="Danh sách Cảm biến & Thiết bị" />
              <DataTable
                kind="sensors"
                devices={devices}
                wateringEvents={wateringEvents}
                assets={assets}
                loading={loading}
                onAdd={setAddModalKind}
                onRowClick={(data, title) => setDetailModalData({ data, title, kind: 'sensors' })}
              />
            </>
          )}

          {view === 'telemetry' && (
            <>
              <SectionHeading eyebrow="Dữ liệu quan trắc" title="Lịch sử nhận dữ liệu cảm biến (Telemetry)" />
              <TelemetryTable
                data={telemetryLogs}
                devices={devices}
                loading={telemetryLogsLoading}
                selectedDevId={selectedTelemetryDevId}
                onSelectDev={(devId) => {
                  setSelectedTelemetryDevId(devId)
                  fetchTelemetryLogs(devId, devices)
                }}
                onRefresh={() => fetchTelemetryLogs(selectedTelemetryDevId, devices)}
                onRowClick={(data, title) => setDetailModalData({ data, title, kind: 'telemetry' })}
              />
            </>
          )}

          {view === 'history' && (
            <>
              <SectionHeading eyebrow="Lịch sử vận hành" title="Nhật ký các lần tưới cây" />
              <DataTable
                kind="history"
                devices={devices}
                wateringEvents={wateringEvents}
                assets={assets}
                loading={loading || historyLoading}
                selectedAssetId={selectedHistoryAssetId}
                onSelectAssetHistory={handleSelectAssetHistory}
                onRowClick={(data, title) => setDetailModalData({ data, title, kind: 'history' })}
              />
            </>
          )}

          {view === 'profile' && (
            <>
              <SectionHeading eyebrow="Tài khoản" title="Thông tin người dùng" />
              <Card className="max-w-2xl border-slate-200 bg-white">
                <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
                  <div>
                    <Label>Tên đăng nhập</Label>
                    <Input readOnly value={user?.username || 'Khách (Chưa đăng nhập)'} className="text-black bg-slate-50 font-medium" />
                  </div>
                  <div>
                    <Label>Trạng thái</Label>
                    <Input readOnly value={user?.status_online ? 'Trực tuyến' : 'Ngoại tuyến'} className="text-black bg-slate-50 font-medium" />
                  </div>
                  <div>
                    <Label>Vị trí canh tác</Label>
                    <Input defaultValue="Khu vườn phía Bắc" className="text-black" />
                  </div>
                  <div>
                    <Label>Múi giờ</Label>
                    <Input defaultValue="UTC+07:00 (Việt Nam)" className="text-black" />
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {view === 'settings' && (
            <>
              <SectionHeading eyebrow="Cấu hình hệ thống" title="Cài đặt ngưỡng an toàn cảm biến & thiết bị" />
              <div className="grid gap-6 max-w-4xl">
                {/* Card Cấu hình Ngưỡng Thuộc tính (Attribute) cho Cây & Thiết bị */}
                <Card className="border-emerald-100/90 bg-white shadow-xs">
                  <CardHeader className="border-b border-emerald-100/70 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <CardTitle className="text-base text-slate-900 font-semibold flex items-center gap-2">
                          <Sliders className="size-5 text-emerald-600" />
                          Cài đặt thuộc tính an toàn (Attribute)
                        </CardTitle>
                        <p className="text-xs text-slate-500 mt-1">
                          Chọn cây để xác định thiết bị điều khiển và cấu hình ngưỡng kích hoạt tưới/cảnh báo.
                        </p>
                      </div>

                      {/* Dropdown chọn Cây (Asset) */}
                      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-1.5">
                        <Sprout className="size-4 text-emerald-600 shrink-0" />
                        <Label htmlFor="settings-tree-select" className="text-xs font-semibold text-black whitespace-nowrap">
                          Chọn Cây:
                        </Label>
                        <select
                          id="settings-tree-select"
                          value={selectedSettingsAssetId}
                          onChange={(e) => setSelectedSettingsAssetId(e.target.value)}
                          className="h-8 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-black outline-none transition-colors hover:bg-slate-50 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                        >
                          {assets.length === 0 ? (
                            <option value="">-- Chưa có cây/khu vườn nào --</option>
                          ) : (
                            assets.map((a) => {
                              const linkedDev = devices.find((d) => {
                                const dAssetId = typeof d.assetId === 'object' && d.assetId !== null ? (d.assetId as any)._id : d.assetId
                                return String(dAssetId) === String(a._id)
                              })
                              return (
                                <option key={a._id} value={a._id}>
                                  {a.name} ({a.type}) {linkedDev ? `[${linkedDev.name || linkedDev._id}]` : '[Chưa có thiết bị]'}
                                </option>
                              )
                            })
                          )}
                        </select>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-6 flex flex-col gap-6">
                    {/* Trạng thái liên kết thiết bị */}
                    {(() => {
                      const matchedDev = devices.find((d) => {
                        const dAssetId = typeof d.assetId === 'object' && d.assetId !== null ? (d.assetId as any)._id : d.assetId
                        return String(dAssetId) === String(selectedSettingsAssetId)
                      })

                      if (!matchedDev) {
                        return (
                          <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-800 flex items-start gap-3">
                            <span className="text-base font-bold text-amber-600">⚠️</span>
                            <div>
                              <p className="font-semibold">Cây chưa được liên kết thiết bị</p>
                              <p className="mt-0.5 text-amber-700">
                                Cây trồng được chọn hiện chưa có thiết bị (Device) nào được gán. Hãy vào mục "Danh sách thiết bị" và chọn cây tương ứng trước khi cấu hình ngưỡng an toàn.
                              </p>
                            </div>
                          </div>
                        )
                      }

                      return (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-emerald-100 bg-emerald-50/40 text-xs">
                            <div className="flex items-center gap-2">
                              <Cpu className="size-4 text-emerald-600" />
                              <span className="font-semibold text-slate-800">Thiết bị đang gán:</span>
                              <span className="font-bold text-emerald-900">{matchedDev.name || matchedDev._id}</span>
                              <Badge variant="outline" className="text-[10px] bg-white border-emerald-200 text-emerald-800">
                                Mã: {matchedDev._id}
                              </Badge>
                            </div>
                            <span className="text-slate-500">
                              Loại: {matchedDev.type || 'esp32'}
                            </span>
                          </div>

                          {/* Thanh bar 1: Ngưỡng độ ẩm đất (Soil Humidity) */}
                          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Sprout className="size-4 text-emerald-600" />
                                <div>
                                  <h4 className="text-sm font-semibold text-slate-900">
                                    Độ ẩm đất (Soil Moisture Threshold)
                                  </h4>
                                  <p className="text-[11px] text-slate-500">
                                    Kéo 2 hình tròn để xác định safe_min_soil_humidity và safe_max_soil_humidity
                                  </p>
                                </div>
                              </div>
                              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                                {settingSoilMin}% – {settingSoilMax}%
                              </span>
                            </div>

                            <DualRangeSlider
                              min={0}
                              max={100}
                              step={1}
                              minValue={settingSoilMin}
                              maxValue={settingSoilMax}
                              onChange={(minVal, maxVal) => {
                                setSettingSoilMin(minVal)
                                setSettingSoilMax(maxVal)
                              }}
                              unit="%"
                              trackColor="bg-emerald-500"
                            />
                          </div>

                          {/* Thanh bar 2: Ngưỡng mức nước bể chứa (Water Level) */}
                          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Waves className="size-4 text-cyan-600" />
                                <div>
                                  <h4 className="text-sm font-semibold text-slate-900">
                                    Mức nước bể chứa (Water Level Threshold)
                                  </h4>
                                  <p className="text-[11px] text-slate-500">
                                    Kéo 2 hình tròn để xác định safe_min_water_level và safe_max_water_level
                                  </p>
                                </div>
                              </div>
                              <span className="text-xs font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 px-2.5 py-1 rounded-md">
                                {settingWaterMin}% – {settingWaterMax}%
                              </span>
                            </div>

                            <DualRangeSlider
                              min={0}
                              max={100}
                              step={1}
                              minValue={settingWaterMin}
                              maxValue={settingWaterMax}
                              onChange={(minVal, maxVal) => {
                                setSettingWaterMin(minVal)
                                setSettingWaterMax(maxVal)
                              }}
                              unit="%"
                              trackColor="bg-cyan-500"
                            />
                          </div>

                          {/* Thông báo kết quả lưu */}
                          {settingsSaveMsg && (
                            <div
                              className={`p-3 rounded-lg text-xs font-medium border flex items-center gap-2 ${
                                settingsSaveMsg.type === 'success'
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                  : 'bg-red-50 border-red-200 text-red-800'
                              }`}
                            >
                              <span>{settingsSaveMsg.type === 'success' ? '✓' : '⚠️'}</span>
                              {settingsSaveMsg.text}
                            </div>
                          )}

                          {/* Nút Lưu dữ liệu Attribute */}
                          <div className="flex items-center justify-end gap-3 pt-2">
                            <Button
                              onClick={handleSaveAttributes}
                              disabled={savingSettings}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-6 h-9 shadow-xs"
                            >
                              {savingSettings ? (
                                <>
                                  <RefreshCw className="size-3.5 mr-2 animate-spin" />
                                  Đang lưu DB...
                                </>
                              ) : (
                                'Lưu cấu hình Attribute'
                              )}
                            </Button>
                          </div>
                        </>
                      )
                    })()}
                  </CardContent>
                </Card>

                {/* Các cấu hình phụ khác (Làm mới & Đăng xuất) */}
                <Card className="border-slate-200 bg-white/80 shadow-xs">
                  <CardContent className="flex flex-col gap-4 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">Tự động làm mới dữ liệu</p>
                        <p className="text-xs text-muted-foreground">
                          Cập nhật telemetry và biểu đồ định kỳ qua WebSocket.
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    {user && (
                      <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                        <span className="text-xs text-slate-500">Tài khoản: {user.username}</span>
                        <Button variant="outline" size="sm" className="gap-2 text-red-600 text-xs" onClick={handleLogout}>
                          <LogOut className="size-3.5" />
                          Đăng xuất
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>

      {addModalKind && (
        <AddModal
          kind={addModalKind}
          assets={assets}
          onClose={() => setAddModalKind(null)}
          onSuccess={() => {
            fetchData()
          }}
        />
      )}

      {detailModalData && (
        <DetailModal
          title={detailModalData.title}
          data={detailModalData.data}
          kind={detailModalData.kind}
          assets={assets}
          onClose={() => setDetailModalData(null)}
          onUpdated={() => {
            fetchData()
          }}
        />
      )}
    </main>
  )
}
