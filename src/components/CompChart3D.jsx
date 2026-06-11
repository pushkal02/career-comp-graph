import { useRef, useState, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Html, useCursor } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { convertCurrency } from '../utils/currency';

// ── Scene scale constants ────────────────────────────────────────────────────
const SW   = 12;    // X: timeline width in scene units
const SH   = 5;     // Y: max salary height in scene units
const WD   = 0.45;  // Z: wall extrusion depth
const ORB_MIN = 0.10;
const ORB_MAX = 0.52;

// ── Color palette (mirrors CSS vars) ────────────────────────────────────────
const C = {
  base:      '#38bdf8',
  bonus:     '#10b981',
  grant:     '#f59e0b',
  vest:      '#a855f7',
  hike:      '#14b8a6',
  promotion: '#ec4899',
  jobswitch: '#3b82f6',
};

// ── Coordinate helpers ───────────────────────────────────────────────────────
const nx = (months, total) => total > 0 ? (months / total) * SW : 0;
const ny = (salary, maxY)  => maxY  > 0 ? (salary / maxY)  * SH : 0;

const orbRadius = (amt, maxAmt) => {
  if (maxAmt === 0) return ORB_MIN;
  const f = Math.min(amt / maxAmt, 1);
  return Math.sqrt(ORB_MIN ** 2 + (ORB_MAX ** 2 - ORB_MIN ** 2) * f);
};

const normalizeDate = (d) => (d && d.length === 7 ? `${d}-01` : d);

const monthsSince = (dateStr, startYear, startMonth) => {
  const parts = (normalizeDate(dateStr) || '').split('-');
  const year  = Number(parts[0]);
  const month = Number(parts[1]);
  const day   = parts[2] ? Number(parts[2]) : 1;
  return (year - startYear) * 12 + (month - startMonth) + (day - 1) / 30.4368;
};

const salaryAt = (dateStr, sortedSalaryEvents, currency) => {
  if (sortedSalaryEvents.length === 0) return 0;
  const norm = normalizeDate(dateStr);
  let sal = sortedSalaryEvents[0].salary;
  let cur = sortedSalaryEvents[0].currency;
  for (const evt of sortedSalaryEvents) {
    if (normalizeDate(evt.date) <= norm) { sal = evt.salary; cur = evt.currency; }
  }
  return convertCurrency(sal, cur, currency);
};

// ─────────────────────────────────────────────────────────────────────────────
// SalaryWall — extruded 3D wall from the step-line shape
// ─────────────────────────────────────────────────────────────────────────────
function SalaryWall({ sortedSalaryEvents, startYear, startMonth, totalMonths, maxY, currency }) {
  const wallRef = useRef();

  const geometry = useMemo(() => {
    if (sortedSalaryEvents.length === 0) return null;

    const gx = (d) => nx(monthsSince(d, startYear, startMonth), totalMonths);
    const gy = (s, c) => ny(convertCurrency(s, c, currency), maxY);

    const shape = new THREE.Shape();
    const y0 = gy(sortedSalaryEvents[0].salary, sortedSalaryEvents[0].currency);

    shape.moveTo(0, 0);
    shape.lineTo(0, y0);

    let lastY = y0;
    for (let i = 1; i < sortedSalaryEvents.length; i++) {
      const { date, salary, currency: c } = sortedSalaryEvents[i];
      const x = gx(date);
      const y = gy(salary, c);
      shape.lineTo(x, lastY);
      shape.lineTo(x, y);
      lastY = y;
    }
    shape.lineTo(SW, lastY);
    shape.lineTo(SW, 0);
    shape.lineTo(0, 0);

    return new THREE.ExtrudeGeometry(shape, {
      depth: WD,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.018,
      bevelSegments: 3,
    });
  }, [sortedSalaryEvents, startYear, startMonth, totalMonths, maxY, currency]);

  useFrame((state) => {
    if (wallRef.current?.material) {
      wallRef.current.material.emissiveIntensity =
        0.12 + Math.sin(state.clock.elapsedTime * 0.65) * 0.045;
    }
  });

  if (!geometry) return null;

  return (
    <group>
      {/* Main wall */}
      <mesh ref={wallRef} geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={C.base}
          emissive={C.base}
          emissiveIntensity={0.12}
          metalness={0.72}
          roughness={0.10}
          transparent
          opacity={0.82}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Outer glow halo — slightly scaled up, rendered from behind */}
      <mesh geometry={geometry} scale={[1.002, 1.003, 1.5]} position={[0, 0, -0.05]}>
        <meshStandardMaterial
          color={C.base}
          emissive={C.base}
          emissiveIntensity={0.6}
          transparent
          opacity={0.07}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
      {/* Step-edge accent lines */}
      <lineSegments geometry={new THREE.EdgesGeometry(geometry)}>
        <lineBasicMaterial color="#7dd3fc" transparent opacity={0.18} />
      </lineSegments>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CompEventOrb — glowing, floating, interactive sphere for bonus/grant/vest
// ─────────────────────────────────────────────────────────────────────────────
function CompEventOrb({ position, radius, color, eventData, formatFullCurrency, formatDateLabel }) {
  const groupRef  = useRef();
  const meshRef   = useRef();
  const scaleRef  = useRef(1);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const phaseOffset = position[0] * 0.55;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(t * 1.05 + phaseOffset) * 0.072;
    }
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.38;
      meshRef.current.rotation.x = Math.sin(t * 0.28 + phaseOffset) * 0.14;
      const target = hovered ? 1.28 : 1.0;
      scaleRef.current += (target - scaleRef.current) * 0.12;
      meshRef.current.scale.setScalar(scaleRef.current);
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Equatorial ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius * 1.32, 0.018, 8, 48]} />
        <meshBasicMaterial color={color} transparent opacity={hovered ? 0.65 : 0.28} />
      </mesh>
      {/* Tilted ring */}
      <mesh rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[radius * 1.15, 0.012, 6, 48]} />
        <meshBasicMaterial color={color} transparent opacity={hovered ? 0.45 : 0.18} />
      </mesh>
      {/* Main orb sphere */}
      <mesh
        ref={meshRef}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[radius, 40, 40]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.9 : 0.48}
          metalness={0.18}
          roughness={0.04}
          transparent
          opacity={hovered ? 0.96 : 0.88}
          envMapIntensity={0.5}
        />
      </mesh>
      {/* Bright inner core */}
      <mesh>
        <sphereGeometry args={[radius * 0.42, 16, 16]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.22} />
      </mesh>
      {/* Local point light for scene illumination */}
      <pointLight
        color={color}
        intensity={hovered ? 2.2 : 0.65}
        distance={radius * 7}
        decay={2}
      />
      {/* HTML Tooltip */}
      {hovered && (
        <Html
          center
          position={[0, radius + 0.55, 0]}
          zIndexRange={[200, 0]}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          <div style={{
            background: 'rgba(7,10,19,0.97)',
            backdropFilter: 'blur(14px)',
            border: `1px solid ${color}55`,
            borderRadius: '10px',
            padding: '0.65rem 0.95rem',
            minWidth: '168px',
            boxShadow: `0 10px 35px ${color}28, 0 0 0 1px ${color}18`,
            fontFamily: "'Outfit', -apple-system, sans-serif",
            transform: 'translateX(-50%)',
            animation: 'none',
          }}>
            <div style={{
              display: 'inline-block',
              background: `${color}22`,
              border: `1px solid ${color}45`,
              borderRadius: '4px',
              padding: '0.1rem 0.4rem',
              fontSize: '0.63rem',
              fontWeight: 700,
              color,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              marginBottom: '0.38rem',
            }}>{eventData.type}</div>
            <div style={{
              color: 'white',
              fontWeight: 800,
              fontSize: '0.92rem',
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: '-0.01em',
            }}>
              {formatFullCurrency(eventData.amount, eventData.currency)}
            </div>
            {eventData.title && (
              <div style={{
                color: '#94a3b8',
                fontSize: '0.72rem',
                marginTop: '0.22rem',
                maxWidth: '200px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {eventData.title}
              </div>
            )}
            {eventData.company && (
              <div style={{ color: '#818cf8', fontSize: '0.7rem', fontWeight: 600 }}>
                {eventData.company}
              </div>
            )}
            <div style={{ color: '#475569', fontSize: '0.67rem', marginTop: '0.18rem' }}>
              {formatDateLabel(eventData.date)}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SalaryEventDiamond — spinning crystal at each salary change point
// ─────────────────────────────────────────────────────────────────────────────
function SalaryEventDiamond({ position, color, eventData, formatFullCurrency, formatDateLabel }) {
  const meshRef  = useRef();
  const scaleRef = useRef(1);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const phase = position[0] * 0.42;

  useFrame((state) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y += 0.022;
    meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.35 + phase) * 0.12;
    const target = hovered ? 1.45 : 1.0;
    scaleRef.current += (target - scaleRef.current) * 0.10;
    meshRef.current.scale.setScalar(scaleRef.current);
  });

  return (
    <group position={position}>
      {/* Stem to wall */}
      <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.011, 0.011, 0.24, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.45} />
      </mesh>
      {/* Crystal octahedron */}
      <mesh
        ref={meshRef}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
      >
        <octahedronGeometry args={[0.19, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 1.05 : 0.65}
          metalness={0.85}
          roughness={0.06}
        />
      </mesh>
      {/* Glow orb behind */}
      <mesh scale={1.5}>
        <sphereGeometry args={[0.19, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.06} />
      </mesh>
      <pointLight color={color} intensity={hovered ? 1.5 : 0.4} distance={2.2} decay={2} />
      {/* Tooltip */}
      {hovered && (
        <Html
          center
          position={[0, 0.65, 0]}
          zIndexRange={[200, 0]}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          <div style={{
            background: 'rgba(7,10,19,0.97)',
            backdropFilter: 'blur(14px)',
            border: `1px solid ${color}55`,
            borderRadius: '10px',
            padding: '0.65rem 0.95rem',
            minWidth: '168px',
            boxShadow: `0 10px 35px ${color}28`,
            fontFamily: "'Outfit', -apple-system, sans-serif",
            transform: 'translateX(-50%)',
          }}>
            <div style={{
              display: 'inline-block',
              background: `${color}22`,
              border: `1px solid ${color}45`,
              borderRadius: '4px',
              padding: '0.1rem 0.4rem',
              fontSize: '0.63rem',
              fontWeight: 700,
              color,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              marginBottom: '0.38rem',
            }}>{eventData.type}</div>
            <div style={{
              color: 'white',
              fontWeight: 800,
              fontSize: '0.92rem',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {formatFullCurrency(eventData.salary, eventData.currency)}/yr
            </div>
            {eventData.title && (
              <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: '0.22rem' }}>
                {eventData.title}
              </div>
            )}
            {eventData.company && (
              <div style={{ color: '#818cf8', fontSize: '0.7rem', fontWeight: 600 }}>
                {eventData.company}
              </div>
            )}
            <div style={{ color: '#475569', fontSize: '0.67rem', marginTop: '0.18rem' }}>
              {formatDateLabel(eventData.date)}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SceneFloor — dark ground plane + grid helper
// ─────────────────────────────────────────────────────────────────────────────
function SceneFloor() {
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[SW / 2, -0.01, WD / 2]}
        receiveShadow
      >
        <planeGeometry args={[SW + 5, 14]} />
        <meshStandardMaterial
          color="#04060f"
          metalness={0.15}
          roughness={0.85}
          transparent
          opacity={0.98}
        />
      </mesh>
      <gridHelper
        args={[SW + 5, 22, '#0f1e33', '#0a1525']}
        position={[SW / 2, 0.001, WD / 2]}
      />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// YearLabels — floor text + vertical guide lines at each year
// ─────────────────────────────────────────────────────────────────────────────
function YearLabels({ startYear, endYear, startMonth, totalMonths }) {
  const markers = useMemo(() => {
    const list = [];
    for (let y = startYear; y <= endYear; y++) {
      const months = (y - startYear) * 12 + (1 - startMonth);
      if (months < -0.5 || months > totalMonths + 0.5) continue;
      list.push({ year: y, x: nx(Math.max(0, months), totalMonths) });
    }
    return list;
  }, [startYear, endYear, startMonth, totalMonths]);

  return (
    <>
      {markers.map(({ year, x }) => (
        <group key={year} position={[x, 0, WD / 2]}>
          {/* Tall ghost guide pillar */}
          <mesh position={[0, SH / 2, 0]}>
            <boxGeometry args={[0.008, SH, 0.008]} />
            <meshBasicMaterial color="#1a2e45" transparent opacity={0.4} />
          </mesh>
          {/* Floor year label */}
          <Text
            position={[0, -0.2, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.21}
            color="#334155"
            anchorX="center"
            anchorY="middle"
          >
            {`'${String(year).slice(-2)}`}
          </Text>
        </group>
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SalaryAxisLabels — Y-axis ticks along the left edge
// ─────────────────────────────────────────────────────────────────────────────
function SalaryAxisLabels({ maxY, formatShortCurrency }) {
  const ticks = useMemo(() => {
    const n = 5;
    return Array.from({ length: n + 1 }, (_, i) => {
      const salary = (maxY / n) * i;
      return { salary, y: ny(salary, maxY) };
    });
  }, [maxY]);

  return (
    <>
      {ticks.map(({ salary, y }, i) => (
        <Text
          key={i}
          position={[-0.55, y, WD / 2]}
          fontSize={0.16}
          color="#334155"
          anchorX="right"
          anchorY="middle"
        >
          {formatShortCurrency(salary)}
        </Text>
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SceneLighting
// ─────────────────────────────────────────────────────────────────────────────
function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.07} color="#0d1929" />
      <directionalLight
        position={[SW * 0.55, SH * 2.2, 9]}
        intensity={0.75}
        color="#cde8ff"
        castShadow
      />
      <pointLight position={[1, SH * 1.4, 4]} intensity={0.55} color={C.base}  distance={18} decay={2} />
      <pointLight position={[SW, SH * 1.0, 3]} intensity={0.30} color={C.vest}  distance={14} decay={2} />
      <pointLight position={[SW / 2, -1.5, 2]} intensity={0.18} color="#6366f1" distance={12} decay={2} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene3D — assembles everything inside the Canvas
// ─────────────────────────────────────────────────────────────────────────────
function Scene3D({
  sortedSalaryEvents, compEvents, filters,
  startYear, startMonth, endYear, totalMonths,
  maxY, maxCompAmount, currency,
  formatFullCurrency, formatShortCurrency, formatDateLabel,
}) {
  const gx  = (d) => nx(monthsSince(d, startYear, startMonth), totalMonths);
  const gy  = (sal, cur) => ny(convertCurrency(sal, cur, currency), maxY);
  const sat = (d) => salaryAt(d, sortedSalaryEvents, currency);

  const filteredComp   = compEvents.filter(e => filters[e.type]);
  const filteredSalary = sortedSalaryEvents.slice(1).filter(e => filters[e.type]);

  return (
    <>
      <SceneLighting />
      <SceneFloor />
      <YearLabels
        startYear={startYear}
        endYear={endYear}
        startMonth={startMonth}
        totalMonths={totalMonths}
      />
      <SalaryAxisLabels maxY={maxY} formatShortCurrency={formatShortCurrency} />

      {sortedSalaryEvents.length > 0 && (
        <SalaryWall
          sortedSalaryEvents={sortedSalaryEvents}
          startYear={startYear}
          startMonth={startMonth}
          totalMonths={totalMonths}
          maxY={maxY}
          currency={currency}
        />
      )}

      {/* Comp event floating orbs */}
      {filteredComp.map((evt) => {
        const x   = gx(evt.date);
        const sal = sat(evt.date);
        const yBase = ny(sal, maxY);
        const amt = convertCurrency(evt.amount, evt.currency, currency);
        const r   = orbRadius(amt, maxCompAmount);
        return (
          <CompEventOrb
            key={evt.id}
            position={[x, yBase + r + 0.10, WD / 2]}
            radius={r}
            color={C[evt.type] || C.bonus}
            eventData={evt}
            formatFullCurrency={formatFullCurrency}
            formatDateLabel={formatDateLabel}
          />
        );
      })}

      {/* Salary event spinning diamonds */}
      {filteredSalary.map((evt) => {
        const x = gx(evt.date);
        const y = gy(evt.salary, evt.currency);
        return (
          <SalaryEventDiamond
            key={evt.id}
            position={[x, y + 0.22, WD / 2]}
            color={C[evt.type] || C.hike}
            eventData={evt}
            formatFullCurrency={formatFullCurrency}
            formatDateLabel={formatDateLabel}
          />
        );
      })}

      {/* Bloom glow post-processing */}
      <EffectComposer>
        <Bloom
          mipmapBlur
          intensity={1.6}
          luminanceThreshold={0.12}
          luminanceSmoothing={0.03}
          radius={0.72}
        />
      </EffectComposer>

      <OrbitControls
        enableDamping
        dampingFactor={0.07}
        autoRotate
        autoRotateSpeed={0.38}
        minPolarAngle={0.12}
        maxPolarAngle={Math.PI * 0.72}
        minDistance={3.5}
        maxDistance={24}
        target={[SW / 2, SH * 0.42, WD / 2]}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CompChart3D — top-level export; wraps everything in a Canvas
// ─────────────────────────────────────────────────────────────────────────────
export default function CompChart3D({
  sortedSalaryEvents, compEvents, filters,
  startYear, startMonth, endYear, totalMonths,
  maxY, maxCompAmount, currency,
  formatFullCurrency, formatShortCurrency, formatDateLabel,
}) {
  if (sortedSalaryEvents.length === 0) {
    return (
      <div
        className="chart-container"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.85rem',
          background: '#070a13',
          borderRadius: '12px',
          color: 'var(--text-muted)',
        }}
      >
        <span style={{ fontSize: '3rem', opacity: 0.35 }}>🧊</span>
        <p style={{ fontSize: '0.88rem' }}>Add salary events to see the 3D scene</p>
      </div>
    );
  }

  return (
    <div
      className="chart-container"
      style={{
        position: 'relative',
        background: '#070a13',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid rgba(99,102,241,0.18)',
        boxShadow: '0 0 40px rgba(99,102,241,0.08)',
      }}
    >
      {/* Controls hint bar */}
      <div
        style={{
          position: 'absolute',
          bottom: '14px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(7,10,19,0.82)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '999px',
          padding: '0.3rem 1rem',
          fontSize: '0.67rem',
          color: 'var(--text-muted)',
          display: 'flex',
          gap: '0.85rem',
          alignItems: 'center',
          zIndex: 10,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          letterSpacing: '0.02em',
        }}
      >
        <span>🖱 Drag to orbit</span>
        <span style={{ opacity: 0.35 }}>·</span>
        <span>⚲ Scroll to zoom</span>
        <span style={{ opacity: 0.35 }}>·</span>
        <span>⟳ Auto-rotates</span>
        <span style={{ opacity: 0.35 }}>·</span>
        <span>Hover nodes for details</span>
      </div>

      {/* 3D badge */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '14px',
          background: 'rgba(99,102,241,0.12)',
          border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: '6px',
          padding: '0.18rem 0.5rem',
          fontSize: '0.65rem',
          fontWeight: 800,
          color: '#818cf8',
          zIndex: 10,
          letterSpacing: '0.1em',
          pointerEvents: 'none',
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        ◈ THREE.JS 3D
      </div>

      <Canvas
        camera={{
          position: [SW / 2, SH * 1.05, SW * 0.88],
          fov: 44,
          near: 0.1,
          far: 100,
        }}
        gl={{
          antialias: true,
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
        shadows
        dpr={[1, 2]}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={['#070a13']} />
        <fog attach="fog" args={['#070a13', 20, 38]} />
        <Suspense fallback={null}>
          <Scene3D
            sortedSalaryEvents={sortedSalaryEvents}
            compEvents={compEvents}
            filters={filters}
            startYear={startYear}
            startMonth={startMonth}
            endYear={endYear}
            totalMonths={totalMonths}
            maxY={maxY}
            maxCompAmount={maxCompAmount}
            currency={currency}
            formatFullCurrency={formatFullCurrency}
            formatShortCurrency={formatShortCurrency}
            formatDateLabel={formatDateLabel}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
