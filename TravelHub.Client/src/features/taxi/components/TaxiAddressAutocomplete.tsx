import { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { BAKU_CENTER } from '../googleMapsConfig';
import type { Coordinates, TaxiPointMode } from '../taxi.types';

type TaxiAddressAutocompleteProps = {
  id: string;
  label: string;
  mode: TaxiPointMode;
  placeholder: string;
  value: string;
  onPlaceSelect: (mode: TaxiPointMode, coordinates: Coordinates, address: string) => void;
  onTextChange: (mode: TaxiPointMode, address: string) => void;
};

export default function TaxiAddressAutocomplete({
  id,
  label,
  mode,
  placeholder,
  value,
  onPlaceSelect,
  onTextChange,
}: TaxiAddressAutocompleteProps) {
  const placesLibrary = useMapsLibrary('places');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const elementRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);
  const modeRef = useRef(mode);
  const onPlaceSelectRef = useRef(onPlaceSelect);
  const onTextChangeRef = useRef(onTextChange);
  const selectionRequestIdRef = useRef(0);
  const syncingRef = useRef(false);
  const selectingRef = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    modeRef.current = mode;
    onPlaceSelectRef.current = onPlaceSelect;
    onTextChangeRef.current = onTextChange;
  }, [mode, onPlaceSelect, onTextChange]);

  useEffect(() => {
    if (!placesLibrary || !containerRef.current || elementRef.current) {
      return;
    }

    const autocomplete = new placesLibrary.PlaceAutocompleteElement({
      includedRegionCodes: ['az'],
      locationBias: {
        center: BAKU_CENTER,
        radius: 70000,
      },
      placeholder,
      requestedLanguage: 'en',
      requestedRegion: 'az',
    });
    autocomplete.id = id;
    autocomplete.className = 'taxi-address-autocomplete-input';
    autocomplete.value = value;
    elementRef.current = autocomplete;

    function handleInput() {
      if (syncingRef.current || selectingRef.current || !elementRef.current) {
        return;
      }

      onTextChangeRef.current(modeRef.current, elementRef.current.value);
    }

    async function handleSelect(event: Event) {
      const requestId = ++selectionRequestIdRef.current;

      try {
        selectingRef.current = true;
        setError('');

        const place = (event as google.maps.places.PlacePredictionSelectEvent).placePrediction.toPlace();
        const { place: fetchedPlace } = await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location'],
        });

        if (selectionRequestIdRef.current !== requestId) {
          return;
        }

        if (!fetchedPlace.location) {
          setError('Select a place with a map location.');
          return;
        }

        const address = fetchedPlace.formattedAddress || fetchedPlace.displayName || elementRef.current?.value || placeholder;
        onPlaceSelectRef.current(
          modeRef.current,
          {
            latitude: fetchedPlace.location.lat(),
            longitude: fetchedPlace.location.lng(),
          },
          address,
        );
      } catch {
        if (selectionRequestIdRef.current === requestId) {
          setError('Unable to load this address. Please choose another suggestion.');
        }
      } finally {
        window.setTimeout(() => {
          selectingRef.current = false;
        }, 0);
      }
    }

    autocomplete.addEventListener('input', handleInput);
    autocomplete.addEventListener('gmp-select', handleSelect);
    containerRef.current.replaceChildren(autocomplete);

    return () => {
      autocomplete.removeEventListener('input', handleInput);
      autocomplete.removeEventListener('gmp-select', handleSelect);
      autocomplete.remove();
      elementRef.current = null;
    };
  }, [id, placeholder, placesLibrary]);

  useEffect(() => {
    if (!elementRef.current || elementRef.current.value === value) {
      return;
    }

    syncingRef.current = true;
    elementRef.current.value = value;
    window.setTimeout(() => {
      syncingRef.current = false;
    }, 0);
  }, [value]);

  return (
    <label className="field-label taxi-address-field" htmlFor={id}>
      {label}
      <div ref={containerRef} className="taxi-address-autocomplete">
        {!placesLibrary && <input placeholder={placeholder} value={value} readOnly />}
      </div>
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}
