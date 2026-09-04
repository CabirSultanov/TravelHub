import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../../api';
import { getErrorMessage } from '../../../utils/errors';
import { splitTaxiCities, taxiCarClassOptions } from '../../../utils/taxi';
import type { BookingPayment, TaxiBooking, TaxiService, TaxiServiceInput } from '../../../types';
import { createEmptyTaxiBookingForm, emptyTaxiForm } from '../taxi.constants';
import { useTaxiDrivers } from './useTaxiDrivers';
import {
  applyTaxiPointToCoordinates,
  applyTaxiPointToForm,
  applyTaxiPointAddressIfCoordinatesMatch,
  canCreateTaxiBooking,
  idleTaxiRouteState,
} from '../taxi.state';
import type {
  Coordinates,
  TaxiCoordinates,
  TaxiFeature,
  TaxiFeatureOptions,
  TaxiForm,
  TaxiCarClassForm,
  TaxiRouteState,
} from '../taxi.types';

function toAbsoluteImageUrl(imageUrl?: string | null) {
  const trimmed = imageUrl?.trim() ?? '';

  if (!trimmed || /^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return new URL(trimmed, window.location.origin).href;
}

export function useTaxiFeature({
  currentUser,
  setMessage,
  setSubmitting,
  onRequireAuth,
  onBookingCreated,
  onResetPayment,
}: TaxiFeatureOptions): TaxiFeature {
  const [taxiServices, setTaxiServices] = useState<TaxiService[]>([]);
  const [taxiBooking, setTaxiBooking] = useState<TaxiBooking | null>(null);
  const [taxiForm, setTaxiForm] = useState<TaxiForm>(emptyTaxiForm);
  const [taxiBookingForm, setTaxiBookingForm] = useState(() => createEmptyTaxiBookingForm());
  const [taxiPointMode, setTaxiPointMode] = useState<'pickup' | 'dropoff'>('pickup');
  const [taxiCoordinates, setTaxiCoordinates] = useState<TaxiCoordinates>({ pickup: null, dropoff: null });
  const [taxiRouteState, setTaxiRouteState] = useState<TaxiRouteState>(idleTaxiRouteState);
  const [editingTaxiId, setEditingTaxiId] = useState<number | null>(null);
  const [showTaxiForm, setShowTaxiForm] = useState(false);
  const [taxiBookingGuestMode, setTaxiBookingGuestMode] = useState<'self' | 'other'>('self');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTaxiServices() {
      try {
        setTaxiServices(await api.getTaxiServices());
      } catch (error) {
        setMessage(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    }

    void loadTaxiServices();
  }, [setMessage]);

  useEffect(() => {
    if (currentUser) {
      return;
    }

    setTaxiBooking(null);
    setTaxiBookingGuestMode('self');
    setTaxiBookingForm(createEmptyTaxiBookingForm());
    setTaxiCoordinates({ pickup: null, dropoff: null });
    setTaxiRouteState(idleTaxiRouteState);
  }, [currentUser]);

  useEffect(() => {
    if (!taxiBookingForm.taxiServiceId) {
      return;
    }

    if (taxiServices.some((taxiService) => taxiService.id === Number(taxiBookingForm.taxiServiceId))) {
      return;
    }

    setTaxiBookingForm((form) => ({
      ...form,
      taxiServiceId: '',
      carClassName: '',
    }));
    setTaxiBooking(null);
  }, [taxiBookingForm.taxiServiceId, taxiServices]);

  useEffect(() => {
    if (!currentUser || taxiBookingGuestMode !== 'self') {
      return;
    }

    setTaxiBookingForm((form) => ({
      ...form,
      customerName: currentUser.name,
      phoneNumber: currentUser.phoneNumber,
      email: currentUser.email,
    }));
  }, [taxiBookingGuestMode, currentUser?.email, currentUser?.name, currentUser?.phoneNumber]);

  const selectedTaxiService = useMemo(
    () => taxiServices.find((taxiService) => taxiService.id === Number(taxiBookingForm.taxiServiceId)) ?? null,
    [taxiBookingForm.taxiServiceId, taxiServices],
  );
  const selectedTaxiCarClass =
    selectedTaxiService?.carClasses.find((carClass) => carClass.name === taxiBookingForm.carClassName) ??
    selectedTaxiService?.carClasses[0] ??
    null;
  const taxiDistanceKm = taxiRouteState.status === 'success' ? taxiRouteState.distanceKm : 0;
  const taxiEstimatedTotal = selectedTaxiCarClass ? Math.round(taxiDistanceKm * selectedTaxiCarClass.pricePerKm * 100) / 100 : 0;
  const canManageTaxi = currentUser?.role === 'Admin' || currentUser?.role === 'SuperAdmin';
  const canEditTaxiService = (taxiService: TaxiService) =>
    canManageTaxi || (currentUser?.role === 'TaxiOwner' && taxiService.ownerId === currentUser.id);
  const managedTaxiService = editingTaxiId === null
    ? selectedTaxiService
    : taxiServices.find((taxiService) => taxiService.id === editingTaxiId) ?? null;
  const canManageSelectedTaxi = Boolean(managedTaxiService && canEditTaxiService(managedTaxiService));
  const taxiDrivers = useTaxiDrivers({
    active: canManageSelectedTaxi && !showTaxiForm,
    taxiServiceId: selectedTaxiService?.id ?? null,
    setMessage,
    setSubmitting,
  });

  function startCreateTaxiService() {
    if (!canManageTaxi) {
      return;
    }

    setTaxiForm(emptyTaxiForm);
    setEditingTaxiId(null);
    setShowTaxiForm(true);
  }

  function cancelTaxiForm() {
    setTaxiForm(emptyTaxiForm);
    setEditingTaxiId(null);
    setShowTaxiForm(false);
  }

  async function submitTaxiService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (editingTaxiId === null ? !canManageTaxi : !canManageSelectedTaxi) {
      return;
    }

    const taxiService: TaxiServiceInput = {
      companyName: taxiForm.companyName.trim(),
      city: taxiForm.cities.map((city) => city.trim()).filter(Boolean).join(', '),
      phoneNumber: taxiForm.phoneNumber.trim(),
      description: taxiForm.description.trim(),
      imageUrl: toAbsoluteImageUrl(taxiForm.imageUrl) || null,
      carClasses: taxiForm.carClasses.map((carClass) => ({
        name: carClass.name.trim(),
        pricePerKm: Number(carClass.pricePerKm),
      })),
    };

    setSubmitting(true);
    setMessage('');

    try {
      if (editingTaxiId) {
        const updatedTaxiService = await api.updateTaxiService(editingTaxiId, taxiService);
        setTaxiServices(taxiServices.map((taxi) => (taxi.id === editingTaxiId ? updatedTaxiService : taxi)));
        setMessage('Taxi service updated.');
      } else {
        const createdTaxiService = await api.createTaxiService(taxiService);
        setTaxiServices([...taxiServices, createdTaxiService]);
        setMessage('Taxi service created.');
      }

      cancelTaxiForm();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function editTaxiService(taxiService: TaxiService) {
    if (!canEditTaxiService(taxiService)) {
      return;
    }

    setEditingTaxiId(taxiService.id);
    setTaxiForm({
      companyName: taxiService.companyName,
      cities: splitTaxiCities(taxiService.city),
      phoneNumber: taxiService.phoneNumber,
      description: taxiService.description,
      imageUrl: taxiService.imageUrl || '',
      carClasses:
        taxiService.carClasses.length > 0
          ? taxiService.carClasses.map((carClass) => ({
              name: carClass.name,
              pricePerKm: String(carClass.pricePerKm),
            }))
          : emptyTaxiForm.carClasses,
    });
    setShowTaxiForm(true);
    setMessage('');
  }

  function updateTaxiCity(index: number, city: string) {
    setTaxiForm({
      ...taxiForm,
      cities: taxiForm.cities.map((currentCity, currentIndex) => (currentIndex === index ? city : currentCity)),
    });
  }

  function removeTaxiCity(index: number) {
    if (taxiForm.cities.length === 1) {
      return;
    }

    setTaxiForm({
      ...taxiForm,
      cities: taxiForm.cities.filter((_, currentIndex) => currentIndex !== index),
    });
  }

  function addTaxiCity() {
    setTaxiForm({ ...taxiForm, cities: [...taxiForm.cities, ''] });
  }

  function updateTaxiCarClass(index: number, update: Partial<TaxiCarClassForm>) {
    setTaxiForm({
      ...taxiForm,
      carClasses: taxiForm.carClasses.map((currentCarClass, currentIndex) =>
        currentIndex === index ? { ...currentCarClass, ...update } : currentCarClass,
      ),
    });
  }

  function removeTaxiCarClass(index: number) {
    if (taxiForm.carClasses.length === 1) {
      return;
    }

    setTaxiForm({
      ...taxiForm,
      carClasses: taxiForm.carClasses.filter((_, currentIndex) => currentIndex !== index),
    });
  }

  function addTaxiCarClass() {
    const selectedNames = new Set(taxiForm.carClasses.map((carClass) => carClass.name));
    const nextOption = taxiCarClassOptions.find((option) => !selectedNames.has(option.value));

    if (!nextOption) {
      return;
    }

    setTaxiForm({
      ...taxiForm,
      carClasses: [...taxiForm.carClasses, { name: nextOption.value, pricePerKm: '' }],
    });
  }

  async function uploadTaxiImage(file: File) {
    if (editingTaxiId === null ? !canManageTaxi : !canManageSelectedTaxi) {
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      const { imageUrl } = await api.uploadTaxiImage(file);
      setTaxiForm((form) => ({ ...form, imageUrl: toAbsoluteImageUrl(imageUrl) }));
      setMessage('Taxi image uploaded.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteTaxiService(taxiServiceId: number) {
    if (!canManageTaxi || !window.confirm('Delete this taxi service?')) {
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      await api.deleteTaxiService(taxiServiceId);
      setTaxiServices(taxiServices.filter((taxi) => taxi.id !== taxiServiceId));
      setEditingTaxiId(null);
      setShowTaxiForm(false);
      setTaxiForm(emptyTaxiForm);
      setMessage('Taxi service deleted.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function selectTaxiServiceForBooking(taxiService: TaxiService, carClassName?: string) {
    const selectedCarClassName = taxiService.carClasses.some((carClass) => carClass.name === carClassName)
      ? carClassName ?? ''
      : taxiService.carClasses[0]?.name ?? '';

    setTaxiBookingForm({
      ...taxiBookingForm,
      taxiServiceId: String(taxiService.id),
      carClassName: selectedCarClassName,
    });
    setTaxiBooking(null);
    setEditingTaxiId(null);
    setTaxiForm(emptyTaxiForm);
    setShowTaxiForm(false);
    setMessage('');
  }

  function clearTaxiRoutePreview() {
    setTaxiBooking(null);
    setTaxiRouteState(idleTaxiRouteState);
  }

  function updateTaxiMapPoint(mode: 'pickup' | 'dropoff', coordinates: Coordinates, address: string) {
    setTaxiCoordinates((currentCoordinates) => applyTaxiPointToCoordinates(currentCoordinates, mode, coordinates));
    setTaxiBookingForm((form) => applyTaxiPointToForm(form, mode, coordinates, address));
    clearTaxiRoutePreview();

    if (mode === 'pickup') {
      setTaxiPointMode('dropoff');
    }
  }

  function updateTaxiPointAddress(mode: 'pickup' | 'dropoff', coordinates: Coordinates, address: string) {
    setTaxiBookingForm((form) => {
      return applyTaxiPointAddressIfCoordinatesMatch(form, mode, coordinates, address);
    });
  }

  function updateTaxiRoute(route: TaxiRouteState) {
    setTaxiRouteState(route);
  }

  function selectTaxiBookingGuestMode(mode: 'self' | 'other') {
    setTaxiBookingGuestMode(mode);
    setTaxiBookingForm((form) => ({
      ...form,
      customerName: mode === 'self' && currentUser ? currentUser.name : '',
      phoneNumber: mode === 'self' && currentUser ? currentUser.phoneNumber : '',
      email: mode === 'self' && currentUser ? currentUser.email : '',
    }));
  }

  async function submitTaxiBooking(event: FormEvent<HTMLFormElement>, payment: BookingPayment) {
    event.preventDefault();

    if (!currentUser) {
      onRequireAuth('Please sign in to order a taxi.');
      return;
    }

    if (!selectedTaxiService || !selectedTaxiCarClass) {
      setMessage('Choose a taxi service and car class.');
      return;
    }

    const pickupCoordinates = taxiCoordinates.pickup;
    const dropoffCoordinates = taxiCoordinates.dropoff;

    if (
      !pickupCoordinates ||
      !dropoffCoordinates ||
      !canCreateTaxiBooking(taxiBookingForm, taxiCoordinates, taxiRouteState, selectedTaxiCarClass.pricePerKm)
    ) {
      setMessage('Select pickup and dropoff and wait for the route to be calculated.');
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      const createdBooking = await api.createTaxiBooking({
        taxiServiceId: Number(taxiBookingForm.taxiServiceId),
        carClassName: selectedTaxiCarClass.name,
        customerName: taxiBookingForm.customerName,
        phoneNumber: taxiBookingForm.phoneNumber,
        email: taxiBookingForm.email || currentUser.email,
        pickupAddress: taxiBookingForm.pickupAddress,
        dropoffAddress: taxiBookingForm.dropoffAddress,
        pickupLatitude: pickupCoordinates.latitude,
        pickupLongitude: pickupCoordinates.longitude,
        dropoffLatitude: dropoffCoordinates.latitude,
        dropoffLongitude: dropoffCoordinates.longitude,
        payment,
      });

      setTaxiBooking(createdBooking);
      onBookingCreated(createdBooking);
      onResetPayment();
      setMessage('Taxi booking created.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function resetTaxiBooking() {
    setTaxiBooking(null);
    setTaxiBookingForm(createEmptyTaxiBookingForm(currentUser, selectedTaxiService ?? taxiServices[0]));
    setTaxiCoordinates({ pickup: null, dropoff: null });
    setTaxiRouteState(idleTaxiRouteState);
    setMessage('');
  }

  return {
    model: {
      taxiServices,
      selectedTaxiService,
      selectedTaxiCarClass,
      taxiForm,
      taxiBookingForm,
      taxiBooking,
      taxiPointMode,
      taxiCoordinates,
      taxiRouteState,
      taxiBookingGuestMode,
      taxiDistanceKm,
      taxiEstimatedTotal,
      canManageTaxi,
      canManageSelectedTaxi,
      canEditTaxiService,
      editingTaxiId,
      showTaxiForm,
      taxiDrivers,
      loading,
    },
    actions: {
      service: {
        startCreate: startCreateTaxiService,
        select: selectTaxiServiceForBooking,
        edit: editTaxiService,
        delete: (taxiServiceId) => void deleteTaxiService(taxiServiceId),
      },
      serviceForm: {
        setForm: setTaxiForm,
        updateCity: updateTaxiCity,
        removeCity: removeTaxiCity,
        addCity: addTaxiCity,
        updateCarClass: updateTaxiCarClass,
        removeCarClass: removeTaxiCarClass,
        addCarClass: addTaxiCarClass,
        uploadImage: (file) => void uploadTaxiImage(file),
        submit: (event) => void submitTaxiService(event),
        cancel: cancelTaxiForm,
      },
      bookingForm: {
        setForm: setTaxiBookingForm,
        selectGuestMode: selectTaxiBookingGuestMode,
        setPointMode: setTaxiPointMode,
        updatePoint: updateTaxiMapPoint,
        updatePointAddress: updateTaxiPointAddress,
        setRoute: updateTaxiRoute,
        submit: (event, payment) => void submitTaxiBooking(event, payment),
      },
      resetBooking: resetTaxiBooking,
      setBooking: setTaxiBooking,
    },
  };
}
