import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

const DURATION = 300;

export function AnimatedSplashOverlay() {
  return null;
}

/**
 * The launch mark on the login screen, fading and settling into place.
 *
 * Uses React Native's own `Animated` rather than Reanimated's `Keyframe`
 * entering animation, which this used to. Reanimated hides the view until its
 * entering animation starts, and on web that animation never ran — the mark sat
 * at `visibility: hidden` forever, so the login screen showed a blank space above
 * the wordmark. `Animated` needs no layout-animation support to work here.
 *
 * The mark is the first thing anyone sees, so it degrades the safe way: the
 * animation drives opacity and scale only, and the image renders regardless of
 * whether either ever runs.
 */
export function AnimatedIcon() {
  // Held in state rather than a ref: the value is read during render to build the
  // style, which is exactly what a ref is not for.
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      easing: Easing.out(Easing.back(1.4)),
      // The web driver animates through JS regardless; saying so avoids a warning.
      useNativeDriver: false,
    }).start();
  }, [progress]);

  return (
    <View style={styles.iconContainer}>
      {/* No tinted plate behind the mark: the logo is already a rounded square
          with its own edge, and a coloured plate behind it reads as a second,
          competing badge. */}
      <Animated.View
        style={[
          styles.imageContainer,
          {
            opacity: progress,
            transform: [
              { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1.2, 1] }) },
            ],
          },
        ]}>
        <Image style={styles.image} source={require('@/assets/images/logo.png')} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 176,
    height: 176,
  },
  image: {
    // Square, unlike the wordmark this replaced, which was 76x71.
    width: 160,
    height: 160,
  },
});
