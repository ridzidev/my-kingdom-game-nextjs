// src/components/InfoPanel.tsx
'use client';

import { Kingdom } from '@/types';
import styles from './InfoPanel.module.css';

interface InfoPanelProps {
  selectedKingdom: Kingdom | null;
  selectedMapFeature: {
    coords: { lat: number; lng: number };
    kingdom?: Kingdom;
    areaKm2?: number;
  } | null;
  onDeleteKingdom: (kingdomId: string) => void;
  onSelectKingdom: (kingdomId: string | null) => void;
  kingdoms: Kingdom[];
  onStartEditDetails: (kingdomId: string) => void;
  onStartEditTerritory: (kingdomId: string) => void;
  isEditing: boolean; // Prop baru
}

export default function InfoPanel({
  selectedKingdom,
  selectedMapFeature,
  onDeleteKingdom,
  onSelectKingdom,
  kingdoms,
  onStartEditDetails,
  onStartEditTerritory,
  isEditing, // Terima prop baru
}: InfoPanelProps) {
  const handleKingdomSelectionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (isEditing) return; // Jangan proses jika sedang edit
    const kingdomId = event.target.value;
    onSelectKingdom(kingdomId === "none" ? null : kingdomId);
  };

  const formatNumber = (num: number | undefined) => {
    if (num === undefined) return 'N/A';
    return num.toLocaleString();
  };

  return (
    <div className={`${styles.infoPanel} ${isEditing ? styles.disabledPanel : ''}`}>
      <h2>Kingdom Information</h2>

      <div className={styles.selectionGroup}>
        <label htmlFor="kingdom-select">Select Kingdom:</label>
        <select
          id="kingdom-select"
          value={selectedKingdom?.id || "none"}
          onChange={handleKingdomSelectionChange}
          className={styles.kingdomSelect}
          disabled={isEditing} // Disable dropdown saat edit
        >
          <option value="none">-- Select a Kingdom --</option>
          {kingdoms.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
      </div>

      {selectedKingdom ? (
        <div className={styles.kingdomDetails}>
          <h3>{selectedKingdom.name}</h3>
          <p><strong>Ruler:</strong> {selectedKingdom.ruler}</p>
          <p><strong>Ruler's Age:</strong> {selectedKingdom.age} years</p>
          <p><strong>Founded:</strong> Year {selectedKingdom.foundingYear}</p>
          <p><strong>Population:</strong> {formatNumber(selectedKingdom.population)}</p>
          <p><strong>Military Strength:</strong> {formatNumber(selectedKingdom.militaryStrength)}</p>
          <p><strong>Magical Strength:</strong> {formatNumber(selectedKingdom.magicalStrength)}</p>
          <p><strong>Description:</strong> {selectedKingdom.description}</p>
          {selectedMapFeature?.kingdom?.id === selectedKingdom.id && selectedMapFeature?.areaKm2 !== undefined && (
             <p><strong>Territory Size:</strong> {formatNumber(Math.round(selectedMapFeature.areaKm2*0.0000000046437))} km²</p>
          )}
          <div>
            <strong>Special Features:</strong>
            <ul>
              {selectedKingdom.specialFeatures.map((feature, index) => (
                <li key={index}>{feature}</li>
              ))}
            </ul>
          </div>
          <div>
            <strong>Magical Resources:</strong>
            <ul>
              {selectedKingdom.magicalResources.map((resource, index) => (
                <li key={index}>{resource}</li>
              ))}
            </ul>
          </div>
          <div className={styles.actionButtons}>
            <button
              onClick={() => onStartEditDetails(selectedKingdom.id)}
              className={`${styles.button} ${styles.editButton}`}
              disabled={isEditing} // Disable tombol jika sedang edit
            >
              Edit Details
            </button>
            <button
              onClick={() => onStartEditTerritory(selectedKingdom.id)}
              className={`${styles.button} ${styles.editButton}`}
              disabled={isEditing} // Disable tombol jika sedang edit
            >
              Edit Territory
            </button>
            <button
              onClick={() => onDeleteKingdom(selectedKingdom.id)}
              className={`${styles.button} ${styles.deleteButton}`}
              disabled={isEditing} // Disable tombol jika sedang edit
            >
              Delete Kingdom
            </button>
          </div>
        </div>
      ) : selectedMapFeature ? (
        <div className={styles.mapFeatureInfo}>
          <h4>Map Point Information</h4>
          <p>Clicked Coordinates (CRS):</p>
          <p>Lat: {selectedMapFeature.coords.lat.toFixed(2)}, Lng: {selectedMapFeature.coords.lng.toFixed(2)}</p>
          {selectedMapFeature.kingdom && (
            <p>This point is within the territory of <strong>{selectedMapFeature.kingdom.name}</strong>.</p>
          )}
           {selectedMapFeature.areaKm2 !== undefined && !selectedMapFeature.kingdom && (
             <p>You clicked on an area not claimed by any kingdom.</p>
          )}
        </div>
      ) : (
        <p className={styles.noSelection}>
          Click on a kingdom on the map or select one from the dropdown to see its details.
        </p>
      )}
    </div>
  );
}