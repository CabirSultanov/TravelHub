import type { TaxiServiceActions } from '../taxi.types';
import type { TaxiService } from '../../../types';
import { fallbackImage } from '../../../utils/images';

type TaxiServiceListProps = {
  taxiServices: TaxiService[];
  selectedTaxiService: TaxiService | null;
  showTaxiForm: boolean;
  loading: boolean;
  canManageTaxi: boolean;
  submitting: boolean;
  actions: TaxiServiceActions;
};

export default function TaxiServiceList({
  taxiServices,
  selectedTaxiService,
  showTaxiForm,
  loading,
  canManageTaxi,
  submitting,
  actions,
}: TaxiServiceListProps) {
  return (
    <aside className="panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">Taxi</p>
          <h2>Taxi booking</h2>
        </div>
        <span>{taxiServices.length} services</span>
      </div>

      {canManageTaxi && !showTaxiForm && (
        <button className="primary" onClick={actions.startCreate} type="button">
          Create taxi service
        </button>
      )}

      <div className="hotel-list">
        {taxiServices.map((taxi) => (
          <article className={`hotel-card ${selectedTaxiService?.id === taxi.id && !showTaxiForm ? 'active' : ''}`} key={taxi.id}>
            <button className="hotel-card-main" onClick={() => actions.select(taxi)} type="button">
              <img src={taxi.imageUrl || fallbackImage(taxi.companyName, 'taxi')} alt="" />
              <span>
                <strong>{taxi.companyName}</strong>
                <small>{taxi.city}</small>
                <span className="hotel-card-stats">
                  <small>{taxi.carClasses.length} classes</small>
                  <small>{taxi.phoneNumber}</small>
                </span>
              </span>
            </button>
            {canManageTaxi && (
              <div className="card-actions">
                <button disabled={submitting} onClick={() => actions.edit(taxi)} type="button">
                  Edit
                </button>
                <button disabled={submitting} onClick={() => actions.delete(taxi.id)} type="button">
                  Delete
                </button>
              </div>
            )}
          </article>
        ))}

        {!loading && taxiServices.length === 0 && <p className="empty">No taxi services yet.</p>}
      </div>
    </aside>
  );
}
