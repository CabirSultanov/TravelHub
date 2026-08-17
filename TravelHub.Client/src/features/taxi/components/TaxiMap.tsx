import { useEffect, useRef, useState } from 'react';
import { Map, Marker, Polyline, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import type { MapMouseEvent } from '@vis.gl/react-google-maps';
import { api } from '../../../api';
import { BAKU_CENTER } from '../googleMapsConfig';
import { canPreviewTaxiRoute, formatTaxiCoordinateAddress, getMapClickPointMode, idleTaxiRouteState } from '../taxi.state';
import type { Coordinates, TaxiPointMode, TaxiRouteState } from '../taxi.types';

type TaxiMapProps = {
  pickup: Coordinates | null;
  dropoff: Coordinates | null;
  mode: TaxiPointMode;
  onModeChange: (mode: TaxiPointMode) => void;
  onPointChange: (mode: TaxiPointMode, coordinates: Coordinates, address: string) => void;
  onPointAddressChange: (mode: TaxiPointMode, coordinates: Coordinates, address: string) => void;
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

function TaxiGoogleMap({ pickup, dropoff, mode, onPointAddressChange, onPointChange, onRouteChange }: TaxiMapProps) {
  const geocodingLibrary = useMapsLibrary('geocoding');
  const routeRequestIdRef = useRef(0);
  const geocodeRequestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const onRouteChangeRef = useRef(onRouteChange);
  const [routeState, setRouteState] = useState<TaxiRouteState>(idleTaxiRouteState);

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

    if (!canPreviewTaxiRoute({ pickup, dropoff }) || !pickup || !dropoff) {
      const nextState: TaxiRouteState = idleTaxiRouteState;
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

  async function handleMapClick(event: MapMouseEvent) {
    if (!event.detail.latLng) {
      return;
    }

    const coordinates = {
      latitude: event.detail.latLng.lat,
      longitude: event.detail.latLng.lng,
    };
    const targetMode = getMapClickPointMode(mode, pickup, dropoff);
    const fallbackAddress = formatTaxiCoordinateAddress(coordinates);
    const requestId = ++geocodeRequestIdRef.current;

    onPointChange(targetMode, coordinates, fallbackAddress);

    if (!geocodingLibrary) {
      return;
    }

    try {
      const geocoder = new geocodingLibrary.Geocoder();
      const response = await geocoder.geocode({
        componentRestrictions: { country: 'AZ' },
        location: { lat: coordinates.latitude, lng: coordinates.longitude },
      });
      const address = response.results[0]?.formatted_address;

      if (!mountedRef.current || geocodeRequestIdRef.current !== requestId || !address) {
        return;
      }

      onPointAddressChange(targetMode, coordinates, address);
    } catch {
      // Keep the coordinate fallback address when reverse geocoding is unavailable.
    }
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
      <TaxiGoogleMap {...props} />
    </div>
  );
}
