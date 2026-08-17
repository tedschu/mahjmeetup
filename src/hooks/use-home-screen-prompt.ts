import { useSyncExternalStore } from 'react';

import {
  homeScreenPromptFor,
  rememberHomeScreenPrompt,
  type MobilePlatform,
} from '@/lib/home-screen-prompt';

/**
 * Whether the home screen sheet is currently being offered, and to whom.
 *
 * A store rather than screen state because the sheet has two callers that cannot
 * see each other. Browse offers it after somebody joins a match or a public
 * league; the root layout offers it after redeeming an invite link, which happens
 * before any screen has mounted and is arguably the more important case — an
 * organizer texts a link, somebody taps it on a phone, signs up, and lands in a
 * league. That is exactly the moment a shortcut is worth having, and it was the one
 * path that never asked.
 *
 * So the sheet is rendered once by the layout, above whatever screen is showing,
 * and anything that seats a member can ask for it by calling `offerHomeScreenPrompt`.
 * A third join path added later gets it with one line and no new plumbing.
 *
 * The decision about whether to ask at all — phone, not already installed, not
 * asked before — stays in `lib/home-screen-prompt.ts`. This only carries the answer.
 */
let pending: MobilePlatform | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Offers the sheet, if this member should see it at all.
 *
 * Marks it as asked before showing rather than after dismissal: somebody who
 * navigates away instead of tapping "Got it" has still been asked, and asking
 * twice is worse than them missing it once.
 */
export async function offerHomeScreenPrompt(userId: string) {
  const platform = await homeScreenPromptFor(userId);
  if (!platform) return;

  await rememberHomeScreenPrompt(userId);
  pending = platform;
  emit();
}

export function dismissHomeScreenPrompt() {
  pending = null;
  emit();
}

export function useHomeScreenPrompt() {
  return useSyncExternalStore(
    subscribe,
    () => pending,
    // Never on the first server-rendered paint of the static export.
    () => null
  );
}
