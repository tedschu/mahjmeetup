import { useSyncExternalStore } from 'react';

import { supabase } from '@/lib/supabase';

/**
 * Whether the signed-in member still has to set themselves up.
 *
 * The test is a missing name, and only a missing name. Half the group signs up
 * with an email address rather than Google, and that path carries no profile
 * metadata at all — so those members arrive as "Unnamed member" on the
 * leaderboard and as a blank initial in every match roster, with nothing telling
 * them so. This is what puts a mark on the Profile tab until they fix it.
 *
 * Town is deliberately not part of the test, even though Browse's distance filter
 * wants it. A member may reasonably decline to say where they live, and a mark
 * that can never be cleared stops being a prompt and becomes a nag — at which
 * point it is ignored, including when it means something. One condition, one
 * action, and it goes away.
 *
 * Kept in a module-level store rather than fetched per screen because the thing
 * that displays it is the tab bar, which is mounted for the whole session and
 * never re-runs a screen's effects. Both tab bars subscribe; the layout refreshes
 * it when a session appears and the profile screen refreshes it after a save, so
 * the mark disappears on the same tap that earns it.
 */
let needsSetup = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Re-reads the profile and updates every subscriber.
 *
 * Fails quiet. A mark that fails to appear costs a member a hint; an error
 * bubbling out of the tab bar would cost them the whole screen.
 */
export async function refreshProfileSetup() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      needsSetup = false;
      emit();
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .maybeSingle();

    if (error) return;

    // Trimmed: a name of spaces is not a name, and the profile screen writes
    // null for an empty field but nothing stops whitespace being saved.
    needsSetup = (data?.name ?? '').trim().length === 0;
    emit();
  } catch {
    // See above.
  }
}

/** Clears the mark, for sign-out. */
export function clearProfileSetup() {
  needsSetup = false;
  emit();
}

export function useNeedsProfileSetup() {
  return useSyncExternalStore(
    subscribe,
    () => needsSetup,
    // Server snapshot, for the static web export: never mark on the first paint,
    // because the profile has not been read yet and a dot that appears and then
    // vanishes is worse than one that arrives a moment late.
    () => false
  );
}
