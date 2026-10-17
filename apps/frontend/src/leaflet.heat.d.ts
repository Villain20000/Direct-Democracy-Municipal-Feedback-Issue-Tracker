/**
 * Type declarations for the untyped `leaflet.heat` plugin (ships plain
 * JS only; at runtime it attaches `L.heatLayer` to the leaflet module).
 *
 * This is a module file (top-level import) so `declare module 'leaflet'`
 * is a proper module *augmentation* that merges with @types/leaflet
 * instead of shadowing it.
 *
 * Usage:
 *   import * as L from 'leaflet';
 *   import 'leaflet.heat';           // side-effect: registers L.heatLayer
 *   L.heatLayer(points, options)     // typed via the augmentation below
 */
import * as L from 'leaflet';

declare module 'leaflet' {
  export interface HeatMapOptions {
    minOpacity?: number;
    maxZoom?: number;
    max?: number;
    radius?: number;
    blur?: number;
    gradient?: { [key: string]: string };
  }

  export interface HeatLayer extends L.Layer {
    setLatLngs(latlngs: Array<[number, number, number]>): this;
    redraw(): this;
  }

  export function heatLayer(
    latlngs: Array<[number, number, number]>,
    options?: HeatMapOptions,
  ): HeatLayer;
}
