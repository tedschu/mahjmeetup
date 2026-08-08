import { supabase } from './supabase';

export const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;

export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export type Profile = {
  id: string;
  name: string | null;
  phone: string | null;
  town: string | null;
  avatar_url: string | null;
  experience_level: string | null;
};

/** The signed-in member's profile, plus the email held on their auth account. */
export async function fetchMyProfile(): Promise<{ profile: Profile; email: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('You are signed out.');

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, phone, town, experience_level, avatar_url')
    .eq('id', user.id)
    .single();

  if (error) throw error;

  return { profile: data, email: user.email ?? null };
}

export async function updateMyProfile(
  userId: string,
  changes: Pick<Profile, 'name' | 'phone' | 'town' | 'experience_level'>
) {
  const { error } = await supabase.from('profiles').update(changes).eq('id', userId);
  if (error) throw error;
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
