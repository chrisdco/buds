import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import type { BottomTabBarProps } from "expo-router/tabs";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";

import { AppSymbol, icons } from "@/components/Symbol";
import { colors, radius } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { tabBarHidden } from "@/features/nav/TabScrollView";

// Floating tab bar for expo-router's (stable, JS) Tabs: one component on
// both platforms, like Uber/Instagram, instead of the alpha native tabs.
// The pill floats over the screen (content scrolls behind it, roots end in
// TabBarClearance). On iOS 26 the pill is real Liquid Glass via
// expo-glass-effect; elsewhere the same shape is a solid elevated surface.
// Scrolling down in a TabScrollView tucks it away; scrolling up returns it.
const TABS = {
  index: { label: "Home", testID: "tab-home", icon: icons.home },
  trips: { label: "Trips", testID: "tab-trips", icon: icons.trips },
  profile: { label: "Profile", testID: "tab-profile", icon: icons.profile },
} as const;

const glass = isLiquidGlassAvailable();
const BAR_MARGIN = 8;

export function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  const [barH, setBarH] = useState(80);

  // A freshly focused tab always starts with the bar visible.
  useEffect(() => {
    tabBarHidden.value = 0;
  }, [state.index]);

  const offscreen = barH + insets.bottom + BAR_MARGIN;
  const slide = useAnimatedStyle(() => ({
    transform: [{ translateY: withTiming(tabBarHidden.value * offscreen, { duration: 220 }) }],
  }));

  const items = state.routes.map((route, index) => {
    const tab = TABS[route.name as keyof typeof TABS];
    if (!tab) return null;
    const selected = state.index === index;
    return (
      <Pressable
        key={route.key}
        style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
        accessibilityRole="button"
        accessibilityLabel={tab.label}
        accessibilityHint={selected ? `${tab.label}, current tab` : `Go to ${tab.label}`}
        accessibilityState={{ selected }}
        testID={tab.testID}
        hitSlop={4}
        onPress={() => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!selected && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        }}
      >
        <View style={styles.pill}>
          {/* Selected fill mounts/unmounts with its final paint instead of
          mutating backgroundColor on the pill: on Fabric/Android a bg-only
          update can drop the view's borderRadius, turning the capsule
          into a box after navigating away and back. */}
          {selected ? <View style={[styles.pillFill, glass && styles.pillFillGlass]} pointerEvents="none" /> : null}
          <AppSymbol
            name={{ ios: tab.icon.ios, android: tab.icon.android }}
            fallback={tab.icon.fallback}
            size={26}
            tintColor={selected ? colors.text : colors.textDim}
          />
          <Text style={[styles.label, selected && styles.labelSelected]}>{tab.label}</Text>
        </View>
      </Pressable>
    );
  });

  return (
    // Absolute over the scene: the margins around the pill stay see-through.
    <Animated.View
      style={[styles.wrap, { paddingBottom: insets.bottom + BAR_MARGIN }, slide]}
      pointerEvents="box-none"
    >
      {glass ? (
        <GlassView
          glassEffectStyle="regular"
          colorScheme="dark"
          isInteractive
          style={[styles.bar, styles.barGlass]}
          onLayout={(e) => setBarH(e.nativeEvent.layout.height)}
        >
          {items}
        </GlassView>
      ) : (
        <View style={[styles.bar, styles.barSolid]} onLayout={(e) => setBarH(e.nativeEvent.layout.height)}>
          {items}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0 },
  bar: {
    flexDirection: "row",
    borderRadius: 30,
    marginHorizontal: 16,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  barGlass: { overflow: "hidden" },
  barSolid: {
    backgroundColor: colors.surfaceAlt,
    // Elevated above content like Uber's floating bar (Android shadow).
    // elevation is the whole shadow on Android: the legacy shadow* props
    // are iOS-only no-ops here, so they stay out (native-ui skill).
    elevation: 8,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 58 },
  tabPressed: { opacity: 0.7 },
  pill: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 26,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: "transparent",
  },
  pillFill: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.raised,
    borderRadius: radius.full,
  },
  // On glass a solid fill would punch a hole; a light wash reads as selected.
  pillFillGlass: { backgroundColor: "rgba(255,255,255,0.14)" },
  label: { color: colors.textDim, fontSize: 13, fontFamily: fontFamily.medium },
  labelSelected: { color: colors.text, fontFamily: fontFamily.semiBold },
});
