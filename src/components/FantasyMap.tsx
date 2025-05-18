// src/components/FantasyMap.tsx
'use client';
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
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
  LatLngBounds as LeafletLatLngBounds
} from 'leaflet';

let L: typeof import('leaflet') | null = null;

interface EditablePolygon extends LeafletPolygon {
  editTools: {
    enable: () => void;
    disable: () => void;
    isEnabled: () => boolean;
    stopDrawing: () => void;
    revertLayers: () => void;
  };
}

interface EditableMap extends LeafletMapType {
  editTools: {
    startPolygon: (layer: LeafletPolygon) => void;
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
  const legendRef = useRef<HTMLDivElement | null>(null);
  const kingdomLayersRef = useRef<LeafletLayerGroup | null>(null);
  const individualKingdomMainLayersRef = useRef<Record<string, LeafletPolygon[]>>({});
  const editableLayersRef = useRef<EditablePolygon[]>([]);
  const editingWorldOffsetRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && !L) {
      Promise.all([
        import('leaflet'),
        import('leaflet-editable')
      ]).then(([leafletModule, editableModule]) => {
        L = leafletModule.default;
        if (!L) {
            console.error("Leaflet failed to load.");
            return;
        }
        // Initialize Leaflet.Editable
        if (editableModule.default) {
            L.Map.addInitHook(function(this: any) {
                this.editTools = new editableModule.default(this);
            });
        }
        setLibrariesLoaded(true);
      }).catch(error => console.error("Failed to load Leaflet libraries:", error));
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
      }) as any;
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

    const currentEditingLayerKingdomId = editableLayersRef.current.length > 0 ? (editableLayersRef.current[0] as any).options?.id_kingdom : null;
    
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

            const kingdomPolygonOptions = {
              fillColor: kingdom.color,
              color: '#FFFFFF',
              weight: 2.5,
              opacity: 1,
              fillOpacity: 0.5,
              id_kingdom: kingdom.id,
              world_offset: worldOffset
            };

            const kingdomPolygon = L_.polygon(translatedCoords, kingdomPolygonOptions) as any;

            kingdomPolygon.bindPopup(`<b>${kingdom.name}</b> (Copy ${worldOffset})<br>${getKingdomDescription(kingdom)}`);
            
            kingdomPolygon.on('click', (e: LeafletMouseEvent) => {
              L_?.DomEvent.stopPropagation(e);
              if (!isEditingTerritoryMode) {
                  const originalLng = wrapLng(e.latlng.lng, mapWidthUnits);
                  onTileClick({ lat: e.latlng.lat, lng: originalLng }, kingdom);
              } else if (isEditingTerritoryMode && kingdom.id === kingdomBeingEditedId) {
                  editingWorldOffsetRef.current = (kingdomPolygon.options as any).world_offset;
                  const alreadyEditableByThisInstance = editableLayersRef.current.includes(kingdomPolygon) && kingdomPolygon.editTools?.isEnabled();
                  
                  if (!alreadyEditableByThisInstance) {
                      editableLayersRef.current.forEach(l => { 
                          if (l !== kingdomPolygon && l.editTools && l.editTools.isEnabled()) {
                              l.editTools.disable(); 
                          }
                      });
                      editableLayersRef.current = [];

                      if (mapRef.current?.editTools) {
                          mapRef.current.editTools.startPolygon(kingdomPolygon);
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
                if ((kingdomPolygon.options as any).world_offset === editingWorldOffsetRef.current) {
                    const isAlreadyInEditableRef = editableLayersRef.current.includes(kingdomPolygon);
                    const isCurrentlyEnabled = isAlreadyInEditableRef && kingdomPolygon.editTools?.isEnabled();

                    if (!isCurrentlyEnabled) {
                        try {
                            if (mapRef.current?.editTools) {
                                mapRef.current.editTools.startPolygon(kingdomPolygon);
                                editableLayersRef.current.push(kingdomPolygon);
                            }
                        } catch (error) {
                            console.error("Error enabling edit:", error);
                        }
                    }
                }
            }
          });
        });
        if (kingdoms.length > 0) {
            kingdomLegendHtml += `<div class="legend-item"><span class="legend-color" style="background: ${kingdom.color}"></span>${kingdom.name}</div>`;
        }
      }
    });

    if (legendRef.current) {
      (legendRef.current as HTMLDivElement).innerHTML = kingdomLegendHtml;
    } else if (mapContainerRef.current && L_ && mapRef.current && kingdoms.length > 0) {
        if (!legendRef.current) {
            const legendParent = mapRef.current.getContainer().querySelector('.leaflet-control-container');
            if (legendParent) {
                const legendDiv = L_.DomUtil.create('div', 'realistic-legend leaflet-control'); 
                legendDiv.innerHTML = kingdomLegendHtml;
                const bottomLeftContainer = legendParent.querySelector('.leaflet-bottom.leaflet-left');
                if (bottomLeftContainer) {
                    bottomLeftContainer.prepend(legendDiv);
                } else {
                    legendParent.appendChild(legendDiv);
                }
                legendRef.current = legendDiv as HTMLDivElement;
            }
        }
    }  else if (legendRef.current && kingdoms.length === 0) { 
        (legendRef.current as HTMLDivElement).innerHTML = kingdomLegendHtml;
    }
  }, [kingdoms, librariesLoaded, isEditingTerritoryMode, kingdomBeingEditedId, onTileClick, mapWidthUnits, mapHeightUnits]);

  useEffect(() => {
    if (!librariesLoaded || !kingdomToFocusId || !mapRef.current || !L) return;
    if (isEditingTerritoryMode) return;
    const L_ = L;
    const targetKingdomMainLayers = individualKingdomMainLayersRef.current[kingdomToFocusId];

    if (targetKingdomMainLayers && targetKingdomMainLayers.length > 0) {
      let kingdomBoundsAggregated: LeafletLatLngBounds | null = null;
      targetKingdomMainLayers.forEach(layer => {
        const layerBounds = layer.getBounds();
        if (kingdomBoundsAggregated) {
          kingdomBoundsAggregated.extend(layerBounds);
        } else {
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

  useImperativeHandle(ref, () => ({
    getEditedTerritoryData: () => {
      if (!isEditingTerritoryMode || !kingdomBeingEditedId || editableLayersRef.current.length === 0 || !L) {
        console.warn("FantasyMap: getEditedTerritoryData - Conditions not met or no editable layers.");
        return null;
      }
      const layerToGetDataFrom = editableLayersRef.current.find(layer => {
          const opts = (layer as any).options;
          return opts.id_kingdom === kingdomBeingEditedId && opts.world_offset === editingWorldOffsetRef.current && layer.editTools?.isEnabled();
        });

        if (!layerToGetDataFrom) {
          console.warn("FantasyMap: getEditedTerritoryData - Could not find the specific layer that was being edited based on world_offset and active state.");
          const fallbackLayer = editableLayersRef.current.find(layer => 
              (layer as any).options.id_kingdom === kingdomBeingEditedId);
          if (fallbackLayer) {
              console.warn("FantasyMap: getEditedTerritoryData - Using fallback layer (first editable for this kingdom, may not be current offset).");
              const fallbackOffset = (fallbackLayer as any).options.world_offset || 0;
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

  const getTerritoryDataFromLeafletLayer = (
    layer: any,
    worldOffset: number,
    currentMapWidthUnits: number
  ): LatLngExpression[][] | null => {
    if (!L || !layer) return null;
    const latlngsFromLayer = layer.getLatLngs();
    const newTerritoriesLeafletFormat: LatLngExpression[][] = [];

    const parseAndWrapLatLngs = (lls: any, currentWorldOffsetVal: number): LatLngExpression[] => {
        const parsed: LatLngExpression[] = [];
        if (Array.isArray(lls) && lls.length > 0) {
            if (lls[0] && typeof lls[0].lat === 'number' && typeof lls[0].lng === 'number') {
                lls.forEach((ll: { lat: number; lng: number }) => {
                    const normalizedLng = wrapLng(ll.lng - (currentWorldOffsetVal * currentMapWidthUnits), currentMapWidthUnits);
                    parsed.push([ll.lat, normalizedLng] as LatLngExpression);
                });
            } 
            else if (Array.isArray(lls[0]) && lls[0].length === 2 && typeof lls[0][0] === 'number') {
                 lls.forEach((coord: number[]) => {
                    const normalizedLng = wrapLng(coord[1] - (currentWorldOffsetVal * currentMapWidthUnits), currentMapWidthUnits);
                    parsed.push([coord[0], normalizedLng] as LatLngExpression);
                });
            }
        }
        return parsed.length >= 3 ? parsed : [];
      };

    if (Array.isArray(latlngsFromLayer) && latlngsFromLayer.length > 0) {
        if (latlngsFromLayer[0] && typeof (latlngsFromLayer[0] as any).lat === 'number') {
            const poly = parseAndWrapLatLngs(latlngsFromLayer, worldOffset);
            if (poly.length > 0) newTerritoriesLeafletFormat.push(poly);
        }
        else if (Array.isArray(latlngsFromLayer[0]) && latlngsFromLayer[0][0] && typeof (latlngsFromLayer[0][0] as any).lat === 'number') {
            const poly = parseAndWrapLatLngs(latlngsFromLayer[0], worldOffset);
            if (poly.length > 0) newTerritoriesLeafletFormat.push(poly);
        }
        else if (Array.isArray(latlngsFromLayer[0]) && Array.isArray(latlngsFromLayer[0][0]) && latlngsFromLayer[0][0][0] && typeof (latlngsFromLayer[0][0][0] as any).lat === 'number') {
            (latlngsFromLayer as any[][][]).forEach(polygonRingsArray => {
                if (polygonRingsArray.length > 0 && polygonRingsArray[0].length > 0) {
                    const poly = parseAndWrapLatLngs(polygonRingsArray[0], worldOffset);
                    if (poly.length > 0) newTerritoriesLeafletFormat.push(poly);
                }
            });
        } else {
            console.warn("FantasyMap: Unrecognized LatLngs structure from edited layer:", latlngsFromLayer);
        }
      }
    return newTerritoriesLeafletFormat.length > 0 ? newTerritoriesLeafletFormat : null;
  }

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