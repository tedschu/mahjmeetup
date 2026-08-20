/**
 * What the sign-in form needs before it is worth asking the server anything.
 *
 * A module of its own, with no imports, for two reasons. It is pure — a form and
 * three strings in, a sentence or nothing out — so it can be tested without a
 * React Native runtime, which `auth.ts` drags in through Platform and storage.
 * And it is the half of "what went wrong" that is not an auth failure at all,
 * which is exactly the distinction the screen had lost.
 */

export type Intent = 'signIn' | 'signUp' | 'reset';

/**
 * What is wrong with the form, before it is worth asking the server.
 *
 * This exists because of one specific failure: pressing Create account with both
 * fields empty produced "Something went wrong signing you in", plus the support
 * address, from a server error about an invalid email. Every word of that is
 * wrong. Nothing went wrong, there is nothing to email support about, and the
 * actual problem — no email and no password — is the one thing the message did
 * not say.
 *
 * Returns null when there is nothing to complain about. Deliberately checks in the
 * order somebody fills the form in, so the first thing they are told about is the
 * first field they missed rather than the last.
 */
export function describeMissing(
  email: string,
  password: string,
  intent: Intent
): string | null {
  const address = email.trim();

  if (address.length === 0) {
    return intent === 'reset'
      ? 'Enter the email address you signed up with.'
      : `Enter your email address to ${intent === 'signUp' ? 'create an account' : 'sign in'}.`;
  }

  // Deliberately loose. The only address that matters is the one the confirmation
  // email reaches, and no pattern short of sending one can tell you that — so this
  // catches "ted" and "ted@", and lets everything shaped like an address through
  // rather than turning away somebody with an unusual domain.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    return 'That email address looks incomplete — it needs an @ and a domain, like name@example.com.';
  }

  if (intent === 'reset') return null;

  if (password.length === 0) {
    return intent === 'signUp'
      ? 'Choose a password — at least six characters.'
      : 'Enter your password.';
  }

  // Only when signing up. Telling somebody their existing password is too short
  // while they are trying to use it would be both wrong and unhelpful.
  if (intent === 'signUp' && password.length < 6) {
    return 'That password is too short — use at least six characters.';
  }

  return null;
}

