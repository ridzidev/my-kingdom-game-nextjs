// src/types/leaflet-editable.d.ts
declare module 'leaflet-editable' {
    import { Map, Layer, Polygon, Polyline, Marker } from 'leaflet'; // Added more specific types

    // Interface for the main editing toolkit available on map.editTools
    export interface GlobalEditTools {
        /** Starts drawing a new polygon. If layer is provided, it may start editing that specific polygon. */
        startPolygon(layer?: Polygon, options?: any): void;
        /** Starts drawing a new polyline. If layer is provided, it may start editing that specific polyline. */
        startPolyline?(layer?: Polyline, options?: any): void;
        /** Starts placing a new marker. If layer is provided, it may start editing that specific marker. */
        startMarker?(layer?: Marker, options?: any): void;
        // Add other shape drawing methods like startRectangle, startCircle if supported

        /** Enables editing for an already existing layer. */
        startEdit?(layer: Layer, options?: any): void;

        /** Disables all edit tools on the map. */
        disable(): void;
        /** Checks if map-level editing is currently enabled. */
        isEnabled(): boolean;

        /** Stops the current drawing or editing session globally on the map. */
        stopDrawing?(): void; // Optional as FantasyMap uses it on layer.editTools
        
        /** Reverts changes for all layers modified in the current editing session. */
        revertLayers?(): void; // Optional as FantasyMap uses it on layer.editTools

        // Potentially other methods:
        // commitLayers?(): void;
        // newPolyline?: any; (etc. for other shapes)
    }

    // Interface for the editing toolkit available on an individual layer instance (layer.editTools)
    export interface FeatureEditTools {
        /** Enables editing for this specific feature. */
        enable(): void;
        /** Disables editing for this specific feature. */
        disable(): void;
        /** Checks if this specific feature is currently being edited or editable. */
        isEnabled(): boolean;
        /** Stops drawing/editing for this specific feature. */
        stopDrawing(): void;
        /** Reverts uncommitted changes for this specific feature. */
        revertLayers(): void; // Name "revertLayers" is kept as used in FantasyMap, though "revert" might be more apt for a single feature.
    }

    // Describes a Leaflet Map instance after leaflet-editable has been initialized on it.
    export interface EditableMap extends Map {
        editTools: GlobalEditTools;
    }

    // Describes a Leaflet Layer instance that has been made editable.
    export interface EditableLayer extends Layer {
        editTools: FeatureEditTools;

        // leaflet-editable often adds direct methods to layers too:
        /** Enables editing for this layer. Optionally pass the map's EditableMap instance. */
        enableEdit?(map?: EditableMap): void;
        /** Disables editing for this layer. */
        disableEdit?(): void;
        /** Checks if editing is enabled for this layer. */
        editEnabled?(): boolean;
    }

    // More specific types for convenience if needed, extending EditableLayer
    export interface EditablePolygon extends Polygon, EditableLayer {}
    export interface EditablePolyline extends Polyline, EditableLayer {}
    export interface EditableMarker extends Marker, EditableLayer {}


    // The constructor for the main Editable class.
    // It initializes editing on the map and typically returns the GlobalEditTools instance.
    const Editable: {
        new(map: Map, options?: object): GlobalEditTools;
    };

    export default Editable;
}