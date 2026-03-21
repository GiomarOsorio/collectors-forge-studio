/**
 * @file Visor 3D de G-code usando Three.js (react-three-fiber).
 *
 * Parsea el texto G-code, extrae movimientos de extrusión (G1 con E),
 * y renderiza el toolpath como líneas coloreadas por altura (Z).
 * Permite rotar, hacer zoom y desplazar la vista con OrbitControls.
 *
 * @module components/slicer/GcodeViewer
 */

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Parsea texto G-code y extrae segmentos de extrusión.
 *
 * Solo procesa líneas G0/G1 con coordenadas X/Y/Z/E.
 * Retorna segmentos donde E es positivo (extrusión real).
 *
 * @param {string} gcodeText - Texto completo del G-code
 * @returns {{ segments: Float32Array, colors: Float32Array, center: number[], size: number }}
 */
function parseGcode(gcodeText) {
  const lines = gcodeText.split('\n');
  let x = 0, y = 0, z = 0, e = 0;
  let prevX = 0, prevY = 0, prevZ = 0;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  // Primera pasada: recolectar segmentos
  const segs = [];
  for (const line of lines) {
    const trimmed = line.trim();
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
      segs.push([prevX, prevZ, -prevY, x, z, -y, z]);
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
  const colors = [];
  const maxH = maxZ || 1;

  for (let i = 0; i < segs.length; i += step) {
    const s = segs[i];
    positions.push(s[0], s[1], s[2], s[3], s[4], s[5]);

    // Color por altura (Z): azul → cian → verde → amarillo → rojo
    const t = Math.min(s[6] / maxH, 1);
    const color = new THREE.Color();
    color.setHSL(0.66 - t * 0.66, 0.9, 0.55);
    colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
  }

  const cx = (minX + maxX) / 2;
  const cz = (minY + maxY) / 2;
  const height = maxZ - minZ;
  const size = Math.max(maxX - minX, maxY - minY, height) || 100;

  return {
    segments: new Float32Array(positions),
    colors: new Float32Array(colors),
    // Centrar X/Z, pero Y (altura) se desplaza para que la base quede en Y=0
    offset: [cx, minZ, cz],
    height,
    size,
  };
}

/**
 * Mesh del toolpath como LineSegments.
 */
function Toolpath({ gcodeText }) {
  const { segments, colors, offset } = useMemo(
    () => parseGcode(gcodeText),
    [gcodeText],
  );

  if (segments.length === 0) return null;

  return (
    <group position={[-offset[0], -offset[1], -offset[2]]}>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={segments}
            count={segments.length / 3}
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
 * Visor 3D de G-code.
 *
 * @param {Object} props
 * @param {string} props.gcodeText - Texto del G-code a renderizar
 * @param {string} [props.className] - Clases CSS adicionales
 */
export default function GcodeViewer({ gcodeText, className = '' }) {
  const { size, height } = useMemo(() => parseGcode(gcodeText || ''), [gcodeText]);

  if (!gcodeText) return null;

  const camDist = Math.max(size * 1.2, 50);
  const centerY = height / 2;

  return (
    <div className={`w-full h-full bg-[#0a0c0f] rounded-lg overflow-hidden ${className}`}>
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
        <Toolpath gcodeText={gcodeText} />
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
