/**
 * @file Visor 3D de G-code usando Three.js (react-three-fiber).
 *
 * Parsea el texto G-code, extrae movimientos de extrusión (G1 con E),
 * y renderiza el toolpath como líneas coloreadas por altura (Z) o por
 * filamento (colores reales extraídos del header del G-code).
 * Permite rotar, hacer zoom y desplazar la vista con OrbitControls.
 *
 * @module components/slicer/GcodeViewer
 */

import { useMemo, useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Extrae colores de filamento del header del G-code.
 *
 * Busca la línea "; filament_colour = #RRGGBB;#RRGGBB;..."
 *
 * @param {string} gcodeText
 * @returns {string[]} Array de hex colors por tool index
 */
function extractFilamentColors(gcodeText) {
  const match = gcodeText.match(/;\s*filament_colour\s*=\s*(.+)/i);
  if (!match) return [];
  return match[1]
    .split(';')
    .map((c) => c.trim())
    .filter((c) => /^#[0-9a-fA-F]{6}$/.test(c));
}

/**
 * Parsea texto G-code y extrae segmentos de extrusión con tool index.
 *
 * Solo procesa líneas G0/G1 con coordenadas X/Y/Z/E.
 * Retorna segmentos donde E es positivo (extrusión real).
 * Trackea cambios de tool (T0, T1, etc.) para colorear por filamento.
 *
 * @param {string} gcodeText - Texto completo del G-code
 * @returns {{ segments: Float32Array, heightColors: Float32Array, filamentColors: Float32Array, offset: number[], height: number, size: number, toolColors: string[], hasMultiColor: boolean }}
 */
function parseGcode(gcodeText) {
  const lines = gcodeText.split('\n');
  const toolHexColors = extractFilamentColors(gcodeText);

  let x = 0, y = 0, z = 0, e = 0;
  let prevX = 0, prevY = 0, prevZ = 0;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let activeTool = 0;

  // Primera pasada: recolectar segmentos con tool index
  const segs = [];
  for (const line of lines) {
    const trimmed = line.trim();

    // Tool change: T0, T1, T2, ...
    if (/^T\d+$/.test(trimmed)) {
      activeTool = parseInt(trimmed.slice(1), 10);
      continue;
    }

    if (!trimmed.startsWith('G0') && !trimmed.startsWith('G1')) continue;

    const parts = trimmed.split(/\s+/);
    let newE = e;
    for (const p of parts) {
      const code = p[0];
      const val = parseFloat(p.slice(1));
      if (isNaN(val)) continue;
      if (code === 'X') x = val;
      else if (code === 'Y') y = val;
      else if (code === 'Z') z = val;
      else if (code === 'E') newE = val;
    }

    // Solo segmentos con extrusión
    if (newE > e && (x !== prevX || y !== prevY || z !== prevZ)) {
      segs.push([prevX, prevZ, -prevY, x, z, -y, z, activeTool]);
      minX = Math.min(minX, prevX, x);
      minY = Math.min(minY, -prevY, -y);
      minZ = Math.min(minZ, prevZ, z);
      maxX = Math.max(maxX, prevX, x);
      maxY = Math.max(maxY, -prevY, -y);
      maxZ = Math.max(maxZ, prevZ, z);
    }

    prevX = x;
    prevY = y;
    prevZ = z;
    e = newE;
  }

  // Limitar a ~200k segmentos para rendimiento
  const maxSegs = 200000;
  const step = segs.length > maxSegs ? Math.ceil(segs.length / maxSegs) : 1;

  const positions = [];
  const heightColorArr = [];
  const filamentColorArr = [];
  const maxH = maxZ || 1;

  // Convertir hex a THREE.Color para cada tool
  const toolThreeColors = toolHexColors.map((hex) => new THREE.Color(hex));
  // Fallback: si no hay colores en header, usar palette
  const fallbackPalette = ['#4FC3F7', '#FF7043', '#66BB6A', '#AB47BC', '#FFA726', '#EC407A', '#26A69A', '#8D6E63'];
  // Detectar si hay múltiples tools usados
  const toolsUsed = new Set();

  for (let i = 0; i < segs.length; i += step) {
    const s = segs[i];
    positions.push(s[0], s[1], s[2], s[3], s[4], s[5]);
    toolsUsed.add(s[7]);

    // Color por altura (Z): azul → cian → verde → amarillo → rojo
    const t = Math.min(s[6] / maxH, 1);
    const hColor = new THREE.Color();
    hColor.setHSL(0.66 - t * 0.66, 0.9, 0.55);
    heightColorArr.push(hColor.r, hColor.g, hColor.b, hColor.r, hColor.g, hColor.b);

    // Color por filamento (tool)
    const toolIdx = s[7];
    let fColor;
    if (toolIdx < toolThreeColors.length) {
      fColor = toolThreeColors[toolIdx];
    } else {
      fColor = new THREE.Color(fallbackPalette[toolIdx % fallbackPalette.length]);
    }
    filamentColorArr.push(fColor.r, fColor.g, fColor.b, fColor.r, fColor.g, fColor.b);
  }

  const cx = (minX + maxX) / 2;
  const cz = (minY + maxY) / 2;
  const height = maxZ - minZ;
  const size = Math.max(maxX - minX, maxY - minY, height) || 100;

  return {
    segments: new Float32Array(positions),
    heightColors: new Float32Array(heightColorArr),
    filamentColors: new Float32Array(filamentColorArr),
    offset: [cx, minZ, cz],
    height,
    size,
    toolColors: toolHexColors.length > 0
      ? toolHexColors
      : [...toolsUsed].sort().map((i) => fallbackPalette[i % fallbackPalette.length]),
    hasMultiColor: toolsUsed.size > 1,
  };
}

/**
 * Mesh del toolpath como LineSegments.
 * Alterna entre colores por altura o por filamento.
 */
function Toolpath({ gcodeText, colorMode }) {
  const data = useMemo(() => parseGcode(gcodeText), [gcodeText]);
  const geomRef = useRef();

  const colors = colorMode === 'filament' ? data.filamentColors : data.heightColors;

  // Actualizar atributo de color cuando cambia el modo
  useEffect(() => {
    if (geomRef.current) {
      const attr = geomRef.current.getAttribute('color');
      if (attr) {
        attr.array = colors;
        attr.needsUpdate = true;
      }
    }
  }, [colors]);

  if (data.segments.length === 0) return null;

  return (
    <group position={[-data.offset[0], -data.offset[1], -data.offset[2]]}>
      <lineSegments>
        <bufferGeometry ref={geomRef}>
          <bufferAttribute
            attach="attributes-position"
            array={data.segments}
            count={data.segments.length / 3}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            array={colors}
            count={colors.length / 3}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.85} />
      </lineSegments>
    </group>
  );
}

/**
 * Plataforma de impresión (grid).
 */
function BuildPlate({ size }) {
  return (
    <gridHelper
      args={[size, 20, '#2a2d31', '#1a1d21']}
      rotation={[0, 0, 0]}
      position={[0, 0, 0]}
    />
  );
}

/**
 * Visor 3D de G-code con toggle de color (altura / filamento).
 *
 * @param {Object} props
 * @param {string} props.gcodeText - Texto del G-code a renderizar
 * @param {string} [props.className] - Clases CSS adicionales
 */
export default function GcodeViewer({ gcodeText, className = '' }) {
  const parsed = useMemo(() => parseGcode(gcodeText || ''), [gcodeText]);
  const [colorMode, setColorMode] = useState('height');

  if (!gcodeText) return null;

  const { size, height, hasMultiColor, toolColors } = parsed;
  const camDist = Math.max(size * 1.2, 50);
  const centerY = height / 2;

  return (
    <div className={`relative w-full h-full bg-[#0a0c0f] rounded-lg overflow-hidden ${className}`}>
      {/* Controles de color */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <button
          onClick={() => setColorMode(colorMode === 'height' ? 'filament' : 'height')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors backdrop-blur-sm ${
            colorMode === 'filament'
              ? 'bg-amber-400/20 border-amber-400/40 text-amber-400'
              : 'bg-[#1a1d21]/80 border-[#2a2d31] text-steel hover:text-tech-white hover:border-[#3a3d41]'
          }`}
          title={colorMode === 'height' ? 'Cambiar a color por filamento' : 'Cambiar a color por altura'}
        >
          {colorMode === 'filament' ? (
            <>
              <span className="flex gap-0.5">
                {toolColors.slice(0, 4).map((c, i) => (
                  <span
                    key={i}
                    className="w-2.5 h-2.5 rounded-full border border-white/20"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </span>
              Filamento
            </>
          ) : (
            <>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'linear-gradient(135deg, #1565C0, #00BCD4, #4CAF50, #FFC107, #F44336)' }} />
              Altura
            </>
          )}
        </button>
      </div>

      <Canvas
        camera={{
          position: [camDist * 0.7, centerY + camDist * 0.6, camDist * 0.7],
          fov: 45,
          near: 0.1,
          far: camDist * 10,
        }}
        gl={{ antialias: true }}
      >
        <ambientLight intensity={0.6} />
        <Toolpath gcodeText={gcodeText} colorMode={colorMode} />
        <BuildPlate size={size * 1.2} />
        <OrbitControls
          target={[0, centerY, 0]}
          enableDamping
          dampingFactor={0.1}
          rotateSpeed={0.8}
          zoomSpeed={1.2}
          minDistance={10}
          maxDistance={camDist * 5}
        />
      </Canvas>
    </div>
  );
}
