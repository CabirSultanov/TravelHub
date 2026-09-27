import { useEffect } from 'react';
import { APIProvider, APILoadingStatus, Map, Marker, useApiLoadingStatus, useMap } from '@vis.gl/react-google-maps';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '../../features/taxi/googleMapsConfig';
import type { TaxiBooking } from '../../types';

type RidePoints = Pick<TaxiBooking, 'pickupLatitude' | 'pickupLongitude' | 'dropoffLatitude' | 'dropoffLongitude' | 'pickupAddress' | 'dropoffAddress'>;

function FitRidePoints({ pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude }: RidePoints) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: pickupLatitude, lng: pickupLongitude });
    bounds.extend({ lat: dropoffLatitude, lng: dropoffLongitude });
    map.fitBounds(bounds, 56);
  }, [map, pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude]);

  return null;
}

function RidePointsMap(props: RidePoints) {
  const status = useApiLoadingStatus();
  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return <p className="ride-map-fallback">Map unavailable. Your pickup and dropoff addresses are listed above.</p>;
  }

  if (status !== APILoadingStatus.LOADED) {
    return <p className="ride-map-fallback">Loading map… Your ride updates independently.</p>;
  }

  return (
    <div className="ride-map" aria-label="Read-only map of pickup A and dropoff B">
      <Map
        defaultCenter={{ lat: props.pickupLatitude, lng: props.pickupLongitude }}
        defaultZoom={12}
        maxZoom={16}
        disableDefaultUI
        disableDoubleClickZoom
        gestureHandling="none"
        keyboardShortcuts={false}
        clickableIcons={false}
      >
        <Marker label="A" title={`Pickup: ${props.pickupAddress}`} position={{ lat: props.pickupLatitude, lng: props.pickupLongitude }} />
        <Marker label="B" title={`Dropoff: ${props.dropoffAddress}`} position={{ lat: props.dropoffLatitude, lng: props.dropoffLongitude }} />
        <FitRidePoints {...props} />
      </Map>
    </div>
  );
}

export default function TaxiRideMap(props: RidePoints) {
  const validCoordinates = [props.pickupLatitude, props.dropoffLatitude].every((value) => Number.isFinite(value) && Math.abs(value) <= 90)
    && [props.pickupLongitude, props.dropoffLongitude].every((value) => Number.isFinite(value) && Math.abs(value) <= 180);

  if (!GOOGLE_MAPS_API_KEY || !validCoordinates) {
    return <p className="ride-map-fallback">Map unavailable. Your pickup and dropoff addresses are listed above.</p>;
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={GOOGLE_MAPS_LIBRARIES} authReferrerPolicy="origin">
      <RidePointsMap {...props} />
    </APIProvider>
  );
}
