import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { describeAuthError, sendPasswordReset, signInWithGoogle } from '@/lib/auth';
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
  const [notice, setNotice] = useState<string | null>(null);
  /**
   * The screen has two jobs and one form. `forgot` swaps the password field and the
   * three buttons for a single Send button — rather than a separate route, because
   * the signed-out state is this component rather than anything the router owns.
   */
  const [forgot, setForgot] = useState(false);

  async function signInWithEmail() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) setError(describeAuthError(error));
    setLoading(false);
  }

  async function signUpWithEmail() {
    setLoading(true);
    setError(null);
    const {
      data: { session },
      error,
    } = await supabase.auth.signUp({ email, password });
    if (error) setError(describeAuthError(error));
    else if (!session)
      setError('Almost there — open the link in the confirmation email we just sent, then sign in.');
    setLoading(false);
  }

  async function requestPasswordReset() {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await sendPasswordReset(email);
      // Says the same thing whether or not the address has an account, so this
      // cannot be used to find out who is a member.
      setNotice(
        `If there is an account for ${email.trim()}, a reset link is on its way. Open it in this browser — a link opened somewhere else cannot complete the reset.`
      );
    } catch (cause) {
      setError(describeAuthError(cause));
    } finally {
      setLoading(false);
    }
  }

  async function continueWithGoogle() {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (cause) {
      setError(describeAuthError(cause));
    } finally {
      // On web the page navigates away, so this only matters when it fails.
      setLoading(false);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.container}>
      {/* Behind everything, and non-interactive: the screen was otherwise a blank
          field with a mark floating in it.

          A faint fragment in the corner, which is where this started and where it
          ended up. The alternative — a full-height ribbon down one side — was tried
          at length and looked like a border rather than a graphic element; see the
          history of this file if it comes up again. */}
      <CornerRibbon />

      <SafeAreaView style={styles.safeArea}>
        <AnimatedIcon />

        <View style={styles.brand}>
          <ThemedText type="title" style={styles.wordmark}>
            SEVEN BAM
          </ThemedText>
          {/* Set in the two brand colours the guide uses for it, each deepened to
              the ink variant so a 14px line actually reads. Broken at the verb
              rather than mid-phrase, so the colour change lands on a join the
              sentence already has. */}
          <ThemedText type="smallBold" style={styles.tagline}>
            <ThemedText type="smallBold" style={{ color: theme.accentInk }}>
              Your next game{' '}
            </ThemedText>
            <ThemedText type="smallBold" style={{ color: theme.accentWarmInk }}>
              starts here.
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
            placeholderTextColor={theme.placeholder}
          />
          {/* Hidden while resetting: a password field on a screen whose whole
              purpose is that you have forgotten it is just something to ignore. */}
          {forgot ? null : (
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
              placeholderTextColor={theme.placeholder}
            />
          )}

          {forgot ? (
            <>
              <GradientButton
                label="Email me a reset link"
                onPress={requestPasswordReset}
                busy={loading}
                disabled={email.trim().length === 0}
                wide
              />
              <OutlineButton
                label="Back to sign in"
                onPress={() => {
                  setForgot(false);
                  setError(null);
                  setNotice(null);
                }}
                disabled={loading}
                wide
              />
            </>
          ) : (
            <>
              {/* The one gradient on the screen, on the one thing most people are
                  here to do. Everything else is outlined, exactly as the guide lays
                  out its welcome screen. */}
              <GradientButton label="Sign in" onPress={signInWithEmail} busy={loading} wide />
              <OutlineButton
                label="Create account"
                onPress={signUpWithEmail}
                disabled={loading}
                wide
              />

              {/* Quietest control on the card. Nobody is looking for this until they
                  need it, and then they need it to be obvious — so it is plain text
                  in the link ink rather than a third button competing with the two
                  above it. */}
              <Pressable
                onPress={() => {
                  setForgot(true);
                  setError(null);
                  setNotice(null);
                }}
                accessibilityRole="button"
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedText
                  type="small"
                  style={[styles.forgotLink, { color: theme.accentInk }]}>
                  Forgot your password?
                </ThemedText>
              </Pressable>

              <View style={[styles.divider, { backgroundColor: theme.rule }]} />

              <OutlineButton
                label="Continue with Google"
                onPress={continueWithGoogle}
                disabled={loading}
                wide
              />
            </>
          )}

          {notice ? (
            <ThemedText type="small" style={[styles.error, { color: theme.accentInk }]}>
              {notice}
            </ThemedText>
          ) : null}
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
  forgotLink: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
