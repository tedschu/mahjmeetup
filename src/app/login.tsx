import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signInWithGoogle } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { AnimatedIcon } from '@/components/animated-icon';
import { GradientButton, OutlineButton } from '@/components/button';
import { CornerRibbon } from '@/components/ribbon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function LoginScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithEmail() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) setError(error.message);
    setLoading(false);
  }

  async function signUpWithEmail() {
    setLoading(true);
    setError(null);
    const {
      data: { session },
      error,
    } = await supabase.auth.signUp({ email, password });
    if (error) setError(error.message);
    else if (!session) setError('Check your inbox to confirm your email address.');
    setLoading(false);
  }

  async function continueWithGoogle() {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Google sign-in did not work.');
    } finally {
      // On web the page navigates away, so this only matters when it fails.
      setLoading(false);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.container}>
      {/* Behind everything, and non-interactive: the screen was otherwise a blank
          field with a mark floating in it. */}
      <CornerRibbon />

      <SafeAreaView style={styles.safeArea}>
        <AnimatedIcon />

        <View style={styles.brand}>
          <ThemedText type="title" style={styles.wordmark}>
            SEVEN BAM
          </ThemedText>
          {/* Set in the two brand colours the guide uses for it, each deepened to
              the ink variant so a 14px line actually reads. */}
          <ThemedText type="smallBold" style={styles.tagline}>
            <ThemedText type="smallBold" style={{ color: theme.accentInk }}>
              Make connections.{' '}
            </ThemedText>
            <ThemedText type="smallBold" style={{ color: theme.accentWarmInk }}>
              Start something.
            </ThemedText>
          </ThemedText>
        </View>

        <ThemedView style={[styles.formCard, { borderColor: theme.rule }]}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundElement,
                color: theme.text,
                borderColor: theme.rule,
              },
            ]}
            onChangeText={setEmail}
            value={email}
            placeholder="email@address.com"
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor={theme.textSecondary}
          />
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundElement,
                color: theme.text,
                borderColor: theme.rule,
              },
            ]}
            onChangeText={setPassword}
            value={password}
            secureTextEntry
            placeholder="Password"
            autoCapitalize="none"
            placeholderTextColor={theme.textSecondary}
          />

          {/* The one gradient on the screen, on the one thing most people are here
              to do. Everything else is outlined, exactly as the guide lays out its
              welcome screen. */}
          <GradientButton label="Sign in" onPress={signInWithEmail} busy={loading} wide />
          <OutlineButton label="Create account" onPress={signUpWithEmail} disabled={loading} wide />

          <View style={[styles.divider, { backgroundColor: theme.rule }]} />

          <OutlineButton
            label="Continue with Google"
            onPress={continueWithGoogle}
            disabled={loading}
            wide
          />

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
    // Keeps the ribbon's overhang from widening the page on web.
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
    // The mark is set solid in the guide; the default -0.6 opened it up too much
    // at this size for a two-word lockup.
    letterSpacing: 0.5,
  },
  tagline: {
    textAlign: 'center',
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
  /** Separates the two account routes from the third-party one. */
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.one,
  },
  error: {
    textAlign: 'center',
  },
});
