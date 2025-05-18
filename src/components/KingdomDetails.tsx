// src/components/KingdomDetails.tsx
import { Kingdom } from '@/types';

interface KingdomDetailsProps {
  kingdom: Kingdom;
  areaKm2?: number;
  onDelete: () => void;
}

export default function KingdomDetails({ kingdom, areaKm2, onDelete }: KingdomDetailsProps) {
  const magicLevelStars = Math.min(5, Math.max(1, Math.floor(kingdom.magicalStrength / 2000)));
  const prosperityPercent = Math.min(100, Math.max(0, Math.floor((kingdom.population / (kingdom.foundingYear > 1000 ? 1500 : 2000)))));

  const handleDeleteClick = () => {
    if (window.confirm(`Are you sure you want to delete the kingdom "${kingdom.name}"? This action cannot be undone.`)) {
      onDelete();
    }
  };

  return (
    <div className="kingdom-details">
      <h3>{kingdom.name}</h3>
      <p><strong>Ruler:</strong> {kingdom.ruler}</p>
      <p><strong>Age of Rule:</strong> {kingdom.age} years</p>
      <p><strong>Founded:</strong> {kingdom.foundingYear} CE</p>
      <p>
        <strong>Kingdom Color:</strong>
        <span
          className="color-swatch"
          style={{ 
            backgroundColor: kingdom.color,
            display: 'inline-block',
            width: '15px',
            height: '15px',
            marginLeft: '5px',
            border: '1px solid #ccc',
            verticalAlign: 'middle'
           }}
          title={kingdom.color}
        ></span>
      </p>
      
      {areaKm2 !== undefined && (
        <p>
          <strong>Territory Size:</strong> {
            (areaKm2 * 0.0000000046437).toLocaleString(undefined, { maximumFractionDigits: 0 })
          } km²
        </p>
      )}
      <div className="fantasy-stats">
        <p><strong>Population:</strong> {kingdom.population.toLocaleString()} souls</p>
        <p><strong>Military Strength:</strong> {kingdom.militaryStrength.toLocaleString()} troops</p>
        <p><strong>Magic Level:</strong> {'⭐'.repeat(magicLevelStars)} ({kingdom.magicalStrength.toLocaleString()})</p>
        <p><strong>Prosperity:</strong> {prosperityPercent}%</p>
      </div>
      <p><strong>Description:</strong> {kingdom.description}</p>
      <div>
        <strong>Special Features:</strong>
        <ul>
          {kingdom.specialFeatures.map((feature, index) => <li key={index}>{feature}</li>)}
        </ul>
      </div>
      <div>
        <strong>Magical Resources:</strong>
        <ul>
          {kingdom.magicalResources.map((resource, index) => <li key={index}>{resource}</li>)}
        </ul>
      </div>
      <p><strong>Regions:</strong> {kingdom.territoryPolygons?.length || 0}</p>

      <button
        onClick={handleDeleteClick}
        style={{
            backgroundColor: '#e74c3c', color: 'white', border: 'none',
            padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', marginTop: '15px'
        }}>
        Delete Kingdom
      </button>
    </div>
  );
}