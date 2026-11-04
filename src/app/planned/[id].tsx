import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { GroupedCard, IconTile, ListRow, NavHeader, SectionHeader, SelectableRow, StickyFooter } from "@/components/layout";
import { AppSymbol, icons } from "@/components/Symbol";
import { Button, Screen } from "@/components/ui";
import { colors, space } from "@/constants/theme";
import { typeScale as ts } from "@/constants/typography";
import { countdownLabel, timeSlots } from "@/lib/planned";
import { placeCreateParams } from "@/lib/tripPresets";
import { usePlannedStore } from "@/stores/plannedStore";

// One planned trip ("Later"): where, when, whether a reminder is set. Move
// it to another slot, start it now, or drop it. Rows on Home and Trips land
// here instead of creating a room on tap.
export default function PlannedTripScreen() {
  const router = useRouter();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? (rawId[0] ?? "") : (rawId ?? "");
  const trip = usePlannedStore((s) => s.planned?.find((t) => t.id === id));
  const [nowMs] = useState(() => Date.now());
  const [slots] = useState(() => timeSlots(Date.now()));
  const [busy, setBusy] = useState(false);

  if (!trip) {
    return (
      <Screen>
        <NavHeader />
        <View style={styles.center}>
          <Text style={ts.section}>Plan not found</Text>
          <Text style={[ts.rowSub, styles.centerSub]}>It may have passed or been cancelled.</Text>
        </View>
      </Screen>
    );
  }

  const when = new Date(trip.atMs).toLocaleString([], {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  const move = (atMs: number) => {
    if (busy) return;
    setBusy(true);
    void usePlannedStore
      .getState()
      .reschedule(trip.id, atMs)
      .finally(() => setBusy(false));
  };

  const cancel = () => {
    void usePlannedStore.getState().cancel(trip.id);
    router.back();
  };

  const startNow = () => {
    // The room replaces the plan; its reminder would only nag afterwards.
    void usePlannedStore.getState().cancel(trip.id);
    router.replace({ pathname: "/create", params: placeCreateParams(trip.place) });
  };

  return (
    <Screen>
      <NavHeader testID="planned-detail" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <IconTile>
            <AppSymbol name={icons.calendar} fallback={icons.calendar.fallback} size={22} tintColor={colors.text} />
          </IconTile>
          <Text style={[ts.display, styles.title]} accessibilityRole="header" numberOfLines={2}>
            {trip.place.name}
          </Text>
          <Text style={ts.rowSub}>
            {countdownLabel(trip.atMs, nowMs)} · {when}
          </Text>
        </View>

        <GroupedCard>
          {trip.place.address ? <ListRow icon={icons.pin} title={trip.place.address} sub="Address" divider /> : null}
          <ListRow
            icon={icons.bell}
            title="Reminder"
            value={trip.notifId ? "On" : "Off"}
            sub={trip.notifId ? null : "Turn on notifications in Settings to get nudged"}
          />
        </GroupedCard>

        <SectionHeader title="Change time" />
        <GroupedCard>
          {slots.map((s) => (
            <SelectableRow
              key={s.id}
              title={s.label}
              selected={Math.abs(s.atMs - trip.atMs) < 60_000}
              testID={`planned-slot-${s.id}`}
              onPress={() => move(s.atMs)}
            />
          ))}
        </GroupedCard>

        <GroupedCard style={styles.cancelCard}>
          <ListRow icon={icons.trash} title="Cancel plan" destructive testID="planned-cancel" onPress={cancel} />
        </GroupedCard>
      </ScrollView>

      <StickyFooter>
        <Button label="Start now" testID="planned-start" onPress={startNow} />
      </StickyFooter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: space.xl },
  hero: { gap: space.sm, marginTop: space.md, marginBottom: space.lg },
  title: { marginTop: space.xs },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.sm },
  centerSub: { textAlign: "center" },
  cancelCard: { marginTop: space.lg },
});
