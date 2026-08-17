import { AuthError } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from './supabase';

/** Where someone goes when nothing on the screen helps them. */
export const SupportEmail = 'sevenbamapp@gmail.com';

/**
 * Turns an auth failure into something a person can act on.
 *
 * The login screen used to print `error.message` straight from the server, which
 * is written for whoever is reading the logs. A member trying to join a mahjong
 * game was shown "Email rate limit exceeded" — true, meaningless, and silent about
 * the fact that Continue with Google would have worked immediately. That one cost
 * a real signup.
 *
 * Matched on `code` rather than on the message text. Codes are a documented part
 * of the auth API and are enumerated in its types; the prose is not, and changes
 * without warning. Anything unrecognised falls through to the original message
 * plus the support address, so a new failure mode is still reported honestly
 * rather than flattened into "something went wrong".
 */
export function describeAuthError(error: unknown): string {
  const code = error instanceof AuthError ? error.code : undefined;

  switch (code) {
    case 'over_email_send_rate_limit':
      // The one that prompted all this. Names the way out rather than the cause:
      // the member cannot do anything about a mail quota.
      return `We could not send your confirmation email just now. Try Continue with Google — that works straight away — or try again in a few minutes.`;

    case 'over_request_rate_limit':
      return 'Too many attempts in a row. Wait a minute and try again.';

    case 'invalid_credentials':
      // Deliberately does not say which half was wrong; that tells a stranger
      // whether an address has an account.
      return 'That email and password do not match an account. Check for a typo, or create an account below.';

    case 'email_not_confirmed':
      return 'Your email address is not confirmed yet. Open the link in the confirmation email we sent, then sign in.';

    case 'user_already_exists':
    case 'email_exists':
      return 'There is already an account with that email address. Sign in instead, and use a password reset if you have forgotten it.';

    case 'weak_password':
      return 'That password is too short. Use at least six characters.';

    case 'signup_disabled':
      return `New accounts are closed at the moment. Email ${SupportEmail} if you were expecting an invitation.`;

    case 'user_banned':
      return `This account cannot be used. Email ${SupportEmail} if that is unexpected.`;

    case 'validation_failed':
      return 'Check the email address — that one does not look complete.';

    default: {
      const detail = error instanceof Error && error.message ? ` (${error.message})` : '';
      return `Something went wrong signing you in${detail}. Try Continue with Google, or email ${SupportEmail} if it keeps happening.`;
    }
  }
}

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
