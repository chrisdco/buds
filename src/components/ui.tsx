import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import Animated, { cubicBezier } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radius, space } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";

// Shared near-imperceptible press transition (expo-animation skill recipe):
// 3% scale over 120ms. cubicBezier is required — Reanimated 4 rejects raw
// 'cubic-bezier(...)' strings at runtime. The cast bridges a typing gap:
// RN's StyleSheet types don't know Reanimated's easing object.
const pressTransition = {
  transform: [{ scale: 1 }],
  transitionProperty: "transform",
  transitionDuration: "120ms",
  transitionTimingFunction: cubicBezier(0.23, 1, 0.32, 1) as unknown as string,
};

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <SafeAreaView style={[styles.screen, style]} edges={["top", "bottom", "left", "right"]}>
      {children}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

export function TextField(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.textDim}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: "primary" | "ghost" | "danger";
  /** Compact density for decks/sheets with several actions. */
  size?: "default" | "compact";
  /** Screen-reader label; defaults to the visible label. */
  a11yLabel?: string;
  /** Stable selector for Maestro E2E flows (zero runtime cost). */
  testID?: string;
}

export function Button({
  label,
  onPress,
  disabled,
  busy,
  variant = "primary",
  size = "default",
  a11yLabel,
  testID,
}: ButtonProps) {
  const base =
    variant === "primary"
      ? styles.btnPrimary
      : variant === "danger"
        ? styles.btnDanger
        : styles.btnGhost;
  // Near-imperceptible press feedback (expo-animation skill recipe):
  // 3% scale over 120ms via Reanimated CSS transition — no gesture, no
  // shared value. setState fires twice per press, never per frame. The
  // visuals live on the inner Animated.View so the scale carries the
  // background with the label (what makes it read as physical); the outer
  // Pressable owns layout, hit area, and disabled opacity.
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={12}
      pressRetentionOffset={16}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label}
      accessibilityState={{ disabled: disabled || busy, busy: !!busy }}
      testID={testID}
      style={[styles.btnOuter, size === "compact" && styles.btnOuterCompact, (disabled || busy) && styles.btnDisabled, pressed && styles.btnPressed]}
    >
      <Animated.View
        style={[
          styles.btn,
          base,
          size === "compact" && styles.btnCompact,
          pressed && styles.btnScalePressed,
        ]}
      >
        {busy ? (
          <ActivityIndicator color={variant === "primary" ? colors.onPrimary : colors.text} />
        ) : (
          <Text
            style={[
              styles.btnText,
              size === "compact" && styles.btnTextCompact,
              variant === "primary" && styles.btnTextPrimary,
              variant === "danger" && styles.btnTextDanger,
              variant === "ghost" && styles.btnTextGhost,
            ]}
          >
            {label}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  a11yLabel,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Screen-reader label; defaults to the visible label. */
  a11yLabel?: string;
  /** Stable selector for Maestro E2E flows (zero runtime cost). */
  testID?: string;
}) {
  // Same near-imperceptible press scale as Button (tens of presses/day
  // tier). Selected state is a color change, kept — reduced motion drops
  // the scale but never the selection signal.
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={8}
      pressRetentionOffset={12}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label}
      accessibilityState={{ selected }}
      testID={testID}
      style={styles.chipOuter}
    >
      <Animated.View style={[styles.chip, selected && styles.chipSelected, pressed && styles.chipPressed]}>
        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

// Shared honest-loading block (law 8): centered spinner + optional label,
// no positioning opinions — callers wrap it in their Screen/overlay. One
// copy instead of the four that grew across _layout/invite/room/join.
export function LoadingView({ label, testID }: { label?: string; testID?: string }) {
  return (
    <View style={styles.loadingView} testID={testID}>
      <ActivityIndicator size="large" color={colors.accent} />
      {label ? <Text style={styles.loadingViewText}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 20,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontFamily: fontFamily.bold,
    letterSpacing: 0.2,
    marginBottom: space.xs,
  },
  label: {
    color: colors.textDim,
    fontSize: 13,
    fontFamily: fontFamily.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: space.md + 2,
    marginBottom: space.sm,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontFamily: fontFamily.regular,
    marginTop: 10,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
    fontFamily: fontFamily.regular,
  },
  btn: {
    borderRadius: radius.full,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    ...pressTransition,
  },
  btnOuter: {
    marginTop: 12,
  },
  btnOuterCompact: { marginTop: 8 },
  btnScalePressed: { transform: [{ scale: 0.97 }] },
  // Uber polarity flip for dark mode: primary CTA is white ink on canvas.
  btnPrimary: { backgroundColor: colors.primary },
  btnDanger: { backgroundColor: colors.danger },
  btnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnDisabled: { opacity: 0.5 },
  btnPressed: { opacity: 0.85 },
  btnCompact: { paddingVertical: 10 },
  btnTextCompact: { fontSize: 14 },
  // Primary/danger labels sit on filled ink: black/white respectively.
  // Ghost labels are plain white text (was accent blue).
  btnText: { fontSize: 16, fontFamily: fontFamily.medium },
  btnTextPrimary: { color: colors.onPrimary },
  btnTextDanger: { color: colors.text },
  btnTextGhost: { color: colors.text },
  chip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    ...pressTransition,
  },
  chipOuter: { marginRight: 8, marginBottom: 8 },
  chipPressed: { transform: [{ scale: 0.97 }] },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: { color: colors.textDim, fontSize: 14, fontFamily: fontFamily.semiBold },
  chipTextSelected: { color: colors.onPrimary },
  row: { flexDirection: "row", alignItems: "center" },
  loadingView: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingViewText: {
    color: colors.textDim,
    fontSize: 14,
    fontFamily: fontFamily.regular,
    marginTop: space.sm + 4,
  },
});
