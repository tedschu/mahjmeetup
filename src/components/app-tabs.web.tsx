import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Image } from 'expo-image';
import { Pressable, useWindowDimensions, View, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';

import {
  CompactBreakpoint,
  CompactTabBarHeight,
  MaxContentWidth,
  Spacing,
  WebTabBarInset,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Four labels and a brand mark do not fit across a phone, so on narrow screens
 * the navigation moves to the bottom of the window, where the native tabs
 * already live and where a thumb can reach it.
 */
function useCompact() {
  const { width } = useWindowDimensions();
  return width < CompactBreakpoint;
}

export default function AppTabs() {
  const compact = useCompact();

  return (
    <Tabs>
      {/* The bar floats over the content, so the content has to be inset past
          it — above on wide screens, below on narrow ones. */}
      <TabSlot
        style={{
          height: '100%',
          paddingTop: compact ? Spacing.three : WebTabBarInset,
          paddingBottom: compact ? CompactTabBarHeight : 0,
        }}
      />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="index" href="/" asChild>
            <TabButton>Browse</TabButton>
          </TabTrigger>
          <TabTrigger name="matches" href="/matches" asChild>
            <TabButton>My Matches</TabButton>
          </TabTrigger>
          <TabTrigger name="leaderboard" href="/leaderboard" asChild>
            <TabButton>Leaderboard</TabButton>
          </TabTrigger>
          <TabTrigger name="profile" href="/profile" asChild>
            <TabButton>Profile</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const compact = useCompact();
  const theme = useTheme();

  return (
    <Pressable
      {...props}
      style={({ pressed }) => [compact && styles.compactTrigger, pressed && styles.pressed]}>
      {/* A gold rule marks the active tab rather than a filled shape: the
          filter chips are filled pills, and the navigation should not read as
          another row of filters. The rule sits above the label in the bottom
          bar and below it in the top bar, so it always points at the edge the
          bar is anchored to. Transparent when inactive keeps the row from
          shifting as the selection moves. */}
      <View
        style={[
          styles.tabButtonView,
          compact && styles.compactTabButtonView,
          compact
            ? { borderTopColor: isFocused ? theme.accentGold : 'transparent' }
            : { borderBottomColor: isFocused ? theme.accentGold : 'transparent' },
        ]}>
        <ThemedText
          type="label"
          themeColor={isFocused ? 'text' : 'textSecondary'}
          numberOfLines={1}>
          {children}
        </ThemedText>
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const compact = useCompact();
  const theme = useTheme();

  if (compact) {
    return (
      <View
        {...props}
        style={[
          styles.compactContainer,
          { backgroundColor: theme.background, borderColor: theme.rule },
        ]}>
        {props.children}
      </View>
    );
  }

  return (
    <View {...props} style={styles.tabListContainer}>
      {/* Shares the content column's width and padding, so the mark's left
          edge lines up with the headings and cards below it. */}
      <View style={styles.bar}>
        {/* The mark sits outside the pill so it reads as the app's own, rather
            than as the first item in the navigation. */}
        <Image
          source={require('@/assets/images/logo.png')}
          style={styles.brandMark}
          contentFit="contain"
          accessibilityLabel="Mahjong Meetup"
        />

        {/* No pill around the tabs: the gold rule already marks the active one,
            and a filled container made the navigation read as another card. */}
        <View style={styles.innerContainer}>{props.children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    paddingVertical: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    maxWidth: MaxContentWidth,
    // Matches the horizontal padding every screen's content uses.
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  brandMark: {
    width: 48,
    height: 48,
  },
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.four,
  },
  compactContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: CompactTabBarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.two,
  },
  /** Equal shares of the bar, so the four labels never crowd each other out. */
  compactTrigger: {
    flex: 1,
  },
  tabButtonView: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  compactTabButtonView: {
    paddingHorizontal: Spacing.one,
    // Comfortably tappable; below this a thumb starts missing.
    minHeight: 44,
    borderBottomWidth: 0,
    borderTopWidth: 2,
    borderTopColor: 'transparent',
  },
  pressed: {
    opacity: 0.7,
  },
});
