// src/components/GlobeViewDialog.tsx
'use client';

import React, { useEffect, useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import styles from './GlobeViewDialog.module.css'; // Pastikan file CSS ini ada
// import { Kingdom } from '@/types'; // Tidak perlu jika tidak render kingdom di sini
// import type { LatLngExpression } from 'leaflet'; // Tidak perlu

interface GlobeViewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mapImageSrc?: string;
  // Hapus props yang terkait kingdom jika tidak dirender di globe ini:
  // kingdoms: Kingdom[];
  // mapWidthUnits: number;
  // mapHeightUnits: number;
}

// Komponen untuk Bola Dunia 3D yang bisa di-drag
const DraggableGlobe: React.FC<{ mapImageSrc: string }> = ({ mapImageSrc }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const texture = useTexture(mapImageSrc); // Load tekstur
  const SPHERE_RADIUS = 2.5;

  useEffect(() => {
    if (texture) {
      // Untuk peta equirectangular, ClampToEdgeWrapping mencegah jahitan di kutub
      // dan RepeatWrapping untuk wrap horizontal (jika tekstur tidak 360 derajat)
      // Jika tekstur sudah 360 derajat penuh (seperti peta dunia standar), ClampToEdgeWrapping di S juga oke.
      texture.wrapS = THREE.RepeatWrapping; // atau ClampToEdgeWrapping jika tekstur sudah pas 360
      texture.wrapT = THREE.ClampToEdgeWrapping;
      // texture.flipY = false; // Coba ini jika tekstur petamu terbalik secara vertikal saat di sphere
    }
  }, [texture]);

  return (
    <mesh ref={meshRef} rotation={[0, Math.PI * 0.15, 0]}> {/* Rotasi awal sedikit agar tidak flat */}
      <sphereGeometry args={[SPHERE_RADIUS, 64, 32]} /> {/* Radius, widthSegments, heightSegments */}
      <meshStandardMaterial 
        map={texture} 
        side={THREE.FrontSide} // Hanya render sisi depan
        // roughness={0.8} // Untuk tampilan matte
        // metalness={0.1}
      />
    </mesh>
  );
};


const GlobeViewDialog: React.FC<GlobeViewDialogProps> = ({
  isOpen,
  onClose,
  mapImageSrc = '/maps/petadasar.png',
  // kingdoms, // Hapus jika tidak dipakai
  // mapWidthUnits,
  // mapHeightUnits,
}) => {
  // Hapus state showKingdomsOnGlobe jika tidak ada checkbox lagi
  // const [showKingdomsOnGlobe, setShowKingdomsOnGlobe] = useState(true);
  const globeContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEsc);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  const toggleFullscreen = () => {
    const elem = globeContainerRef.current;
    if (!elem) return;
    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch(err => {
        alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      if (document.exitFullscreen) { document.exitFullscreen(); }
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.dialogOverlay} onClick={onClose}>
      <div className={styles.dialogContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>×</button>
        <h2>Global View (Sphere)</h2>
        
        {/* Hapus bagian checkbox jika tidak ada fitur show/hide kingdom di globe ini */}
        <div className={styles.controlsHeader} style={{ justifyContent: 'flex-end' }}> {/* Hanya tombol fullscreen */}
            {/* <div className={styles.checkboxContainer}>
              <input type="checkbox" id="showKingdomsCheckbox" checked={showKingdomsOnGlobe} onChange={() => setShowKingdomsOnGlobe(!showKingdomsOnGlobe)} />
              <label htmlFor="showKingdomsCheckbox">Show Kingdoms</label>
            </div> */}
            <button onClick={toggleFullscreen} className={styles.fullscreenButton}>
              Toggle Fullscreen
            </button>
        </div>

        <p style={{ textAlign: 'center', marginBottom: '15px', fontStyle: 'italic', color: '#555', fontSize: '0.9em' }}>
          Explore the world by dragging the globe.
        </p>
        
        <div ref={globeContainerRef} className={styles.globeViewerContainer}>
          <Suspense fallback={<div className={styles.loadingText}>Loading Globe...</div>}>
            <Canvas
                camera={{ position: [0, 0, 6.5], fov: 50 }} // Sesuaikan posisi kamera
                style={{ background: 'transparent' }} 
            >
              <ambientLight intensity={0.5} /> 
              <directionalLight intensity={0.8} position={[5, 5, 5]} />
              
              <DraggableGlobe mapImageSrc={mapImageSrc} />
              
              <OrbitControls 
                enableZoom={true} 
                enablePan={false} 
                enableDamping={true}
                dampingFactor={0.05} 
                rotateSpeed={0.4}
                minDistance={SPHERE_RADIUS_FOR_CONTROLS_R3F + 0.5} // Jarak zoom terdekat
                maxDistance={12} // Jarak zoom terjauh
              />
            </Canvas>
          </Suspense>
        </div>
         <p style={{ textAlign: 'center', marginTop: '15px', fontSize: '0.9em', color: '#777' }}>
          (Drag to rotate. Scroll to zoom.)
        </p>
      </div>
    </div>
  );
};

const SPHERE_RADIUS_FOR_CONTROLS_R3F = 2.5; // Samakan dengan radius di DraggableGlobe

export default GlobeViewDialog;