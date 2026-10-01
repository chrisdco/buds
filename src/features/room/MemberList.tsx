import { memo, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppSymbol, icons } from "@/components/Symbol";
import { PeepAvatar } from "@/components/PeepAvatar";
import { WaitingPeepArt } from "@/components/illustrations/WaitingPeepArt";
import { colors, radius } from "@/constants/theme";
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
  const selected = useMemo(() => new Set(selectedIds ?? []), [selectedIds]);
  const sorted = useMemo(
    () => [...members].sort((a, b) => a.name.localeCompare(b.name)),
    [members],
  );
  if (sorted.length === 0) {
    return (
      <View style={styles.empty}>
        <WaitingPeepArt width={84} />
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
      {sorted.map((m) => (
        <MemberCard
          key={m.userId}
          member={m}
          isHost={m.userId === hostId}
          isLeader={m.userId === leaderId}
          insight={insights[m.userId]}
          nowMs={nowMs}
          units={units}
          selected={selected.has(m.userId)}
          onSelectMember={onSelectMember}
        />
      ))}
    </ScrollView>
  );
}

const MemberCard = memo(function MemberCard({
  member: m,
  isHost,
  isLeader,
  insight,
  nowMs,
  units,
  selected,
  onSelectMember,
}: {
  member: MemberLive;
  isHost: boolean;
  isLeader: boolean;
  insight: MemberInsight | undefined;
  nowMs: number;
  units: DistanceUnit;
  selected: boolean;
  onSelectMember?: (userId: string) => void;
}) {
  const state = presenceOf(m, nowMs);
  const extra = m.role === "spectator" ? null : insightLine(insight, units);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && onSelectMember && styles.cardPressed,
      ]}
      disabled={!onSelectMember}
      accessibilityRole={onSelectMember ? "button" : undefined}
      accessibilityLabel={onSelectMember ? `View ${m.name}` : undefined}
      accessibilityHint={extra ?? undefined}
      accessibilityState={onSelectMember ? { selected } : undefined}
      testID={onSelectMember ? `member-card-${m.userId}` : undefined}
      onPress={onSelectMember ? () => onSelectMember(m.userId) : undefined}
    >
      <View style={styles.cardHeader}>
        <PeepAvatar seed={m.userId} size={40} />
        <View style={styles.cardTitle}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {m.name}
            </Text>
            {isLeader && (
              <AppSymbol
                name={icons.star}
                fallback={icons.star.fallback}
                size={12}
                tintColor={colors.warning}
              />
            )}
          </View>
          {isHost && <Text style={styles.hostBadge}>HOST</Text>}
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
});

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 8, alignItems: "flex-start" },
  empty: { paddingHorizontal: 16, paddingVertical: 10, alignItems: "center", gap: 8 },
  emptyText: { color: colors.textDim, fontSize: 13, fontFamily: fontFamily.regular },
  card: {
    backgroundColor: colors.surface,
    borderColor: "transparent",
    borderWidth: 2,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: 184,
    flexShrink: 0,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  /** Focused card: bright border like Uber's selected ride row. Border width
  stays 2 in both states (transparent when idle) so selection never shifts
  layout — same no-mutation rule as the tab pill + avatar picker. */
  cardSelected: { borderColor: colors.text },
  cardPressed: { opacity: 0.8 },
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
