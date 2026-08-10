import { describe, expect, it } from 'vitest';
import { createEmptyTaxiBookingForm } from './taxi.constants';
import {
  applyTaxiPointAddressIfCoordinatesMatch,
  applyTaxiPointToCoordinates,
  applyTaxiPointToForm,
  canCreateTaxiBooking,
  canPreviewTaxiRoute,
  clearTaxiPointCoordinates,
  clearTaxiPointInForm,
  formatTaxiCoordinateAddress,
  getMapClickPointMode,
  getTaxiPointFormFields,
  idleTaxiRouteState,
} from './taxi.state';
import type { Coordinates, TaxiCoordinates, TaxiRouteState } from './taxi.types';

const airport: Coordinates = { latitude: 40.4675, longitude: 50.0467 };
const portBaku: Coordinates = { latitude: 40.3712, longitude: 49.8526 };
const ganja: Coordinates = { latitude: 40.6828, longitude: 46.3606 };

const successRoute: TaxiRouteState = {
  status: 'success',
  distanceKm: 24.5,
  durationSeconds: 1800,
  encodedPolyline: 'encoded',
};

function emptyCoordinates(): TaxiCoordinates {
  return { pickup: null, dropoff: null };
}

describe('taxi state helpers', () => {
  it('keeps map clicks on dropoff after pickup is selected', () => {
    expect(getMapClickPointMode('pickup', { latitude: 40.4, longitude: 49.8 }, null)).toBe('dropoff');
    expect(getMapClickPointMode('pickup', null, null)).toBe('pickup');
    expect(getMapClickPointMode('dropoff', { latitude: 40.4, longitude: 49.8 }, null)).toBe('dropoff');
  });

  it('maps address fields to the same taxi point state', () => {
    expect(getTaxiPointFormFields('pickup')).toEqual({
      address: 'pickupAddress',
      latitude: 'pickupLatitude',
      longitude: 'pickupLongitude',
    });
    expect(getTaxiPointFormFields('dropoff')).toEqual({
      address: 'dropoffAddress',
      latitude: 'dropoffLatitude',
      longitude: 'dropoffLongitude',
    });
  });

  it('formats coordinate fallback addresses consistently', () => {
    expect(formatTaxiCoordinateAddress({ latitude: 40.4093211, longitude: 49.8671119 })).toBe('40.409321, 49.867112');
  });

  it('updates pickup coordinates and form fields from address search', () => {
    const form = applyTaxiPointToForm(createEmptyTaxiBookingForm(), 'pickup', airport, 'Heydar Aliyev International Airport');
    const coordinates = applyTaxiPointToCoordinates(emptyCoordinates(), 'pickup', airport);

    expect(coordinates.pickup).toEqual(airport);
    expect(form.pickupAddress).toBe('Heydar Aliyev International Airport');
    expect(form.pickupLatitude).toBe(airport.latitude);
    expect(form.pickupLongitude).toBe(airport.longitude);
  });

  it('updates dropoff coordinates and form fields from address search', () => {
    const form = applyTaxiPointToForm(createEmptyTaxiBookingForm(), 'dropoff', portBaku, 'Port Baku');
    const coordinates = applyTaxiPointToCoordinates(emptyCoordinates(), 'dropoff', portBaku);

    expect(coordinates.dropoff).toEqual(portBaku);
    expect(form.dropoffAddress).toBe('Port Baku');
    expect(form.dropoffLatitude).toBe(portBaku.latitude);
    expect(form.dropoffLongitude).toBe(portBaku.longitude);
  });

  it('updates pickup coordinates and address from a map click fallback', () => {
    const address = formatTaxiCoordinateAddress(airport);
    const form = applyTaxiPointToForm(createEmptyTaxiBookingForm(), 'pickup', airport, address);
    const coordinates = applyTaxiPointToCoordinates(emptyCoordinates(), 'pickup', airport);

    expect(coordinates.pickup).toEqual(airport);
    expect(form.pickupAddress).toBe(address);
  });

  it('updates dropoff coordinates and address from a map click fallback', () => {
    const address = formatTaxiCoordinateAddress(portBaku);
    const form = applyTaxiPointToForm(createEmptyTaxiBookingForm(), 'dropoff', portBaku, address);
    const coordinates = applyTaxiPointToCoordinates(emptyCoordinates(), 'dropoff', portBaku);

    expect(coordinates.dropoff).toEqual(portBaku);
    expect(form.dropoffAddress).toBe(address);
  });

  it('supports pickup by address and dropoff by map as one route-ready state', () => {
    const afterPickup = applyTaxiPointToCoordinates(emptyCoordinates(), 'pickup', airport);
    const afterDropoff = applyTaxiPointToCoordinates(afterPickup, 'dropoff', portBaku);

    expect(canPreviewTaxiRoute(afterDropoff)).toBe(true);
  });

  it('supports pickup by map and dropoff by address as one route-ready state', () => {
    const afterPickup = applyTaxiPointToCoordinates(emptyCoordinates(), 'pickup', airport);
    const afterDropoff = applyTaxiPointToCoordinates(afterPickup, 'dropoff', portBaku);
    const form = applyTaxiPointToForm(
      applyTaxiPointToForm(createEmptyTaxiBookingForm(), 'pickup', airport, formatTaxiCoordinateAddress(airport)),
      'dropoff',
      portBaku,
      'Port Baku',
    );

    expect(canPreviewTaxiRoute(afterDropoff)).toBe(true);
    expect(form.pickupAddress).toBe(formatTaxiCoordinateAddress(airport));
    expect(form.dropoffAddress).toBe('Port Baku');
  });

  it('manual address edits clear stale coordinates for that point', () => {
    const selectedForm = applyTaxiPointToForm(createEmptyTaxiBookingForm(), 'pickup', airport, 'Airport');
    const selectedCoordinates = applyTaxiPointToCoordinates(emptyCoordinates(), 'pickup', airport);
    const editedForm = clearTaxiPointInForm(selectedForm, 'pickup', 'Port Baku');
    const editedCoordinates = clearTaxiPointCoordinates(selectedCoordinates, 'pickup');

    expect(editedCoordinates.pickup).toBeNull();
    expect(editedForm.pickupAddress).toBe('Port Baku');
    expect(editedForm.pickupLatitude).toBe(0);
    expect(editedForm.pickupLongitude).toBe(0);
  });

  it('clearing a point makes the route preview idle again', () => {
    const routeReadyCoordinates = { pickup: airport, dropoff: portBaku };
    const clearedCoordinates = clearTaxiPointCoordinates(routeReadyCoordinates, 'dropoff');

    expect(canPreviewTaxiRoute(routeReadyCoordinates)).toBe(true);
    expect(canPreviewTaxiRoute(clearedCoordinates)).toBe(false);
    expect(idleTaxiRouteState).toEqual({ status: 'idle', distanceKm: 0 });
  });

  it('recalculates from the latest resolved coordinates after a point changes', () => {
    const firstRouteCoordinates = { pickup: airport, dropoff: portBaku };
    const updatedRouteCoordinates = applyTaxiPointToCoordinates(firstRouteCoordinates, 'dropoff', ganja);

    expect(canPreviewTaxiRoute(updatedRouteCoordinates)).toBe(true);
    expect(updatedRouteCoordinates.dropoff).toEqual(ganja);
  });

  it('does not allow booking with unresolved typed address text', () => {
    const selectedForm = applyTaxiPointToForm(
      applyTaxiPointToForm(createEmptyTaxiBookingForm(), 'pickup', airport, 'Airport'),
      'dropoff',
      portBaku,
      'Port Baku',
    );
    const selectedCoordinates = { pickup: airport, dropoff: portBaku };
    const editedForm = clearTaxiPointInForm(selectedForm, 'pickup', 'Ganja');
    const editedCoordinates = clearTaxiPointCoordinates(selectedCoordinates, 'pickup');

    expect(canCreateTaxiBooking(selectedForm, selectedCoordinates, successRoute, 1.2)).toBe(true);
    expect(canCreateTaxiBooking(editedForm, editedCoordinates, successRoute, 1.2)).toBe(false);
  });

  it('ignores stale reverse geocode addresses for old coordinates', () => {
    const currentForm = applyTaxiPointToForm(createEmptyTaxiBookingForm(), 'pickup', portBaku, 'Port Baku');
    const staleResult = applyTaxiPointAddressIfCoordinatesMatch(currentForm, 'pickup', airport, 'Old airport address');

    expect(staleResult.pickupAddress).toBe('Port Baku');
  });
});
