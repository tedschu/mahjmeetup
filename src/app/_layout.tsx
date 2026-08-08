import { ArchivoNarrow_600SemiBold, useFonts } from '@expo-google-fonts/archivo-narrow';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { joinLeagueWithToken, takePendingInvite } from '@/lib/leagues';
import { syncMyAvatar } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import LoginScreen from './login';

SplashScreen.preventAutoHideAsync();

/**
 * Finishes a join that was interrupted by signing in. Google returns people to
 * the app's origin rather than to the invite link they opened, so the token is
 * held and cashed in here instead.
 */
async function redeemInvite() {
  const token = await takePendingInvite();
  if (!token) return;

  try {
    await joinLeagueWithToken(token);
  } catch {
    // The invite screen reports failures; here it would interrupt a sign-in for
    // something the member can retry by opening the link again.
  }
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [session, setSession] = useState<Session | null>(null);
  const [fontsLoaded] = useFonts({ ArchivoNarrow_600SemiBold });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      // Publishes this member's Google photo to their profile so the group can
      // see it on match cards. Once per session, not per screen.
      if (session?.user) {
        syncMyAvatar();
        redeemInvite();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        syncMyAvatar();
        redeemInvite();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Headings and every number are set in the display face, so rendering before
  // it arrives would show a full screen of text in the wrong font and reflow.
  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      {session && session.user ? <AppTabs /> : <LoginScreen />}
    </ThemeProvider>
  );
}
