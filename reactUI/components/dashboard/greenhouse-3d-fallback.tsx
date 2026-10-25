import type { AssetModelVariant } from '@/lib/asset-type'
import { SCENE_COLORS } from './greenhouse-3d-types'

interface Greenhouse3DFallbackProps {
  variant: AssetModelVariant
  nodeCount?: number
  treeCount?: number
  message?: string
}

export function Greenhouse3DFallback({
  variant,
  nodeCount = 0,
  treeCount = 1,
  message = 'Thiết bị không hỗ trợ WebGL. Dữ liệu vẫn hiển thị đầy đủ ở panel bên cạnh.',
}: Greenhouse3DFallbackProps) {
  const visibleNodes = Math.min(Math.max(nodeCount, 0), 3)
  const nodePositions = [
    { x: 102, y: 146 },
    { x: 248, y: 116 },
    { x: 264, y: 184 },
  ]

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-4"
      role="img"
      aria-label="Minh họa tĩnh cây và các node cảm biến"
    >
      <svg
        viewBox="0 0 360 260"
        className="h-full max-h-[300px] w-full max-w-[430px]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="fallback-sky" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f3fbf6" />
            <stop offset="100%" stopColor="#e5f3ea" />
          </linearGradient>
          <linearGradient id="fallback-leaf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#77b88a" />
            <stop offset="100%" stopColor={SCENE_COLORS.leafHealthy} />
          </linearGradient>
        </defs>

        <rect width="360" height="260" rx="18" fill="url(#fallback-sky)" />
        <ellipse cx="180" cy="221" rx="92" ry="17" fill="#cfe2d5" opacity="0.75" />
        <ellipse cx="180" cy="217" rx="68" ry="10" fill="#b7d2bf" opacity="0.55" />

        {variant === 'potted' ? (
          <>
            <path d="M138 172h84l-8 45c-1 7-7 11-14 11h-40c-7 0-13-4-14-11l-8-45Z" fill={SCENE_COLORS.pot} />
            <rect x="133" y="165" width="94" height="12" rx="5" fill={SCENE_COLORS.potRim} />
            <ellipse cx="180" cy="168" rx="39" ry="7" fill={SCENE_COLORS.soilHealthy} />
          </>
        ) : (
          <>
            <path d="M121 207c7-22 30-31 59-31s52 9 59 31c2 7-3 13-10 13H131c-7 0-12-6-10-13Z" fill={SCENE_COLORS.soilHealthy} />
            <path d="M141 198c10-10 24-15 39-15s29 5 39 15" fill="none" stroke="#7b533d" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
          </>
        )}

        <path d="M176 171c-2-25 0-45 4-64h8c3 21 4 41 2 64" fill={SCENE_COLORS.trunk} />
        <path d="M183 133c-15-10-25-15-37-29" fill="none" stroke={SCENE_COLORS.trunk} strokeWidth="6" strokeLinecap="round" />
        <path d="M184 126c14-12 26-16 37-30" fill="none" stroke={SCENE_COLORS.trunk} strokeWidth="6" strokeLinecap="round" />

        <g fill="url(#fallback-leaf)">
          <polygon points="153,117 183,63 213,117" />
          <polygon points="123,137 153,83 183,137" />
          <polygon points="177,139 206,79 235,139" />
          <polygon points="143,155 180,103 217,155" />
        </g>

        {nodePositions.slice(0, visibleNodes).map((node, index) => (
          <g key={`${node.x}-${node.y}`}>
            <circle cx={node.x} cy={node.y} r="12" fill={SCENE_COLORS.nodeOnline} opacity="0.18" />
            <circle cx={node.x} cy={node.y} r="6" fill={SCENE_COLORS.nodeOnline} />
            <circle cx={node.x} cy={node.y} r="2.5" fill="#ffffff" />
            <line
              x1={node.x}
              y1={node.y}
              x2={180 + (index - 1) * 18}
              y2={148}
              stroke={SCENE_COLORS.nodeOnline}
              strokeWidth="1.5"
              strokeDasharray="3 4"
              opacity="0.55"
            />
          </g>
        ))}
      </svg>

      <p className="max-w-[420px] text-center text-[11px] leading-relaxed text-slate-500">
        {message}
      </p>
      <p className="text-[10px] text-slate-400">
        {treeCount} cây · {nodeCount} node cảm biến
      </p>
    </div>
  )
}
