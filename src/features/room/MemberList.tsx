import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colorForUser, colors } from "@/constants/theme";
import { formatDistanceM } from "@/lib/geo";
import { formatDurationS } from "@/lib/time";
import type { MemberInsight } from "@/modes/types";
import { presenceLabel, presenceOf } from "@/stores/membersStore";
import type { MemberLive } from "@/types/contracts";

function insightLine(insight: MemberInsight | undefined): string | null {
  if (!insight) return null;
  if (insight.arrivedRank != null) return `Arrived #${insight.arrivedRank}`;
  const parts: string[] = [];
  if (insight.etaS != null) parts.push(`ETA ${formatDurationS(insight.etaS)}`);
  if (insight.remainingM != null) parts.push(formatDistanceM(insight.remainingM));
  if (parts.length === 0 && insight.distanceToLeaderM != null) {
    parts.push(`${formatDistanceM(insight.distanceToLeaderM)} behind`);
  }
  if (parts.length === 0 && insight.distanceFromCentroidM != null) {
    parts.push(
      insight.outsideRadius
        ? // U+FE0E forces monochrome text presentation cross-platform.
          `${"\u26A0\uFE0E"} ${formatDistanceM(insight.distanceFromCentroidM)} out`
        : `${formatDistanceM(insight.distanceFromCentroidM)} from center`,
    );
  }
  if (insight.overlapPct != null && insight.overlapPct >= 30) {
    parts.push(`${insight.overlapPct}% shared`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

interface MemberListProps {
  members: MemberLive[];
  hostId: string | null;
  leaderId: string | null;
  insights: Record<string, MemberInsight>;
  nowMs: number;
  /** Opens the member detail sheet; omitted = cards not tappable. */
  onSelectMember?: (userId: string) => void;
}

export function MemberList({
  members,
  hostId,
  leaderId,
  insights,
  nowMs,
  onSelectMember,
}: MemberListProps) {
  const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name));
  if (sorted.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No members yet — invite your buds from the map</Text>
      </View>
    );
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {sorted.map((m) => {
        const state = presenceOf(m, nowMs);
        const extra = m.role === "spectator" ? null : insightLine(insights[m.userId]);
        return (
          <Pressable
            key={m.userId}
            style={styles.card}
            disabled={!onSelectMember}
            accessibilityRole={onSelectMember ? "button" : undefined}
            accessibilityLabel={onSelectMember ? `View ${m.name}` : undefined}
            onPress={onSelectMember ? () => onSelectMember(m.userId) : undefined}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.dot, { backgroundColor: colorForUser(m.userId) }]} />
              <Text style={styles.name} numberOfLines={1}>
                {m.name}
              </Text>
              {m.userId === leaderId && <Text style={styles.leaderBadge}>★</Text>}
              {m.userId === hostId && <Text style={styles.hostBadge}>HOST</Text>}
            </View>
            <Text style={styles.status} numberOfLines={1}>
              {m.role === "spectator" ? "Spectator" : presenceLabel(state, m, nowMs)}
            </Text>
            {extra && (
              <Text style={styles.insight} numberOfLines={1}>
                {extra}
              </Text>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 12, gap: 8 },
  empty: { paddingHorizontal: 16, paddingVertical: 10 },
  emptyText: { color: colors.textDim, fontSize: 13 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 130,
    maxWidth: 180,
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
  leaderBadge: { color: colors.warning, fontSize: 12 },
  status: { color: colors.textDim, fontSize: 12, marginTop: 3 },
  insight: { color: colors.accent, fontSize: 12, marginTop: 2, fontWeight: "600" },
});
