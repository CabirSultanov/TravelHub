import { useEffect, useRef, useState } from 'react';
import { APIProvider, Map, Marker, Polyline, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import type { MapMouseEvent } from '@vis.gl/react-google-maps';
import { api } from '../../../api';
import type { Coordinates, TaxiPointMode, TaxiRouteState } from '../taxi.types';

const BAKU_CENTER = { lat: 40.4093, lng: 49.8671 };
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

type TaxiMapProps = {
  pickup: Coordinates | null;
  dropoff: Coordinates | null;
  mode: TaxiPointMode;
  onModeChange: (mode: TaxiPointMode) => void;
  onPointChange: (coordinates: Coordinates) => void;
  onRouteChange: (route: TaxiRouteState) => void;
};

function toLatLng(coordinates: Coordinates) {
  return { lat: coordinates.latitude, lng: coordinates.longitude };
}

function RoutePreview({
  pickup,
  dropoff,
  route,
}: {
  pickup: Coordinates | null;
  dropoff: Coordinates | null;
  route: TaxiRouteState;
}) {
  const map = useMap();
  const geometryLibrary = useMapsLibrary('geometry');

  useEffect(() => {
    if (!map || !geometryLibrary || !pickup || !dropoff || route.status !== 'success' || !route.encodedPolyline) {
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(toLatLng(pickup));
    bounds.extend(toLatLng(dropoff));

    for (const point of geometryLibrary.encoding.decodePath(route.encodedPolyline)) {
      bounds.extend(point);
    }

    map.fitBounds(bounds, 64);
  }, [dropoff, geometryLibrary, map, pickup, route.encodedPolyline, route.status]);

  if (route.status !== 'success' || !route.encodedPolyline) {
    return null;
  }

  return (
    <Polyline
      encodedPath={route.encodedPolyline}
      strokeColor="#1877f2"
      strokeOpacity={0.95}
      strokeWeight={6}
      zIndex={10}
    />
  );
}

function TaxiGoogleMap({ pickup, dropoff, onPointChange, onRouteChange }: TaxiMapProps) {
  const routeRequestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const onRouteChangeRef = useRef(onRouteChange);
  const [routeState, setRouteState] = useState<TaxiRouteState>({ status: 'idle', distanceKm: 0 });

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    onRouteChangeRef.current = onRouteChange;
  }, [onRouteChange]);

  useEffect(() => {
    const requestId = ++routeRequestIdRef.current;
    const controller = new AbortController();

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

    async function loadRoute() {
      try {
        const route = await api.previewTaxiRoute(
          {
            pickupLatitude: routePickup.latitude,
            pickupLongitude: routePickup.longitude,
            dropoffLatitude: routeDropoff.latitude,
            dropoffLongitude: routeDropoff.longitude,
          },
          controller.signal,
        );

        if (!mountedRef.current || routeRequestIdRef.current !== requestId) {
          return;
        }

        const successState: TaxiRouteState = {
          status: 'success',
          distanceKm: route.distanceKm,
          durationSeconds: route.durationSeconds,
          encodedPolyline: route.encodedPolyline,
        };
        setRouteState(successState);
        onRouteChangeRef.current(successState);
      } catch {
        if (!mountedRef.current || routeRequestIdRef.current !== requestId || controller.signal.aborted) {
          return;
        }

        const errorState: TaxiRouteState = { status: 'error', distanceKm: 0 };
        setRouteState(errorState);
        onRouteChangeRef.current(errorState);
      }
    }

    void loadRoute();

    return () => controller.abort();
  }, [dropoff, pickup]);

  function handleMapClick(event: MapMouseEvent) {
    if (!event.detail.latLng) {
      return;
    }

    onPointChange({
      latitude: event.detail.latLng.lat,
      longitude: event.detail.latLng.lng,
    });
  }

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
    <>
      <p className="taxi-map-instructions" aria-live="polite">
        {instruction}
      </p>
      <div className="taxi-map">
        <Map
          defaultCenter={BAKU_CENTER}
          defaultZoom={12}
          gestureHandling="greedy"
          onClick={handleMapClick}
          reuseMaps
          streetViewControl={false}
        >
          {pickup && <Marker position={toLatLng(pickup)} />}
          {dropoff && <Marker position={toLatLng(dropoff)} />}
          <RoutePreview dropoff={dropoff} pickup={pickup} route={routeState} />
        </Map>
      </div>
    </>
  );
}

export default function TaxiMap(props: TaxiMapProps) {
  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="taxi-map-panel">
        <div className="booking-mode taxi-point-mode" aria-label="Taxi map point mode">
          <button
            className={props.mode === 'pickup' ? 'active taxi-pickup-mode' : 'taxi-pickup-mode'}
            onClick={() => props.onModeChange('pickup')}
            type="button"
          >
            Pickup
          </button>
          <button
            className={props.mode === 'dropoff' ? 'active taxi-dropoff-mode' : 'taxi-dropoff-mode'}
            onClick={() => props.onModeChange('dropoff')}
            type="button"
          >
            Dropoff
          </button>
        </div>
        <p className="taxi-map-instructions">Google Maps API key is not configured.</p>
        <div className="taxi-map" />
      </div>
    );
  }

  return (
    <div className="taxi-map-panel">
      <div className="booking-mode taxi-point-mode" aria-label="Taxi map point mode">
        <button
          className={props.mode === 'pickup' ? 'active taxi-pickup-mode' : 'taxi-pickup-mode'}
          onClick={() => props.onModeChange('pickup')}
          type="button"
        >
          Pickup
        </button>
        <button
          className={props.mode === 'dropoff' ? 'active taxi-dropoff-mode' : 'taxi-dropoff-mode'}
          onClick={() => props.onModeChange('dropoff')}
          type="button"
        >
          Dropoff
        </button>
      </div>
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['geometry']} authReferrerPolicy="origin">
        <TaxiGoogleMap {...props} />
      </APIProvider>
    </div>
  );
}
