import { DriverPlaceholder } from '@/components/DriverPlaceholder';

export default function ActiveScreen() {
  return (
    <DriverPlaceholder
      message="Your accepted ride will stay here until it is completed."
      statusMessage="Accept an available ride to get started."
      statusTitle="No active ride"
      title="Active ride"
    />
  );
}
