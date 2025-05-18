// src/components/FantasyMap.tsx
'use client';
import React, {
  useEffect,
  useRef,
  useState,
  // useCallback, // Removed: unused
  forwardRef,
  useImperativeHandle
} from 'react';
import { Kingdom } from '@/types';
import type {
  Map as LeafletMapType,
  LatLngExpression,
  LatLngBoundsExpression,
  LeafletMouseEvent,
  Polygon as LeafletPolygon,
  LayerGroup as LeafletLayerGroup,
  LatLngBounds as LeafletLatLngBounds,
  PathOptions // Imported for EditablePolygon options
} from 'leaflet';

let L: typeof import('leaflet') | null = null;
let Editable: any = null;
// Define LeafletLatLng type alias once L is loaded, or use L.LatLng directly.
type LeafletLatLng = import('leaflet').LatLng;


interface EditablePolygon extends LeafletPolygon {
  editTools: {
    enable: () => void;
    disable: () => void;
    isEnabled: () => boolean;
    stopDrawing: () => void;
    revertLayers: () => void;
  };
  options: PathOptions & {
    id_kingdom?: string;
    world_offset?: number;
  };
}

interface EditableMap extends LeafletMapType {
  editTools: {
    startPolygon: (layer?: LeafletPolygon) => void; // layer is optional in some leaflet-editable versions/uses
    startEdit: (layer: LeafletPolygon) => void;
    stopDrawing: () => void;
    revertLayers: () => void;
    disable: () => void;
    isEnabled: () => boolean;
  };
}

export interface FantasyMapHandle {
  getEditedTerritoryData: () => LatLngExpression[][] | null;
  cancelInternalTerritoryEdit: () => void;
}

const wrapLng = (lng: number, mapWidth: number): number => {
  if (mapWidth === 0) return lng;
  const wrapped = lng % mapWidth;
  return wrapped < 0 ? wrapped + mapWidth : wrapped;
};

interface FantasyMapProps {
  kingdoms: Kingdom[];
  onTileClick: (coord: { lat: number; lng: number }, kingdom?: Kingdom) => void;
  kingdomToFocusId?: string | null;
  onFocusComplete?: () => void;
  mapWidthUnits?: number;
  mapHeightUnits?: number;
  isEditingTerritoryMode: boolean;
  kingdomBeingEditedId: string | null;
}

const FantasyMap = forwardRef<FantasyMapHandle, FantasyMapProps>(({
  kingdoms,
  onTileClick,
  kingdomToFocusId,
  onFocusComplete,
  mapWidthUnits = 2000,
  mapHeightUnits = 1000,
  isEditingTerritoryMode,
  kingdomBeingEditedId,
}, ref) => {
  const mapRef = useRef<EditableMap | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [librariesLoaded, setLibrariesLoaded] = useState(false);
  const legendRef = useRef<HTMLDivElement>(null);
  const kingdomLayersRef = useRef<LeafletLayerGroup | null>(null);
  const individualKingdomMainLayersRef = useRef<Record<string, LeafletPolygon[]>>({}); // LeafletPolygon is fine here, cast to EditablePolygon when needed
  const editableLayersRef = useRef<EditablePolygon[]>([]);
  const editingWorldOffsetRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && !L) {
      const loadLibraries = async () => {
        try {
          const [leafletModule, editableModule] = await Promise.all([
            import('leaflet'),
            import('leaflet-editable')
          ]);
          
          L = leafletModule.default;
          Editable = editableModule.default;
          
          if (!L) {
            console.error("Leaflet failed to load.");
            return;
          }

          // Initialize the editable plugin
          if (Editable) {
            const MapClass = L.Map as unknown as { prototype: { initialize: Function } };
            const originalInitHook = MapClass.prototype.initialize;
            MapClass.prototype.initialize = function(this: EditableMap, ...args: unknown[]) {
              const result = originalInitHook.apply(this, args);
              (this as EditableMap).editTools = new Editable(this);
              return result;
            };
          }
          
          setLibrariesLoaded(true);
        } catch (error) {
          console.error("Failed to load Leaflet libraries:", error);
        }
      };

      loadLibraries();
    } else if (L) {
      setLibrariesLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!librariesLoaded || !mapContainerRef.current || !L) return;
    if (!mapRef.current) {
      const L_ = L;
      const map = L_.map(mapContainerRef.current, {
        crs: L_.CRS.Simple,
        zoomControl: false
      }) as EditableMap;
      mapRef.current = map;

      const imageUrl = '/maps/petadasar.png';
      const worldCopies = 2;

      for (let i = -worldCopies; i <= worldCopies; i++) {
        const bounds: LatLngBoundsExpression = [
          [0, i * mapWidthUnits],
          [mapHeightUnits, (i + 1) * mapWidthUnits]
        ];
        L_.imageOverlay(imageUrl, bounds, { interactive: false }).addTo(map);
      }
      
      const worldBounds: LatLngBoundsExpression = [[0, 0], [mapHeightUnits, mapWidthUnits]];
      map.fitBounds(worldBounds);

      const initialZoom = map.getZoom();
      map.options.minZoom = initialZoom - 1;
      map.options.maxZoom = initialZoom + 6;

      L_.control.zoom({ position: 'bottomright' }).addTo(map);
      L_.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
      kingdomLayersRef.current = L_.layerGroup().addTo(map);
    }

    const currentMap = mapRef.current;
    const handleMapDeselect = (e: LeafletMouseEvent) => {
        if (isEditingTerritoryMode && e.originalEvent.target && (e.originalEvent.target as HTMLElement).closest('.leaflet-editing-icon')) {
            return;
        }
        const targetIsVertexHandle = (e.originalEvent.target as HTMLElement).classList.contains('leaflet-vertex-icon') ||
                                   (e.originalEvent.target as HTMLElement).classList.contains('leaflet-middle-icon');
        if (targetIsVertexHandle) return;

        const normalizedLng = wrapLng(e.latlng.lng, mapWidthUnits);
        onTileClick({ lat: e.latlng.lat, lng: normalizedLng }, undefined);
    };
    currentMap?.on('click', handleMapDeselect);

    return () => {
      currentMap?.off('click', handleMapDeselect);
    };
  }, [librariesLoaded, onTileClick, mapHeightUnits, mapWidthUnits, isEditingTerritoryMode]);
  
  useEffect(() => {
    if (!librariesLoaded || !mapRef.current || !kingdomLayersRef.current || !L) return;
    const L_ = L;
    kingdomLayersRef.current.clearLayers();
    individualKingdomMainLayersRef.current = {};

    // Cast to EditablePolygon to access custom options type-safely
    const currentEditingLayerKingdomId = editableLayersRef.current.length > 0 ? (editableLayersRef.current[0] as EditablePolygon).options?.id_kingdom : null;
    
    if (!isEditingTerritoryMode || (kingdomBeingEditedId && kingdomBeingEditedId !== currentEditingLayerKingdomId) || (!kingdomBeingEditedId && currentEditingLayerKingdomId)) {
        editableLayersRef.current.forEach(layer => {
            if (layer.editTools && layer.editTools.isEnabled()) {
                layer.editTools.disable();
            }
        });
        editableLayersRef.current = [];
        if (!isEditingTerritoryMode || !kingdomBeingEditedId) {
            editingWorldOffsetRef.current = 0;
        }
    }

    let kingdomLegendHtml = '<h4>Kingdoms</h4>';
    if (kingdoms.length === 0) kingdomLegendHtml += '<p>No kingdoms on the map.</p>';

    const worldCopiesForPolygons = 2; 
    const polygonRenderOffsets: number[] = [];
    for (let i = -worldCopiesForPolygons; i <= worldCopiesForPolygons; i++) {
        polygonRenderOffsets.push(i);
    }

    kingdoms.forEach(kingdom => {
      if (!individualKingdomMainLayersRef.current[kingdom.id]) {
          individualKingdomMainLayersRef.current[kingdom.id] = [];
      }
      if (kingdom.territoryPolygons) {
        kingdom.territoryPolygons.forEach((originalPolygonCoords) => {
          if (!originalPolygonCoords || originalPolygonCoords.length < 3) return;

          polygonRenderOffsets.forEach(worldOffset => {
            const translatedCoords = originalPolygonCoords.map(coord => {
              const lat = (coord as number[])[0];
              const lng = (coord as number[])[1];
              return [lat, lng + (worldOffset * mapWidthUnits)] as LatLngExpression;
            });

            const kingdomPolygonOptions: EditablePolygon['options'] = { // Use the more specific options type
              fillColor: kingdom.color,
              color: '#FFFFFF',
              weight: 2.5,
              opacity: 1,
              fillOpacity: 0.5,
              id_kingdom: kingdom.id,
              world_offset: worldOffset
            };

            // Cast to EditablePolygon after creation.
            const kingdomPolygon = L_.polygon(translatedCoords, kingdomPolygonOptions) as EditablePolygon;

            kingdomPolygon.bindPopup(`<b>${kingdom.name}</b> (Copy ${worldOffset})<br>${getKingdomDescription(kingdom)}`);
            
            kingdomPolygon.on('click', (e: LeafletMouseEvent) => {
              L_?.DomEvent.stopPropagation(e);
              if (!isEditingTerritoryMode) {
                  const originalLng = wrapLng(e.latlng.lng, mapWidthUnits);
                  onTileClick({ lat: e.latlng.lat, lng: originalLng }, kingdom);
              } else if (isEditingTerritoryMode && kingdom.id === kingdomBeingEditedId) {
                  // Access options type-safely
                  editingWorldOffsetRef.current = kingdomPolygon.options.world_offset ?? 0;
                  const alreadyEditableByThisInstance = editableLayersRef.current.includes(kingdomPolygon) && kingdomPolygon.editTools?.isEnabled();
                  
                  if (!alreadyEditableByThisInstance) {
                      editableLayersRef.current.forEach(l => { 
                          if (l !== kingdomPolygon && l.editTools && l.editTools.isEnabled()) {
                              l.editTools.disable(); 
                          }
                      });
                      editableLayersRef.current = []; // Clear and add only the current one

                      if (mapRef.current?.editTools) {
                          mapRef.current.editTools.startPolygon(kingdomPolygon); // Enable editing for this polygon
                          editableLayersRef.current.push(kingdomPolygon);
                      }
                  }
              }
            });
            
            kingdomLayersRef.current?.addLayer(kingdomPolygon);
            if (worldOffset === 0) { 
                individualKingdomMainLayersRef.current[kingdom.id].push(kingdomPolygon);
            }

            if (isEditingTerritoryMode && kingdom.id === kingdomBeingEditedId && mapRef.current) {
                // Access options type-safely
                if (kingdomPolygon.options.world_offset === editingWorldOffsetRef.current) {
                    const isAlreadyInEditableRef = editableLayersRef.current.includes(kingdomPolygon);
                    const isCurrentlyEnabled = isAlreadyInEditableRef && kingdomPolygon.editTools?.isEnabled();

                    if (!isCurrentlyEnabled) {
                        try {
                            if (mapRef.current?.editTools) {
                                mapRef.current.editTools.startPolygon(kingdomPolygon);
                                if(!isAlreadyInEditableRef) editableLayersRef.current.push(kingdomPolygon);
                            }
                        } catch (error) {
                            console.error("Error enabling edit:", error);
                        }
                    }
                }
            }
          });
        });
        if (kingdoms.length > 0) { // This check should be outside forEach if legend is for all
            kingdomLegendHtml += `<div class="legend-item"><span class="legend-color" style="background: ${kingdom.color}"></span>${kingdom.name}</div>`;
        }
      }
    });

    if (legendRef.current) {
      legendRef.current.innerHTML = kingdomLegendHtml;
    } else if (mapContainerRef.current && L_ && mapRef.current && kingdoms.length > 0) {
        if (!legendRef.current) { // Redundant check, already in else if
            const legendParent = mapRef.current.getContainer().querySelector('.leaflet-control-container');
            if (legendParent) {
                const legendDiv = L_.DomUtil.create('div', 'realistic-legend leaflet-control'); 
                legendDiv.innerHTML = kingdomLegendHtml;
                const bottomLeftContainer = legendParent.querySelector('.leaflet-bottom.leaflet-left');
                if (bottomLeftContainer) {
                    bottomLeftContainer.prepend(legendDiv);
                } else {
                    legendParent.appendChild(legendDiv); // Fallback if bottom-left is not found
                }
                legendRef.current = legendDiv;
            }
        }
    }  else if (legendRef.current && kingdoms.length === 0) { 
        (legendRef.current as HTMLDivElement).innerHTML = kingdomLegendHtml; // Update legend to "No kingdoms"
    }
  }, [kingdoms, librariesLoaded, isEditingTerritoryMode, kingdomBeingEditedId, onTileClick, mapWidthUnits, mapHeightUnits]);

  useEffect(() => {
    if (!librariesLoaded || !kingdomToFocusId || !mapRef.current || !L) return;
    if (isEditingTerritoryMode) return; // Don't refocus if editing
    const L_ = L;
    const targetKingdomMainLayers = individualKingdomMainLayersRef.current[kingdomToFocusId];

    if (targetKingdomMainLayers && targetKingdomMainLayers.length > 0) {
      let kingdomBoundsAggregated: LeafletLatLngBounds | null = null;
      targetKingdomMainLayers.forEach(layer => {
        const layerBounds = layer.getBounds();
        if (kingdomBoundsAggregated) {
          kingdomBoundsAggregated.extend(layerBounds);
        } else {
          // Ensure L_ is available for L_.latLngBounds
          kingdomBoundsAggregated = L_.latLngBounds(layerBounds.getSouthWest(), layerBounds.getNorthEast());
        }
      });

      if (kingdomBoundsAggregated) {
        const focusMaxZoom = mapRef.current.options.maxZoom ? mapRef.current.options.maxZoom -1 : mapRef.current.getZoom() + 2;
        mapRef.current.fitBounds(kingdomBoundsAggregated, { padding: [50, 50], maxZoom: focusMaxZoom });
      }
    }
    if (onFocusComplete) onFocusComplete();
  }, [kingdomToFocusId, onFocusComplete, librariesLoaded, isEditingTerritoryMode]);

  // Helper function for parsing LatLngs, ensures L is loaded
  const parseAndWrapLatLngs = (
    lls: LeafletLatLng[], // Expects an array of L.LatLng objects
    currentWorldOffsetVal: number,
    mapWidth: number
  ): LatLngExpression[] => {
    const parsed: LatLngExpression[] = [];
    if (!L) return parsed; // Guard against L not being loaded

    if (Array.isArray(lls) && lls.length > 0) {
      lls.forEach((ll: LeafletLatLng) => {
        // ll is an L.LatLng object, so ll.lat and ll.lng are numbers
        const normalizedLng = wrapLng(ll.lng - (currentWorldOffsetVal * mapWidth), mapWidth);
        parsed.push([ll.lat, normalizedLng] as LatLngExpression);
      });
    }
    return parsed.length >= 3 ? parsed : [];
  };

  const getTerritoryDataFromLeafletLayer = (
    layer: EditablePolygon,
    worldOffset: number,
    currentMapWidthUnits: number
  ): LatLngExpression[][] | null => {
    if (!L || !layer) return null;
    const latlngsFromLayer = layer.getLatLngs(); // Returns L.LatLng[] | L.LatLng[][] | L.LatLng[][][]
    const newTerritoriesLeafletFormat: LatLngExpression[][] = [];

    if (Array.isArray(latlngsFromLayer) && latlngsFromLayer.length > 0) {
      const firstEl = latlngsFromLayer[0];

      // Case 1: Simple Polygon (latlngsFromLayer is LeafletLatLng[])
      // `firstEl` would be a LeafletLatLng object.
      if (firstEl && 'lat' in firstEl && typeof firstEl.lat === 'number') {
        const poly = parseAndWrapLatLngs(latlngsFromLayer as LeafletLatLng[], worldOffset, currentMapWidthUnits);
        if (poly.length > 0) newTerritoriesLeafletFormat.push(poly);
      }
      // Case 2: Polygon with holes (latlngsFromLayer is LeafletLatLng[][])
      // `firstEl` would be an array of LeafletLatLng (the outer ring).
      else if (Array.isArray(firstEl) && firstEl.length > 0) {
        const firstInnerEl = firstEl[0]; // This is firstEl[0], which is a LeafletLatLng
        if (firstInnerEl && 'lat' in firstInnerEl && typeof firstInnerEl.lat === 'number') {
          // `firstEl` is LeafletLatLng[] (outer ring of a polygon with holes)
          const poly = parseAndWrapLatLngs(firstEl as LeafletLatLng[], worldOffset, currentMapWidthUnits);
          if (poly.length > 0) newTerritoriesLeafletFormat.push(poly);
        }
        // Case 3: MultiPolygon (latlngsFromLayer is LeafletLatLng[][][])
        // `firstEl` would be LeafletLatLng[][] (a single polygon, possibly with holes)
        else if (Array.isArray(firstInnerEl) && firstInnerEl.length > 0) {
          // `firstInnerEl` is LeafletLatLng[]
          const firstDeepInnerEl = firstInnerEl[0]; // This should be firstInnerEl[0]
          if (firstDeepInnerEl && 'lat' in firstDeepInnerEl && typeof firstDeepInnerEl.lat === 'number') {
            // `firstEl` is LeafletLatLng[][]
            // `latlngsFromLayer` is LeafletLatLng[][][]
            (latlngsFromLayer as LeafletLatLng[][][]).forEach(polygonRingsArray => { // polygonRingsArray is LeafletLatLng[][]
              if (polygonRingsArray.length > 0 && polygonRingsArray[0].length > 0) { // polygonRingsArray[0] is LeafletLatLng[] (outer ring)
                const poly = parseAndWrapLatLngs(polygonRingsArray[0] as LeafletLatLng[], worldOffset, currentMapWidthUnits);
                if (poly.length > 0) newTerritoriesLeafletFormat.push(poly);
              }
            });
          } else {
             console.warn("FantasyMap: Unrecognized LatLngs structure (depth 3 but not LeafletLatLng):", latlngsFromLayer);
          }
        } else {
            console.warn("FantasyMap: Unrecognized LatLngs structure (depth 2 but not LeafletLatLng or empty):", latlngsFromLayer);
        }
      } else {
        console.warn("FantasyMap: Unrecognized LatLngs structure (depth 1 but not LeafletLatLng or empty):", latlngsFromLayer);
      }
    }
    return newTerritoriesLeafletFormat.length > 0 ? newTerritoriesLeafletFormat : null;
  };

  useImperativeHandle(ref, () => ({
    getEditedTerritoryData: () => {
      if (!isEditingTerritoryMode || !kingdomBeingEditedId || editableLayersRef.current.length === 0 || !L) {
        console.warn("FantasyMap: getEditedTerritoryData - Conditions not met or no editable layers.");
        return null;
      }
      const layerToGetDataFrom = editableLayersRef.current.find(layer => {
          // Access options type-safely
          const opts = layer.options;
          return opts.id_kingdom === kingdomBeingEditedId && opts.world_offset === editingWorldOffsetRef.current && layer.editTools?.isEnabled();
        });

        if (!layerToGetDataFrom) {
          console.warn("FantasyMap: getEditedTerritoryData - Could not find the specific layer that was being edited based on world_offset and active state.");
          const fallbackLayer = editableLayersRef.current.find(layer => 
              // Access options type-safely
              (layer as EditablePolygon).options.id_kingdom === kingdomBeingEditedId);
          
          if (fallbackLayer) {
              console.warn("FantasyMap: getEditedTerritoryData - Using fallback layer (first editable for this kingdom, may not be current offset).");
              // Access options type-safely
              const fallbackOffset = (fallbackLayer as EditablePolygon).options.world_offset ?? 0;
              return getTerritoryDataFromLeafletLayer(fallbackLayer, fallbackOffset, mapWidthUnits);
          }
          return null;
        }
        return getTerritoryDataFromLeafletLayer(layerToGetDataFrom, editingWorldOffsetRef.current, mapWidthUnits);
    },
    cancelInternalTerritoryEdit: () => {
      editableLayersRef.current.forEach(layer => {
        if (layer.editTools && layer.editTools.isEnabled()) {
            if (typeof layer.editTools.stopDrawing === 'function') layer.editTools.stopDrawing();
            if (typeof layer.editTools.revertLayers === 'function') layer.editTools.revertLayers();
            layer.editTools.disable();
        }
      });
      editableLayersRef.current = [];
      editingWorldOffsetRef.current = 0;
    }
  }));

  return (
    <div
      ref={mapContainerRef}
      className="realistic-map"
      style={{
        width: '100%',
        height: '600px',
        position: 'relative',
        border: '1px solid #ccc',
        backgroundColor: '#f0f8ff'
      }}
    >
      {!librariesLoaded && (
        <div className="loading-text" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', fontSize: '1.2em', color: '#333' }}>
          Loading Map Libraries...
        </div>
      )}
    </div>
  );
});

function getKingdomDescription(kingdom: Kingdom): string {
  return kingdom.description || "A notable kingdom of these lands.";
}

FantasyMap.displayName = 'FantasyMap';
export default FantasyMap;