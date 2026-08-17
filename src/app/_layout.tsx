import { Poppins_600SemiBold, useFonts } from '@expo-google-fonts/poppins';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { HomeScreenSheet } from '@/components/home-screen-sheet';
import {
  inviteTokenFromUrl,
  joinLeagueWithToken,
  rememberPendingInvite,
  takePendingInvite,
} from '@/lib/leagues';
import {
  dismissHomeScreenPrompt,
  offerHomeScreenPrompt,
  useHomeScreenPrompt,
} from '@/hooks/use-home-screen-prompt';
import { clearProfileSetup, refreshProfileSetup } from '@/hooks/use-profile-setup';
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
async function redeemInvite(userId: string) {
  const token = await takePendingInvite();
  if (!token) return;

  try {
    await joinLeagueWithToken(token);
    // The strongest case for the home screen shortcut: somebody who followed a
    // link on their phone and has just landed in a league. Offered only after the
    // join succeeds, so a stale or spent invite never produces a welcome sheet.
    await offerHomeScreenPrompt(userId);
  } catch {
    // Deliberately ignored; see above.
  }
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [session, setSession] = useState<Session | null>(null);
  const [fontsLoaded] = useFonts({ Poppins_600SemiBold });
  const homeScreenPrompt = useHomeScreenPrompt();

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
        redeemInvite(session.user.id);
        // Marks the Profile tab when this member has no name yet, which in
        // practice means they signed up with an email address rather than Google.
        // Independent of syncMyAvatar, which only ever writes a photo — the name
        // arrives from provider metadata at signup or not at all.
        refreshProfileSetup();
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        syncMyAvatar();
        redeemInvite(session.user.id);
        refreshProfileSetup();
      } else {
        // Signing out has to clear it, or the mark would still be sitting on a
        // tab bar that the next member to sign in inherits.
        clearProfileSetup();
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
      {/* One sheet for the whole app, so every join path can raise it — Browse
          after a seat or a league, and redeemInvite after a link. */}
      {homeScreenPrompt ? (
        <HomeScreenSheet
          visible
          platform={homeScreenPrompt}
          onClose={dismissHomeScreenPrompt}
        />
      ) : null}
    </ThemeProvider>
  );
}
