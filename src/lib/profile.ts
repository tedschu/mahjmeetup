import { supabase } from './supabase';

export const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;

export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export type Profile = {
  id: string;
  name: string | null;
  /**
   * Kept in `profile_contacts`, not on the profiles row, because the select policy
   * on `profiles` is `using (true)` and this is not something to publish. Presented
   * here as one profile anyway — the split is a storage rule, not something the
   * screen should have to know. See 20260815214500.
   */
  phone: string | null;
  town: string | null;
  /**
   * The centre of `town`, from a Places city result — not a device position and
   * not an address. Browse measures distance from here.
   */
  home_latitude: number | null;
  home_longitude: number | null;
  avatar_url: string | null;
  experience_level: string | null;
};

/** The signed-in member's profile, plus the email held on their auth account. */
export async function fetchMyProfile(): Promise<{ profile: Profile; email: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('You are signed out.');

  // Two reads because the contact details live in their own table; one round trip,
  // since neither depends on the other.
  const [directory, contact] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, town, home_latitude, home_longitude, experience_level, avatar_url')
      .eq('id', user.id)
      .single(),
    // maybeSingle: a member who has never given a phone number has no row at all,
    // which is not an error.
    supabase.from('profile_contacts').select('phone').eq('profile_id', user.id).maybeSingle(),
  ]);

  if (directory.error) throw directory.error;

  return {
    profile: { ...directory.data, phone: contact.data?.phone ?? null },
    email: user.email ?? null,
  };
}

export async function updateMyProfile(
  userId: string,
  changes: Pick<
    Profile,
    'name' | 'phone' | 'town' | 'experience_level' | 'home_latitude' | 'home_longitude'
  >
) {
  const { phone, ...directory } = changes;

  const { error } = await supabase.from('profiles').update(directory).eq('id', userId);
  if (error) throw error;

  // Upsert rather than update: the row is created the first time a member gives a
  // number, and clearing the field writes a null rather than deleting the row.
  const { error: contactError } = await supabase
    .from('profile_contacts')
    .upsert({ profile_id: userId, phone }, { onConflict: 'profile_id' });

  if (contactError) throw contactError;
}

/**
 * Just the signed-in member's home coordinates, for Browse's distance filter.
 *
 * Separate from `fetchMyProfile` because Browse needs only this, and returns null
 * on any failure — a profile lookup that fails should cost the distance filter,
 * not the whole list of matches.
 */
export async function fetchMyHome(
  userId: string
): Promise<{ latitude: number; longitude: number } | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('home_latitude, home_longitude')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;
  if (typeof data.home_latitude !== 'number' || typeof data.home_longitude !== 'number') return null;

  return { latitude: data.home_latitude, longitude: data.home_longitude };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Copies the signed-in member's Google photo onto their profiles row.
 *
 * Needed because auth metadata is readable only by its owner: without this, a
 * member's photo would be visible to nobody but themselves. The signup trigger
 * captures it for new accounts, so this exists for accounts that predate the
 * column and for when Google changes the URL.
 *
 * Fails quietly. A missing photo falls back to initials, which is not worth
 * interrupting a sign-in over.
 */
export async function syncMyAvatar() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const metadata = user.user_metadata ?? {};
    const picture = (metadata.avatar_url ?? metadata.picture) as string | undefined;
    if (!picture) return;

    const { data: current } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .maybeSingle();

    if (current?.avatar_url === picture) return;

    await supabase.from('profiles').update({ avatar_url: picture }).eq('id', user.id);
  } catch {
    // Deliberately ignored; see above.
  }
}
