import { supabase } from './supabase';

export const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;

export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export type Profile = {
  id: string;
  name: string | null;
  phone: string | null;
  town: string | null;
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
    .select('id, name, phone, town, experience_level')
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
