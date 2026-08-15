import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DisplayFont, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { enterMatchScores, formatWhen, type Match } from '@/lib/matches';

/** Accepts a whole number, optionally negative. Rejects blanks and stray text. */
function parseScore(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

export function ScoreEntrySheet({
  match,
  visible,
  onClose,
  onSaved,
}: {
  match: Match | null;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const theme = useTheme();
  // Prefilled with whatever is already recorded, so correcting one number does
  // not mean retyping the whole card. The caller keys this component by match,
  // so the initialiser re-runs for each one.
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (match?.players ?? []).map((player) => [
        player.player_id,
        player.score === null ? '' : String(player.score),
      ])
    )
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!match) return null;

  const rows = match.players;
  const allValid = rows.every((row) => parseScore(drafts[row.player_id] ?? '') !== null);
  const isCorrection = rows.some((row) => row.score !== null);

  const close = () => {
    setError(null);
    onClose();
  };

  const save = async () => {
    const scores = rows.map((row) => ({
      player_id: row.player_id,
      score: parseScore(drafts[row.player_id] ?? '') ?? 0,
    }));

    setIsSaving(true);
    try {
      await enterMatchScores(match.id, scores);
      setError(null);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the scores.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ThemedView style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.sheetContent}>
            <ThemedText type="subtitle">{isCorrection ? 'Edit scores' : 'Enter scores'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {match.location} · {formatWhen(match.date_time)}
            </ThemedText>

            <View style={styles.rows}>
              {rows.map((row) => {
                const raw = drafts[row.player_id] ?? '';
                const invalid = raw.trim().length > 0 && parseScore(raw) === null;

                return (
                  <View key={row.player_id} style={styles.row}>
                    <ThemedText style={styles.playerName} numberOfLines={1}>
                      {row.profile?.name ?? 'Member'}
                    </ThemedText>
                    <TextInput
                      value={raw}
                      onChangeText={(next) =>
                        setDrafts((current) => ({ ...current, [row.player_id]: next }))
                      }
                      keyboardType="numbers-and-punctuation"
                      inputMode="numeric"
                      placeholder={row.score === null ? '0' : String(row.score)}
                      placeholderTextColor={theme.textSecondary}
                      style={[
                        styles.input,
                        {
                          color: theme.text,
                          backgroundColor: theme.backgroundElement,
                          borderColor: invalid ? theme.danger : 'transparent',
                        },
                      ]}
                    />
                  </View>
                );
              })}
            </View>

            {error ? (
              <ThemedText type="small" style={{ color: theme.danger }}>
                {error}
              </ThemedText>
            ) : null}

            <ThemedText type="small" themeColor="textSecondary">
              {isCorrection
                ? 'Saving replaces the recorded card. The standings update automatically.'
                : 'Saving records the card and marks the match completed. The standings update automatically.'}
            </ThemedText>

            <View style={styles.actions}>
              <Pressable onPress={close} style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="backgroundElement" style={styles.button}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    Cancel
                  </ThemedText>
                </ThemedView>
              </Pressable>

              <Pressable
                onPress={save}
                disabled={!allValid || isSaving}
                style={({ pressed }) => pressed && styles.pressed}>
                <View
                  style={[
                    styles.button,
                    { backgroundColor: theme.accentButton },
                    (!allValid || isSaving) && styles.disabled,
                  ]}>
                  {isSaving ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <ThemedText type="smallBold" style={styles.saveLabel}>
                      Save scores
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
    maxHeight: '85%',
  },
  sheetContent: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  rows: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  playerName: {
    flex: 1,
  },
  input: {
    fontFamily: DisplayFont,
    fontVariant: ['tabular-nums'],
    width: 110,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.small,
    borderWidth: 1,
    textAlign: 'right',
    fontSize: 16,
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
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  disabled: {
    opacity: 0.5,
  },
  saveLabel: {
    // White on the deep teal fill: 5.4:1, where the near-black it replaced was
    // correct only while the fill was the pale `accent`.
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.7,
  },
});
