import { StyleSheet, View, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

const MOCK_MATCHES = [
  { id: '1', date: 'Fri, Oct 27', time: '7:00 PM', location: 'Ted\'s House', players: 2, max: 4, type: 'Casual' },
  { id: '2', date: 'Sat, Oct 28', time: '2:00 PM', location: 'Community Center', players: 4, max: 4, type: 'League' },
  { id: '3', date: 'Sun, Oct 29', time: '1:00 PM', location: 'Sarah\'s Place', players: 1, max: 4, type: 'Casual' },
];

export default function BrowseMatchesScreen() {
  const renderItem = ({ item }: { item: any }) => (
    <ThemedView type="backgroundElement" style={styles.matchCard}>
      <View style={styles.cardHeader}>
        <ThemedText type="defaultSemiBold">{item.date} @ {item.time}</ThemedText>
        <ThemedText type="small" style={styles.badge}>{item.type}</ThemedText>
      </View>
      <ThemedText>{item.location}</ThemedText>
      <ThemedText style={styles.playersText}>
        Players: {item.players} / {item.max} {item.players === item.max ? '(Full)' : '(Open)'}
      </ThemedText>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="title">Open Matches</ThemedText>
          <ThemedText style={styles.subtitle}>Find a table to join</ThemedText>
        </View>

        <FlatList
          data={MOCK_MATCHES}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          style={styles.list}
        />
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
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
  },
  subtitle: {
    opacity: 0.7,
    marginTop: 4,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  matchCard: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: '#007AFF20',
    color: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  playersText: {
    marginTop: Spacing.one,
    opacity: 0.8,
  }
});
