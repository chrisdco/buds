import * as Linking from "expo-linking";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import { GroupedCard, IconTile, ListRow, NavHeader, SectionHeader, SelectableRow } from "@/components/layout";
import { PeepAvatar } from "@/components/PeepAvatar";
import { icons } from "@/components/Symbol";
import { Button, Chip, ErrorText, Screen } from "@/components/ui";
import { colorForUser, colors, space } from "@/constants/theme";
import { typeScale as ts } from "@/constants/typography";
import { extendedExpiryIso } from "@/lib/expiry";
import { MODE_OPTIONS } from "@/modes/modeOptions";
import { requestBatteryOptimizationExemption } from "@/services/location/battery";
import { stopBackgroundUpdates } from "@/services/location/backgroundTask";
import { ensureBackgroundLocation } from "@/services/location/permissions";
import { roomsRpc } from "@/services/rpc/rooms";
import { useMembersStore } from "@/stores/membersStore";
import { useRoomStore } from "@/stores/roomStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";

/** Switch styled once for every toggle row on this screen. */
function Toggle({
  value,
  disabled,
  testID,
  label,
  onValueChange,
}: {
  value: boolean;
  disabled?: boolean;
  testID: string;
  label: string;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <Switch
      value={value}
      disabled={disabled}
      testID={testID}
      accessibilityLabel={label}
      onValueChange={onValueChange}
      trackColor={{ true: colors.success, false: colors.raised }}
      thumbColor={colors.text}
    />
  );
}

export default function RoomSettingsScreen() {
  const room = useRoomStore((s) => s.room);
  const myMemberId = useRoomStore((s) => s.myMemberId);
  const destRoom = useRoomStore((s) => s.destRoom);
  const destByMember = useRoomStore((s) => s.destByMember);
  const membersMap = useMembersStore((s) => s.members);
  const myUserId = useSessionStore((s) => s.userId);
  const backgroundSharing = useSessionStore((s) => s.backgroundSharing);
  const [error, setError] = useState<string | null>(null);

  if (!room) return null;
  const isHost = room.host_id === myUserId;
  const me = myUserId ? membersMap[myUserId] : undefined;
  const members = Object.values(membersMap);
  const travelers = members.filter((m) => m.role === "traveler");
  const myDest = myMemberId ? destByMember[myMemberId] : undefined;

  const toggleBackgroundSharing = async (enabled: boolean) => {
    if (!enabled) {
      useSessionStore.getState().setBackgroundSharing(false);
      await stopBackgroundUpdates();
      return;
    }
    // Prime once: explain the Always ask before the OS dialog appears.
    const session = useSessionStore.getState();
    if (!session.primedBackground) {
      session.setPrimed("background");
      const ok = await useUiStore.getState().requestConfirm({
        title: "Share with the screen off?",
        body: "Buds will ask for always-on location so your group keeps seeing you during the trip.",
        confirmLabel: "Continue",
        cancelLabel: "Not now",
        destructive: false,
      });
      if (!ok) return;
    }
    const granted = await ensureBackgroundLocation();
    if (!granted) {
      Alert.alert(
        "Background location needed",
        "Allow location 'Always' in settings so Buds can keep sharing with the screen off.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => void Linking.openSettings() },
        ],
      );
      return;
    }
    useSessionStore.getState().setBackgroundSharing(true);
    // Best-effort: ask Android to exempt Buds from battery optimization.
    await requestBatteryOptimizationExemption();
  };

  const guard = async (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    const result = await action();
    if (!result.ok) {
      setError(
        result.error === "bad_expiry"
          ? "That expiry time isn't valid."
          : result.error === "bad_destination"
            ? "That destination isn't valid."
            : result.error === "network"
              ? "Couldn't reach the server — check your connection."
              : "That didn't work — only the host can change this.",
      );
    }
  };

  const setMode = (mode: (typeof MODE_OPTIONS)[number]["id"]) => {
    if (!isHost || mode === room.mode) return;
    void guard(() => roomsRpc.setMode(room.id, mode));
  };

  const kick = (userId: string, name: string) => {
    void (async () => {
      const ok = await useUiStore.getState().requestConfirm({
        title: `Remove ${name}?`,
        body: "They won't be able to rejoin this room.",
        confirmLabel: "Remove",
        destructive: true,
      });
      if (ok) void guard(() => roomsRpc.kickMember(room.id, userId));
    })();
  };

  const endRoom = () => {
    void (async () => {
      const ok = await useUiStore.getState().requestConfirm({
        title: "End room for everyone?",
        body: "This closes the room for all members.",
        confirmLabel: "End room",
        destructive: true,
      });
      if (ok) void roomsRpc.endRoom(room.id);
    })();
  };

  const extendBy = (ms: number) =>
    void guard(() => roomsRpc.setExpiry(room.id, extendedExpiryIso(room.expires_at, ms, Date.now())));

  return (
    <Screen>
      <NavHeader title="Room settings" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={ts.rowSub}>
          {room.name} · code {room.code}
          {isHost ? "" : " · host controls are read-only"}
        </Text>

        <SectionHeader title={isHost ? "Mode" : "Mode (host only)"} />
        <View accessibilityRole="radiogroup">
          {MODE_OPTIONS.map((m) => (
            <SelectableRow
              key={m.id}
              title={m.label}
              meta={m.blurb}
              selected={m.id === room.mode}
              leading={<IconTile icon={m.icon} round />}
              a11yLabel={`${m.label} mode`}
              a11yHint={m.blurb}
              testID={`settings-mode-${m.id}`}
              onPress={isHost ? () => setMode(m.id) : undefined}
            />
          ))}
        </View>

        {room.mode === "leader" && (
          <>
            <SectionHeader title="Leader" />
            <View style={styles.chips}>
              {travelers.map((m) => (
                <Chip
                  key={m.userId}
                  label={m.name}
                  selected={m.userId === room.leader_id}
                  onPress={() => isHost && void guard(() => roomsRpc.setLeader(room.id, m.userId))}
                />
              ))}
            </View>
          </>
        )}

        {me?.role === "traveler" && (
          <>
            <SectionHeader title="Privacy" />
            <GroupedCard>
              <ListRow
                title="Share my location"
                sub={me.sharing ? "Sharing live" : "Paused — buds see your last position"}
                divider
                trailing={
                  <Toggle
                    value={me.sharing}
                    label="Share my location"
                    testID="settings-sharing"
                    onValueChange={(sharing) => void roomsRpc.setSharing(room.id, sharing)}
                  />
                }
              />
              <ListRow
                title="Screen-off sharing"
                sub="Keeps sharing while Buds is in the background"
                trailing={
                  <Toggle
                    value={backgroundSharing}
                    label="Keep sharing with the screen off"
                    testID="settings-background"
                    onValueChange={(enabled) => void toggleBackgroundSharing(enabled)}
                  />
                }
              />
            </GroupedCard>
            <Text style={[ts.meta, styles.note]}>
              Shows a notification while active and asks to ignore battery
              optimization so Android doesn&apos;t stop it.
            </Text>
          </>
        )}

        <SectionHeader title="Access" />
        <GroupedCard>
          <ListRow
            title="Lock room"
            sub={room.locked ? "Nobody new can join" : "Open to joiners with the code"}
            trailing={
              <Toggle
                value={room.locked}
                disabled={!isHost}
                label="Lock room"
                testID="settings-lock"
                onValueChange={(locked) => void guard(() => roomsRpc.lockRoom(room.id, locked))}
              />
            }
          />
        </GroupedCard>

        {/* Expiry is visible to everyone; only the host can change it. */}
        <SectionHeader title="Expiry" />
        <Text style={[ts.rowSub, styles.expiry]}>
          {room.expires_at
            ? `Auto-closes ${new Date(room.expires_at).toLocaleString()}`
            : "No expiry set"}
        </Text>
        {isHost && (
          <View style={styles.chips}>
            <Chip label="+1 hour" selected={false} testID="settings-expiry-1h" onPress={() => extendBy(3_600_000)} />
            <Chip
              label="+4 hours"
              selected={false}
              testID="settings-expiry-4h"
              onPress={() => extendBy(4 * 3_600_000)}
            />
            {room.expires_at && (
              <Chip
                label="Remove limit"
                selected={false}
                testID="settings-expiry-none"
                onPress={() => void guard(() => roomsRpc.setExpiry(room.id, null))}
              />
            )}
          </View>
        )}

        {((destRoom && isHost) || myDest) && (
          <>
            <SectionHeader title="Destinations" />
            <GroupedCard>
              {destRoom && isHost && (
                <ListRow
                  icon={icons.flag}
                  title="Clear room destination"
                  sub={destRoom.label}
                  divider={!!myDest}
                  onPress={() => void guard(() => roomsRpc.clearDestination(room.id))}
                />
              )}
              {myDest && (
                <ListRow
                  icon={icons.pin}
                  title="Clear my destination"
                  sub={myDest.label}
                  onPress={() => void roomsRpc.clearDestination(room.id, myMemberId)}
                />
              )}
            </GroupedCard>
          </>
        )}

        <SectionHeader title={`Members · ${members.length}`} />
        <GroupedCard>
          {members.map((m, i) => (
            <ListRow
              key={m.userId}
              title={m.name}
              sub={
                [m.userId === room.host_id ? "Host" : null, m.role === "spectator" ? "Spectator" : null]
                  .filter(Boolean)
                  .join(" · ") || null
              }
              divider={i < members.length - 1}
              leading={
                <View style={[styles.avatarRing, { borderColor: colorForUser(m.userId) }]}>
                  <PeepAvatar seed={m.userId} size={36} />
                </View>
              }
              trailing={
                isHost && m.userId !== myUserId ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${m.name} from the room`}
                    testID={`settings-kick-${m.userId}`}
                    hitSlop={12}
                    onPress={() => kick(m.userId, m.name)}
                  >
                    <Text style={styles.kick}>Remove</Text>
                  </Pressable>
                ) : undefined
              }
            />
          ))}
        </GroupedCard>

        <ErrorText>{error}</ErrorText>
        {/* Destructive action sits alone at the end, spaced off the rest. */}
        {isHost && (
          <View style={styles.end}>
            <Button label="End room for everyone" variant="danger" testID="settings-end" onPress={endRoom} />
          </View>
        )}
        <View style={styles.bottom} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap" },
  note: { marginTop: space.sm },
  expiry: { marginBottom: space.sm },
  // Member hue as a ring: wayfinding color ties the row to the map marker.
  avatarRing: { borderWidth: 2, borderRadius: 22, padding: 2 },
  kick: { ...ts.meta, color: colors.danger, padding: 4 },
  end: { marginTop: space.lg },
  bottom: { height: space.xl },
});
