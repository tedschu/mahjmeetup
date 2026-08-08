import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { joinLeagueWithToken, rememberPendingInvite } from '@/lib/leagues';
import { supabase } from '@/lib/supabase';

type State =
  | { kind: 'working' }
  | { kind: 'joined' }
  | { kind: 'needs-sign-in' }
  | { kind: 'failed'; message: string };

/**
 * Where an invite link lands.
 *
 * Signed in, it redeems the token immediately. Signed out, it holds the token and
 * asks them to sign in — Google returns people to the app's origin rather than
 * here, so without that the invite would be silently lost on the way back.
 */
export default function JoinLeagueScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [state, setState] = useState<State>({ kind: 'working' });

  useEffect(() => {
    let active = true;

    (async () => {
      if (!token) {
        if (active) {
          setState({ kind: 'failed', message: 'That invite link is missing its code.' });
        }
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        await rememberPendingInvite(token);
        if (active) setState({ kind: 'needs-sign-in' });
        return;
      }

      try {
        await joinLeagueWithToken(token);
        if (active) setState({ kind: 'joined' });
      } catch (cause) {
        if (active) {
          setState({
            kind: 'failed',
            message: cause instanceof Error ? cause.message : 'That invite link did not work.',
          });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <ThemedView type="backgroundElement" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {state.kind === 'working' ? (
            <>
              <ActivityIndicator />
              <ThemedText type="small" themeColor="textSecondary">
                Checking that invite…
              </ThemedText>
            </>
          ) : null}

          {state.kind === 'joined' ? (
            <>
              <ThemedText type="title">You&apos;re in</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
                The league is on your Leagues tab, and its meetups will show up in My Matches once
                the tables are drawn.
              </ThemedText>
              <Pressable
                onPress={() => router.replace('/leagues')}
                style={({ pressed }) => pressed && styles.pressed}>
                <View style={[styles.button, { backgroundColor: theme.accent }]}>
                  <ThemedText type="smallBold" style={styles.buttonLabel}>
                    Open Leagues
                  </ThemedText>
                </View>
              </Pressable>
            </>
          ) : null}

          {state.kind === 'needs-sign-in' ? (
            <>
              <ThemedText type="title">Sign in to join</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
                We&apos;ll add you to the league as soon as you&apos;re in. The invite is saved, so
                you won&apos;t need this link again.
              </ThemedText>
              <Pressable
                onPress={() => router.replace('/')}
                style={({ pressed }) => pressed && styles.pressed}>
                <View style={[styles.button, { backgroundColor: theme.accent }]}>
                  <ThemedText type="smallBold" style={styles.buttonLabel}>
                    Continue to sign in
                  </ThemedText>
                </View>
              </Pressable>
            </>
          ) : null}

          {state.kind === 'failed' ? (
            <>
              <ThemedText type="title">That didn&apos;t work</ThemedText>
              <ThemedText type="small" style={[styles.centered, styles.error]}>
                {state.message}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
                Ask whoever invited you to send the link again — they can copy a fresh one from the
                league.
              </ThemedText>
              <Pressable
                onPress={() => router.replace('/')}
                style={({ pressed }) => pressed && styles.pressed}>
                <View style={[styles.button, { backgroundColor: theme.accent }]}>
                  <ThemedText type="smallBold" style={styles.buttonLabel}>
                    Go to Browse
                  </ThemedText>
                </View>
              </Pressable>
            </>
          ) : null}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  centered: {
    textAlign: 'center',
  },
  button: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.three,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    color: '#ffffff',
  },
  error: {
    color: '#c0392b',
  },
  pressed: {
    opacity: 0.7,
  },
});
