import type { MouseEvent } from 'react';
import type { TaxiPointMode } from '../taxi.types';

type TaxiMapPoint = {
  x: number;
  y: number;
};

type TaxiMapProps = {
  pickup: TaxiMapPoint;
  dropoff: TaxiMapPoint;
  mode: TaxiPointMode;
  onModeChange: (mode: TaxiPointMode) => void;
  onPointChange: (event: MouseEvent<HTMLButtonElement>) => void;
};

export default function TaxiMap({ pickup, dropoff, mode, onModeChange, onPointChange }: TaxiMapProps) {
  return (
    <div className="taxi-map-panel">
      <div className="booking-mode taxi-point-mode">
        <button className={mode === 'pickup' ? 'active' : ''} onClick={() => onModeChange('pickup')} type="button">
          Pickup
        </button>
        <button className={mode === 'dropoff' ? 'active' : ''} onClick={() => onModeChange('dropoff')} type="button">
          Dropoff
        </button>
      </div>
      <button className="taxi-map" onClick={onPointChange} type="button" aria-label="Demo taxi map">
        <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 100">
          <line x1={pickup.x} y1={pickup.y} x2={dropoff.x} y2={dropoff.y} />
        </svg>
        <span className="taxi-marker pickup" style={{ left: `${pickup.x}%`, top: `${pickup.y}%` }}>
          P
        </span>
        <span className="taxi-marker dropoff" style={{ left: `${dropoff.x}%`, top: `${dropoff.y}%` }}>
          D
        </span>
      </button>
    </div>
  );
}
