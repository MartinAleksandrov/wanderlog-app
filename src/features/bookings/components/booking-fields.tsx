import { DateField } from '@/components/date-field';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { addDays, daysBetween } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { BOOKING_NOTES_MAX_LENGTH, BOOKING_TEXT_MAX_LENGTH } from '@convex/lib/limits';
import type { Coordinates } from '@convex/schema';
import { PlusIcon, XIcon } from 'lucide-react-native';
import { Children } from 'react';
import { Pressable, View } from 'react-native';
import { BOOKING_KINDS, TRANSPORT_MODE_ORDER, TRANSPORT_MODES } from '../booking-kinds';
import type { BookingDraft } from '../booking-draft';
import { nightsLabel, whenLabels } from '../booking-format';
import { StaySearch } from './stay-search';
import { TimeField } from './time-field';

type FieldsProps = {
  draft: BookingDraft;
  onChange: (fields: Partial<BookingDraft>) => void;
};

// The booking form's fields, in three parts: what was booked (different per type), when, and what
// every booking has (code, price, notes). The screen around them loads, saves and deletes.

// What was booked: the hotel, the flight, the train or rental car, the tickets
export function WhatFields({ draft, onChange, near }: FieldsProps & { near?: Coordinates }) {
  switch (draft.type) {
    case 'stay':
      return (
        <>
          <Field label="Where you're staying">
            <StaySearch value={draft} near={near} onChange={onChange} />
          </Field>
          {/* Picked from Google: the address and phone came with it */}
          {draft.providerPlaceId === undefined ? (
            <>
              <TextField
                label="Address"
                value={draft.address}
                onChange={(address) => onChange({ address })}
                optional
              />
              <TextField
                label="Phone"
                value={draft.phone}
                onChange={(phone) => onChange({ phone })}
                keyboardType="phone-pad"
                optional
              />
            </>
          ) : null}
        </>
      );
    case 'flight':
      return (
        <>
          <Pair>
            <TextField
              label="Flight number"
              value={draft.flightNumber}
              onChange={(flightNumber) => onChange({ flightNumber })}
              placeholder="LH 1234"
              autoCapitalize="characters"
            />
            <TextField
              label="Airline"
              value={draft.airline}
              onChange={(airline) => onChange({ airline })}
              placeholder="Lufthansa"
              optional
            />
          </Pair>
          <Pair>
            <TextField
              label="From"
              value={draft.from}
              onChange={(from) => onChange({ from })}
              placeholder="SOF"
            />
            <TextField
              label="To"
              value={draft.to}
              onChange={(to) => onChange({ to })}
              placeholder="LIS"
            />
          </Pair>
        </>
      );
    case 'transport': {
      const isCar = draft.mode === 'car';
      return (
        <>
          <Field label="Type">
            <View className="flex-row flex-wrap gap-2">
              {TRANSPORT_MODE_ORDER.map((mode) => (
                <Chip
                  key={mode}
                  label={TRANSPORT_MODES[mode].label}
                  selected={draft.mode === mode}
                  onPress={() => onChange({ mode })}
                />
              ))}
            </View>
          </Field>
          <TextField
            label={isCar ? 'Rental company' : 'Company or number'}
            value={draft.name}
            onChange={(name) => onChange({ name })}
            placeholder={isCar ? 'Avis, Sixt…' : 'Eurostar 9014'}
          />
          <Pair>
            <TextField
              label={isCar ? 'Pick-up at' : 'From'}
              value={draft.from}
              onChange={(from) => onChange({ from })}
              optional
            />
            <TextField
              label={isCar ? 'Drop-off at' : 'To'}
              value={draft.to}
              onChange={(to) => onChange({ to })}
              optional
            />
          </Pair>
        </>
      );
    }
    case 'activity':
      return (
        <>
          <TextField
            label="What's booked"
            value={draft.name}
            onChange={(name) => onChange({ name })}
            placeholder="Museum tickets, a tour, dinner…"
          />
          <TextField
            label="Where"
            value={draft.address}
            onChange={(address) => onChange({ address })}
            optional
          />
        </>
      );
  }
}

// When: the start, and the end (a stay always has one; for the others it's optional). Changing
// the start keeps the end after it: a stay keeps its number of nights.
export function WhenFields({ draft, onChange }: FieldsProps) {
  const labels = whenLabels(draft.type, draft.mode);
  const isStay = draft.type === 'stay';
  // A journey may land on the day before it leaves, in local time (see convex/bookings.ts)
  const isJourney = draft.type === 'flight' || draft.type === 'transport';

  function changeStartDate(startDate: string) {
    if (draft.endDate === '' || draft.endDate >= startDate) {
      onChange({ startDate });
      return;
    }
    const length = isStay ? Math.max(1, daysBetween(draft.startDate, draft.endDate)) : 0;
    onChange({ startDate, endDate: addDays(startDate, length) });
  }

  return (
    <>
      {/* DateField takes the room the fixed-width TimeField leaves */}
      <View className="flex-row items-end gap-3">
        <DateField label={labels.start} value={draft.startDate} onChange={changeStartDate} />
        <TimeField
          label="Time"
          value={draft.startTime}
          onChange={(startTime) => onChange({ startTime })}
        />
      </View>
      {draft.endDate === '' ? (
        <Button
          variant="ghost"
          className="self-start"
          onPress={() => onChange({ endDate: draft.startDate })}
        >
          <Icon as={PlusIcon} className="size-4" />
          <Text>Add {labels.endNoun}</Text>
        </Button>
      ) : (
        <View className="flex-row items-end gap-3">
          <DateField
            label={labels.end}
            value={draft.endDate}
            minimumDate={isJourney ? addDays(draft.startDate, -1) : draft.startDate}
            onChange={(endDate) => onChange({ endDate })}
          />
          <TimeField
            label="Time"
            value={draft.endTime}
            onChange={(endTime) => onChange({ endTime })}
          />
          {!isStay ? (
            <Button
              variant="ghost"
              size="icon"
              onPress={() => onChange({ endDate: '', endTime: '' })}
              aria-label={`Remove ${labels.endNoun}`}
            >
              <Icon as={XIcon} className="size-4 text-muted-foreground" />
            </Button>
          ) : null}
        </View>
      )}
      {isStay && draft.endDate !== '' ? (
        <Text variant="muted">{nightsLabel(draft.startDate, draft.endDate)}</Text>
      ) : null}
      {draft.type === 'flight' ? (
        <Pair>
          <TextField
            label="Terminal"
            value={draft.terminal}
            onChange={(terminal) => onChange({ terminal })}
            optional
          />
          <TextField
            label="Seat"
            value={draft.seat}
            onChange={(seat) => onChange({ seat })}
            autoCapitalize="characters"
            optional
          />
        </Pair>
      ) : null}
    </>
  );
}

// What every booking has: its code, its price and notes
export function CommonFields({ draft, onChange }: FieldsProps) {
  return (
    <>
      <TextField
        label="Booking code"
        value={draft.confirmationCode}
        onChange={(confirmationCode) => onChange({ confirmationCode })}
        placeholder="ABC123"
        autoCapitalize="characters"
        optional
      />
      <Field label="Price" optional>
        <View className="flex-row gap-2">
          <Input
            value={draft.amount}
            onChangeText={(amount) => onChange({ amount })}
            placeholder="0.00"
            keyboardType="decimal-pad"
            className="flex-1"
          />
          <Input
            value={draft.currency}
            onChangeText={(currency) => onChange({ currency: currency.toUpperCase() })}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={3}
            aria-label="Currency"
            className="w-20 text-center"
          />
        </View>
      </Field>
      <Field label="Notes" optional>
        {/* textAlignVertical: Android otherwise centres the text in the taller box */}
        <Input
          value={draft.notes}
          onChangeText={(notes) => onChange({ notes })}
          maxLength={BOOKING_NOTES_MAX_LENGTH}
          placeholder={BOOKING_KINDS[draft.type].notesHint}
          multiline
          textAlignVertical="top"
          className="h-24 py-2"
        />
      </Field>
    </>
  );
}

// A label over its input. Optional fields say so, so required ones need no asterisk.
function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium">
        {label}
        {optional ? (
          <Text className="text-sm font-normal text-muted-foreground"> (optional)</Text>
        ) : null}
      </Text>
      {children}
    </View>
  );
}

function TextField({
  label,
  value,
  onChange,
  optional,
  ...inputProps
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
} & Pick<React.ComponentProps<typeof Input>, 'placeholder' | 'autoCapitalize' | 'keyboardType'>) {
  return (
    <Field label={label} optional={optional}>
      <Input
        value={value}
        onChangeText={onChange}
        maxLength={BOOKING_TEXT_MAX_LENGTH}
        autoCorrect={false}
        {...inputProps}
      />
    </Field>
  );
}

// Two fields side by side, each half the width
function Pair({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-row gap-3">
      {Children.map(children, (child) => (
        <View className="flex-1">{child}</View>
      ))}
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={cn(
        'rounded-full border px-3 py-1.5',
        selected ? 'border-primary bg-primary' : 'border-border bg-card active:bg-accent',
      )}
    >
      <Text className={cn('text-sm', selected && 'text-primary-foreground')}>{label}</Text>
    </Pressable>
  );
}
