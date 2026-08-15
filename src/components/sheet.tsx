import { type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { QuietButton } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The frame the detail sheets share.
 *
 * Extracted the moment there were two of them — one for a match, one for a public
 * league — because they open from adjacent cards in the same list. A sheet that
 * slid up from a slightly different height, or dimmed the page a shade differently,
 * would read as a different kind of thing rather than the same gesture.
 */
export function Sheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/*
          The tappable backdrop, as a sibling behind the sheet rather than a
          Pressable wrapping it. Wrapping would swallow presses meant for the
          controls inside: on web a press is a click, and a click bubbles up to
          every handler above it instead of stopping at the deepest one.
        */}
        <Pressable style={styles.backdropFill} onPress={onClose} accessibilityLabel="Close" />

        <ThemedView style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.sheetContent}>{children}</ScrollView>
        </ThemedView>
      </View>
    </Modal>
  );
}

/**
 * The heading: what this is, above what it is called, with the dismiss control.
 *
 * A sheet tall enough to fill the screen leaves no obvious backdrop left to tap,
 * so it needs a real close button — unlike the small roster popover this pattern
 * replaced.
 */
export function SheetTitle({
  title,
  eyebrow,
  onClose,
}: {
  title: string;
  /** What kind of thing this is — "Pick-up match", "League". */
  eyebrow?: ReactNode;
  onClose: () => void;
}) {
  return (
    <View style={styles.titleRow}>
      <View style={styles.titleText}>
        <ThemedText type="subtitle">{title}</ThemedText>
        {eyebrow}
      </View>
      <QuietButton icon="close" label="Close" onPress={onClose} />
    </View>
  );
}

/**
 * A titled block. Every fact in a sheet is one of these, so the eye can find
 * "where" without reading "when" first — which is the whole reason these sheets
 * exist rather than longer cards.
 */
export function SheetSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="label" themeColor="textSecondary">
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

/** The action row, ruled off from the facts above it. */
export function SheetFooter({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return <View style={[styles.footer, { borderColor: theme.rule }]}>{children}</View>;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  backdropFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  sheet: {
    width: '100%',
    maxWidth: MaxContentWidth,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    maxHeight: '92%',
  },
  sheetContent: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  titleText: {
    flex: 1,
    gap: Spacing.half,
  },
  section: {
    gap: Spacing.one,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
  },
});
