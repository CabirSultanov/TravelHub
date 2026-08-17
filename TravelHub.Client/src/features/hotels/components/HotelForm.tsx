import type { ChangeEvent } from 'react';
import RoomPhotoFields from './RoomPhotoFields';
import type { HotelForm as HotelFormState, HotelFormActions } from '../hotels.types';

type HotelFormProps = {
  hotelForm: HotelFormState;
  editingHotelId: number | null;
  submitting: boolean;
  actions: HotelFormActions;
};

export default function HotelForm({ hotelForm, editingHotelId, submitting, actions }: HotelFormProps) {
  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file) {
      actions.uploadImage(file);
    }

    event.target.value = '';
  }

  return (
    <form id="hotel-edit-form" className="form-grid hotel-create-form" onSubmit={(event) => void actions.submit(event)}>
      <h3>{editingHotelId ? 'Edit hotel details' : 'Hotel details'}</h3>
      <label className="field-label">
        Name
        <input
          placeholder="Hotel name"
          value={hotelForm.name}
          onChange={(event) => actions.setForm({ ...hotelForm, name: event.target.value })}
          required
        />
      </label>
      <label className="field-label">
        City
        <input
          placeholder="City"
          value={hotelForm.city}
          onChange={(event) => actions.setForm({ ...hotelForm, city: event.target.value })}
          required
        />
      </label>
      <label className="field-label">
        Description
        <input
          placeholder="Hotel description"
          value={hotelForm.description}
          onChange={(event) => actions.setForm({ ...hotelForm, description: event.target.value })}
        />
      </label>
      <div className="field-label hotel-image-field">
        Hotel image
        {hotelForm.imageUrl && <img className="hotel-image-preview" src={hotelForm.imageUrl} alt="" />}
        <div className="hotel-image-upload-row">
          <input placeholder="No image selected" readOnly value={hotelForm.imageUrl} />
          <label className={`small-primary-button image-upload-button${submitting ? ' is-disabled' : ''}`}>
            Choose photo
            <input accept="image/jpeg,image/png,image/webp" disabled={submitting} onChange={handleImageChange} type="file" />
          </label>
        </div>
      </div>

      {editingHotelId === null && (
        <>
          <div className="room-types-header">
            <h3>Room types</h3>
            <span>{hotelForm.rooms.reduce((total, room) => total + Number(room.capacity || 0) * Number(room.totalRooms || 0), 0)} places</span>
          </div>

          {hotelForm.rooms.map((room, index) => (
            <section className="room-form-panel" key={index}>
              <div className="section-title">
                <h3>Room type {index + 1}</h3>
                <span>{Number(room.capacity || 0) * Number(room.totalRooms || 0)} places</span>
              </div>
              <label className="field-label">
                Room type
                <input
                  placeholder="Standard room"
                  value={room.roomType}
                  onChange={(event) => actions.updateRoom(index, { roomType: event.target.value })}
                  required
                />
              </label>
              <label className="field-label">
                Capacity
                <input
                  min="1"
                  placeholder="Guests count"
                  type="number"
                  value={room.capacity}
                  onChange={(event) => actions.updateRoom(index, { capacity: event.target.value })}
                  required
                />
              </label>
              <label className="field-label">
                Total rooms
                <input
                  min="1"
                  placeholder="How many rooms"
                  type="number"
                  value={room.totalRooms}
                  onChange={(event) => actions.updateRoom(index, { totalRooms: event.target.value })}
                  required
                />
              </label>
              <label className="field-label">
                Price per night
                <input
                  min="0"
                  placeholder="Price"
                  step="0.01"
                  type="number"
                  value={room.pricePerNight}
                  onChange={(event) => actions.updateRoom(index, { pricePerNight: event.target.value })}
                  required
                />
              </label>
              <label className="field-label">
                Description
                <input
                  placeholder="Room description"
                  value={room.description}
                  onChange={(event) => actions.updateRoom(index, { description: event.target.value })}
                  required
                />
              </label>
              <RoomPhotoFields
                imageUrls={room.imageUrls}
                onAdd={() => actions.addRoomImageUrl(index)}
                onChange={(imageIndex, imageUrl) => actions.updateRoomImageUrl(index, imageIndex, imageUrl)}
                onRemove={(imageIndex) => actions.removeRoomImageUrl(index, imageIndex)}
                onUpload={(file) => actions.uploadRoomImage(index, file)}
                submitting={submitting}
              />
              <button
                className="link-button"
                disabled={hotelForm.rooms.length <= 2}
                onClick={() => actions.removeRoom(index)}
                type="button"
              >
                Remove room type
              </button>
            </section>
          ))}

          <button className="link-button" onClick={actions.addRoom} type="button">
            Add room type
          </button>
        </>
      )}

      <button className="primary" disabled={submitting} type="submit">
        {editingHotelId ? 'Save hotel' : 'Create hotel'}
      </button>
      <button className="link-button" disabled={submitting} onClick={actions.cancel} type="button">
        Cancel
      </button>
    </form>
  );
}
