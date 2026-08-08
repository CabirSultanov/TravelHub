import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../../api';
import { getErrorMessage } from '../../../utils/errors';
import { splitTaxiCities, taxiCarClassOptions, toLegacyTaxiPoint } from '../../../utils/taxi';
import type { TaxiBooking, TaxiService, TaxiServiceInput } from '../../../types';
import { createEmptyTaxiBookingForm, emptyTaxiForm } from '../taxi.constants';
import type {
  Coordinates,
  TaxiCoordinates,
  TaxiFeature,
  TaxiFeatureOptions,
  TaxiForm,
  TaxiCarClassForm,
  TaxiRouteState,
} from '../taxi.types';

export function useTaxiFeature({
  currentUser,
  setMessage,
  setSubmitting,
  onRequireAuth,
  onBookingCreated,
  onResetPayment,
  onResetTaxiPayment,
}: TaxiFeatureOptions): TaxiFeature {
  const [taxiServices, setTaxiServices] = useState<TaxiService[]>([]);
  const [taxiBooking, setTaxiBooking] = useState<TaxiBooking | null>(null);
  const [taxiForm, setTaxiForm] = useState<TaxiForm>(emptyTaxiForm);
  const [taxiBookingForm, setTaxiBookingForm] = useState(() => createEmptyTaxiBookingForm());
  const [taxiPointMode, setTaxiPointMode] = useState<'pickup' | 'dropoff'>('pickup');
  const [taxiCoordinates, setTaxiCoordinates] = useState<TaxiCoordinates>({ pickup: null, dropoff: null });
  const [taxiRouteState, setTaxiRouteState] = useState<TaxiRouteState>({ status: 'idle', distanceKm: 0 });
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
    setTaxiRouteState({ status: 'idle', distanceKm: 0 });
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
  const taxiEstimatedTotal = selectedTaxiCarClass ? taxiDistanceKm * selectedTaxiCarClass.pricePerKm : 0;
  const canManageTaxi = currentUser?.role === 'Admin' || currentUser?.role === 'SuperAdmin';

  function startCreateTaxiService() {
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

    if (!canManageTaxi) {
      return;
    }

    const taxiService: TaxiServiceInput = {
      companyName: taxiForm.companyName.trim(),
      city: taxiForm.cities.map((city) => city.trim()).filter(Boolean).join(', '),
      phoneNumber: taxiForm.phoneNumber.trim(),
      description: taxiForm.description.trim(),
      imageUrl: taxiForm.imageUrl?.trim() || null,
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

  function selectTaxiServiceForBooking(taxiService: TaxiService) {
    setTaxiBookingForm({
      ...taxiBookingForm,
      taxiServiceId: String(taxiService.id),
      carClassName: taxiService.carClasses[0]?.name ?? '',
    });
    setTaxiBooking(null);
    onResetTaxiPayment();
    setEditingTaxiId(null);
    setTaxiForm(emptyTaxiForm);
    setShowTaxiForm(false);
    setMessage('');
  }

  function updateTaxiMapPoint(coordinates: Coordinates) {
    const legacyPoint = toLegacyTaxiPoint(coordinates);

    setTaxiCoordinates((currentCoordinates) => ({
      ...currentCoordinates,
      [taxiPointMode]: coordinates,
    }));
    setTaxiBookingForm((form) => ({
      ...form,
      [taxiPointMode === 'pickup' ? 'pickupX' : 'dropoffX']: legacyPoint.x,
      [taxiPointMode === 'pickup' ? 'pickupY' : 'dropoffY']: legacyPoint.y,
    }));
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

  async function submitTaxiBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUser) {
      onRequireAuth('Please sign in to order a taxi.');
      return;
    }

    if (!selectedTaxiService || !selectedTaxiCarClass) {
      setMessage('Choose a taxi service and car class.');
      return;
    }

    if (
      !taxiCoordinates.pickup ||
      !taxiCoordinates.dropoff ||
      taxiRouteState.status !== 'success' ||
      !Number.isFinite(taxiDistanceKm) ||
      taxiDistanceKm <= 0 ||
      !Number.isFinite(selectedTaxiCarClass.pricePerKm) ||
      selectedTaxiCarClass.pricePerKm <= 0
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
        email: taxiBookingForm.email,
        pickupAddress: taxiBookingForm.pickupAddress,
        dropoffAddress: taxiBookingForm.dropoffAddress,
        pickupX: taxiBookingForm.pickupX,
        pickupY: taxiBookingForm.pickupY,
        dropoffX: taxiBookingForm.dropoffX,
        dropoffY: taxiBookingForm.dropoffY,
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
    setTaxiRouteState({ status: 'idle', distanceKm: 0 });
    onResetTaxiPayment();
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
      editingTaxiId,
      showTaxiForm,
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
        submit: (event) => void submitTaxiService(event),
        cancel: cancelTaxiForm,
      },
      bookingForm: {
        setForm: setTaxiBookingForm,
        selectGuestMode: selectTaxiBookingGuestMode,
        setPointMode: setTaxiPointMode,
        updatePoint: updateTaxiMapPoint,
        setRoute: updateTaxiRoute,
        submit: (event) => void submitTaxiBooking(event),
      },
      resetBooking: resetTaxiBooking,
      setBooking: setTaxiBooking,
    },
  };
}
