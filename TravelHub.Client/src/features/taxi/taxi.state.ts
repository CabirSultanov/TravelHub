import type { Coordinates, TaxiBookingForm, TaxiCoordinates, TaxiPointMode, TaxiRouteState } from './taxi.types';

export const idleTaxiRouteState: TaxiRouteState = { status: 'idle', distanceKm: 0 };

export function formatTaxiCoordinateAddress(coordinates: Coordinates) {
  return `${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`;
}

export function getTaxiPointFormFields(mode: TaxiPointMode) {
  return mode === 'pickup'
    ? {
        address: 'pickupAddress',
        latitude: 'pickupLatitude',
        longitude: 'pickupLongitude',
      } as const
    : {
        address: 'dropoffAddress',
        latitude: 'dropoffLatitude',
        longitude: 'dropoffLongitude',
      } as const;
}

export function getMapClickPointMode(mode: TaxiPointMode, pickup: Coordinates | null, dropoff: Coordinates | null) {
  return mode === 'pickup' && pickup && !dropoff ? 'dropoff' : mode;
}

export function applyTaxiPointToCoordinates(
  coordinates: TaxiCoordinates,
  mode: TaxiPointMode,
  point: Coordinates,
): TaxiCoordinates {
  return {
    ...coordinates,
    [mode]: point,
  };
}

export function applyTaxiPointToForm(
  form: TaxiBookingForm,
  mode: TaxiPointMode,
  point: Coordinates,
  address: string,
): TaxiBookingForm {
  const fields = getTaxiPointFormFields(mode);

  return {
    ...form,
    [fields.address]: address,
    [fields.latitude]: point.latitude,
    [fields.longitude]: point.longitude,
  };
}

export function applyTaxiPointAddressIfCoordinatesMatch(
  form: TaxiBookingForm,
  mode: TaxiPointMode,
  point: Coordinates,
  address: string,
): TaxiBookingForm {
  const fields = getTaxiPointFormFields(mode);
  const samePoint = form[fields.latitude] === point.latitude && form[fields.longitude] === point.longitude;

  return samePoint ? { ...form, [fields.address]: address } : form;
}

export function canPreviewTaxiRoute(coordinates: TaxiCoordinates) {
  return Boolean(coordinates.pickup && coordinates.dropoff);
}

export function canCreateTaxiBooking(
  form: TaxiBookingForm,
  coordinates: TaxiCoordinates,
  routeState: TaxiRouteState,
  pricePerKm: number | undefined,
) {
  return (
    form.pickupAddress.trim().length > 0 &&
    form.dropoffAddress.trim().length > 0 &&
    canPreviewTaxiRoute(coordinates) &&
    routeState.status === 'success' &&
    Number.isFinite(routeState.distanceKm) &&
    routeState.distanceKm > 0 &&
    Number.isFinite(pricePerKm) &&
    Number(pricePerKm) > 0
  );
}
