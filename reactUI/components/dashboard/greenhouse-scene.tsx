'use client'

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ComponentRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  Billboard,
  ContactShadows,
  Html,
  OrbitControls,
  RoundedBox,
  useCursor,
  useGLTF,
} from '@react-three/drei'
import * as THREE from 'three'
import type { AssetModelVariant } from '@/lib/asset-type'
import { Greenhouse3DFallback } from './greenhouse-3d-fallback'
import {
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
  GROUND_GRID_DIVISIONS,
  GROUND_GRID_SIZE,
  GROUND_Y,
  SCENE_COLORS,
  TREE_GLTF_PATH,
  TREE_GROUP_NAME,
  soilTopForVariant,
  treeHeightForVariant,
  type GreenhouseDevice,
  type GreenhouseTelemetry,
  type SoilHealth,
} from './greenhouse-3d-types'

if (typeof window !== 'undefined') {
  useGLTF.preload(TREE_GLTF_PATH)
}

export interface GreenhouseSceneProps {
  variant: AssetModelVariant
  devices: GreenhouseDevice[]
  selectedDeviceId: string | null
  telemetry: GreenhouseTelemetry | null
  soilHealth: SoilHealth
  waterLow: boolean
  pumpOn: boolean
  waitingForTelemetry: boolean
  autoRotate: boolean
  resetSignal: number
  reducedMotion: boolean
  onSelectDevice: (deviceId: string) => void
  onSelectAsset: () => void
}

export function GreenhouseScene({
  variant,
  devices,
  selectedDeviceId,
  telemetry,
  soilHealth,
  waterLow,
  pumpOn,
  waitingForTelemetry,
  autoRotate,
  resetSignal,
  reducedMotion,
  onSelectDevice,
  onSelectAsset,
}: GreenhouseSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{
        position: DEFAULT_CAMERA_POSITION,
        fov: 35,
        near: 0.1,
        far: 100,
      }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
      }}
      onPointerMissed={onSelectAsset}
      fallback={
        <Greenhouse3DFallback
          variant={variant}
          nodeCount={devices.length}
        />
      }
      aria-label="Mô hình 3D cây và các node cảm biến"
      className="h-full w-full"
    >
      <Lights />
      <GroundGrid />

      <Suspense key={variant} fallback={<TreePlaceholder variant={variant} />}>
        <TreeAssembly
          variant={variant}
          soilHealth={soilHealth}
          reducedMotion={reducedMotion}
          onSelectAsset={onSelectAsset}
        />
        <ContactShadows
          position={[0, GROUND_Y + 0.008, 0]}
          opacity={0.28}
          scale={6.2}
          blur={3.2}
          far={2.6}
          resolution={512}
          frames={1}
          color="#2f4f3a"
        />
      </Suspense>

      {devices.map((device, index) => (
        <SensorNode
          key={device._id}
          device={device}
          index={index}
          position={getNodePosition(device, index, devices.length, variant)}
          selected={device._id === selectedDeviceId}
          warning={
            device._id === selectedDeviceId &&
            (waterLow || soilHealth === 'dry' || soilHealth === 'wet')
          }
          valueLabel={
            device._id === selectedDeviceId &&
            telemetry?.soil_humidity !== null &&
            telemetry?.soil_humidity !== undefined
              ? `${Math.round(telemetry.soil_humidity)}% đất`
              : null
          }
          reducedMotion={reducedMotion}
          onSelect={onSelectDevice}
        />
      ))}

      <WateringValve
        variant={variant}
        pumpOn={pumpOn}
        waitingForTelemetry={waitingForTelemetry}
        reducedMotion={reducedMotion}
      />

      <CameraRig autoRotate={autoRotate} resetSignal={resetSignal} />
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

function CameraRig({
  autoRotate,
  resetSignal,
}: {
  autoRotate: boolean
  resetSignal: number
}) {
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null)
  const { camera } = useThree()

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return

    camera.position.set(...DEFAULT_CAMERA_POSITION)
    controls.target.set(...DEFAULT_CAMERA_TARGET)
    controls.update()
  }, [camera, resetSignal])

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      target={DEFAULT_CAMERA_TARGET}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={3.2}
      maxDistance={8.5}
      minPolarAngle={0.35}
      maxPolarAngle={Math.PI / 2.06}
      autoRotate={autoRotate}
      autoRotateSpeed={0.7}
    />
  )
}

interface TreeAssemblyProps {
  variant: AssetModelVariant
  soilHealth: SoilHealth
  reducedMotion: boolean
  onSelectAsset: () => void
}

function TreeAssembly({
  variant,
  soilHealth,
  reducedMotion,
  onSelectAsset,
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
  const swayRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

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

  useFrame((state) => {
    if (!swayRef.current) return

    const lean =
      soilHealth === 'dry' ? 0.035 : soilHealth === 'wet' ? -0.01 : 0

    if (reducedMotion) {
      swayRef.current.rotation.z = lean
      swayRef.current.rotation.x = 0
      return
    }

    const time = state.clock.elapsedTime
    swayRef.current.rotation.z = Math.sin(time * 0.9) * 0.008 + lean
    swayRef.current.rotation.x = Math.cos(time * 0.7) * 0.005
  })

  if (!tree) return <TreePlaceholder variant={variant} />

  const soilTop = soilTopForVariant(variant)
  const hoverRingInner = variant === 'potted' ? 0.56 : 0.7
  const hoverRingOuter = variant === 'potted' ? 0.6 : 0.74
  return (
    <group>
      <group
        onClick={(event) => {
          event.stopPropagation()
          onSelectAsset()
        }}
        onPointerEnter={(event) => {
          event.stopPropagation()
          setHovered(true)
        }}
        onPointerLeave={(event) => {
          event.stopPropagation()
          setHovered(false)
        }}
      >
        {variant === 'potted' ? (
          <Pot soilHealth={soilHealth} />
        ) : (
          <GroundBed soilHealth={soilHealth} />
        )}

        <group ref={swayRef} position={[0, soilTop, 0]}>
          <primitive object={tree.root} />
        </group>

        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, GROUND_Y + 0.009, 0]}
        >
          <ringGeometry args={[hoverRingInner, hoverRingOuter, 40]} />
          <meshBasicMaterial
            color={hovered ? '#10b981' : '#a7c9b2'}
            transparent
            opacity={hovered ? 0.55 : 0.28}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

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
  index: number
  position: [number, number, number]
  selected: boolean
  warning: boolean
  valueLabel: string | null
  reducedMotion: boolean
  onSelect: (deviceId: string) => void
}

function SensorNode({
  device,
  index,
  position,
  selected,
  warning,
  valueLabel,
  reducedMotion,
  onSelect,
}: SensorNodeProps) {
  const [hovered, setHovered] = useState(false)
  const glowRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  useCursor(hovered)

  const color = !device.online
    ? SCENE_COLORS.nodeOffline
    : warning
      ? SCENE_COLORS.nodeWarning
      : selected
        ? SCENE_COLORS.nodeSelected
        : SCENE_COLORS.nodeOnline

  useFrame((state) => {
    const time = state.clock.elapsedTime
    const pulse = reducedMotion ? 0 : (Math.sin(time * 2.1 + index * 1.2) + 1) / 2

    if (glowRef.current) {
      glowRef.current.scale.setScalar(1 + pulse * 0.4)
      const material = glowRef.current.material
      if (material instanceof THREE.MeshBasicMaterial) {
        material.opacity = 0.12 + (1 - pulse) * 0.12
      }
    }

    if (ringRef.current) {
      ringRef.current.scale.setScalar(1 + pulse * 0.55)
    }
  })

  return (
    <group position={position} scale={hovered ? 1.08 : 1}>
      <mesh ref={glowRef}>
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
        <mesh ref={ringRef}>
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
        }}
        onPointerOut={(event) => {
          event.stopPropagation()
          setHovered(false)
        }}
        onClick={(event) => {
          event.stopPropagation()
          onSelect(device._id)
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

      <Html
        position={[0, 0.2, 0]}
        center
        distanceFactor={6}
        zIndexRange={[40, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-1 text-[10px] shadow-sm backdrop-blur ${
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
    </group>
  )
}

function WateringValve({
  variant,
  pumpOn,
  waitingForTelemetry,
  reducedMotion,
}: {
  variant: AssetModelVariant
  pumpOn: boolean
  waitingForTelemetry: boolean
  reducedMotion: boolean
}) {
  const handleRef = useRef<THREE.Group>(null)
  const soilTop = soilTopForVariant(variant)

  useFrame((_, delta) => {
    if (!handleRef.current) return
    const target = pumpOn ? Math.PI / 2 : 0

    if (reducedMotion) {
      handleRef.current.rotation.y = target
      return
    }

    handleRef.current.rotation.y = THREE.MathUtils.damp(
      handleRef.current.rotation.y,
      target,
      8,
      delta,
    )
  })

  return (
    <group>
      <Pipe
        position={[1.35, 0.2, 0.38]}
        rotation={[0, 0, Math.PI / 2]}
        length={1.26}
      />
      <mesh position={[1.98, 0.25, 0.38]}>
        <cylinderGeometry args={[0.05, 0.05, 0.12, 12]} />
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

      <RoundedBox
        args={[0.2, 0.16, 0.15]}
        radius={0.025}
        smoothness={2}
        position={[0.72, 0.29, 0.38]}
      >
        <meshStandardMaterial
          color={SCENE_COLORS.valveBody}
          roughness={0.5}
          metalness={0.25}
        />
      </RoundedBox>

      <group ref={handleRef} position={[0.72, 0.395, 0.38]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.075, 0.018, 8, 20]} />
          <meshStandardMaterial
            color={SCENE_COLORS.valveHandle}
            roughness={0.5}
            metalness={0.2}
          />
        </mesh>
        <mesh>
          <boxGeometry args={[0.15, 0.018, 0.018]} />
          <meshStandardMaterial
            color={SCENE_COLORS.valveHandle}
            roughness={0.5}
            metalness={0.2}
          />
        </mesh>
      </group>

      <Html
        position={[0.72, 1.16, 0.38]}
        center
        distanceFactor={6}
        zIndexRange={[30, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div
          className={`whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-semibold shadow-sm backdrop-blur ${
            pumpOn
              ? 'border-emerald-300 bg-emerald-50/95 text-emerald-900'
              : 'border-slate-200 bg-white/95 text-slate-600'
          }`}
        >
          Van tưới ·{' '}
          {pumpOn
            ? waitingForTelemetry
              ? 'Đang chờ dữ liệu'
              : 'ĐANG MỞ'
            : 'ĐANG ĐÓNG'}
        </div>
      </Html>

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
