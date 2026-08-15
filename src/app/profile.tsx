import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientButton } from '@/components/button';
import { PlaceAutocompleteInput } from '@/components/place-autocomplete-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { coordinatesOf, type Coordinates } from '@/lib/geo';
import { fetchPlaceLocation } from '@/lib/places';
import {
  EXPERIENCE_LEVELS,
  fetchMyProfile,
  signOut,
  updateMyProfile,
  type ExperienceLevel,
} from '@/lib/profile';

type Draft = {
  name: string;
  phone: string;
  town: string;
  experience_level: string;
};

const EMPTY: Draft = { name: '', phone: '', town: '', experience_level: '' };

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  hint?: string;
  keyboardType?: 'default' | 'phone-pad';
}) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      <ThemedText type="label" themeColor="textSecondary">{label}</ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        keyboardType={keyboardType ?? 'default'}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.background, borderColor: theme.rule },
        ]}
      />
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

export default function ProfileScreen() {
  const theme = useTheme();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  /**
   * The town's coordinates, kept beside the draft rather than in it because they
   * are not typed — they arrive from a Places lookup after a suggestion is
   * picked, and are dropped whenever the town is edited by hand.
   */
  const [home, setHome] = useState<Coordinates | null>(null);

  const load = useCallback(async () => {
    try {
      const { profile, email: accountEmail } = await fetchMyProfile();
      setUserId(profile.id);
      setEmail(accountEmail);
      setDraft({
        name: profile.name ?? '',
        phone: profile.phone ?? '',
        town: profile.town ?? '',
        experience_level: profile.experience_level ?? '',
      });
      setHome(coordinatesOf({
        latitude: profile.home_latitude,
        longitude: profile.home_longitude,
      }));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your profile.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        await load();
        if (active) setIsLoading(false);
      })();

      return () => {
        active = false;
      };
    }, [load])
  );

  const save = async () => {
    if (!userId) return;

    setIsSaving(true);
    setStatus(null);
    try {
      await updateMyProfile(userId, {
        name: draft.name.trim() || null,
        phone: draft.phone.trim() || null,
        town: draft.town.trim() || null,
        experience_level: draft.experience_level || null,
        home_latitude: home?.latitude ?? null,
        home_longitude: home?.longitude ?? null,
      });
      setStatus('Profile saved.');
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const set = (key: keyof Draft) => (next: string) => {
    setDraft((current) => ({ ...current, [key]: next }));
    setStatus(null);
  };

  return (
    <ThemedView type="backgroundElement" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {isLoading ? (
          <ActivityIndicator style={styles.centered} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            // `handled` so a tap on a town suggestion reaches the row instead of
            // being swallowed as a dismiss-the-keyboard gesture.
            keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <ThemedText type="title">Profile</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
                How the group sees you
              </ThemedText>
            </View>

            <Field
              label="Name"
              value={draft.name}
              onChangeText={set('name')}
              placeholder="What the group calls you"
              hint="Shown on match cards and the leaderboard."
            />

            {/*
              Shown as a field rather than as the caption under the title, where it
              read as decoration — which is no way to present the one detail the
              note below says gets shared.

              Not editable, and not for want of a text input. This is the address
              you sign in with: it lives on the auth account rather than on the
              profile, and changing it means `auth.updateUser` plus a confirmation
              link, which cannot happen behind the same Save button as a name. A
              field that appeared to save and then reverted would be worse than one
              that says where the value comes from.
            */}
            <View style={styles.field}>
              <ThemedText type="label" themeColor="textSecondary">
                Email
              </ThemedText>
              <View
                style={[
                  styles.input,
                  styles.readOnly,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.rule },
                ]}>
                <ThemedText numberOfLines={1}>{email ?? '—'}</ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                How you sign in. Ask to have it changed if you need to.
              </ThemedText>
            </View>

            <Field
              label="Phone"
              value={draft.phone}
              onChangeText={set('phone')}
              placeholder="Optional"
              keyboardType="phone-pad"
            />

            {/* Said before it happens, not discovered afterwards. Hosting a match
                hands your email to strangers who join it, which is a fair trade for
                being reachable but not one to make on somebody's behalf silently.
                Placed under the contact fields, where the question arises. */}
            <ThemedView
              type="background"
              style={[styles.notice, { borderColor: theme.rule }]}>
              <ThemedText type="label" themeColor="textSecondary">
                Who can see this
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                When you host a match, everyone who takes a seat can see your email
                address — and your phone number if you have given one — so they can
                reach you. The same goes for members of a league you organize.
              </ThemedText>
              {/* The other direction, added when hosts got the ability to write to
                  their players. Worth its own sentence: it is the one case where
                  somebody else can see your address without you choosing to host
                  anything. */}
              <ThemedText type="small" themeColor="textSecondary">
                It also works the other way. When you join a match or a league, your
                email address is visible to whoever runs it, so they can send you
                updates — a change of venue, or a game called off. Other players
                never see it: group messages are sent blind.
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Nobody else sees either detail. They are never shown in Browse, on
                the leaderboard, or to people who have not joined.
              </ThemedText>
            </ThemedView>

            <PlaceAutocompleteInput
              label="Town"
              value={draft.town}
              onChangeText={(next) => {
                setDraft((current) => ({ ...current, town: next }));
                // A town typed by hand has no position, and keeping the previous
                // one would filter Browse around the wrong place.
                setHome(null);
              }}
              onSelectPlace={(suggestion) => {
                setDraft((current) => ({ ...current, town: suggestion.mainText }));
                setHome(null);
                // Not awaited: the field stays responsive, and a profile without
                // coordinates is perfectly valid — it just cannot sort by distance.
                fetchPlaceLocation(suggestion.placeId).then(setHome);
              }}
              placeholder="Where you play from"
              hint="Pick a suggestion, and Browse can show you the closest tables first."
              kind="city"
            />

            <View style={styles.field}>
              <ThemedText type="label" themeColor="textSecondary">
                Experience
              </ThemedText>
              <View style={styles.chips}>
                {EXPERIENCE_LEVELS.map((level: ExperienceLevel) => {
                  const selected = draft.experience_level === level;
                  return (
                    <Pressable
                      key={level}
                      onPress={() => set('experience_level')(selected ? '' : level)}
                      style={({ pressed }) => pressed && styles.pressed}>
                      <ThemedView
                        type={selected ? 'backgroundSelected' : 'background'}
                        style={[styles.chip, { borderColor: theme.rule }]}>
                        <ThemedText
                          type="label"
                          themeColor={selected ? 'text' : 'textSecondary'}>
                          {level}
                        </ThemedText>
                      </ThemedView>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {error ? (
              <ThemedText type="small" style={{ color: theme.danger }}>
                {error}
              </ThemedText>
            ) : null}
            {status ? (
              <ThemedText type="small" style={{ color: theme.accentInk }}>
                {status}
              </ThemedText>
            ) : null}

            <GradientButton label="Save profile" onPress={save} busy={isSaving} wide />

            {/* Signing out is not something to encourage, so it stays the quietest
                control on the screen rather than taking the outline treatment. */}
            <Pressable onPress={signOut} style={({ pressed }) => pressed && styles.pressed}>
              <View style={[styles.secondaryButton, { borderColor: theme.rule }]}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Sign out
                </ThemedText>
              </View>
            </Pressable>
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  header: {
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  subtitle: {
    marginTop: 2,
  },
  field: {
    gap: Spacing.one,
  },
  /** An outlined card rather than a `hint` line: it is two sentences, not a caption. */
  notice: {
    padding: Spacing.three,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  input: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
  },
  /**
   * A value you can read but not type into. On the page ground rather than the card
   * white the editable fields use, so it looks unavailable before it is tapped —
   * the same distinction the inputs already draw, in reverse.
   */
  readOnly: {
    justifyContent: 'center',
    minHeight: 44,
  },
  chips: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryButton: {
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.7,
  },
  centered: {
    marginTop: Spacing.six,
  },
});
