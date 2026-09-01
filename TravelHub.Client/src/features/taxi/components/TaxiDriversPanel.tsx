import type { TaxiDriverManagement } from '../taxi.types';

export default function TaxiDriversPanel({ management, submitting }: { management: TaxiDriverManagement; submitting: boolean }) {
  return (
    <section className="taxi-drivers-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">Team</p>
          <h3>Drivers</h3>
        </div>
        <span>{management.drivers.length} assigned</span>
      </div>

      <label className="field-label">
        Add a driver
        <input
          aria-label="Search driver candidates"
          onChange={(event) => management.setSearch(event.target.value)}
          placeholder="Search users..."
          value={management.search}
        />
      </label>

      <div className="driver-list">
        {management.candidates.map((candidate) => (
          <article className="driver-row" key={candidate.id}>
            <span><strong>{candidate.name}</strong><small>{candidate.email}</small></span>
            <button disabled={submitting} onClick={() => void management.assign(candidate.id)} type="button">Add driver</button>
          </article>
        ))}
        {management.candidates.length === 0 && <p className="empty">No eligible users found.</p>}
      </div>

      <h4>Current drivers</h4>
      <div className="driver-list">
        {management.drivers.map((driver) => (
          <article className="driver-row" key={driver.id}>
            <span><strong>{driver.name}</strong><small>{driver.email}</small></span>
            <button className="danger-card-button" disabled={submitting} onClick={() => void management.remove(driver.id)} type="button">Remove</button>
          </article>
        ))}
        {management.drivers.length === 0 && <p className="empty">No drivers assigned yet.</p>}
      </div>
    </section>
  );
}
