import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { toClockTime } from '@/lib/dates';
import { cn } from '@/lib/utils';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { ClockIcon, XIcon } from 'lucide-react-native';
import { Platform, Pressable, View } from 'react-native';

type TimeFieldProps = {
  label: string;
  // 'HH:mm', or '' for no time
  value: string;
  onChange: (value: string) => void;
};

// An optional time next to a date field ("Check-in 15:00"), with the phone's own time picker on a
// 24-hour clock, like tickets print it. Empty until picked; the ✕ takes the time off again.
export function TimeField({ label, value, onChange }: TimeFieldProps) {
  // The picker needs a full date; only its hours and minutes matter. Noon when nothing is set.
  const [hours = 12, minutes = 0] = value ? value.split(':').map(Number) : [];
  const shown = new Date(2000, 0, 1, hours, minutes);
  const pick = (_event: unknown, picked: Date) => onChange(toClockTime(picked));

  return (
    <View className="w-32 gap-1.5">
      <Text className="text-sm font-medium">{label}</Text>
      {Platform.OS === 'ios' && value ? (
        <View className="h-10 flex-row items-center">
          <DateTimePicker value={shown} mode="time" display="compact" onValueChange={pick} />
          <ClearButton label={label} onPress={() => onChange('')} />
        </View>
      ) : (
        <View className="h-10 flex-row items-center rounded-md border border-input bg-background">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label}, ${value || 'no time set'}`}
            // iOS opens its inline picker once a time is set; Android always uses the dialog
            onPress={() =>
              Platform.OS === 'ios'
                ? onChange('12:00')
                : DateTimePickerAndroid.open({
                    value: shown,
                    mode: 'time',
                    is24Hour: true,
                    // Called only when the user picks a time (OK); Cancel just closes the dialog
                    onValueChange: pick,
                  })
            }
            className="h-full flex-1 flex-row items-center gap-2 rounded-md px-3 active:bg-accent"
          >
            <Icon as={ClockIcon} className="size-4 text-muted-foreground" />
            <Text className={cn('text-sm', !value && 'text-muted-foreground')}>
              {value || 'Time'}
            </Text>
          </Pressable>
          {value ? <ClearButton label={label} onPress={() => onChange('')} /> : null}
        </View>
      )}
    </View>
  );
}

function ClearButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-9"
      onPress={onPress}
      aria-label={`Clear the ${label.toLowerCase()}`}
    >
      <Icon as={XIcon} className="size-4 text-muted-foreground" />
    </Button>
  );
}
