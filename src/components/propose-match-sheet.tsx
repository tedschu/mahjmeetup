import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';

import { PlaceAutocompleteInput } from '@/components/place-autocomplete-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { createMatch } from '@/lib/matches';

/** Local wall-clock date, so the default is today where the member is, not UTC. */
function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/**
 * Combines the two fields into an instant. Returns null when either is
 * malformed or the pair is not a real calendar date, so 2026-02-31 is rejected
 * rather than silently rolling into March.
 */
function toTimestamp(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) return null;
  if (!/^\d{1,2}:\d{2}$/.test(time.trim())) return null;

  const [year, month, day] = date.trim().split('-').map(Number);
  const [hour, minute] = time.trim().split(':').map(Number);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59) return null;

  const at = new Date(year, month - 1, day, hour, minute);
  if (at.getMonth() !== month - 1 || at.getDate() !== day) return null;

  return at.toISOString();
}

export function ProposeMatchSheet({
  hostId,
  visible,
  onClose,
  onCreated,
}: {
  hostId: string | null;
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const theme = useTheme();
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState('19:00');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [supplies, setSupplies] = useState(false);
  const [isLeague, setIsLeague] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const at = toTimestamp(date, time);
  const canPost = at !== null && location.trim().length > 0 && !isSaving;

  const reset = () => {
    setDate(todayISO());
    setTime('19:00');
    setLocation('');
    setNotes('');
    setSupplies(false);
    setIsLeague(false);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const post = async () => {
    if (!hostId || !at) return;

    setIsSaving(true);
    try {
      await createMatch(hostId, {
        date_time: at,
        location: location.trim(),
        notes: notes.trim() || null,
        supplies_provided: supplies,
        is_league: isLeague,
      });
      reset();
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not post the match.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ThemedView style={styles.sheet}>
          {/* `handled` so a tap on a venue suggestion is delivered to the row
              instead of being swallowed as a dismiss-the-keyboard gesture. */}
          <ScrollView
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled">
            <ThemedText type="subtitle">Propose a match</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              You take the first seat. Three others can join.
            </ThemedText>

            <View style={styles.pair}>
              <View style={styles.pairItem}>
                <ThemedText type="label" themeColor="textSecondary">Date</ThemedText>
                <TextInput
                  value={date}
                  onChangeText={setDate}
                  placeholder="2026-08-15"
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.input,
                    { color: theme.text, backgroundColor: theme.backgroundElement },
                  ]}
                />
              </View>
              <View style={styles.pairItem}>
                <ThemedText type="label" themeColor="textSecondary">Time</ThemedText>
                <TextInput
                  value={time}
                  onChangeText={setTime}
                  placeholder="19:00"
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.input,
                    { color: theme.text, backgroundColor: theme.backgroundElement },
                  ]}
                />
              </View>
            </View>

            {date.length > 0 && time.length > 0 && at === null ? (
              <ThemedText type="small" style={styles.error}>
                Use YYYY-MM-DD and a 24-hour time, like 2026-08-15 and 19:00.
              </ThemedText>
            ) : null}

            <PlaceAutocompleteInput
              label="Venue"
              value={location}
              onChangeText={setLocation}
              placeholder="Where you are playing"
              hint="Pick a suggestion, or type anything — a living room is a venue too."
              kind="venue"
            />

            <View style={styles.field}>
              <ThemedText type="label" themeColor="textSecondary">Notes</ThemedText>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Parking, buzzer code, what to bring"
                placeholderTextColor={theme.textSecondary}
                multiline
                style={[
                  styles.input,
                  styles.multiline,
                  { color: theme.text, backgroundColor: theme.backgroundElement },
                ]}
              />
            </View>

            <View style={styles.toggle}>
              <ThemedText style={styles.toggleLabel}>I am providing tiles and racks</ThemedText>
              <Switch value={supplies} onValueChange={setSupplies} />
            </View>

            <View style={styles.toggle}>
              <ThemedText style={styles.toggleLabel}>Counts toward the league</ThemedText>
              <Switch value={isLeague} onValueChange={setIsLeague} />
            </View>

            {error ? (
              <ThemedText type="small" style={styles.error}>
                {error}
              </ThemedText>
            ) : null}

            <View style={styles.actions}>
              <Pressable onPress={close} style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="backgroundElement" style={styles.button}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    Cancel
                  </ThemedText>
                </ThemedView>
              </Pressable>

              <Pressable
                onPress={post}
                disabled={!canPost}
                style={({ pressed }) => pressed && styles.pressed}>
                <View
                  style={[
                    styles.button,
                    { backgroundColor: theme.accent },
                    !canPost && styles.disabled,
                  ]}>
                  {isSaving ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <ThemedText type="smallBold" style={styles.postLabel}>
                      Post match
                    </ThemedText>
                  )}
                </View>
              </Pressable>
            </View>
          </ScrollView>
        </ThemedView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    width: '100%',
    maxWidth: MaxContentWidth,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    maxHeight: '90%',
  },
  sheetContent: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  pair: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  pairItem: {
    flex: 1,
    gap: Spacing.one,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    fontSize: 16,
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  toggleLabel: {
    flex: 1,
  },
  error: {
    color: '#c0392b',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  button: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  disabled: {
    opacity: 0.5,
  },
  postLabel: {
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.7,
  },
});
