import RoomPhotoFields from './RoomPhotoFields';
import type { HotelRoomForm, RoomFormActions } from '../hotels.types';

type RoomFormProps = {
  roomForm: HotelRoomForm;
  editingRoomId: number | null;
  submitting: boolean;
  actions: RoomFormActions;
};

export default function RoomForm({ roomForm, editingRoomId, submitting, actions }: RoomFormProps) {
  return (
    <form id="room-edit-form" className="form-grid room-edit-form" onSubmit={(event) => void actions.submit(event)}>
      <h3>{editingRoomId ? 'Edit room' : 'Create room'}</h3>
      <label className="field-label">
        Room type
        <input
          placeholder="Standard room"
          value={roomForm.roomType}
          onChange={(event) => actions.setForm({ ...roomForm, roomType: event.target.value })}
          required
        />
      </label>
      <label className="field-label">
        Capacity
        <input
          min="1"
          placeholder="Guests count"
          type="number"
          value={roomForm.capacity}
          onChange={(event) => actions.setForm({ ...roomForm, capacity: event.target.value })}
          required
        />
      </label>
      <label className="field-label">
        Total rooms
        <input
          min="1"
          placeholder="How many rooms"
          type="number"
          value={roomForm.totalRooms}
          onChange={(event) => actions.setForm({ ...roomForm, totalRooms: event.target.value })}
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
          value={roomForm.pricePerNight}
          onChange={(event) => actions.setForm({ ...roomForm, pricePerNight: event.target.value })}
          required
        />
      </label>
      <label className="field-label">
        Description
        <input
          placeholder="Room description"
          value={roomForm.description}
          onChange={(event) => actions.setForm({ ...roomForm, description: event.target.value })}
          required
        />
      </label>
      <RoomPhotoFields
        imageUrls={roomForm.imageUrls}
        onAdd={actions.addImageUrl}
        onChange={actions.updateImageUrl}
        onRemove={actions.removeImageUrl}
        onUpload={actions.uploadImage}
        submitting={submitting}
      />
      <button className="primary" disabled={submitting} type="submit">
        {editingRoomId ? 'Save room' : 'Create room'}
      </button>
      <button className="link-button" onClick={actions.cancel} type="button">
        Cancel
      </button>
    </form>
  );
}
