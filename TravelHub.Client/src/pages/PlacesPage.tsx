import type { Place } from '../types';

type PlacesPageProps = {
  places: Place[];
  loading: boolean;
  fallbackImage: (seed: string, topic?: string) => string;
};

export default function PlacesPage({ places, loading, fallbackImage }: PlacesPageProps) {
  return (
    <section className="page-section">
      <div className="section-title">
        <div>
          <p className="eyebrow">Places</p>
          <h2>Interesting places</h2>
        </div>
        <span>{places.length} places</span>
      </div>

      <div className="card-grid">
        {places.map((place) => (
          <article className="service-card" key={place.id}>
            <img src={place.imageUrl || fallbackImage(place.name, 'azerbaijan landmark')} alt="" />
            <strong>{place.name}</strong>
            <span>{place.city}</span>
            <small>{place.description}</small>
          </article>
        ))}

        {!loading && places.length === 0 && <p className="empty">No places yet.</p>}
      </div>
    </section>
  );
}
