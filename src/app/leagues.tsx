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

import { LeagueDetail } from '@/components/league-detail';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  BottomTabInset,
  CardShadow,
  LeagueColorNames,
  LeagueColors,
  MaxContentWidth,
  Spacing,
  type LeagueColor,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { createLeague, fetchMyLeagues, type MyLeague } from '@/lib/leagues';
import { supabase } from '@/lib/supabase';

/** Creating a league is two decisions: what it is called and what colour it is. */
function NewLeagueForm({
  onCreate,
  onCancel,
  busy,
}: {
  onCreate: (name: string, color: LeagueColor) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [color, setColor] = useState<LeagueColor>('blue');

  return (
    <ThemedView type="background" style={[styles.card, { borderColor: theme.rule }]}>
      <ThemedText type="label" themeColor="textSecondary">
        League name
      </ThemedText>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Fox Valley League"
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text, borderColor: theme.rule }]}
      />

      <ThemedText type="label" themeColor="textSecondary">
        Colour
      </ThemedText>
      <View style={styles.swatches}>
        {LeagueColorNames.map((option) => (
          <Pressable
            key={option}
            onPress={() => setColor(option)}
            accessibilityRole="button"
            accessibilityLabel={option}
            style={({ pressed }) => pressed && styles.pressed}>
            <View
              style={[
                styles.swatch,
                { backgroundColor: LeagueColors[option] },
                color === option && { borderColor: theme.text, borderWidth: 3 },
              ]}
            />
          </Pressable>
        ))}
      </View>

      <View style={styles.formActions}>
        <Pressable onPress={onCancel} style={({ pressed }) => pressed && styles.pressed}>
          <ThemedView type="backgroundElement" style={styles.secondaryButton}>
            <ThemedText type="label" themeColor="textSecondary">
              Cancel
            </ThemedText>
          </ThemedView>
        </Pressable>
        <Pressable
          onPress={() => onCreate(name, color)}
          disabled={busy || name.trim().length === 0}
          style={({ pressed }) => pressed && styles.pressed}>
          <View
            style={[
              styles.primaryButton,
              { backgroundColor: LeagueColors[color] },
              (busy || name.trim().length === 0) && styles.disabled,
            ]}>
            <ThemedText type="label" style={styles.primaryLabel}>
              {busy ? 'Creating…' : 'Create league'}
            </ThemedText>
          </View>
        </Pressable>
      </View>
    </ThemedView>
  );
}

export default function LeaguesScreen() {
  const theme = useTheme();
  const [leagues, setLeagues] = useState<MyLeague[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [openLeagueId, setOpenLeagueId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('You are signed out.');
        return;
      }

      setUserId(user.id);
      setLeagues(await fetchMyLeagues(user.id));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your leagues.');
    }
  }, []);

  // Refetch on focus, so a league joined from an invite link on another screen
  // is here when you come back.
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

  const create = async (name: string, color: LeagueColor) => {
    if (!userId) return;

    setBusy(true);
    try {
      const id = await createLeague(userId, name, color);
      await load();
      setIsCreating(false);
      // Straight into the new league, because the next thing anyone wants is the
      // invite link.
      setOpenLeagueId(id);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create that league.');
    } finally {
      setBusy(false);
    }
  };

  const openLeague = leagues.find((league) => league.id === openLeagueId) ?? null;

  if (openLeague && userId) {
    return (
      <ThemedView type="backgroundElement" style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <LeagueDetail
            league={openLeague}
            userId={userId}
            onBack={() => setOpenLeagueId(null)}
            onChanged={load}
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView type="backgroundElement" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <ThemedText type="label" themeColor="accent">
              {leagues.length === 0
                ? 'Not in a league'
                : `${leagues.length} ${leagues.length === 1 ? 'league' : 'leagues'}`}
            </ThemedText>
            <ThemedText type="title">Leagues</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
              Seasons, meetups, and standings of their own
            </ThemedText>
          </View>

          {error ? (
            <ThemedText type="small" style={styles.error}>
              {error}
            </ThemedText>
          ) : null}

          {isLoading ? <ActivityIndicator style={styles.centered} /> : null}

          {leagues.map((league) => {
            const tint = LeagueColors[league.color] ?? theme.accent;
            return (
              <Pressable
                key={league.id}
                onPress={() => setOpenLeagueId(league.id)}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView
                  type="background"
                  style={[styles.leagueCard, { borderLeftColor: tint }]}>
                  <ThemedText type="subtitle" numberOfLines={1}>
                    {league.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {league.role === 'organizer' ? 'You organize this' : 'Member'}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            );
          })}

          {isCreating ? (
            <NewLeagueForm
              onCreate={create}
              onCancel={() => setIsCreating(false)}
              busy={busy}
            />
          ) : (
            <Pressable
              onPress={() => setIsCreating(true)}
              style={({ pressed }) => pressed && styles.pressed}>
              <View style={[styles.primaryButton, styles.wide, { backgroundColor: theme.accent }]}>
                <ThemedText type="smallBold" style={styles.primaryLabel}>
                  New league
                </ThemedText>
              </View>
            </Pressable>
          )}

          {!isLoading && leagues.length === 0 && !isCreating ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
              Start one and share its link, or open a link somebody sent you.
            </ThemedText>
          ) : null}
        </ScrollView>
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
  leagueCard: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderLeftWidth: 4,
    boxShadow: CardShadow,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
    boxShadow: CardShadow,
  },
  input: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
  },
  swatches: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 0,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  primaryButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
  },
  wide: {
    borderRadius: Spacing.three,
  },
  secondaryButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
  },
  primaryLabel: {
    color: '#ffffff',
  },
  disabled: {
    opacity: 0.5,
  },
  error: {
    color: '#c0392b',
  },
  centered: {
    marginTop: Spacing.three,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
