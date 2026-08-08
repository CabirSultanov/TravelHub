type RoomPhotoFieldsProps = {
  imageUrls: string[];
  onChange: (index: number, imageUrl: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

export default function RoomPhotoFields({ imageUrls, onChange, onAdd, onRemove }: RoomPhotoFieldsProps) {
  return (
    <div className="room-photo-fields">
      <strong>Room photos</strong>
      {imageUrls.map((imageUrl, index) => (
        <div className="image-url-row" key={index}>
          <input
            placeholder="Image URL"
            type="url"
            value={imageUrl}
            onChange={(event) => onChange(index, event.target.value)}
          />
          <button disabled={imageUrls.length === 1} onClick={() => onRemove(index)} type="button">
            Remove
          </button>
        </div>
      ))}
      <button className="link-button" onClick={onAdd} type="button">
        Add photo
      </button>
    </div>
  );
}
