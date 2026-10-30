'use client'

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ComponentRef } from 'react'
import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from '@react-three/fiber'
import {
  Billboard,
  Html,
  OrbitControls,
  useCursor,
  useGLTF,
} from '@react-three/drei'
import * as THREE from 'three'
import {
  resolveAssetVariant,
  type AssetModelVariant,
} from '@/lib/asset-type'
import { Greenhouse3DFallback } from './greenhouse-3d-fallback'
import {
  DEFAULT_CAMERA_POSITION,
  GROUND_GRID_DIVISIONS,
  GROUND_GRID_SIZE,
  GROUND_Y,
  SCENE_COLORS,
  TREE_GLTF_PATH,
  TREE_GROUP_NAME,
  soilTopForVariant,
  treeHeightForVariant,
  type GreenhouseDevice,
  type GreenhouseStation,
  type SoilHealth,
  type StationLayout,
} from './greenhouse-3d-types'
import {
  collidesWithStations,
  snapStationPosition,
} from './greenhouse-layout'

if (typeof window !== 'undefined') {
  useGLTF.preload(TREE_GLTF_PATH)
}

export interface GreenhouseSceneProps {
  stations: GreenhouseStation[]
  layout: Record<string, StationLayout>
  selectedAssetId: string | null
  selectedDeviceId: string | null
  editMode: boolean
  isMobile: boolean
  paused: boolean
  resetSignal: number
  reducedMotion: boolean
  onSelectAsset: (assetId: string | null) => void
  onSelectDevice: (deviceId: string) => void
  onMoveStation: (
    assetId: string,
    position: StationLayout,
  ) => void | Promise<void>
  onLayoutError: (message: string) => void
}

export function GreenhouseScene({
  stations,
  layout,
  selectedAssetId,
  selectedDeviceId,
  editMode,
  isMobile,
  paused,
  resetSignal,
  reducedMotion,
  onSelectAsset,
  onSelectDevice,
  onMoveStation,
  onLayoutError,
}: GreenhouseSceneProps) {
  const firstStation = stations[0]
  const fallbackVariant = firstStation
    ? resolveAssetVariant(firstStation.asset.type)
    : 'potted'
  const nodeCount = stations.reduce(
    (total, station) => total + station.devices.length,
    0,
  )
  const revision = useMemo(
    () =>
      JSON.stringify({
        selectedAssetId,
        selectedDeviceId,
        editMode,
        stations: stations.map((station) => ({
          id: station.asset._id,
          x: station.position.x,
          z: station.position.z,
          online: station.online,
          pumpOn: station.pumpOn,
          telemetry: station.primaryTelemetry,
          devices: station.devices.map((device) => [
            device._id,
            device.online,
          ]),
        })),
      }),
    [editMode, selectedAssetId, selectedDeviceId, stations],
  )

  return (
    <Canvas
      frameloop={paused ? 'never' : 'demand'}
      dpr={isMobile ? 1 : [1, 1.25]}
      camera={{
        position: DEFAULT_CAMERA_POSITION,
        fov: 35,
        near: 0.1,
        far: 100,
      }}
      gl={{
        antialias: !isMobile,
        alpha: true,
        powerPreference: 'high-performance',
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
      }}
      onPointerMissed={() => {
        if (!editMode) onSelectAsset(null)
      }}
      fallback={
        <Greenhouse3DFallback
          variant={fallbackVariant}
          nodeCount={nodeCount}
          treeCount={stations.length}
        />
      }
      aria-label="Mô hình 3D khu vườn và các node cảm biến"
      className="h-full w-full"
    >
      <FpsLimiter fps={30} />
      <SceneInvalidator revision={revision} paused={paused} />
      <WaterAnimationLoop
        active={
          !paused &&
          !reducedMotion &&
          stations.some((station) => station.pumpOn)
        }
      />
      <Lights />
      <GroundGrid />
      <GroundClickPlane
        editMode={editMode}
        selectedAssetId={selectedAssetId}
        layout={layout}
        onMoveStation={onMoveStation}
        onLayoutError={onLayoutError}
        onSelectAsset={onSelectAsset}
      />

      <Suspense fallback={<StationsPlaceholder stations={stations} />}>
        {stations.map((station) => (
          <TreeStation
            key={station.asset._id}
            station={station}
            selected={station.asset._id === selectedAssetId}
            selectedDeviceId={selectedDeviceId}
            reducedMotion={reducedMotion}
            onSelectAsset={onSelectAsset}
            onSelectDevice={onSelectDevice}
          />
        ))}
      </Suspense>

      <CameraRig
        resetSignal={resetSignal}
        positions={stations.map((station) => station.position)}
      />
    </Canvas>
  )
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.72} />
      <hemisphereLight args={['#ffffff', '#b7d3bf', 1.2]} />
      <directionalLight position={[4, 6, 4]} intensity={2.1} color="#fff7e8" />
      <directionalLight position={[-4, 3, -3]} intensity={0.8} color="#c7e6d4" />
    </>
  )
}

function GroundGrid() {
  return (
    <gridHelper
      args={[
        GROUND_GRID_SIZE,
        GROUND_GRID_DIVISIONS,
        '#6f9f82',
        '#a9cbb5',
      ]}
      position={[0, GROUND_Y - 0.002, 0]}
    />
  )
}

function GroundClickPlane({
  editMode,
  selectedAssetId,
  layout,
  onMoveStation,
  onLayoutError,
  onSelectAsset,
}: {
  editMode: boolean
  selectedAssetId: string | null
  layout: Record<string, StationLayout>
  onMoveStation: (
    assetId: string,
    position: StationLayout,
  ) => void | Promise<void>
  onLayoutError: (message: string) => void
  onSelectAsset: (assetId: string | null) => void
}) {
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()

    if (!editMode) {
      onSelectAsset(null)
      return
    }

    if (!selectedAssetId) {
      onLayoutError('Chọn một cây trước, sau đó click điểm đích.')
      return
    }

    const candidate = snapStationPosition(
      event.point.x,
      event.point.z,
    )
    if (collidesWithStations(selectedAssetId, candidate, layout)) {
      onLayoutError(
        'Vị trí này chồng lấn với cây khác. Chọn điểm khác.',
      )
      return
    }

    void onMoveStation(selectedAssetId, candidate)
  }

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, GROUND_Y + 0.001, 0]}
      onClick={handleClick}
    >
      <planeGeometry args={[GROUND_GRID_SIZE, GROUND_GRID_SIZE]} />
      <meshBasicMaterial
        transparent
        opacity={0}
        depthWrite={false}
        colorWrite={false}
      />
    </mesh>
  )
}

function FpsLimiter({ fps }: { fps: number }) {
  const get = useThree((state) => state.get)
  const set = useThree((state) => state.set)

  useEffect(() => {
    const store = get()
    const original = store.invalidate
    let lastFrame = 0
    const limited = (frames?: number) => {
      const now = performance.now()
      if (now - lastFrame < 1000 / fps) return
      lastFrame = now
      original(frames)
    }

    set({ invalidate: limited })
    return () => set({ invalidate: original })
  }, [fps, get, set])

  return null
}

function SceneInvalidator({
  revision,
  paused,
}: {
  revision: string
  paused: boolean
}) {
  const get = useThree((state) => state.get)

  useEffect(() => {
    if (!paused) get().invalidate()
  }, [get, paused, revision])

  return null
}

function WaterAnimationLoop({ active }: { active: boolean }) {
  const get = useThree((state) => state.get)

  useEffect(() => {
    if (!active) return

    let raf = 0
    const tick = () => {
      get().invalidate()
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, get])

  return null
}

function CameraRig({
  resetSignal,
  positions,
}: {
  resetSignal: number
  positions: StationLayout[]
}) {
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null)
  const { camera, get } = useThree()
  const count = positions.length

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    if (!(camera instanceof THREE.PerspectiveCamera)) return

    if (positions.length === 0) {
      camera.position.set(...DEFAULT_CAMERA_POSITION)
      controls.target.set(0, 0.9, 0)
      controls.update()
      return
    }

    const margin = 1.6
    const xs = positions.map((position) => position.x)
    const zs = positions.map((position) => position.z)
    const minX = Math.min(...xs) - margin
    const maxX = Math.max(...xs) + margin
    const minZ = Math.min(...zs) - margin
    const maxZ = Math.max(...zs) + margin
    const centerX = (minX + maxX) / 2
    const centerZ = (minZ + maxZ) / 2
    const spanX = Math.max(maxX - minX, 2)
    const spanZ = Math.max(maxZ - minZ, 2)
    const fov = THREE.MathUtils.degToRad(camera.fov)
    const verticalDistance = spanZ / (2 * Math.tan(fov / 2))
    const horizontalDistance =
      spanX / (2 * Math.tan(fov / 2) * Math.max(camera.aspect, 0.6))
    const distance =
      Math.max(verticalDistance, horizontalDistance, 5.5) * 1.18

    camera.position.set(
      centerX + distance * 0.55,
      Math.max(2.8, distance * 0.55),
      centerZ + distance * 0.85,
    )
    controls.target.set(centerX, 0.9, centerZ)
    controls.update()
  }, [camera, count, resetSignal])

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={false}
      enableDamping={false}
      minDistance={3.2}
      maxDistance={22}
      minPolarAngle={0.35}
      maxPolarAngle={Math.PI / 2.06}
      onChange={() => get().invalidate()}
    />
  )
}

function StationsPlaceholder({ stations }: { stations: GreenhouseStation[] }) {
  return (
    <>
      {stations.map((station) => (
        <group
          key={station.asset._id}
          position={[station.position.x, 0, station.position.z]}
        >
          <TreePlaceholder
            variant={resolveAssetVariant(station.asset.type)}
          />
        </group>
      ))}
    </>
  )
}

interface TreeStationProps {
  station: GreenhouseStation
  selected: boolean
  selectedDeviceId: string | null
  reducedMotion: boolean
  onSelectAsset: (assetId: string | null) => void
  onSelectDevice: (deviceId: string) => void
}

function TreeStation({
  station,
  selected,
  selectedDeviceId,
  reducedMotion,
  onSelectAsset,
  onSelectDevice,
}: TreeStationProps) {
  const variant = resolveAssetVariant(station.asset.type)
  const [hovered, setHovered] = useState(false)
  const get = useThree((state) => state.get)
  useCursor(hovered)

  const soilTop = soilTopForVariant(variant)
  const treeTop = soilTop + treeHeightForVariant(variant)
  const soil = station.primaryTelemetry?.soil_humidity

  return (
    <group
      position={[station.position.x, 0, station.position.z]}
      onClick={(event) => {
        event.stopPropagation()
        onSelectAsset(station.asset._id)
        get().invalidate()
      }}
      onPointerEnter={(event) => {
        event.stopPropagation()
        setHovered(true)
        get().invalidate()
      }}
      onPointerLeave={(event) => {
        event.stopPropagation()
        setHovered(false)
        get().invalidate()
      }}
    >
      <TreeAssembly
        variant={variant}
        soilHealth={station.soilHealth}
        highlighted={selected || hovered}
      />

      {station.pumpOn && (
        <HealingParticles
          soilTop={soilTop}
          treeHeight={treeHeightForVariant(variant)}
          reducedMotion={reducedMotion}
        />
      )}

      {station.devices.map((device, index) => {
        const deviceTelemetry = station.telemetryByDevice[device._id] ?? null
        const isSelected = device._id === selectedDeviceId
        const deviceSoil = deviceTelemetry?.soil_humidity

        return (
          <SensorNode
            key={device._id}
            device={device}
            position={getNodePosition(
              device,
              index,
              station.devices.length,
              variant,
            )}
            selected={isSelected}
            warning={
              isSelected &&
              (station.waterLow ||
                station.soilHealth === 'dry' ||
                station.soilHealth === 'wet')
            }
            valueLabel={
              isSelected && deviceSoil !== null && deviceSoil !== undefined
                ? `${Math.round(deviceSoil)}% ??t`
                : null
            }
            onSelect={onSelectDevice}
          />
        )
      })}

      <WateringValve
        variant={variant}
        pumpOn={station.pumpOn}
        selected={selected}
        reducedMotion={reducedMotion}
      />

      {(selected || hovered) && (
        <Html
          position={[0, treeTop + 0.24, 0]}
          center
          distanceFactor={9}
          zIndexRange={[30, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] shadow-sm ${
              selected
                ? 'border-emerald-400 bg-emerald-50/95 text-emerald-950'
                : 'border-white/80 bg-white/95 text-slate-700'
            }`}
          >
            <span
              className={`inline-block size-1.5 rounded-full ${
                station.online ? 'bg-emerald-500' : 'bg-red-500'
              }`}
            />
            <span className="max-w-[100px] truncate font-semibold">
              {station.asset.name}
            </span>
            {soil !== null && soil !== undefined && (
              <span className="text-slate-500">
                ? {Math.round(soil)}% ??t
              </span>
            )}
            {station.pumpOn && (
              <span className="font-semibold text-emerald-700">? T??i</span>
            )}
          </div>
        </Html>
      )}
    </group>
  )
}

interface TreeAssemblyProps {
  variant: AssetModelVariant
  soilHealth: SoilHealth
  highlighted: boolean
}

function TreeAssembly({
  variant,
  soilHealth,
  highlighted,
}: TreeAssemblyProps) {
  const { scene } = useGLTF(TREE_GLTF_PATH)
  const source = useMemo(() => {
    const direct = scene.getObjectByName(TREE_GROUP_NAME)
    if (direct) return direct

    // Keep working if a future export changes the node names. The two ground
    // planes and the exported lamp empties are not trees.
    const root = scene.getObjectByName('Root')
    return (
      root?.children.find(
        (child) =>
          child.name !== 'Plane' &&
          child.name !== 'Plane001' &&
          !child.name.startsWith('Lamp'),
      ) ?? null
    )
  }, [scene])
  const tree = useMemo(
    () => (source ? createTreeModel(source, variant) : null),
    [source, variant],
  )
  useEffect(() => {
    if (!tree) return

    const leafColor =
      soilHealth === 'dry'
        ? SCENE_COLORS.leafDry
        : soilHealth === 'wet'
          ? SCENE_COLORS.leafWet
          : soilHealth === 'healthy'
            ? SCENE_COLORS.leafHealthy
            : SCENE_COLORS.leafUnknown

    for (const material of tree.leafMaterials) {
      material.color.set(leafColor)
    }
  }, [soilHealth, tree])

  useEffect(() => {
    if (!tree) return
    return () => {
      for (const material of tree.materials) material.dispose()
    }
  }, [tree])

  if (!tree) return <TreePlaceholder variant={variant} />

  const soilTop = soilTopForVariant(variant)
  const hoverRingInner = variant === 'potted' ? 0.56 : 0.7
  const hoverRingOuter = variant === 'potted' ? 0.6 : 0.74
  return (
    <group>
      {variant === 'potted' ? (
        <Pot soilHealth={soilHealth} />
      ) : (
        <GroundBed soilHealth={soilHealth} />
      )}

      <group position={[0, soilTop, 0]}>
        <primitive object={tree.root} />
      </group>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, GROUND_Y + 0.009, 0]}
      >
        <ringGeometry args={[hoverRingInner, hoverRingOuter, 40]} />
        <meshBasicMaterial
          color={highlighted ? '#10b981' : '#a7c9b2'}
          transparent
          opacity={highlighted ? 0.62 : 0.28}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

function Pot({ soilHealth }: { soilHealth: SoilHealth }) {
  return (
    <group>
      <mesh position={[0, GROUND_Y + 0.02, 0]}>
        <cylinderGeometry args={[0.53, 0.54, 0.04, 28]} />
        <meshStandardMaterial color={SCENE_COLORS.saucer} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.37, 0]}>
        <cylinderGeometry args={[0.46, 0.36, 0.42, 24]} />
        <meshStandardMaterial
          color={SCENE_COLORS.pot}
          roughness={0.92}
          flatShading
        />
      </mesh>
      <mesh position={[0, 0.58, 0]}>
        <cylinderGeometry args={[0.48, 0.48, 0.05, 24]} />
        <meshStandardMaterial
          color={SCENE_COLORS.potRim}
          roughness={0.92}
          flatShading
        />
      </mesh>
      <mesh position={[0, 0.595, 0]}>
        <cylinderGeometry args={[0.43, 0.43, 0.03, 24]} />
        <meshStandardMaterial
          color={soilColor(soilHealth)}
          roughness={1}
          flatShading
        />
      </mesh>
    </group>
  )
}

function GroundBed({ soilHealth }: { soilHealth: SoilHealth }) {
  const tufts = [
    [-0.48, 0.33, 0.32, -0.18],
    [0.5, 0.33, 0.22, 0.22],
    [-0.22, 0.33, -0.5, 0.1],
    [0.38, 0.33, -0.38, -0.2],
    [0.02, 0.33, 0.58, 0.05],
  ] as const

  return (
    <group>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.5, 0.68, 0.16, 24]} />
        <meshStandardMaterial
          color={soilColor(soilHealth)}
          roughness={1}
          flatShading
        />
      </mesh>
      <mesh position={[0, 0.286, 0]}>
        <cylinderGeometry args={[0.46, 0.5, 0.02, 24]} />
        <meshStandardMaterial
          color={soilColor(soilHealth)}
          roughness={1}
          flatShading
        />
      </mesh>
      {tufts.map(([x, y, z, rotation], index) => (
        <mesh
          key={`tuft-${index}`}
          position={[x, y, z]}
          rotation={[0, rotation, -0.18]}
        >
          <coneGeometry args={[0.035, 0.14, 4]} />
          <meshStandardMaterial
            color={SCENE_COLORS.grass}
            roughness={0.9}
            flatShading
          />
        </mesh>
      ))}
      {[
        [-0.6, 0.18, -0.1],
        [0.62, 0.18, -0.15],
        [0.15, 0.18, 0.68],
      ].map(([x, y, z], index) => (
        <mesh key={`stone-${index}`} position={[x, y, z]}>
          <dodecahedronGeometry args={[0.045, 0]} />
          <meshStandardMaterial
            color={SCENE_COLORS.stone}
            roughness={1}
            flatShading
          />
        </mesh>
      ))}
    </group>
  )
}

function TreePlaceholder({ variant }: { variant: AssetModelVariant }) {
  const soilTop = soilTopForVariant(variant)

  return (
    <group>
      {variant === 'potted' ? (
        <Pot soilHealth="unknown" />
      ) : (
        <GroundBed soilHealth="unknown" />
      )}
      <group position={[0, soilTop, 0]}>
        <mesh position={[0, 0.42, 0]}>
          <cylinderGeometry args={[0.045, 0.07, 0.84, 8]} />
          <meshStandardMaterial color={SCENE_COLORS.trunk} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.92, 0]}>
          <icosahedronGeometry args={[0.34, 0]} />
          <meshStandardMaterial
            color={SCENE_COLORS.leafUnknown}
            roughness={0.9}
            flatShading
          />
        </mesh>
        <mesh position={[-0.23, 0.78, 0.04]}>
          <icosahedronGeometry args={[0.22, 0]} />
          <meshStandardMaterial
            color={SCENE_COLORS.leafUnknown}
            roughness={0.9}
            flatShading
          />
        </mesh>
        <mesh position={[0.22, 0.76, -0.03]}>
          <icosahedronGeometry args={[0.2, 0]} />
          <meshStandardMaterial
            color={SCENE_COLORS.leafUnknown}
            roughness={0.9}
            flatShading
          />
        </mesh>
      </group>
    </group>
  )
}

interface SensorNodeProps {
  device: GreenhouseDevice
  position: [number, number, number]
  selected: boolean
  warning: boolean
  valueLabel: string | null
  onSelect: (deviceId: string) => void
}

function SensorNode({
  device,
  position,
  selected,
  warning,
  valueLabel,
  onSelect,
}: SensorNodeProps) {
  const [hovered, setHovered] = useState(false)
  const get = useThree((state) => state.get)
  useCursor(hovered)
  const showLabel = selected || hovered

  const color = !device.online
    ? SCENE_COLORS.nodeOffline
    : warning
      ? SCENE_COLORS.nodeWarning
      : selected
        ? SCENE_COLORS.nodeSelected
        : SCENE_COLORS.nodeOnline

  return (
    <group position={position} scale={hovered ? 1.08 : 1}>
      <mesh>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.18}
          depthWrite={false}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[0.072, 20, 20]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.75}
          roughness={0.35}
          metalness={0.05}
        />
      </mesh>

      <Billboard>
        <mesh>
          <ringGeometry args={[0.11, 0.132, 28]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.55}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </Billboard>

      {selected && (
        <Billboard>
          <mesh>
            <ringGeometry args={[0.15, 0.17, 32]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.9}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        </Billboard>
      )}

      <mesh
        castShadow={false}
        receiveShadow={false}
        onPointerOver={(event) => {
          event.stopPropagation()
          setHovered(true)
          get().invalidate()
        }}
        onPointerOut={(event) => {
          event.stopPropagation()
          setHovered(false)
          get().invalidate()
        }}
        onClick={(event) => {
          event.stopPropagation()
          onSelect(device._id)
          get().invalidate()
        }}
      >
        <sphereGeometry args={[0.17, 12, 12]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          colorWrite={false}
        />
      </mesh>

      {showLabel && (
        <Html
          position={[0, 0.2, 0]}
          center
          distanceFactor={8}
          zIndexRange={[40, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-1 text-[10px] shadow-sm ${
              selected
                ? 'border-emerald-400 bg-emerald-50/95 text-emerald-950'
                : 'border-white/80 bg-white/95 text-slate-700'
            }`}
          >
            <span
              className={`inline-block size-1.5 rounded-full ${
                device.online ? 'bg-emerald-500' : 'bg-red-500'
              }`}
            />
            <span className="max-w-[120px] truncate font-semibold">
              {device.name || device._id}
            </span>
            {valueLabel && (
              <span className="text-slate-500">· {valueLabel}</span>
            )}
          </div>
        </Html>
      )}
    </group>
  )
}

function HealingParticles({
  soilTop,
  treeHeight,
  reducedMotion,
}: {
  soilTop: number
  treeHeight: number
  reducedMotion: boolean
}) {
  const count = 28
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        angle: (index / count) * Math.PI * 2 + Math.random() * 0.5,
        radius: 0.24 + Math.random() * 0.38,
        speed: 0.18 + Math.random() * 0.18,
        offset: Math.random(),
      })),
    [],
  )
  const baseY = soilTop + treeHeight * 0.55
  const topY = soilTop + treeHeight + 0.35

  const geometry = useMemo(() => {
    const next = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)

    seeds.forEach((seed, index) => {
      const y = baseY + seed.offset * (topY - baseY)
      positions[index * 3] = Math.cos(seed.angle) * seed.radius
      positions[index * 3 + 1] = y
      positions[index * 3 + 2] = Math.sin(seed.angle) * seed.radius
    })

    next.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3),
    )
    return next
  }, [baseY, count, seeds, topY])

  const texture = useMemo(() => {
    if (typeof document === 'undefined') return null

    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const context = canvas.getContext('2d')
    if (!context) return null

    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.8)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 64, 64)

    const next = new THREE.CanvasTexture(canvas)
    next.colorSpace = THREE.SRGBColorSpace
    return next
  }, [])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => texture?.dispose(), [texture])

  useFrame((state) => {
    if (reducedMotion) return

    const attribute = geometry.getAttribute(
      'position',
    ) as THREE.BufferAttribute
    const positions = attribute.array as Float32Array
    const time = state.clock.elapsedTime

    seeds.forEach((seed, index) => {
      const life = (time * seed.speed + seed.offset) % 1
      const angle = seed.angle + time * 0.22
      const radius = seed.radius * (0.8 + life * 0.35)

      positions[index * 3] = Math.cos(angle) * radius
      positions[index * 3 + 1] = baseY + life * (topY - baseY)
      positions[index * 3 + 2] = Math.sin(angle) * radius
    })

    attribute.needsUpdate = true
  })

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        map={texture ?? undefined}
        color={SCENE_COLORS.healing}
        size={0.11}
        sizeAttenuation
        transparent
        opacity={0.85}
        alphaTest={0.01}
        depthTest={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  )
}

function WateringValve({
  variant,
  pumpOn,
  selected,
  reducedMotion,
}: {
  variant: AssetModelVariant
  pumpOn: boolean
  selected: boolean
  reducedMotion: boolean
}) {
  const soilTop = soilTopForVariant(variant)

  return (
    <group>
      <Pipe
        position={[0.835, 0.2, 0.38]}
        rotation={[0, 0, Math.PI / 2]}
        length={0.23}
      />
      <mesh position={[0.95, 0.2, 0.38]}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshStandardMaterial
          color={SCENE_COLORS.valveBody}
          roughness={0.55}
          metalness={0.2}
        />
      </mesh>
      <Pipe position={[0.72, 0.575, 0.38]} length={0.75} />
      <Pipe
        position={[0.57, 0.95, 0.34]}
        rotation={[0, 0, Math.PI / 2]}
        length={0.3}
      />
      <mesh position={[0.72, 0.95, 0.38]}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshStandardMaterial
          color={SCENE_COLORS.pipe}
          roughness={0.45}
          metalness={0.25}
        />
      </mesh>
      <mesh position={[0.42, 0.93, 0.3]}>
        <cylinderGeometry args={[0.032, 0.04, 0.08, 12]} />
        <meshStandardMaterial
          color={SCENE_COLORS.pipe}
          roughness={0.45}
          metalness={0.25}
        />
      </mesh>

      <mesh position={[0.72, 0.3, 0.38]}>
        <cylinderGeometry args={[0.115, 0.115, 0.14, 16]} />
        <meshStandardMaterial
          color={SCENE_COLORS.valveBody}
          roughness={0.5}
          metalness={0.3}
        />
      </mesh>
      <mesh position={[0.72, 0.225, 0.38]}>
        <cylinderGeometry args={[0.145, 0.145, 0.025, 16]} />
        <meshStandardMaterial
          color={SCENE_COLORS.valveFlange}
          roughness={0.45}
          metalness={0.35}
        />
      </mesh>
      <mesh position={[0.72, 0.375, 0.38]}>
        <cylinderGeometry args={[0.145, 0.145, 0.025, 16]} />
        <meshStandardMaterial
          color={SCENE_COLORS.valveFlange}
          roughness={0.45}
          metalness={0.35}
        />
      </mesh>
      <mesh position={[0.72, 0.43, 0.38]}>
        <cylinderGeometry args={[0.06, 0.075, 0.08, 12]} />
        <meshStandardMaterial
          color={SCENE_COLORS.valveBody}
          roughness={0.5}
          metalness={0.25}
        />
      </mesh>
      <mesh position={[0.72, 0.5, 0.38]}>
        <cylinderGeometry args={[0.022, 0.022, 0.1, 8]} />
        <meshStandardMaterial
          color={SCENE_COLORS.valveStem}
          roughness={0.35}
          metalness={0.6}
        />
      </mesh>

      {[0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].map(
        (angle) => (
          <mesh
            key={`valve-bolt-${angle}`}
            position={[
              0.72 + Math.cos(angle) * 0.105,
              0.39,
              0.38 + Math.sin(angle) * 0.105,
            ]}
          >
            <sphereGeometry args={[0.012, 6, 6]} />
            <meshStandardMaterial
              color="#d1d5db"
              roughness={0.35}
              metalness={0.6}
            />
          </mesh>
        ),
      )}

      <group
        position={[0.72, 0.565, 0.38]}
        rotation={[0, pumpOn ? Math.PI / 2 : 0, 0]}
      >
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.105, 0.018, 8, 20]} />
          <meshStandardMaterial
            color={SCENE_COLORS.valveWheel}
            roughness={0.45}
            metalness={0.2}
          />
        </mesh>
        {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map(
          (angle) => (
            <mesh key={`valve-spoke-${angle}`} rotation={[0, angle, 0]}>
              <boxGeometry args={[0.19, 0.014, 0.014]} />
              <meshStandardMaterial
                color={SCENE_COLORS.valveWheel}
                roughness={0.45}
                metalness={0.2}
              />
            </mesh>
          ),
        )}
        <mesh>
          <cylinderGeometry args={[0.028, 0.028, 0.035, 10]} />
          <meshStandardMaterial
            color={SCENE_COLORS.valveHandle}
            roughness={0.4}
            metalness={0.3}
          />
        </mesh>
      </group>

      {selected && (
        <Html
          position={[0.72, 0.78, 0.38]}
          center
          distanceFactor={8}
          zIndexRange={[30, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div
            className={`whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-semibold shadow-sm ${
              pumpOn
                ? 'border-emerald-300 bg-emerald-50/95 text-emerald-900'
                : 'border-slate-200 bg-white/95 text-slate-600'
            }`}
          >
            Van tưới · {pumpOn ? 'ĐANG MỞ' : 'ĐANG ĐÓNG'}
          </div>
        </Html>
      )}

      {pumpOn && (
        <WaterStream soilTop={soilTop} reducedMotion={reducedMotion} />
      )}
    </group>
  )
}

function Pipe({
  position,
  rotation = [0, 0, 0],
  length,
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  length: number
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <cylinderGeometry args={[0.034, 0.034, length, 12]} />
      <meshStandardMaterial
        color={SCENE_COLORS.pipe}
        roughness={0.45}
        metalness={0.25}
      />
    </mesh>
  )
}

function WaterStream({
  soilTop,
  reducedMotion,
}: {
  soilTop: number
  reducedMotion: boolean
}) {
  const start = useMemo(() => new THREE.Vector3(0.42, 0.88, 0.3), [])
  const end = useMemo(
    () => new THREE.Vector3(0.24, soilTop + 0.02, 0.16),
    [soilTop],
  )
  const droplets = useMemo(
    () => Array.from({ length: 10 }, (_, index) => index / 10),
    [],
  )
  const dropletRefs = useRef<Array<THREE.Mesh | null>>([])
  const splashRef = useRef<THREE.Mesh>(null)

  const stream = useMemo(() => {
    const direction = end.clone().sub(start)
    const length = direction.length()
    const midpoint = start.clone().add(end).multiplyScalar(0.5)
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize(),
    )
    return { midpoint, quaternion, length }
  }, [end, start])

  useFrame((state) => {
    const time = state.clock.elapsedTime

    droplets.forEach((offset, index) => {
      const droplet = dropletRefs.current[index]
      if (!droplet) return

      const progress = reducedMotion ? offset : (time * 0.9 + offset) % 1
      droplet.position.lerpVectors(start, end, progress)

      if (!reducedMotion) {
        droplet.position.x += Math.sin((progress + offset) * 14) * 0.014
        droplet.position.z += Math.cos((progress + offset) * 12) * 0.014
        droplet.scale.setScalar(0.7 + Math.sin(progress * Math.PI) * 0.45)
      }
    })

    if (splashRef.current) {
      const pulse = reducedMotion
        ? 0
        : (Math.sin(time * 4.2) + 1) / 2
      splashRef.current.scale.setScalar(1 + pulse * 0.55)
    }
  })

  return (
    <group>
      <mesh position={stream.midpoint} quaternion={stream.quaternion}>
        <cylinderGeometry args={[0.006, 0.012, stream.length, 6]} />
        <meshBasicMaterial
          color={SCENE_COLORS.water}
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </mesh>

      {droplets.map((_, index) => (
        <mesh
          key={`droplet-${index}`}
          ref={(node) => {
            dropletRefs.current[index] = node
          }}
        >
          <sphereGeometry args={[0.018, 8, 8]} />
          <meshBasicMaterial
            color="#bae6fd"
            transparent
            opacity={0.9}
            depthWrite={false}
          />
        </mesh>
      ))}

      <mesh
        ref={splashRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[end.x, soilTop + 0.03, end.z]}
      >
        <ringGeometry args={[0.04, 0.06, 20]} />
        <meshBasicMaterial
          color={SCENE_COLORS.water}
          transparent
          opacity={0.45}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

function createTreeModel(
  source: THREE.Object3D,
  variant: AssetModelVariant,
): {
  root: THREE.Group
  leafMaterials: THREE.MeshStandardMaterial[]
  materials: THREE.Material[]
} {
  // The Sketchfab export keeps the tree geometry in its original Z-up space.
  // Apply the parent world matrix (the Sketchfab_model rotation) before
  // normalizing, otherwise the tree lies along the Z axis.
  source.updateWorldMatrix(true, false)
  const parentMatrix = source.parent
    ? source.parent.matrixWorld.clone()
    : new THREE.Matrix4()

  const clone = source.clone(true)
  clone.matrixAutoUpdate = true

  const leafMaterials: THREE.MeshStandardMaterial[] = []
  const materials: THREE.Material[] = []

  clone.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return

    object.castShadow = true
    object.receiveShadow = true

    const originalMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material]

    const clonedMaterials = originalMaterials.map((material) => {
      const cloned = material.clone()
      materials.push(cloned)

      if (cloned instanceof THREE.MeshStandardMaterial) {
        const isLeaf =
          cloned.color.g > cloned.color.r &&
          cloned.color.g > cloned.color.b

        cloned.color.set(
          isLeaf ? SCENE_COLORS.leafHealthy : SCENE_COLORS.trunk,
        )
        cloned.flatShading = true
        cloned.roughness = 0.85
        cloned.metalness = 0
        cloned.needsUpdate = true

        if (isLeaf) leafMaterials.push(cloned)
      }

      return cloned
    })

    object.material = Array.isArray(object.material)
      ? clonedMaterials
      : clonedMaterials[0]
  })

  const oriented = new THREE.Group()
  oriented.applyMatrix4(parentMatrix)
  oriented.add(clone)

  const wrapper = new THREE.Group()
  wrapper.add(oriented)

  const box = new THREE.Box3().setFromObject(wrapper)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())

  oriented.position.x -= center.x
  oriented.position.y -= box.min.y
  oriented.position.z -= center.z

  wrapper.scale.setScalar(
    treeHeightForVariant(variant) / Math.max(size.y, 0.001),
  )

  return { root: wrapper, leafMaterials, materials }
}

function soilColor(health: SoilHealth): string {
  if (health === 'dry') return SCENE_COLORS.soilDry
  if (health === 'wet') return SCENE_COLORS.soilWet
  return SCENE_COLORS.soilHealthy
}

function getNodePosition(
  device: GreenhouseDevice,
  index: number,
  total: number,
  variant: AssetModelVariant,
): [number, number, number] {
  const baseY = soilTopForVariant(variant)
  const type = `${device.type ?? ''} ${device.name ?? ''}`.toLowerCase()
  const spread = total > 1 ? (index - (total - 1) / 2) * 0.16 : 0

  // Prefer a meaningful position per device type, then spread duplicates and
  // fall back to a deterministic ring for unknown device types.
  if (
    type.includes('soil') ||
    type.includes('dat') ||
    type.includes('đất') ||
    type.includes('esp') ||
    type.includes('sensor')
  ) {
    return [
      -0.52 + spread,
      baseY + 0.27,
      0.5 + Math.abs(spread) * 0.4,
    ]
  }

  if (
    type.includes('dht') ||
    type.includes('temp') ||
    type.includes('humid') ||
    type.includes('nhiet') ||
    type.includes('độ ẩm') ||
    type.includes('do am')
  ) {
    return [
      0.48 + spread,
      baseY + 0.95,
      0.42,
    ]
  }

  if (
    type.includes('pump') ||
    type.includes('valve') ||
    type.includes('bom') ||
    type.includes('tuoi') ||
    type.includes('tưới')
  ) {
    return [
      0.8,
      baseY + 0.35 + Math.abs(spread) * 0.25,
      0.36 + spread,
    ]
  }

  const angle = -0.35 + (index / Math.max(total, 1)) * 1.7
  return [
    Math.cos(angle) * 0.68,
    baseY + 0.55 + (index % 3) * 0.18,
    Math.sin(angle) * 0.68 + 0.1,
  ]
}
