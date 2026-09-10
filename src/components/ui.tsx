import type { ReactNode } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, space } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";

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
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label}
      accessibilityState={{ disabled: disabled || busy, busy: !!busy }}
      testID={testID}
      style={({ pressed }) => [
        styles.btn,
        base,
        size === "compact" && styles.btnCompact,
        (disabled || busy) && styles.btnDisabled,
        pressed && styles.btnPressed,
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
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label}
      accessibilityState={{ selected }}
      testID={testID}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
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
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
    fontFamily: fontFamily.regular,
  },
  btn: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
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
  btnCompact: { paddingVertical: 10, marginTop: 8 },
  btnTextCompact: { fontSize: 14 },
  // Primary/danger labels sit on filled ink: black/white respectively.
  // Ghost labels are plain white text (was accent blue).
  btnText: { fontSize: 16, fontFamily: fontFamily.medium },
  btnTextPrimary: { color: colors.onPrimary },
  btnTextDanger: { color: "#FFFFFF" },
  btnTextGhost: { color: colors.text },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: { color: colors.textDim, fontSize: 14, fontFamily: fontFamily.semiBold },
  chipTextSelected: { color: colors.onPrimary },
  row: { flexDirection: "row", alignItems: "center" },
});
