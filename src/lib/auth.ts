import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from './supabase';

/**
 * Sign in with Google.
 *
 * The two platforms take different routes to the same place. On web the
 * browser leaves for Google and comes back with a code in the URL, which the
 * client picks up itself because `detectSessionInUrl` is on. On native there is
 * no page to come back to, so the consent screen opens in an auth session, the
 * deep link is caught here, and the code is exchanged by hand.
 */
export async function signInWithGoogle() {
  const redirectTo =
    Platform.OS === 'web'
      ? // Back to the page the member started on, not a hardcoded host, so the
        // same build works on localhost and on the deployed site.
        window.location.origin
      : Linking.createURL('/');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      // On native the app opens the URL itself; on web supabase-js navigates.
      skipBrowserRedirect: Platform.OS !== 'web',
    },
  });

  if (error) throw error;
  if (Platform.OS === 'web' || !data?.url) return;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return; // Member closed the sheet.

  const code = new URL(result.url).searchParams.get('code');
  if (!code) throw new Error('Google did not return a sign-in code.');

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
}
