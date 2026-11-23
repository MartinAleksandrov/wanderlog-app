import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { CalendarDaysIcon } from 'lucide-react-native';
import { Platform, Pressable, View } from 'react-native';
import { formatDate, fromIsoDate, toIsoDate } from '../trip-dates';

type DateFieldProps = {
  label: string;
  // 'YYYY-MM-DD'
  value: string;
  minimumDate?: string;
  onChange: (value: string) => void;
};

// A labelled date input using the phone's own date picker. The picker works differently per
// platform: Android opens it as a dialog from a function call, iOS shows a compact inline button.
export function DateField({ label, value, minimumDate, onChange }: DateFieldProps) {
  const date = fromIsoDate(value);
  const minimum = minimumDate ? fromIsoDate(minimumDate) : undefined;

  return (
    <View className="flex-1 gap-1.5">
      <Text className="text-sm font-medium">{label}</Text>
      {Platform.OS === 'ios' ? (
        <DateTimePicker
          value={date}
          mode="date"
          display="compact"
          minimumDate={minimum}
          onValueChange={(_event, picked) => onChange(toIsoDate(picked))}
          style={{ alignSelf: 'flex-start' }}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} date, ${formatDate(value)}`}
          onPress={() =>
            DateTimePickerAndroid.open({
              value: date,
              mode: 'date',
              minimumDate: minimum,
              // Called only when the user picks a date (OK); Cancel just closes the dialog
              onValueChange: (_event, picked) => onChange(toIsoDate(picked)),
            })
          }
          className="h-10 flex-row items-center gap-2 rounded-md border border-input bg-background px-3 active:bg-accent"
        >
          <Icon as={CalendarDaysIcon} className="size-4 text-muted-foreground" />
          <Text className="text-sm">{formatDate(value)}</Text>
        </Pressable>
      )}
    </View>
  );
}
