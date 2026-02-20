/**
 * @file Visor 3D para archivos STL usando React Three Fiber.
 *
 * Muestra una vista previa del modelo 3D con controles de órbita y rotación
 * automática. Si WebGL no está disponible o el archivo no se puede cargar,
 * muestra un marcador de posición con el nombre del archivo.
 *
 * @module components/ModelViewer3D
 */

import { Suspense } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Center, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { Box } from 'lucide-react';

/**
 * Malla 3D del modelo STL cargado desde una URL.
 *
 * @param {{ url: string }} props
 * @returns {JSX.Element}
 */
function STLMesh({ url }) {
  const geometry = useLoader(STLLoader, url);
  return (
    <Center>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color="#F59E0B"
          metalness={0.15}
          roughness={0.55}
        />
      </mesh>
    </Center>
  );
}

/**
 * Escena de carga mientras el STL se descarga.
 *
 * @returns {JSX.Element}
 */
function LoadingMesh() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#2a2d31" wireframe />
    </mesh>
  );
}

/**
 * Visor 3D interactivo de modelos STL.
 *
 * @param {Object} props
 * @param {string} props.url - URL del archivo STL a mostrar
 * @param {string} [props.fileName] - Nombre del archivo (para el marcador)
 * @param {string} [props.className] - Clases CSS adicionales para el contenedor
 * @returns {JSX.Element}
 */
export default function ModelViewer3D({ url, fileName = 'modelo.stl', className = '' }) {
  if (!url) {
    return (
      <div className={`w-full h-64 rounded-xl overflow-hidden bg-[#0d1014] border border-[#1e2125] flex items-center justify-center ${className}`}>
        <div className="text-center">
          <Box size={40} className="mx-auto mb-3 text-gunmetal opacity-40" />
          <p className="text-gunmetal text-sm">Sin vista previa</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-64 rounded-xl overflow-hidden bg-[#0d1014] border border-[#1e2125] ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        shadows
        gl={{ antialias: true }}
      >
        {/* Iluminación */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={1.2} castShadow />
        <directionalLight position={[-5, -5, -5]} intensity={0.2} />

        {/* Modelo */}
        <Suspense fallback={<LoadingMesh />}>
          <STLMesh url={url} />
          <OrbitControls
            autoRotate
            autoRotateSpeed={1.5}
            enablePan={false}
            minDistance={1}
            maxDistance={20}
          />
        </Suspense>

        {/* Gizmo de orientación */}
        <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
          <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="white" />
        </GizmoHelper>
      </Canvas>

      {/* Nombre del archivo */}
      <div className="absolute bottom-2 left-2 bg-black/50 rounded px-2 py-0.5">
        <p className="text-xs text-gunmetal truncate max-w-[150px]">{fileName}</p>
      </div>
    </div>
  );
}
