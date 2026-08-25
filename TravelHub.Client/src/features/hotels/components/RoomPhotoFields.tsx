import PhotoFields from './PhotoFields';

type RoomPhotoFieldsProps = {
  imageUrls: string[];
  onChange: (index: number, imageUrl: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpload: (file: File) => void;
  submitting: boolean;
};

export default function RoomPhotoFields({
  imageUrls,
  onChange,
  onAdd,
  onRemove,
  onUpload,
  submitting,
}: RoomPhotoFieldsProps) {
  return (
    <PhotoFields
      title="Room photos"
      imageUrls={imageUrls}
      onAdd={onAdd}
      onChange={onChange}
      onRemove={onRemove}
      onUpload={onUpload}
      submitting={submitting}
    />
  );
}
