import { ScrollView, StyleSheet, Text, View } from "react-native";

import { colorForUser, colors } from "@/constants/theme";
import { presenceLabel, presenceOf } from "@/stores/membersStore";
import type { MemberLive } from "@/types/contracts";

interface MemberListProps {
  members: MemberLive[];
  hostId: string | null;
  nowMs: number;
}

export function MemberList({ members, hostId, nowMs }: MemberListProps) {
  const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {sorted.map((m) => {
        const state = presenceOf(m, nowMs);
        return (
          <View key={m.userId} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.dot, { backgroundColor: colorForUser(m.userId) }]} />
              <Text style={styles.name} numberOfLines={1}>
                {m.name}
              </Text>
              {m.userId === hostId && <Text style={styles.hostBadge}>HOST</Text>}
            </View>
            <Text style={styles.status} numberOfLines={1}>
              {m.role === "spectator" ? "Spectator" : presenceLabel(state, m, nowMs)}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 12, gap: 8 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 120,
    maxWidth: 170,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { color: colors.text, fontWeight: "600", fontSize: 14, flexShrink: 1 },
  hostBadge: {
    color: colors.warning,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  status: { color: colors.textDim, fontSize: 12, marginTop: 3 },
});
