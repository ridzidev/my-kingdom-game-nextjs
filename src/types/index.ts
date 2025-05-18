// src/types/index.ts
import type { LatLngExpression } from 'leaflet';

// export interface Coordinate { // Tidak lagi digunakan untuk definisi teritori utama
//   r: number;
//   c: number;
// }

// export interface Territory { // Tidak lagi digunakan
//   r: number;
//   c: number;
// }

export interface GameTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  isPaused: boolean;
  lastUpdate: number; // timestamp of last update
}

export interface GameState {
  time: GameTime;
  speed: number; // 1 = normal, 2 = 2x, 0.5 = 0.5x
  isRunning: boolean;
  selectedKingdom: string | null;
  selectedLocation: { lat: number; lng: number } | null;
  kingdoms: Kingdom[];
  events: GameEvent[];
  resources: ResourceNode[];
}

export interface Kingdom {
  id: string;
  name: string;
  ruler: string;
  age: number; // Usia penguasa
  foundingYear: number;
  color: string; // Warna untuk tile di peta
  // Ganti 'territories' lama dengan 'territoryPolygons'
  // territoryPolygons adalah array dari poligon,
  // setiap poligon adalah array dari titik LatLngExpression
  // Contoh: satu kerajaan bisa punya beberapa wilayah terpisah (beberapa poligon)
  territoryPolygons: LatLngExpression[][];
  description: string;
  specialFeatures: string[];
  magicalResources: string[];
  population: number;
  militaryStrength: number;
  magicalStrength: number;
  // New properties for simulation
  foundingDate: GameTime;
  lastUpdated: GameTime;
  resources: {
    gold: number;
    food: number;
    magic: number;
  };
  development: {
    technology: number;
    magic: number;
    culture: number;
  };
  relations: {
    [kingdomId: string]: number; // -100 to 100, where -100 is hostile, 0 is neutral, 100 is allied
  };
  events: GameEvent[];
}

export interface GameEvent {
  id: string;
  type: 'war' | 'peace' | 'disaster' | 'discovery' | 'development';
  title: string;
  description: string;
  date: GameTime;
  affectedKingdoms: string[];
  consequences: {
    type: 'population' | 'military' | 'magic' | 'resources' | 'relations';
    value: number;
    targetKingdom?: string;
  }[];
}

export interface ResourceNode {
  id: string;
  type: 'gold' | 'food' | 'magic';
  position: LatLngExpression;
  amount: number;
  regenerationRate: number;
  lastHarvested: GameTime;
}

export interface WorldState {
  kingdoms: Kingdom[];
  resources: ResourceNode[];
  events: GameEvent[];
  time: GameTime;
}