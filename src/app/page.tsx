// src/app/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import FantasyMap, { FantasyMapHandle } from '@/components/FantasyMap';
import InfoPanel from '@/components/InfoPanel';
import GlobeViewDialog from '@/components/GlobeViewDialog'; // Ini versi GlobeViewDialog silinder
import { Kingdom } from '@/types';
import './HomePage.css'; // Pastikan ada
import styles from './EditForm.module.css'; // Pastikan ada
import type { LatLngExpression } from 'leaflet';
import * as turf from '@turf/turf';
// Removed Feature, Polygon as they are unused
// import type { Feature, Polygon } from 'geojson'; // Original line
import type {} from 'geojson'; // Corrected: removed unused Feature, Polygon. If no other types from 'geojson' are needed, this line can be removed.

// Helper functions dan konstanta skala
function generateUniqueId(): string {
  return `k${Date.now()}${Math.random().toString(36).substring(2, 7)}`;
}
function getRandomColor(): string {
  const letters = '0123456789ABCDEF'; let color = '#';
  for (let i = 0; i < 6; i++) { color += letters[Math.floor(Math.random() * 16)]; }
  return color;
}
const adj = ["Mighty", "Ancient", "Forgotten", "Shining", "Dark", "Whispering", "Frozen", "Burning"];
const noun = ["Empire", "Kingdom", "Dominion", "Realm", "Dynasty", "Union", "Confederacy", "Holdings"];
const place = ["of the Sun", "of the Moon", "of the Stars", "of the North", "of the Deep", "of the Sky", "by the Sea", "in the Woods"];
function getRandomKingdomName(): string {
  return `${adj[Math.floor(Math.random() * adj.length)]} ${noun[Math.floor(Math.random() * noun.length)]} ${place[Math.floor(Math.random() * place.length)]}`;
}

const KINGDOMS_STORAGE_KEY = 'fantasyKingdomsData';
const MAP_CRS_WIDTH_UNITS = 2000;
const MAP_CRS_HEIGHT_UNITS = 1000;
const KM_PER_MAP_UNIT_LENGTH = 5;
const SQKM_PER_MAP_UNIT_AREA = KM_PER_MAP_UNIT_LENGTH * KM_PER_MAP_UNIT_LENGTH;

type EditableKingdomFields = Omit<Kingdom, 'id' | 'territoryPolygons' | 'color'>;

export default function HomePage() {
  const [kingdoms, setKingdoms] = useState<Kingdom[]>([]);
  const [selectedKingdom, setSelectedKingdom] = useState<Kingdom | null>(null);
  const [selectedMapFeature, setSelectedMapFeature] = useState<{
    coords: { lat: number; lng: number };
    kingdom?: Kingdom;
    areaKm2?: number;
  } | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [kingdomToFocus, setKingdomToFocus] = useState<string | null>(null);
  const [editingKingdomId, setEditingKingdomId] = useState<string | null>(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [isEditingTerritory, setIsEditingTerritory] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<EditableKingdomFields>>({});
  const fantasyMapRef = useRef<FantasyMapHandle>(null);
  const [isGlobeViewOpen, setIsGlobeViewOpen] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const storedKingdoms = localStorage.getItem(KINGDOMS_STORAGE_KEY);
    if (storedKingdoms) {
      try {
        const parsedData = JSON.parse(storedKingdoms);
        if (Array.isArray(parsedData) && parsedData.every(item => typeof item === 'object' && item !== null && 'id' in item && 'name' in item)) {
          setKingdoms(parsedData as Kingdom[]);
        } else { localStorage.removeItem(KINGDOMS_STORAGE_KEY); }
      } catch { localStorage.removeItem(KINGDOMS_STORAGE_KEY); }
    }
  }, []);

  useEffect(() => {
    if (isClient) { // Hanya simpan jika sudah di client
        if (kingdoms.length > 0) {
            localStorage.setItem(KINGDOMS_STORAGE_KEY, JSON.stringify(kingdoms));
        } else {
            // Jika tidak ada kerajaan, hapus dari local storage untuk konsistensi
            localStorage.removeItem(KINGDOMS_STORAGE_KEY);
        }
    }
  }, [kingdoms, isClient]);

  const handleMapClick = useCallback((coords: { lat: number; lng: number }, kingdomOwner?: Kingdom) => {
    if (isEditingTerritory) return;
    setSelectedKingdom(kingdomOwner || null);
    let areaKm2: number | undefined = undefined;
    if (kingdomOwner && kingdomOwner.territoryPolygons) {
        let totalAreaCrsUnits = 0;
        kingdomOwner.territoryPolygons.forEach(polygonCoordsLeaflet => {
            const geoJsonRing = polygonCoordsLeaflet.map(p => {
                const [lat, lng] = p as [number, number];
                return [lng, lat] as [number, number];
            });
            if (geoJsonRing.length > 0 && (geoJsonRing[0][0] !== geoJsonRing[geoJsonRing.length - 1][0] || geoJsonRing[0][1] !== geoJsonRing[geoJsonRing.length - 1][1])) {
                geoJsonRing.push([...geoJsonRing[0]]);
            }
            if (geoJsonRing.length >= 4) {
                const turfPoly = turf.polygon([geoJsonRing]);
                totalAreaCrsUnits += turf.area(turfPoly);
            }
        });
        areaKm2 = totalAreaCrsUnits * SQKM_PER_MAP_UNIT_AREA;
    }
    setSelectedMapFeature({ coords, kingdom: kingdomOwner, areaKm2 });
    if (kingdomOwner && !isEditingDetails && !isEditingTerritory) {
      setKingdomToFocus(kingdomOwner.id);
    }
  }, [isEditingDetails, isEditingTerritory]); // Hapus dependensi yang tidak perlu jika ada

  const handleSelectKingdomFromPanel = useCallback((kingdomId: string | null) => {
    if (isEditingDetails || isEditingTerritory) return;
    if (kingdomId) {
        const kingdom = kingdoms.find(k => k.id === kingdomId);
        setSelectedKingdom(kingdom || null); setKingdomToFocus(kingdomId);
        if (kingdom) {
            let areaKm2: number | undefined = undefined;
            let centerCoordsLat: number = MAP_CRS_HEIGHT_UNITS / 2;
            let centerCoordsLng: number = MAP_CRS_WIDTH_UNITS / 2;
            if (kingdom.territoryPolygons && kingdom.territoryPolygons.length > 0 && kingdom.territoryPolygons[0].length > 0) {
                let totalAreaCrsUnits = 0;
                 kingdom.territoryPolygons.forEach(polygonCoordsLeaflet => {
                    const geoJsonRing = polygonCoordsLeaflet.map(p => {
                        const [lat, lng] = p as [number, number];
                        return [lng, lat] as [number, number];
                    });
                    if (geoJsonRing.length > 0 && (geoJsonRing[0][0] !== geoJsonRing[geoJsonRing.length - 1][0] || geoJsonRing[0][1] !== geoJsonRing[geoJsonRing.length - 1][1])) {
                        geoJsonRing.push([...geoJsonRing[0]]);
                    }
                    if (geoJsonRing.length >= 4) {
                        const turfPoly = turf.polygon([geoJsonRing]);
                        totalAreaCrsUnits += turf.area(turfPoly);
                    }
                });
                areaKm2 = totalAreaCrsUnits * SQKM_PER_MAP_UNIT_AREA;
                const firstPolyRingGeoJson = kingdom.territoryPolygons[0].map(p => {
                    const [lat, lng] = p as [number, number];
                    return [lng, lat] as [number, number];
                });
                if (firstPolyRingGeoJson.length > 0 && (firstPolyRingGeoJson[0][0] !== firstPolyRingGeoJson[firstPolyRingGeoJson.length - 1][0] || firstPolyRingGeoJson[0][1] !== firstPolyRingGeoJson[firstPolyRingGeoJson.length - 1][1])) {
                    firstPolyRingGeoJson.push([...firstPolyRingGeoJson[0]]);
                }
                if(firstPolyRingGeoJson.length >= 4) {
                    const turfPolyForCenter = turf.polygon([firstPolyRingGeoJson]);
                    const center = turf.centerOfMass(turfPolyForCenter);
                    centerCoordsLat = center.geometry.coordinates[1];
                    centerCoordsLng = center.geometry.coordinates[0];
                }
            }
             setSelectedMapFeature({ coords: {lat: centerCoordsLat, lng: centerCoordsLng }, kingdom: kingdom, areaKm2 });
        } else { setSelectedMapFeature(null); }
    } else { setSelectedKingdom(null); setSelectedMapFeature(null); setKingdomToFocus(null); }
  }, [kingdoms, isEditingDetails, isEditingTerritory]);

 const handleGenerateRandomKingdom = () => {
    if (isEditingDetails || isEditingTerritory) { alert("Please finish or cancel editing."); return; }
    const MAP_BOUNDS_Y_MAX = MAP_CRS_HEIGHT_UNITS; const MAP_BOUNDS_X_MAX = MAP_CRS_WIDTH_UNITS;
    const POLYGON_SIZE_MIN = 80; const POLYGON_SIZE_MAX = 250; const MAX_GENERATION_ATTEMPTS = 20;
    let newPolygonVerticesLeaflet: LatLngExpression[] = [];
    let generatedPolygonGeoJSON: ReturnType<typeof turf.polygon> | null = null;
    let attempt = 0; let isOverlapping = true;

    while (isOverlapping && attempt < MAX_GENERATION_ATTEMPTS) {
      attempt++;
      const centerX = Math.random() * (MAP_BOUNDS_X_MAX - POLYGON_SIZE_MAX * 1.5) + (POLYGON_SIZE_MAX * 0.75);
      const centerY = Math.random() * (MAP_BOUNDS_Y_MAX - POLYGON_SIZE_MAX * 1.5) + (POLYGON_SIZE_MAX * 0.75);
      const numVertices = Math.floor(Math.random() * 3) + 5;
      const tempVerticesLeaflet: LatLngExpression[] = [];
      const angles: number[] = []; for (let i = 0; i < numVertices; i++) { angles.push(Math.random() * 2 * Math.PI); } angles.sort();
      for (let i = 0; i < numVertices; i++) {
        const angle = angles[i]; const radius = POLYGON_SIZE_MIN + Math.random() * (POLYGON_SIZE_MAX - POLYGON_SIZE_MIN);
        const x = centerX + radius * Math.cos(angle); const y = centerY + radius * Math.sin(angle);
        tempVerticesLeaflet.push([ Math.max(0, Math.min(MAP_BOUNDS_Y_MAX, y)), Math.max(0, Math.min(MAP_BOUNDS_X_MAX, x)) ] as LatLngExpression);
      }
      newPolygonVerticesLeaflet = tempVerticesLeaflet;
      const geoJsonRingForNewPoly = newPolygonVerticesLeaflet.map(p => {
        const [lat, lng] = p as [number, number];
        return [lng, lat] as [number, number];
      });
      if (geoJsonRingForNewPoly.length > 0 && (geoJsonRingForNewPoly[0][0] !== geoJsonRingForNewPoly[geoJsonRingForNewPoly.length - 1][0] || geoJsonRingForNewPoly[0][1] !== geoJsonRingForNewPoly[geoJsonRingForNewPoly.length - 1][1])) {
        geoJsonRingForNewPoly.push([...geoJsonRingForNewPoly[0]]);
      }
      if (geoJsonRingForNewPoly.length < 4) { continue; }
      generatedPolygonGeoJSON = turf.polygon([geoJsonRingForNewPoly]);
      isOverlapping = false;
      for (const existingKingdom of kingdoms) {
        for (const existingTerritoryLeaflet of existingKingdom.territoryPolygons) {
          const existingGeoJsonRing = existingTerritoryLeaflet.map(p => {
            const [lat, lng] = p as [number, number];
            return [lng, lat] as [number, number];
          });
           if (existingGeoJsonRing.length > 0 && (existingGeoJsonRing[0][0] !== existingGeoJsonRing[existingGeoJsonRing.length - 1][0] || existingGeoJsonRing[0][1] !== existingGeoJsonRing[existingGeoJsonRing.length - 1][1])) {
            existingGeoJsonRing.push([...existingGeoJsonRing[0]]);
          }
          if (existingGeoJsonRing.length < 4) continue;
          const existingPolygonGeoJSON = turf.polygon([existingGeoJsonRing]);
          if (generatedPolygonGeoJSON && turf.booleanOverlap(generatedPolygonGeoJSON, existingPolygonGeoJSON)) {
            isOverlapping = true; break;
          }
        }
        if (isOverlapping) break;
      }
    }
    if (isOverlapping) { alert(`Could not find space after ${MAX_GENERATION_ATTEMPTS} attempts.`); return; }
    const newKingdom: Kingdom = {
      id: generateUniqueId(), name: getRandomKingdomName(), ruler: "Ruler " + (Math.floor(Math.random() * 100) + 1),
      age: Math.floor(Math.random() * 60) + 25, foundingYear: 800 + Math.floor(Math.random() * 700), color: getRandomColor(),
      territoryPolygons: [newPolygonVerticesLeaflet], description: "A newly risen kingdom.", specialFeatures: ["Mysterious Origins"],
      magicalResources: ["Raw Magic Crystals"], population: Math.floor(Math.random() * 80000) + 20000,
      militaryStrength: Math.floor(Math.random() * 30000) + 7000, magicalStrength: Math.floor(Math.random() * 8000) + 1500,
      foundingDate: { year: 0, month: 1, day: 1, hour: 0, minute: 0, isPaused: false, lastUpdate: Date.now() },
      lastUpdated: { year: 0, month: 1, day: 1, hour: 0, minute: 0, isPaused: false, lastUpdate: Date.now() },
      resources: { gold: 0, food: 0, magic: 0 },
      development: { technology: 0, magic: 0, culture: 0 },
      relations: {},
      events: []
    };
    setKingdoms(prevKingdoms => [...prevKingdoms, newKingdom]);
    let newKingdomAreaKm2: number | undefined = undefined;
    let newKingdomCenterLat: number = MAP_CRS_HEIGHT_UNITS / 2;
    let newKingdomCenterLng: number = MAP_CRS_WIDTH_UNITS / 2;
    if (generatedPolygonGeoJSON) {
        const areaCrsUnits = turf.area(generatedPolygonGeoJSON); newKingdomAreaKm2 = areaCrsUnits * SQKM_PER_MAP_UNIT_AREA;
        const centerPoint = turf.centerOfMass(generatedPolygonGeoJSON);
        newKingdomCenterLat = centerPoint.geometry.coordinates[1]; newKingdomCenterLng = centerPoint.geometry.coordinates[0];
    }
    setSelectedMapFeature({ coords: { lat: newKingdomCenterLat, lng: newKingdomCenterLng }, kingdom: newKingdom, areaKm2: newKingdomAreaKm2 });
    setSelectedKingdom(newKingdom); setKingdomToFocus(newKingdom.id);
  };

  const handleDeleteKingdom = (kingdomIdToDelete: string) => {
    if (isEditingDetails || isEditingTerritory) { alert("Please finish or cancel editing."); return; }
    setKingdoms(kingdoms.filter(k => k.id !== kingdomIdToDelete));
    setSelectedKingdom(null);
    setSelectedMapFeature(null);
  };

  const handleStartEditDetails = (kingdomId: string) => {
    handleCancelAllEdits(true);
    const kingdomToEdit = kingdoms.find(k => k.id === kingdomId);
    if (kingdomToEdit) {
      setEditingKingdomId(kingdomId);
      // Changed _, __, ___ to _id, _territoryPolygons, _color for ESLint
      const { id: _id, territoryPolygons: _territoryPolygons, color: _color, ...editableFields } = kingdomToEdit;
      setEditFormData(editableFields);
      setIsEditingDetails(true); setIsEditingTerritory(false);
      setSelectedKingdom(kingdomToEdit); setKingdomToFocus(kingdomId);
    }
  };
  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let processedValue: string | number | string[];
    if (type === 'number') {
      processedValue = parseInt(value, 10);
      if (isNaN(processedValue)) processedValue = editFormData[name as keyof EditableKingdomFields] !== undefined ? (editFormData[name as keyof EditableKingdomFields] as number) : 0;
    } else if (name === 'specialFeatures' || name === 'magicalResources') {
      processedValue = value.split(',').map(s => s.trim()).filter(s => s !== '');
    } else { processedValue = value; }
    setEditFormData(prev => ({ ...prev, [name]: processedValue }));
  };
  const handleSaveEditDetails = () => {
    if (!editingKingdomId || Object.keys(editFormData).length === 0) {
        if(Object.keys(editFormData).length === 0) handleCancelAllEdits();
        return;
    }
    let updatedKingdomInstance: Kingdom | undefined;
    setKingdoms(prevKingdoms =>
      prevKingdoms.map(k => {
        if (k.id === editingKingdomId) {
          updatedKingdomInstance = { ...k, ...(editFormData as EditableKingdomFields) };
          return updatedKingdomInstance;
        }
        return k;
      })
    );
    if (updatedKingdomInstance && selectedKingdom?.id === editingKingdomId) {
        setSelectedKingdom(updatedKingdomInstance);
    }
    handleCancelAllEdits();
  };

  const renderEditForm = () => {
    if (!isEditingDetails || !editingKingdomId) return null;
    const kingdomBeingEdited = kingdoms.find(k => k.id === editingKingdomId);
    if (!kingdomBeingEdited) return null;
    const currentFormData = {
        name: editFormData.name ?? kingdomBeingEdited.name, ruler: editFormData.ruler ?? kingdomBeingEdited.ruler,
        age: editFormData.age ?? kingdomBeingEdited.age, foundingYear: editFormData.foundingYear ?? kingdomBeingEdited.foundingYear,
        description: editFormData.description ?? kingdomBeingEdited.description, population: editFormData.population ?? kingdomBeingEdited.population,
        militaryStrength: editFormData.militaryStrength ?? kingdomBeingEdited.militaryStrength, magicalStrength: editFormData.magicalStrength ?? kingdomBeingEdited.magicalStrength,
        specialFeatures: editFormData.specialFeatures ?? kingdomBeingEdited.specialFeatures, magicalResources: editFormData.magicalResources ?? kingdomBeingEdited.magicalResources,
    };
    return (
      <div className={styles.editFormOverlay}>
        <div className={styles.editFormContainer}>
          <h2>Edit Details: {kingdomBeingEdited.name}</h2>
          <form onSubmit={(e) => { e.preventDefault(); handleSaveEditDetails(); }}>
            <div className={styles.formGroup}><label htmlFor="name">Name:</label><input type="text" id="name" name="name" value={currentFormData.name} onChange={handleEditFormChange} required /></div>
            <div className={styles.formGroup}><label htmlFor="ruler">Ruler:</label><input type="text" id="ruler" name="ruler" value={currentFormData.ruler} onChange={handleEditFormChange} required /></div>
            <div className={styles.formGroup}><label htmlFor="age">Ruler&apos;s Age:</label><input type="number" id="age" name="age" value={currentFormData.age} onChange={handleEditFormChange} required /></div>
            <div className={styles.formGroup}><label htmlFor="foundingYear">Founding Year:</label><input type="number" id="foundingYear" name="foundingYear" value={currentFormData.foundingYear} onChange={handleEditFormChange} required /></div>
            <div className={styles.formGroup}><label htmlFor="population">Population:</label><input type="number" id="population" name="population" value={currentFormData.population} onChange={handleEditFormChange} /></div>
            <div className={styles.formGroup}><label htmlFor="militaryStrength">Military Strength:</label><input type="number" id="militaryStrength" name="militaryStrength" value={currentFormData.militaryStrength} onChange={handleEditFormChange} /></div>
            <div className={styles.formGroup}><label htmlFor="magicalStrength">Magical Strength:</label><input type="number" id="magicalStrength" name="magicalStrength" value={currentFormData.magicalStrength} onChange={handleEditFormChange} /></div>
            <div className={styles.formGroup}><label htmlFor="description">Description:</label><textarea id="description" name="description" value={currentFormData.description} onChange={handleEditFormChange} rows={3}></textarea></div>
            <div className={styles.formGroup}><label htmlFor="specialFeatures">Special Features (comma-separated):</label><input type="text" id="specialFeatures" name="specialFeatures" value={(currentFormData.specialFeatures || []).join(', ')} onChange={handleEditFormChange} /></div>
            <div className={styles.formGroup}><label htmlFor="magicalResources">Magical Resources (comma-separated):</label><input type="text" id="magicalResources" name="magicalResources" value={(currentFormData.magicalResources || []).join(', ')} onChange={handleEditFormChange} /></div>
            <div className={styles.formActions}><button type="submit" className={styles.saveButton}>Save Details</button><button type="button" onClick={() => handleCancelAllEdits()} className={styles.cancelButton}>Cancel</button></div>
          </form>
        </div>
      </div>
    );
  };

  const handleStartEditTerritory = (kingdomId: string) => {
    handleCancelAllEdits(true);
    const kingdomToEdit = kingdoms.find(k => k.id === kingdomId);
    if (kingdomToEdit) {
      setEditingKingdomId(kingdomId);
      setIsEditingTerritory(true); setIsEditingDetails(false);
      setSelectedKingdom(kingdomToEdit); setKingdomToFocus(kingdomId);
    }
  };

  const triggerSaveTerritoryChanges = () => {
    if (!editingKingdomId || !fantasyMapRef.current) { console.error("Save error: No ID or map ref."); return; }
    const newTerritories = fantasyMapRef.current.getEditedTerritoryData();
    if (newTerritories && newTerritories.some(poly => poly.length >=3)) {
        let updatedKingdomAfterSave: Kingdom | undefined;
        setKingdoms(prevKingdoms =>
          prevKingdoms.map(k => {
            if (k.id === editingKingdomId) {
              updatedKingdomAfterSave = { ...k, territoryPolygons: newTerritories };
              return updatedKingdomAfterSave;
            }
            return k;
          })
        );
        if (updatedKingdomAfterSave) {
            if (selectedKingdom?.id === editingKingdomId) { setSelectedKingdom(updatedKingdomAfterSave); }
            let areaKm2: number | undefined = undefined;
            let centerCoordsLat: number = MAP_CRS_HEIGHT_UNITS / 2;
            let centerCoordsLng: number = MAP_CRS_WIDTH_UNITS / 2;
            if (updatedKingdomAfterSave.territoryPolygons && updatedKingdomAfterSave.territoryPolygons.length > 0) {
                let totalAreaCrsUnits = 0;
                updatedKingdomAfterSave.territoryPolygons.forEach(polygonCoordsLeaflet => {
                    const geoJsonRing = polygonCoordsLeaflet.map(p => {
                        const [lat, lng] = p as [number, number];
                        return [lng, lat] as [number, number];
                    });
                     if (geoJsonRing.length > 0 && (geoJsonRing[0][0] !== geoJsonRing[geoJsonRing.length - 1][0] || geoJsonRing[0][1] !== geoJsonRing[geoJsonRing.length - 1][1])) {
                         geoJsonRing.push([...geoJsonRing[0]]);
                     }
                    if (geoJsonRing.length >= 4) {
                        const turfPoly = turf.polygon([geoJsonRing]);
                        totalAreaCrsUnits += turf.area(turfPoly);
                    }
                });
                areaKm2 = totalAreaCrsUnits * SQKM_PER_MAP_UNIT_AREA;
                const firstPolyRingGeoJson = updatedKingdomAfterSave.territoryPolygons[0].map(p => {
                    const [lat, lng] = p as [number, number];
                    return [lng, lat] as [number, number];
                });
                if (firstPolyRingGeoJson.length > 0 && (firstPolyRingGeoJson[0][0] !== firstPolyRingGeoJson[firstPolyRingGeoJson.length - 1][0] || firstPolyRingGeoJson[0][1] !== firstPolyRingGeoJson[firstPolyRingGeoJson.length - 1][1])) {
                    firstPolyRingGeoJson.push([...firstPolyRingGeoJson[0]]);
                }
                if(firstPolyRingGeoJson.length >= 4) {
                    const turfPolyForCenter = turf.polygon([firstPolyRingGeoJson]);
                    const center = turf.centerOfMass(turfPolyForCenter);
                    centerCoordsLat = center.geometry.coordinates[1];
                    centerCoordsLng = center.geometry.coordinates[0];
                }
            }
            setSelectedMapFeature({ coords: {lat: centerCoordsLat, lng: centerCoordsLng }, kingdom: updatedKingdomAfterSave, areaKm2 });
        }
        handleCancelAllEdits();
    } else {
        console.warn("Save territory: No valid changes or data is invalid.");
        handleCancelAllEdits();
    }
  };
  
  const handleCancelAllEdits = (isSwitchingMode = false) => {
    // Removed the alert that always fires. Only alert if not switching mode and edits are active.
    if (!isSwitchingMode && (isEditingDetails || isEditingTerritory)) {
      alert("Please finish or cancel editing first.");
      return; // Keep return here if alert is shown
    }
    if (isEditingTerritory && fantasyMapRef.current) {
        fantasyMapRef.current.cancelInternalTerritoryEdit();
    }
    setEditingKingdomId(null);
    setIsEditingDetails(false);
    setIsEditingTerritory(false);
    setEditFormData({});
    // If not switching mode, it implies a direct cancel action from a button,
    // so it makes sense to also clear selection.
    // if (!isSwitchingMode) {
    //   setSelectedKingdom(null);
    //   setSelectedMapFeature(null);
    // }
  };

  const renderTerritoryEditControls = () => {
    if (!isEditingTerritory || !editingKingdomId) return null;
    return (
      <div style={{
        position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
        zIndex: 1200, backgroundColor: 'rgba(255, 255, 255, 0.95)', padding: '15px',
        borderRadius: '8px', boxShadow: '0 0 15px rgba(0,0,0,0.3)', display: 'flex', gap: '15px'
      }}>
        <button onClick={triggerSaveTerritoryChanges} className={styles.saveButton}>
            Save Territory Changes
        </button>
        <button onClick={() => handleCancelAllEdits(false)} className={styles.cancelButton}> {/* Pass false for explicit cancel */}
            Cancel Territory Edit
        </button>
      </div>
    );
  };

  return (
    <main className="homepage-main">
      {isClient && renderEditForm()}
      {isClient && renderTerritoryEditControls()}
      {isClient && isGlobeViewOpen && (
        <GlobeViewDialog
          isOpen={isGlobeViewOpen}
          onClose={() => setIsGlobeViewOpen(false)}
          mapImageSrc="/maps/petadasar.png"
          // mapImageWidth={PETADASAR_IMAGE_ACTUAL_WIDTH_PX} // Untuk versi silinder
          // Untuk versi bola 3D, mapImageWidth tidak dipakai, tapi perlu props lain:
          // kingdoms={kingdoms} 
          // mapWidthUnits={MAP_CRS_WIDTH_UNITS}
          // mapHeightUnits={MAP_CRS_HEIGHT_UNITS}
        />
      )}
      <header className="homepage-header">
        <h1>Interactive Fantasy Kingdom Map</h1>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', margin: '10px auto' }}>
            <button onClick={handleGenerateRandomKingdom} style={{ padding: '10px 15px' }} disabled={isEditingDetails || isEditingTerritory}>
              Generate New Random Kingdom
            </button>
            <button onClick={() => setIsGlobeViewOpen(true)} style={{ padding: '10px 15px' }} disabled={isEditingDetails || isEditingTerritory}>
              Lihat Globe
            </button>
        </div>
        {isClient && kingdoms.length === 0 && !isEditingDetails && !isEditingTerritory &&
            <p style={{textAlign: 'center'}}>No kingdoms yet. Generate one!</p>
        }
        {isEditingDetails && <p style={{textAlign: 'center', color: 'orange', fontWeight:'bold', margin: '5px 0'}}>EDITING DETAILS...</p>}
        {isEditingTerritory && <p style={{textAlign: 'center', color: 'deepskyblue', fontWeight:'bold', margin: '5px 0'}}>EDITING TERRITORY...</p>}
      </header>
      <div className={`game-container ${isEditingDetails || isEditingTerritory ? styles.editingActive : ''}`}>
        <div className="map-area">
          {isClient && (
            <FantasyMap
              ref={fantasyMapRef}
              kingdoms={kingdoms}
              onTileClick={handleMapClick}
              kingdomToFocusId={kingdomToFocus}
              onFocusComplete={() => setKingdomToFocus(null)}
              mapWidthUnits={MAP_CRS_WIDTH_UNITS}
              mapHeightUnits={MAP_CRS_HEIGHT_UNITS}
              isEditingTerritoryMode={isEditingTerritory}
              kingdomBeingEditedId={editingKingdomId}
            />
          )}
        </div>
        <div className="info-area">
          {isClient && (
            <InfoPanel
              selectedKingdom={selectedKingdom}
              selectedMapFeature={selectedMapFeature}
              onDeleteKingdom={handleDeleteKingdom}
              onSelectKingdom={handleSelectKingdomFromPanel}
              kingdoms={kingdoms}
              onStartEditDetails={handleStartEditDetails}
              onStartEditTerritory={handleStartEditTerritory}
              isEditing={isEditingDetails || isEditingTerritory}
            />
          )}
        </div>
      </div>
    </main>
  );
}