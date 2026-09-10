import { useEffect } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { colors } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { useUiStore } from "@/stores/uiStore";

const TOAST_TTL_MS = 6_000;

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
        <Pressable
          key={t.key}
          style={[
            styles.toast,
            t.severity === "warn" && styles.warn,
            { top: topOffset + i * 54 },
          ]}
          onPress={() => dismissToast(t.key)}
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
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
  },
  warn: { borderColor: colors.warning },
  title: { color: colors.text, fontFamily: fontFamily.bold, fontSize: 13 },
  body: { color: colors.textDim, fontSize: 12, fontFamily: fontFamily.regular, marginTop: 1 },
});
