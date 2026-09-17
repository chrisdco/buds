import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppSymbol, icons } from "@/components/Symbol";
import { colorForUser, colors, radius } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { formatDistanceM, type DistanceUnit } from "@/lib/geo";
import { formatDurationS } from "@/lib/time";
import type { MemberInsight } from "@/modes/types";
import { presenceLabel, presenceOf } from "@/stores/membersStore";
import type { MemberLive } from "@/types/contracts";

function insightLine(insight: MemberInsight | undefined, units: DistanceUnit): string | null {
  if (!insight) return null;
  if (insight.arrivedRank != null) return `Arrived #${insight.arrivedRank}`;
  const parts: string[] = [];
  if (insight.etaS != null) parts.push(`ETA ${formatDurationS(insight.etaS)}`);
  if (insight.remainingM != null) parts.push(formatDistanceM(insight.remainingM, units));
  if (parts.length === 0 && insight.distanceToLeaderM != null) {
    parts.push(`${formatDistanceM(insight.distanceToLeaderM, units)} behind`);
  }
  if (parts.length === 0 && insight.distanceFromCentroidM != null) {
    parts.push(
      insight.outsideRadius
        ? // U+FE0E forces monochrome text presentation cross-platform.
          `${"\u26A0\uFE0E"} ${formatDistanceM(insight.distanceFromCentroidM, units)} out`
        : `${formatDistanceM(insight.distanceFromCentroidM, units)} from center`,
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
  units: DistanceUnit;
  /** Opens the member detail sheet; omitted = cards not tappable. */
  onSelectMember?: (userId: string) => void;
  /** Focus-set members render selected (Uber selected-card border). */
  selectedIds?: string[];
}

export function MemberList({
  members,
  hostId,
  leaderId,
  insights,
  nowMs,
  units,
  onSelectMember,
  selectedIds,
}: MemberListProps) {
  const selected = new Set(selectedIds ?? []);
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
        const extra = m.role === "spectator" ? null : insightLine(insights[m.userId], units);
        return (
          <Pressable
            key={m.userId}
            style={[styles.card, selected.has(m.userId) && styles.cardSelected]}
            disabled={!onSelectMember}
            accessibilityRole={onSelectMember ? "button" : undefined}
            accessibilityLabel={onSelectMember ? `View ${m.name}` : undefined}
            testID={onSelectMember ? `member-card-${m.userId}` : undefined}
            onPress={onSelectMember ? () => onSelectMember(m.userId) : undefined}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.avatar, { backgroundColor: colorForUser(m.userId) }]}>
                <Text style={styles.avatarInitial}>
                  {m.name.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.cardTitle}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {m.name}
                  </Text>
                  {m.userId === leaderId && (
                    <AppSymbol
                      name={icons.star}
                      fallback={icons.star.fallback}
                      size={12}
                      tintColor={colors.warning}
                    />
                  )}
                </View>
                {m.userId === hostId && <Text style={styles.hostBadge}>HOST</Text>}
              </View>
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
  content: { paddingHorizontal: 20, gap: 8, alignItems: "flex-start" },
  empty: { paddingHorizontal: 16, paddingVertical: 10 },
  emptyText: { color: colors.textDim, fontSize: 13, fontFamily: fontFamily.regular },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: 184,
    flexShrink: 0,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  /** Focused card: bright border like Uber's selected ride row. */
  cardSelected: { borderColor: colors.text, borderWidth: 2 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { color: colors.text, fontFamily: fontFamily.bold, fontSize: 16 },
  cardTitle: { flex: 1, flexShrink: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  name: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 14, flexShrink: 1 },
  hostBadge: {
    color: colors.warning,
    fontSize: 9,
    fontFamily: fontFamily.extraBold,
    letterSpacing: 0.5,
  },
  leaderBadge: { color: colors.warning, fontSize: 12 },
  status: { color: colors.textDim, fontSize: 12, fontFamily: fontFamily.regular, marginTop: 3 },
  insight: {
    color: colors.accent,
    fontSize: 12,
    marginTop: 2,
    fontFamily: fontFamily.semiBold,
  },
});
