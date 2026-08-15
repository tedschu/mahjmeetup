import { Poppins_600SemiBold, useFonts } from '@expo-google-fonts/poppins';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import {
  inviteTokenFromUrl,
  joinLeagueWithToken,
  rememberPendingInvite,
  takePendingInvite,
} from '@/lib/leagues';
import { syncMyAvatar } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import LoginScreen from './login';

SplashScreen.preventAutoHideAsync();

/**
 * Cashes in an invite once there is a session.
 *
 * Two cases arrive here. Someone already signed in who opens an invite link, and
 * someone who had to sign in first — Google returns people to the app's origin
 * rather than to the link they followed, so the token is stashed on the way past
 * and redeemed on the way back.
 *
 * Silent on failure. A bad or already-used invite is not worth interrupting a
 * sign-in over, and re-opening the link reports it properly.
 */
async function redeemInvite() {
  const token = await takePendingInvite();
  if (!token) return;

  try {
    await joinLeagueWithToken(token);
  } catch {
    // Deliberately ignored; see above.
  }
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [session, setSession] = useState<Session | null>(null);
  const [fontsLoaded] = useFonts({ Poppins_600SemiBold });

  useEffect(() => {
    (async () => {
      // Stashed before the session is even known, because a signed-out visitor
      // gets sent to the login screen and the token would be gone by the time
      // they came back.
      const fromUrl = inviteTokenFromUrl();
      if (fromUrl) await rememberPendingInvite(fromUrl);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(session);
      // Publishes this member's Google photo to their profile so the group can
      // see it on match cards. Once per session, not per screen.
      if (session?.user) {
        syncMyAvatar();
        redeemInvite();
      }
    })();

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
