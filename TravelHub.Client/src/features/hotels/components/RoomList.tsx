import type { HotelRoom } from '../../../types';
import { formatMoney } from '../../../utils/formatting';
import { roomImageUrls, roomMainImage } from '../../../utils/images';
import type { HotelsFeatureActions } from '../hotels.types';

type RoomListProps = {
  rooms: HotelRoom[];
  selectedRoom: HotelRoom | null;
  roomsLoading: boolean;
  canManageHotels: boolean;
  submitting: boolean;
  actions: HotelsFeatureActions['roomList'];
};

export default function RoomList({
  rooms,
  selectedRoom,
  roomsLoading,
  canManageHotels,
  submitting,
  actions,
}: RoomListProps) {
  return (
    <>
      <div className="rooms">
        {rooms.map((room) => (
          <article className={`room-card ${selectedRoom?.id === room.id ? 'active' : ''}`} key={room.id}>
            <button
              className="room-card-main"
              disabled={!room.isAvailable}
              onClick={() => actions.select(room)}
              type="button"
            >
              <img src={roomMainImage(room)} alt="" />
              <span>
                <strong>{room.roomType}</strong>
                <small className="room-facts">
                  <span>Guests: {room.capacity}</span>
                  <span>Rooms: {room.totalRooms}</span>
                  <span>Price: {formatMoney(room.pricePerNight)} / night</span>
                </small>
              </span>
            </button>
            {canManageHotels && (
              <div className="card-actions">
                <button disabled={submitting} onClick={() => actions.edit(room)} type="button">
                  Edit
                </button>
                <button
                  disabled={submitting}
                  onClick={() => actions.requestDelete({ kind: 'room', id: room.id, name: room.roomType })}
                  type="button"
                >
                  Delete
                </button>
              </div>
            )}
          </article>
        ))}
      </div>

      {roomsLoading && <p className="empty">Loading rooms...</p>}
      {!roomsLoading && rooms.length === 0 && <p className="empty">No rooms for this hotel yet.</p>}
    </>
  );
}

export function RoomPhotoStrip({ room }: { room: HotelRoom | null }) {
  if (!room) {
    return null;
  }

  const imageUrls = roomImageUrls(room);

  return (
    <div className="room-photo-strip">
      {imageUrls.length > 0 && (
        <div className="room-photo-gallery">
          {imageUrls.map((imageUrl) => (
            <img src={imageUrl} alt="" key={imageUrl} />
          ))}
        </div>
      )}
      <div className="room-detail-copy">
        <h3>{room.roomType}</h3>
        {room.description && (
          <p>{room.description}</p>
        )}
      </div>
    </div>
  );
}
