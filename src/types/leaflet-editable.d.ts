declare module 'leaflet-editable' {
    import { Map, Layer } from 'leaflet';

    interface EditTools {
        startPolygon(layer: Layer): void;
        startEdit(layer: Layer): void;
        stopDrawing(): void;
        revertLayers(): void;
        disable(): void;
        isEnabled(): boolean;
    }

    interface EditableMap extends Map {
        editTools: EditTools;
    }

    interface EditableLayer extends Layer {
        editTools: EditTools;
        enableEdit(): void;
    }

    const Editable: {
        new(map: Map): EditTools;
    };

    export default Editable;
} 