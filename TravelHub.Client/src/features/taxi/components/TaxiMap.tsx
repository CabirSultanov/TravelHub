import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapMouseEvent,
  Marker as MapLibreMarker,
} from 'maplibre-gl';
import type { Coordinates, TaxiPointMode, TaxiRouteState } from '../taxi.types';

const ROUTE_SOURCE_ID = 'taxi-route';
const ROUTE_LAYER_ID = 'taxi-route-line';
const BAKU_CENTER: [number, number] = [49.8671, 40.4093];

type RouteGeometry = {
  type: 'LineString';
  coordinates: [number, number][];
};

type RouteGeoJSON = GeoJSON.Feature<GeoJSON.LineString> | GeoJSON.FeatureCollection<GeoJSON.LineString>;

type TaxiMapProps = {
  pickup: Coordinates | null;
  dropoff: Coordinates | null;
  mode: TaxiPointMode;
  onModeChange: (mode: TaxiPointMode) => void;
  onPointChange: (coordinates: Coordinates) => void;
  onRouteChange: (route: TaxiRouteState) => void;
};

type RouteResult = {
  geometry: RouteGeometry;
  distanceKm: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseRouteGeometry(value: unknown): RouteGeometry | null {
  if (!isRecord(value) || value.type !== 'LineString' || !Array.isArray(value.coordinates)) {
    return null;
  }

  const coordinates: [number, number][] = [];

  for (const point of value.coordinates) {
    if (
      !Array.isArray(point) ||
      point.length < 2 ||
      typeof point[0] !== 'number' ||
      typeof point[1] !== 'number' ||
      !Number.isFinite(point[0]) ||
      !Number.isFinite(point[1])
    ) {
      return null;
    }

    coordinates.push([point[0], point[1]]);
  }

  return coordinates.length >= 2 ? { type: 'LineString', coordinates } : null;
}

function parseRouteResponse(value: unknown): RouteResult | null {
  if (!isRecord(value) || (value.code !== undefined && value.code !== 'Ok') || !Array.isArray(value.routes)) {
    return null;
  }

  const route = value.routes[0];

  if (!isRecord(route) || typeof route.distance !== 'number' || !Number.isFinite(route.distance) || route.distance <= 0) {
    return null;
  }

  const geometry = parseRouteGeometry(route.geometry);

  if (!geometry) {
    return null;
  }

  return {
    geometry,
    distanceKm: Math.round((route.distance / 1000) * 100) / 100,
  };
}

function createMarkerElement(kind: 'pickup' | 'dropoff') {
  const element = document.createElement('span');
  element.className = `taxi-map-marker ${kind}`;
  element.setAttribute('aria-hidden', 'true');
  return element;
}

function syncMarker(
  map: MapLibreMap,
  markerRef: { current: MapLibreMarker | null },
  coordinates: Coordinates | null,
  kind: 'pickup' | 'dropoff',
) {
  if (!coordinates) {
    markerRef.current?.remove();
    markerRef.current = null;
    return;
  }

  const position: [number, number] = [coordinates.longitude, coordinates.latitude];

  if (!markerRef.current) {
    markerRef.current = new maplibregl.Marker({ element: createMarkerElement(kind) })
      .setLngLat(position)
      .addTo(map);
    return;
  }

  markerRef.current.setLngLat(position);
}

function setRouteData(map: MapLibreMap, geometry: RouteGeometry | null) {
  const data: RouteGeoJSON = geometry
    ? {
        type: 'Feature',
        properties: {},
        geometry,
      }
    : {
        type: 'FeatureCollection',
        features: [],
      };
  const source = map.getSource(ROUTE_SOURCE_ID);

  if (source?.type === 'geojson') {
    void (source as GeoJSONSource).setData(data);
  } else if (geometry && !source) {
    map.addSource(ROUTE_SOURCE_ID, {
      type: 'geojson',
      data,
    });
  }

  if (geometry && !map.getLayer(ROUTE_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_LAYER_ID,
      type: 'line',
      source: ROUTE_SOURCE_ID,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#1877f2',
        'line-opacity': 0.9,
        'line-width': 6,
      },
    });
  }

  if (geometry && map.getLayer(ROUTE_LAYER_ID)) {
    map.moveLayer(ROUTE_LAYER_ID);
  }
}

function fitRouteBounds(map: MapLibreMap, pickup: Coordinates, dropoff: Coordinates, geometry: RouteGeometry) {
  const bounds = new maplibregl.LngLatBounds();
  bounds.extend([pickup.longitude, pickup.latitude]);
  bounds.extend([dropoff.longitude, dropoff.latitude]);

  for (const [longitude, latitude] of geometry.coordinates) {
    bounds.extend([longitude, latitude]);
  }

  map.fitBounds(bounds, { padding: 64, maxZoom: 15, duration: 500 });
}

export default function TaxiMap({ pickup, dropoff, mode, onModeChange, onPointChange, onRouteChange }: TaxiMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const pickupMarkerRef = useRef<MapLibreMarker | null>(null);
  const dropoffMarkerRef = useRef<MapLibreMarker | null>(null);
  const routeRequestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const onPointChangeRef = useRef(onPointChange);
  const onRouteChangeRef = useRef(onRouteChange);
  const [mapReady, setMapReady] = useState(false);
  const [routeState, setRouteState] = useState<TaxiRouteState>({ status: 'idle', distanceKm: 0 });

  useEffect(() => {
    onPointChangeRef.current = onPointChange;
  }, [onPointChange]);

  useEffect(() => {
    onRouteChangeRef.current = onRouteChange;
  }, [onRouteChange]);

  useEffect(() => {
    mountedRef.current = true;

    if (!mapContainerRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      center: BAKU_CENTER,
      zoom: 12,
      attributionControl: { compact: true },
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm',
          },
        ],
      },
    });
    const handleLoad = () => {
      if (mountedRef.current) {
        setMapReady(true);
      }
    };
    const handleMapClick = (event: MapMouseEvent) => {
      onPointChangeRef.current({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
    };

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', handleLoad);
    map.on('click', handleMapClick);

    return () => {
      mountedRef.current = false;
      map.off('load', handleLoad);
      map.off('click', handleMapClick);
      pickupMarkerRef.current?.remove();
      dropoffMarkerRef.current?.remove();
      pickupMarkerRef.current = null;
      dropoffMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    syncMarker(map, pickupMarkerRef, pickup, 'pickup');
    syncMarker(map, dropoffMarkerRef, dropoff, 'dropoff');
  }, [dropoff, mapReady, pickup]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    const routeMap = map;

    const requestId = ++routeRequestIdRef.current;
    const controller = new AbortController();
    let timedOut = false;

    setRouteData(routeMap, null);

    if (!pickup || !dropoff) {
      const nextState: TaxiRouteState = { status: 'idle', distanceKm: 0 };
      setRouteState(nextState);
      onRouteChangeRef.current(nextState);
      return () => controller.abort();
    }

    const routePickup = pickup;
    const routeDropoff = dropoff;

    const loadingState: TaxiRouteState = { status: 'loading', distanceKm: 0 };
    setRouteState(loadingState);
    onRouteChangeRef.current(loadingState);

    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 12000);
    const routeUrl = `https://router.project-osrm.org/route/v1/driving/${routePickup.longitude},${routePickup.latitude};${routeDropoff.longitude},${routeDropoff.latitude}?overview=full&geometries=geojson`;

    async function loadRoute() {
      try {
        const response = await fetch(routeUrl, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`OSRM request failed with status ${response.status}`);
        }

        const route = parseRouteResponse((await response.json()) as unknown);

        if (!route) {
          throw new Error('OSRM returned no usable route');
        }

        if (!mountedRef.current || routeRequestIdRef.current !== requestId) {
          return;
        }

        setRouteData(routeMap, route.geometry);
        fitRouteBounds(routeMap, routePickup, routeDropoff, route.geometry);
        const successState: TaxiRouteState = { status: 'success', distanceKm: route.distanceKm };
        setRouteState(successState);
        onRouteChangeRef.current(successState);
      } catch (error) {
        if (!mountedRef.current || routeRequestIdRef.current !== requestId || (controller.signal.aborted && !timedOut)) {
          return;
        }

        const errorState: TaxiRouteState = { status: 'error', distanceKm: 0 };
        setRouteState(errorState);
        onRouteChangeRef.current(errorState);
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    void loadRoute();

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [dropoff, mapReady, pickup]);

  const instruction =
    routeState.status === 'loading'
      ? 'Calculating route...'
      : routeState.status === 'error'
        ? 'Unable to calculate route. Please try another location.'
        : !pickup
          ? 'Click on the map to select pickup'
          : !dropoff
            ? 'Select Dropoff, then click on the map'
            : 'Route calculated';

  return (
    <div className="taxi-map-panel">
      <div className="booking-mode taxi-point-mode" aria-label="Taxi map point mode">
        <button
          className={mode === 'pickup' ? 'active taxi-pickup-mode' : 'taxi-pickup-mode'}
          onClick={() => onModeChange('pickup')}
          type="button"
        >
          Pickup
        </button>
        <button
          className={mode === 'dropoff' ? 'active taxi-dropoff-mode' : 'taxi-dropoff-mode'}
          onClick={() => onModeChange('dropoff')}
          type="button"
        >
          Dropoff
        </button>
      </div>
      <p className="taxi-map-instructions" aria-live="polite">
        {instruction}
      </p>
      <div className="taxi-map" ref={mapContainerRef} role="application" aria-label="Interactive taxi map" />
    </div>
  );
}
