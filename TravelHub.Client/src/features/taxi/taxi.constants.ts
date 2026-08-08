import type { AuthUser, TaxiService } from '../../types';
import type { TaxiBookingForm, TaxiForm } from './taxi.types';

export const emptyTaxiForm: TaxiForm = {
  companyName: '',
  cities: [''],
  phoneNumber: '',
  description: '',
  imageUrl: '',
  carClasses: [{ name: 'Standard', pricePerKm: '' }],
};

export function createEmptyTaxiBookingForm(user?: AuthUser | null, taxiService?: TaxiService): TaxiBookingForm {
  return {
    taxiServiceId: String(taxiService?.id ?? ''),
    carClassName: taxiService?.carClasses[0]?.name ?? '',
    customerName: user?.name ?? '',
    phoneNumber: user?.phoneNumber ?? '',
    email: user?.email ?? '',
    pickupAddress: 'Airport terminal',
    dropoffAddress: 'City center',
    pickupX: 22,
    pickupY: 68,
    dropoffX: 76,
    dropoffY: 34,
  };
}
