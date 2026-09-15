import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";

export interface SosBannerItem {
  userId: string;
  name: string;
  atMs: number;
  /** Sender's latest known position (null when never positioned). */
  pos: { lat: number; lng: number } | null;
}

// Persistent emergency banner (#45): unlike toasts it does not expire on a
// timer — it lives while the sender's SOS is fresh in the store (TTL,
// explicit clear, or leave). Red distress language, one line per sender,
// with a Navigate action to their live marker. The container is the live
// region but stays ungrouped so Navigate remains its own control.
export function SosBanner({
  items,
  nowMs,
  top,
  onNavigate,
}: {
  items: SosBannerItem[];
  nowMs: number;
  top: number;
  onNavigate: (lat: number, lng: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <View
      style={[styles.stack, { top }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {items.map((item) => {
        const pos = item.pos;
        return (
          <View
            key={item.userId}
            style={styles.banner}
            testID="sos-banner"
            accessibilityLabel={`SOS, ${item.name} needs help, ${freshness(item.atMs, nowMs)}`}
          >
            <Text style={styles.text} numberOfLines={1}>
              SOS — {item.name} needs help · {freshness(item.atMs, nowMs)}
            </Text>
            {pos && (
              <Pressable
                style={styles.nav}
                accessibilityRole="button"
                accessibilityLabel={`Navigate to ${item.name}`}
                testID="sos-navigate"
                onPress={() => onNavigate(pos.lat, pos.lng)}
              >
                <Text style={styles.navText}>Navigate</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

function freshness(atMs: number, nowMs: number): string {
  const mins = Math.max(0, Math.round((nowMs - atMs) / 60_000));
  return mins < 1 ? "just now" : `${mins}m ago`;
}

const styles = StyleSheet.create({
  stack: { position: "absolute", alignSelf: "center", maxWidth: "92%", gap: 6 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.danger,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  text: {
    color: colors.text,
    fontFamily: fontFamily.bold,
    fontSize: 13,
    flexShrink: 1,
  },
  nav: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  navText: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 12 },
});
