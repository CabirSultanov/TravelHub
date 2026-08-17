import type { TaxiForm, TaxiServiceFormActions } from '../taxi.types';
import { taxiCarClassOptions } from '../../../utils/taxi';

type TaxiServiceFormProps = {
  taxiForm: TaxiForm;
  editingTaxiId: number | null;
  submitting: boolean;
  phoneNumberPattern: string;
  pricePattern: string;
  actions: TaxiServiceFormActions;
};

export default function TaxiServiceForm({
  taxiForm,
  editingTaxiId,
  submitting,
  phoneNumberPattern,
  pricePattern,
  actions,
}: TaxiServiceFormProps) {
  return (
    <form className="form-grid taxi-service-form" onSubmit={(event) => void actions.submit(event)}>
      <h3>{editingTaxiId ? 'Edit taxi service' : 'New taxi service'}</h3>
      <input
        placeholder="Company name"
        value={taxiForm.companyName}
        onChange={(event) => actions.setForm({ ...taxiForm, companyName: event.target.value })}
        required
      />
      <div className="taxi-cities">
        <strong>Cities</strong>
        {taxiForm.cities.map((city, index) => (
          <div className="taxi-city-row" key={index}>
            <input
              placeholder="City"
              value={city}
              onChange={(event) => actions.updateCity(index, event.target.value)}
              required
            />
            <button disabled={taxiForm.cities.length === 1} onClick={() => actions.removeCity(index)} type="button">
              Remove
            </button>
          </div>
        ))}
        <button className="link-button taxi-form-add-button" onClick={actions.addCity} type="button">
          Add city
        </button>
      </div>
      <input
        inputMode="tel"
        pattern={phoneNumberPattern}
        placeholder="Phone number"
        title="Use digits, spaces, +, -, or parentheses."
        type="tel"
        value={taxiForm.phoneNumber}
        onChange={(event) => actions.setForm({ ...taxiForm, phoneNumber: event.target.value })}
        required
      />
      <div className="taxi-classes">
        <strong>Car classes</strong>
        {taxiForm.carClasses.map((carClass, index) => (
          <div className="taxi-class-row" key={index}>
            <select
              value={carClass.name}
              onChange={(event) => actions.updateCarClass(index, { name: event.target.value })}
              required
            >
              {taxiCarClassOptions.map((option) => (
                <option
                  disabled={taxiForm.carClasses.some(
                    (currentCarClass, currentIndex) =>
                      currentIndex !== index && currentCarClass.name === option.value,
                  )}
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
            <input
              className="taxi-price-input"
              inputMode="decimal"
              min="0.01"
              pattern={pricePattern}
              placeholder="Price per km"
              step="0.01"
              title="Use a number greater than 0, for example 1.50."
              type="text"
              value={carClass.pricePerKm}
              onChange={(event) => actions.updateCarClass(index, { pricePerKm: event.target.value })}
              required
            />
            <button disabled={taxiForm.carClasses.length === 1} onClick={() => actions.removeCarClass(index)} type="button">
              Remove
            </button>
          </div>
        ))}
        <button
          className="link-button taxi-form-add-button"
          disabled={taxiForm.carClasses.length === taxiCarClassOptions.length}
          onClick={actions.addCarClass}
          type="button"
        >
          Add class
        </button>
      </div>
      <input
        placeholder="Description"
        value={taxiForm.description}
        onChange={(event) => actions.setForm({ ...taxiForm, description: event.target.value })}
        required
      />
      <input
        placeholder="Image URL"
        pattern="https?://.+"
        title="Use a full http or https URL."
        type="url"
        value={taxiForm.imageUrl || ''}
        onChange={(event) => actions.setForm({ ...taxiForm, imageUrl: event.target.value })}
        required
      />
      <div className="taxi-service-form-actions">
        <button className="primary taxi-service-submit" disabled={submitting} type="submit">
          {editingTaxiId ? 'Save taxi service' : 'Create taxi service'}
        </button>
        <button className="link-button taxi-service-cancel" disabled={submitting} onClick={actions.cancel} type="button">
          Cancel
        </button>
      </div>
    </form>
  );
}
