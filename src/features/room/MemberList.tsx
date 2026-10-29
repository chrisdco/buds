import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PeepAvatar } from "@/components/PeepAvatar";
import { WaitingPeepArt } from "@/components/illustrations/WaitingPeepArt";
import { colorForUser, colors, radius, space } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { typeScale } from "@/constants/typography";
import type { DistanceUnit } from "@/lib/geo";
import type { MemberInsight } from "@/modes/types";
import { memberMeta, memberValue, sortMembers } from "@/features/room/sheetLogic";
import { presenceOf } from "@/stores/membersStore";
import type { MemberLive } from "@/types/contracts";

// The room's member list in Uber ride-list grammar (ref "Choose a trip"):
// one vertical row per person — face left, name + status, and the deciding
// number (ETA) right-aligned as the largest text. Rows sort by what needs
// attention: SOS, then soonest arrival, arrived last, spectators at the end.

interface MemberListProps {
  members: MemberLive[];
  myUserId: string | null;
  hostId: string | null;
  leaderId: string | null;
  insights: Record<string, MemberInsight>;
  sosUserIds: string[];
  nowMs: number;
  units: DistanceUnit;
  onSelectMember?: (userId: string) => void;
  /** Focus-set members render selected (Uber selected-row border). */
  selectedIds?: string[];
}

export function MemberList({
  members,
  myUserId,
  hostId,
  leaderId,
  insights,
  sosUserIds,
  nowMs,
  units,
  onSelectMember,
  selectedIds,
}: MemberListProps) {
  const selected = useMemo(() => new Set(selectedIds ?? []), [selectedIds]);
  const sos = useMemo(() => new Set(sosUserIds), [sosUserIds]);
  const sorted = useMemo(() => sortMembers(members, insights, sos), [members, insights, sos]);
  if (sorted.length === 0) {
    return (
      <View style={styles.empty}>
        <WaitingPeepArt width={84} />
        <Text style={typeScale.rowSub}>No one here yet — invite your buds.</Text>
      </View>
    );
  }
  return (
    <View>
      {sorted.map((m) => (
        <MemberRow
          key={m.userId}
          member={m}
          value={m.role === "spectator" ? null : memberValue(insights[m.userId], units)}
          meta={memberMeta(m, insights[m.userId], units, nowMs, {
            isMe: m.userId === myUserId,
            isHost: m.userId === hostId,
            isLeader: m.userId === leaderId,
            sos: sos.has(m.userId),
          })}
          isMe={m.userId === myUserId}
          sos={sos.has(m.userId)}
          faded={(() => {
            const s = presenceOf(m, nowMs);
            return s === "offline" || s === "reconnecting";
          })()}
          selected={selected.has(m.userId)}
          onSelectMember={onSelectMember}
        />
      ))}
    </View>
  );
}

const MemberRow = memo(function MemberRow({
  member: m,
  value,
  meta,
  isMe,
  sos,
  faded,
  selected,
  onSelectMember,
}: {
  member: MemberLive;
  value: string | null;
  meta: string;
  isMe: boolean;
  sos: boolean;
  faded: boolean;
  selected: boolean;
  onSelectMember?: (userId: string) => void;
}) {
  const name = isMe ? `${m.name} (you)` : m.name;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        sos && styles.rowSos,
        pressed && onSelectMember && styles.pressed,
      ]}
      disabled={!onSelectMember}
      accessibilityRole={onSelectMember ? "button" : undefined}
      accessibilityLabel={`${name}, ${meta}${value ? `, ${value}` : ""}`}
      accessibilityHint={onSelectMember ? "Opens their details" : undefined}
      accessibilityState={onSelectMember ? { selected } : undefined}
      testID={onSelectMember ? `member-card-${m.userId}` : undefined}
      onPress={onSelectMember ? () => onSelectMember(m.userId) : undefined}
    >
      {/* Ring in the member's map color ties the row to their marker. */}
      <View style={[styles.avatarRing, { borderColor: colorForUser(m.userId) }, faded && styles.faded]}>
        <PeepAvatar seed={m.userId} size={40} />
      </View>
      <View style={styles.body}>
        <Text style={typeScale.rowTitle} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[typeScale.rowSub, sos && styles.sosText]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      {value ? <Text style={[typeScale.value, styles.value]}>{value}</Text> : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  empty: { paddingVertical: space.md, alignItems: "center", gap: space.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 72,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: "transparent",
  },
  // Uber's selected ride row: a white border, no layout shift (border is
  // always laid out, transparent when idle).
  rowSelected: { borderColor: colors.text },
  rowSos: { borderColor: colors.danger },
  pressed: { opacity: 0.75 },
  avatarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  faded: { opacity: 0.45 },
  body: { flex: 1, flexShrink: 1, gap: 2 },
  sosText: { color: colors.danger, fontFamily: fontFamily.semiBold },
  value: { marginLeft: space.sm },
});
