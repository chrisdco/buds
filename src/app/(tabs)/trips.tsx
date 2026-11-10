import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";

import { GroupedCard, ListRow, SectionHeader, TabBarClearance } from "@/components/layout";
import { Button, Screen } from "@/components/ui";
import { WaitingPeepArt } from "@/components/illustrations/WaitingPeepArt";
import { icons } from "@/components/Symbol";
import { space } from "@/constants/theme";

import { countdownLabel } from "@/lib/planned";
import { usePlannedStore } from "@/stores/plannedStore";
import { useRecentsStore } from "@/stores/recentsStore";
import { TabScrollView } from "@/features/nav/TabScrollView";
import { AvatarStack } from "@/features/trips/AvatarStack";
import { StatTiles } from "@/features/trips/StatTiles";
import { budsLabel, groupByRecency, shortDate, tripStats } from "@/lib/tripHistory";
import { MODE_OPTIONS } from "@/modes/modeOptions";
import { makeStyles, useTypeScale } from "@/theme";

// Trips tab (Uber Activity): counts at a glance, upcoming planned trips,
// then every room this device created or joined, bucketed by recency, each
// row saying where it went, with whom and when.
// A row opens the trip's detail (where, who, rejoin or go again).
export default function TripsScreen() {
  const styles = useStyles();
  const typeScale = useTypeScale();
  const router = useRouter();
  // Resident recents (loaded once at startup): rows paint on first commit,
  // and focus refetches that change nothing don't re-render at all.
  const recents = useRecentsStore((s) => s.recents);

  const planned = usePlannedStore((s) => s.planned);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useFocusEffect(
    useCallback(() => {
      void useRecentsStore.getState().refresh();
      void usePlannedStore.getState().refresh();
      setNowMs(Date.now());
    }, []),
  );

  const upcoming = planned ?? [];
  const past = recents ?? [];
  const stats = tripStats(past);
  const sections = groupByRecency(past, nowMs);

  return (
    <Screen>
      <TabScrollView showsVerticalScrollIndicator={false}>
        <Text style={[typeScale.display, styles.title]} accessibilityRole="header">
          Trips
        </Text>

        {past.length > 0 && (
          <View style={styles.stats}>
            <StatTiles
              stats={[
                { key: "trips", value: stats.trips, label: stats.trips === 1 ? "Trip" : "Trips" },
                { key: "buds", value: stats.buds, label: stats.buds === 1 ? "Bud" : "Buds" },
                { key: "places", value: stats.places, label: stats.places === 1 ? "Place" : "Places" },
              ]}
            />
          </View>
        )}

        {/* Uber Activity: Upcoming first (scheduled reminders), then Past. */}
        {upcoming.length > 0 && (
          <>
            <SectionHeader title="Upcoming" style={past.length > 0 ? undefined : styles.firstSection} />
            <GroupedCard>
              {upcoming.map((t, i) => (
                <ListRow
                  key={t.id}
                  icon={icons.calendar}
                  title={t.place.name}
                  sub={`${countdownLabel(t.atMs, nowMs)}${t.notifId ? "" : " · no reminder"}`}
                  chevron
                  divider={i < upcoming.length - 1}
                  a11yLabel={`Planned trip to ${t.place.name}`}
                  a11yHint="Change the time, start now or cancel"
                  testID={`trips-planned-${t.id}`}
                  onPress={() => router.push(`/planned/${t.id}`)}
                />
              ))}
            </GroupedCard>
          </>
        )}

        {/* recents === null only before the startup preload resolves: render
        nothing (same black) rather than flashing the empty state. */}
        {recents === null ? null : past.length === 0 ? (
          <>
            <SectionHeader title="Past" style={upcoming.length === 0 ? styles.firstSection : undefined} />
            <View style={styles.empty} testID="trips-empty">
              <WaitingPeepArt width={120} />
              <Text style={typeScale.rowTitle}>No trips yet</Text>
              <Text style={[typeScale.rowSub, styles.emptySub]}>
                Rooms you create or join show up here so you can jump back in.
              </Text>
              <View style={styles.emptyActions}>
                <View style={styles.emptyBtn}>
                  <Button
                    label="New room"
                    size="compact"
                    testID="trips-empty-create"
                    onPress={() => router.push("/create")}
                  />
                </View>
                <View style={styles.emptyBtn}>
                  <Button
                    label="Join"
                    size="compact"
                    variant="ghost"
                    testID="trips-empty-join"
                    onPress={() => router.push("/join")}
                  />
                </View>
              </View>
            </View>
          </>
        ) : (
          sections.map((section) => (
            <View key={section.title}>
              <SectionHeader title={section.title} />
              <GroupedCard>
                {section.rooms.map((r, i) => {
                  const mode = MODE_OPTIONS.find((m) => m.id === r.mode);
                  const when = shortDate(r.lastAtMs, nowMs);
                  const where = r.destLabel ? `to ${r.destLabel}` : (mode?.label ?? null);
                  const who = budsLabel(r.buds);
                  return (
                    <ListRow
                      key={r.id}
                      icon={mode?.icon ?? icons.group}
                      title={r.name}
                      sub={[when, where].filter(Boolean).join(" · ") || null}
                      divider={i < section.rooms.length - 1}
                      chevron
                      a11yLabel={`${r.name}${who ? `, ${who}` : ""}`}
                      a11yHint="Opens trip details"
                      testID={`trips-open-${r.code}`}
                      onPress={() => router.push(`/trip/${r.id}`)}
                      trailing={<AvatarStack buds={r.buds ?? []} size={24} />}
                    />
                  );
                })}
              </GroupedCard>
            </View>
          ))
        )}

        <TabBarClearance />
      </TabScrollView>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  title: { marginTop: space.lg },
  firstSection: { marginTop: space.lg },
  stats: { marginTop: space.lg },
  empty: { alignItems: "center", gap: space.sm, paddingVertical: space.md },
  emptySub: { textAlign: "center", paddingHorizontal: space.lg },
  emptyActions: { flexDirection: "row", gap: space.sm, alignSelf: "stretch", marginTop: space.sm },
  emptyBtn: { flex: 1 },
}));
