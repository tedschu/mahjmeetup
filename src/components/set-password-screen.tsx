import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientButton, OutlineButton } from './button';
import { CornerRibbon } from './ribbon';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { cancelPasswordReset, describeAuthError, updatePassword } from '@/lib/auth';

/**
 * Where a recovery link lands: choose a new password, then carry on into the app.
 *
 * This screen exists because of the shape of the flow rather than for its own sake.
 * Following a recovery link **signs the member in** — the link is the proof of
 * identity — and the root layout shows the tabs whenever there is a session. Without
 * something claiming that session first, somebody clicking "reset my password" would
 * be dropped into Browse with their old password still live, having reset nothing,
 * and with no hint that they were meant to do anything. So the layout holds them
 * here while a reset is pending.
 *
 * Deliberately mirrors the login screen — same ribbon, same wordmark, same card — so
 * arriving from an email feels like arriving at the app rather than at a form.
 */
export function SetPasswordScreen({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Checked here rather than left to the server, because the server cannot see the
   * second field. Six is the project's minimum, set in supabase/config.toml.
   */
  const tooShort = password.length > 0 && password.length < 6;
  const mismatch = confirmation.length > 0 && confirmation !== password;
  const ready = password.length >= 6 && confirmation === password;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      onDone();
    } catch (cause) {
      setError(describeAuthError(cause));
      setBusy(false);
    }
  };

  /**
   * For somebody who followed the link and would rather not change anything. The
   * session from the link stays, so they end up signed in — which is what the link
   * entitled them to, and better than a dead end.
   */
  const skip = async () => {
    await cancelPasswordReset();
    onDone();
  };

  return (
    <ThemedView type="backgroundElement" style={styles.container}>
      <CornerRibbon />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.brand}>
          <ThemedText type="title" style={styles.wordmark}>
            SEVEN BAM
          </ThemedText>
          <ThemedText type="smallBold" style={{ color: theme.accentInk }}>
            Choose a new password
          </ThemedText>
        </View>

        <ThemedView style={[styles.formCard, { borderColor: theme.rule }]}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundElement,
                color: theme.text,
                borderColor: tooShort ? theme.danger : theme.rule,
              },
            ]}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="New password"
            autoCapitalize="none"
            placeholderTextColor={theme.placeholder}
          />
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundElement,
                color: theme.text,
                borderColor: mismatch ? theme.danger : theme.rule,
              },
            ]}
            value={confirmation}
            onChangeText={setConfirmation}
            secureTextEntry
            placeholder="Type it again"
            autoCapitalize="none"
            placeholderTextColor={theme.placeholder}
          />

          {/* One line at a time, and only once there is something to say about —
              telling somebody their password is too short before they have finished
              typing it is just noise. */}
          <ThemedText type="small" themeColor="textSecondary">
            {tooShort
              ? 'At least six characters.'
              : mismatch
                ? 'The two do not match yet.'
                : 'At least six characters. You will stay signed in afterwards.'}
          </ThemedText>

          <GradientButton
            label="Save password"
            onPress={save}
            busy={busy}
            disabled={!ready}
            wide
          />
          <OutlineButton label="Skip for now" onPress={skip} disabled={busy} wide />

          {error ? (
            <ThemedText type="small" style={[styles.error, { color: theme.danger }]}>
              {error}
            </ThemedText>
          ) : null}
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  safeArea: {
    width: '100%',
    maxWidth: 400,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.four,
  },
  brand: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  wordmark: {
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  formCard: {
    alignSelf: 'stretch',
    padding: Spacing.four,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.three,
  },
  input: {
    padding: Spacing.three,
    borderRadius: Radius.small,
    borderWidth: 1,
    fontSize: 16,
  },
  error: {
    textAlign: 'center',
  },
});
