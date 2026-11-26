import { DateField } from '@/components/date-field';
import { Text } from '@/components/ui/text';
import { daysBetween } from '@/lib/dates';
import { TRIP_MAX_DAYS } from '@convex/lib/limits';
import { View } from 'react-native';
import { latestEndDate, withStartDate, type TripDates } from '../trip-days';

type TripDatesFieldProps = {
  value: TripDates;
  onChange: (dates: TripDates) => void;
};

// A trip's first and last day side by side, and how many days that makes. Shared by the new-trip
// and edit-trip pop-ups, so both follow the same rules: the end is on or after the start and at
// most TRIP_MAX_DAYS days long (the picker greys out other days; the backend checks the same), and
// moving the start keeps the trip within that (withStartDate).
export function TripDatesField({ value, onChange }: TripDatesFieldProps) {
  const { startDate, endDate } = value;
  const days = daysBetween(startDate, endDate) + 1;

  return (
    <View className="gap-2">
      <View className="flex-row gap-3">
        <DateField
          label="Start"
          value={startDate}
          onChange={(start) => onChange(withStartDate(value, start))}
        />
        <DateField
          label="End"
          value={endDate}
          minimumDate={startDate}
          maximumDate={latestEndDate(startDate)}
          onChange={(end) => onChange({ startDate, endDate: end })}
        />
      </View>
      {/* At the limit, say why the picker stops there. A trip saved before the limit existed can
          be longer: then it also says why it can't be saved as it is. */}
      <Text variant="muted">
        {days === 1 ? '1 day' : `${days} days`}
        {days >= TRIP_MAX_DAYS ? ` · trips can be up to ${TRIP_MAX_DAYS} days` : ''}
      </Text>
    </View>
  );
}
