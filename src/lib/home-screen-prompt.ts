import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Whether to offer this member the "add Seven Bam to your home screen" prompt,
 * and remembering that we did.
 *
 * The moment to ask is just after somebody first takes a seat, because that is the
 * first time the app has something of theirs in it — a game on a date they now want
 * to be reminded of. Asking on sign-in would be asking a stranger to install
 * something.
 *
 * Most of this file is the list of people who must *not* see it. An unwanted
 * install prompt is the most disliked pattern on the mobile web, and every
 * condition below removes somebody for whom the prompt would be nonsense.
 */

/** One key per member: two people sharing a tablet each get asked once. */
const storageKey = (userId: string) => `sevenbam.homeScreenPrompt.${userId}`;

export type MobilePlatform = 'ios' | 'android';

/**
 * Which set of instructions to give, or null when none apply.
 *
 * Read from the user agent, which is the only thing that distinguishes Safari's
 * share sheet from Chrome's overflow menu — the steps are different and a wrong
 * one is worse than none. iPadOS deliberately counts as iOS: it reports itself as
 * a Mac, so it is caught by the touch-point test rather than by its platform
 * string.
 */
export function mobilePlatform(): MobilePlatform | null {
  if (Platform.OS !== 'web') return null;
  if (typeof navigator === 'undefined') return null;

  const ua = navigator.userAgent ?? '';

  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipod|ipad/i.test(ua)) return 'ios';
  // iPadOS 13+ masquerades as desktop Safari. A Mac with a touch screen does not
  // exist, so touch points are a safe tell.
  if (/macintosh/i.test(ua) && typeof document !== 'undefined' && navigator.maxTouchPoints > 1) {
    return 'ios';
  }

  return null;
}

/**
 * Already launched from a home screen icon, so there is nothing to add.
 *
 * Two tests because the platforms disagree: `display-mode: standalone` is the
 * standard and works on Android, while iOS answers `navigator.standalone`.
 */
function alreadyInstalled() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;

  const standaloneDisplay =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;

  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;

  return standaloneDisplay || iosStandalone;
}

/**
 * Whether to show the prompt now.
 *
 * Fails to `null` on any doubt. Never showing it costs a member a convenience they
 * do not know about; showing it wrongly — on a desktop, twice, or to somebody who
 * already installed it — is the kind of thing that makes people distrust an app.
 */
export async function homeScreenPromptFor(userId: string): Promise<MobilePlatform | null> {
  const platform = mobilePlatform();
  if (!platform) return null;
  if (alreadyInstalled()) return null;

  try {
    const seen = await AsyncStorage.getItem(storageKey(userId));
    return seen ? null : platform;
  } catch {
    // Storage unavailable — private browsing, a wiped profile. Better to stay
    // quiet than to risk asking on every single join.
    return null;
  }
}

/** Records that the prompt has been shown, so it never appears again. */
export async function rememberHomeScreenPrompt(userId: string) {
  try {
    await AsyncStorage.setItem(storageKey(userId), new Date().toISOString());
  } catch {
    // If this fails the member may see the prompt once more. Acceptable; the
    // alternative is not showing it at all.
  }
}
