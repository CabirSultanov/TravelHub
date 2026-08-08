import type { FormEvent, MouseEvent } from 'react';
import type {
  AuthUser,
  BookingGuestMode,
  TaxiBooking,
  TaxiBookingCreate,
  TaxiCarClass,
  TaxiService,
  TaxiServiceInput,
} from '../../types';

export type TaxiCarClassForm = {
  name: string;
  pricePerKm: string;
};

export type TaxiForm = Omit<TaxiServiceInput, 'city' | 'carClasses'> & {
  cities: string[];
  carClasses: TaxiCarClassForm[];
};

export type TaxiPointMode = 'pickup' | 'dropoff';

export type TaxiBookingForm = Omit<TaxiBookingCreate, 'taxiServiceId'> & {
  taxiServiceId: string;
};

export type TaxiServiceFormActions = {
  setForm: (form: TaxiForm) => void;
  updateCity: (index: number, city: string) => void;
  removeCity: (index: number) => void;
  addCity: () => void;
  updateCarClass: (index: number, update: Partial<TaxiCarClassForm>) => void;
  removeCarClass: (index: number) => void;
  addCarClass: () => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
  cancel: () => void;
};

export type TaxiBookingFormActions = {
  setForm: (form: TaxiBookingForm) => void;
  selectGuestMode: (mode: BookingGuestMode) => void;
  setPointMode: (mode: TaxiPointMode) => void;
  updatePoint: (event: MouseEvent<HTMLButtonElement>) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
};

export type TaxiFeatureModel = {
  taxiServices: TaxiService[];
  selectedTaxiService: TaxiService | null;
  selectedTaxiCarClass: TaxiCarClass | null;
  taxiForm: TaxiForm;
  taxiBookingForm: TaxiBookingForm;
  taxiBooking: TaxiBooking | null;
  taxiPointMode: TaxiPointMode;
  taxiBookingGuestMode: BookingGuestMode;
  taxiDistanceKm: number;
  taxiEstimatedTotal: number;
  canManageTaxi: boolean;
  editingTaxiId: number | null;
  showTaxiForm: boolean;
  loading: boolean;
};

export type TaxiServiceActions = {
  startCreate: () => void;
  select: (taxiService: TaxiService) => void;
  edit: (taxiService: TaxiService) => void;
  delete: (taxiServiceId: number) => void;
};

export type TaxiFeatureActions = {
  service: TaxiServiceActions;
  serviceForm: TaxiServiceFormActions;
  bookingForm: TaxiBookingFormActions;
  resetBooking: () => void;
  setBooking: (booking: TaxiBooking | null) => void;
};

export type TaxiFeature = {
  model: TaxiFeatureModel;
  actions: TaxiFeatureActions;
};

export type TaxiFeatureOptions = {
  currentUser: AuthUser | null;
  setMessage: (message: string) => void;
  setSubmitting: (submitting: boolean) => void;
  onRequireAuth: (message: string) => void;
  onBookingCreated: (booking: TaxiBooking) => void;
  onResetPayment: () => void;
  onResetTaxiPayment: () => void;
};
