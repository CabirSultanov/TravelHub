import type { ChangeEvent } from 'react';

type PhotoFieldsProps = {
  title: string;
  imageUrls: string[];
  onChange: (index: number, imageUrl: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpload: (file: File) => void;
  submitting: boolean;
};

export default function PhotoFields({
  title,
  imageUrls,
  onChange,
  onAdd,
  onRemove,
  onUpload,
  submitting,
}: PhotoFieldsProps) {
  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file) {
      onUpload(file);
    }

    event.target.value = '';
  }

  return (
    <div className="photo-fields">
      <strong>{title}</strong>
      <label className={`small-primary-button image-upload-button${submitting ? ' is-disabled' : ''}`}>
        Choose photo
        <input accept="image/jpeg,image/png,image/webp" disabled={submitting} onChange={handleUpload} type="file" />
      </label>
      {imageUrls.map((imageUrl, index) => (
        <div className="image-url-row" key={index}>
          {imageUrl && <img className="room-image-preview" src={imageUrl} alt="" />}
          <input
            placeholder="Image URL"
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
