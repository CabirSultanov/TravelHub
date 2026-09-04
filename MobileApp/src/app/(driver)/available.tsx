import { DriverPlaceholder } from '@/components/DriverPlaceholder';

export default function AvailableScreen() {
  return (
    <DriverPlaceholder
      message="New ride requests will appear here when they are ready for you."
      statusMessage="Check back soon for your next trip."
      statusTitle="No rides available"
      title="Available rides"
    />
  );
}
