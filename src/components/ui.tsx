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

import { colors } from "@/constants/theme";

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
}

export function Button({
  label,
  onPress,
  disabled,
  busy,
  variant = "primary",
  size = "default",
  a11yLabel,
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
      style={({ pressed }) => [
        styles.btn,
        base,
        size === "compact" && styles.btnCompact,
        (disabled || busy) && styles.btnDisabled,
        pressed && styles.btnPressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <Text
          style={[
            styles.btnText,
            size === "compact" && styles.btnTextCompact,
            variant === "ghost" && { color: colors.accent },
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
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Screen-reader label; defaults to the visible label. */
  a11yLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label}
      accessibilityState={{ selected }}
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
    fontWeight: "700",
    marginBottom: 4,
  },
  label: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 18,
    marginBottom: 8,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
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
  },
  btn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  btnPrimary: { backgroundColor: colors.accent },
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
  btnText: { color: colors.text, fontSize: 16, fontWeight: "600" },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: { color: colors.textDim, fontSize: 14, fontWeight: "600" },
  chipTextSelected: { color: colors.text },
  row: { flexDirection: "row", alignItems: "center" },
});
