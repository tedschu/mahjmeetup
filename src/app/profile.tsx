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
                {email ?? 'How the group sees you'}
              </ThemedText>
            </View>

            <Field
              label="Name"
              value={draft.name}
              onChangeText={set('name')}
              placeholder="What the group calls you"
              hint="Shown on match cards and the leaderboard."
            />

            <Field
              label="Phone"
              value={draft.phone}
              onChangeText={set('phone')}
              placeholder="Optional"
              keyboardType="phone-pad"
            />

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
  input: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
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
