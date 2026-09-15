import { useEffect } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import Animated, { Easing, FadeInDown, FadeOutDown } from "react-native-reanimated";

import { colors, radius } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { useUiStore } from "@/stores/uiStore";

const TOAST_TTL_MS = 6_000;

// Toast motion (expo-animation skill recipe): enter from below over 300ms,
// exit the same way ~20% faster. Builders live at module scope — inline
// chains rebuild on every render. Uninvited UI stays quick and quiet.
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const TOAST_ENTER = FadeInDown.duration(300).easing(EASE_OUT);
const TOAST_EXIT = FadeOutDown.duration(250).easing(EASE_OUT);

export function Toasts({ topOffset }: { topOffset: number }) {
  const toasts = useUiStore((s) => s.toasts);
  const dismissToast = useUiStore((s) => s.dismissToast);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setInterval(() => {
      const cutoff = Date.now() - TOAST_TTL_MS;
      for (const t of useUiStore.getState().toasts) {
        if (t.atMs < cutoff) dismissToast(t.key);
      }
    }, 1_000);
    return () => clearInterval(timer);
  }, [toasts.length, dismissToast]);

  if (toasts.length === 0) return null;
  return (
    <>
      {toasts.map((t, i) => (
        <Animated.View
          key={t.key}
          entering={TOAST_ENTER}
          exiting={TOAST_EXIT}
          // Toasts announce themselves (native-ui Behavior): the container
          // is the live region, the nested Pressable stays the dismissal
          // control. Note: no `accessible` here — grouping would fold the
          // dismiss button into one element and hide it from screen readers.
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[styles.toast, t.severity === "warn" && styles.warn, { top: topOffset + i * 54 }]}
        >
          <Pressable
            onPress={() => dismissToast(t.key)}
            accessibilityRole="button"
            accessibilityHint="Dismisses this notification"
          >
            <Text style={styles.title} numberOfLines={1}>
              {t.title}
            </Text>
            {t.body ? (
              <Text style={styles.body} numberOfLines={1}>
                {t.body}
              </Text>
            ) : null}
          </Pressable>
        </Animated.View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    alignSelf: "center",
    maxWidth: "86%",
    backgroundColor: colors.scrim,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
  },
  warn: { borderColor: colors.warning },
  title: { color: colors.text, fontFamily: fontFamily.bold, fontSize: 13 },
  body: { color: colors.textDim, fontSize: 12, fontFamily: fontFamily.regular, marginTop: 1 },
});
