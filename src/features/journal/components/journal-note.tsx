import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { showError } from '@/lib/error-message';
import { cn } from '@/lib/utils';
import { CheckIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useDebouncedCallback } from 'use-debounce';

// How long after the last key press a note is saved
const SAVE_DELAY_MS = 800;

type JournalNoteProps = {
  // The note as the backend has it. It changes when someone else edits it (on another phone).
  savedText?: string;
  placeholder: string;
  maxLength: number;
  // Viewers see the note but can't change it
  editable: boolean;
  onSave: (text: string) => Promise<unknown>;
  // The box's height, e.g. "h-36"
  className?: string;
};

// A journal note that saves itself: there's no Save button. It waits until the user stops typing
// for a moment (a debounce), and sends anything still waiting when the field loses focus or the
// screen closes. "Saved" shows under it once the backend has the latest text.
//
// While the user is writing (the field has focus, or what they wrote isn't saved yet) it shows
// their own text, the draft, so the backend's answer (which comes back trimmed) never jumps the
// cursor or eats a space they just typed. The rest of the time it shows the saved note, so an
// edit made on another phone shows up here too.
export function JournalNote({
  savedText,
  placeholder,
  maxLength,
  editable,
  onSave,
  className,
}: JournalNoteProps) {
  // null: not writing, show the saved note
  const [draft, setDraft] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  // Only read in event handlers, so refs: changing them doesn't need a redraw
  const isFocused = useRef(false);
  const latestSave = useRef(0); // numbers each save, to tell the newest one's answer apart
  const isSaved = useRef(true); // the newest save went through (or there was none)
  const isWaiting = useRef(false); // typed, but the debounce hasn't sent it yet

  const save = useDebouncedCallback((value: string) => {
    const id = latestSave.current + 1;
    latestSave.current = id;
    isSaved.current = false;
    isWaiting.current = false;
    setStatus('saving');
    onSave(value)
      .then(() => {
        // An older save's answer, or more typing is waiting to be sent: the latest text isn't
        // saved yet
        if (id !== latestSave.current || isWaiting.current) return;
        isSaved.current = true;
        setStatus('saved');
        // Done writing: back to the saved note (the same text, as the backend keeps it)
        if (!isFocused.current) setDraft(null);
      })
      .catch((error: unknown) => {
        if (id !== latestSave.current) return;
        // The draft stays, so the text isn't lost: typing again tries again
        setStatus('idle');
        showError("Couldn't save the note", error);
      });
  }, SAVE_DELAY_MS);

  // Closing the screen mid-sentence still saves it
  useEffect(() => () => void save.flush(), [save]);

  if (!editable) {
    return savedText ? <Text className="leading-6">{savedText}</Text> : null;
  }

  return (
    <View className="gap-1">
      {/* textAlignVertical: Android otherwise centres the text in the taller box */}
      <Input
        value={draft ?? savedText ?? ''}
        onFocus={() => {
          isFocused.current = true;
          // Starts from the note as it is now, edits from elsewhere included
          setDraft((current) => current ?? savedText ?? '');
        }}
        onChangeText={(value) => {
          setDraft(value);
          setStatus('idle');
          isWaiting.current = true;
          save(value);
        }}
        onBlur={() => {
          isFocused.current = false;
          save.flush();
          // Nothing left to send: show the saved note again
          if (isSaved.current) setDraft(null);
        }}
        placeholder={placeholder}
        maxLength={maxLength}
        multiline
        textAlignVertical="top"
        className={cn('py-2', className)}
      />
      <View className="h-4 flex-row items-center justify-end gap-1">
        {status === 'saving' ? (
          <Text className="text-xs text-muted-foreground">Saving…</Text>
        ) : null}
        {status === 'saved' ? (
          <>
            <Icon as={CheckIcon} className="size-3 text-muted-foreground" />
            <Text className="text-xs text-muted-foreground">Saved</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}
