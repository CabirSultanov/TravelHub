import { DriverPlaceholder } from '@/components/DriverPlaceholder';

export default function HistoryScreen() {
  return (
    <DriverPlaceholder
      message="Your completed trips will be kept here."
      statusMessage="Your ride history will appear after your first completed trip."
      statusTitle="No completed rides"
      title="Ride history"
    />
  );
}
