import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { IconTile, ListRow, NavHeader } from "@/components/layout";
import { Button, Chip, ErrorText, Screen } from "@/components/ui";
import { SearchResultSkeleton } from "@/components/Skeleton";
import { AppSymbol, icons } from "@/components/Symbol";
import { colors, radius, space } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { typeScale } from "@/constants/typography";
import { formatDistanceM } from "@/lib/geo";
import { destCreateParams } from "@/lib/tripPresets";
import { timeSlots, type TimeSlot } from "@/lib/planned";
import type { PlaceRef } from "@/lib/places";
import { searchPlaces, isAbortError, type PlaceResult } from "@/services/places/photon";
import { usePlacesStore } from "@/stores/placesStore";
import { usePlannedStore } from "@/stores/plannedStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";

const MIN_QUERY = 3;
const DEBOUNCE_MS = 400;

// Plan-your-trip (Uber grammar): Where-to field over Photon, saved
// Home/Work shortcuts, recent searches with distances, an unbiased
// "different city" retry, and a map escape hatch. Picks don't create
// anything directly — they route to /create with validated dest params,
// and the room's adjust-pin confirm applies unchanged post-create.
export default function PlanTripScreen() {
  const router = useRouter();
  const rawParams = useLocalSearchParams();
  const whenParam = Array.isArray(rawParams.when) ? rawParams.when[0] : rawParams.when;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [unbiased, setUnbiased] = useState(false);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [saveSlot, setSaveSlot] = useState<"home" | "work" | null>(null);
  const [later, setLater] = useState(whenParam === "later");
  const [slotId, setSlotId] = useState<string>("1h");
  // "Later" from Home arrives with the time picker already open.
  const [whenOpen, setWhenOpen] = useState(whenParam === "later");
  const [fieldFocused, setFieldFocused] = useState(false);
  // Slots snapshot when Later arms, deferred to a microtask: consuming
  // the clock synchronously in an effect is a cascading-render hazard
  // (same rule as the room screen's destDraft handoff).
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  useEffect(() => {
    if (!later) return;
    queueMicrotask(() => setSlots(timeSlots(Date.now())));
  }, [later]);
  const requestId = useRef(0);
  const inFlight = useRef<AbortController | null>(null);
  const userCancelled = useRef(false);

  const recents = usePlacesStore((s) => s.recents);
  const saved = usePlacesStore((s) => s.saved);
  const units = useSessionStore((s) => s.units);

  // Best-effort origin for distances: last known fix only, never a
  // permission prompt — search must work denied. Absent origin just means
  // no distance labels, never a block.
  useEffect(() => {
    void (async () => {
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last) setOrigin({ lat: last.coords.latitude, lng: last.coords.longitude });
      } catch {
        // No cached fix — distances stay hidden.
      }
    })();
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY) return;
    const id = ++requestId.current;
    const bias = !unbiased ? origin : null;
    const timer = setTimeout(() => {
      inFlight.current?.abort();
      userCancelled.current = true;
      const controller = new AbortController();
      inFlight.current = controller;
      userCancelled.current = false;
      setSearching(true);
      void searchPlaces(q, bias ?? undefined, 6, controller.signal)
        .then((r) => {
          if (requestId.current !== id) return;
          setResults(r);
          setSearched(true);
          setError(null);
        })
        .catch((e: unknown) => {
          if (requestId.current !== id) return;
          if (isAbortError(e) && userCancelled.current) return;
          setResults([]);
          setSearched(true);
          setError("Couldn't search — check your connection.");
        })
        .finally(() => {
          if (requestId.current === id) setSearching(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      userCancelled.current = true;
      inFlight.current?.abort();
    };
  }, [query, retryNonce, unbiased, origin]);

  const toRef = (p: { name: string; address: string; lat: number; lng: number }): PlaceRef => ({
    ...p,
    atMs: Date.now(),
  });

  const pick = (place: PlaceResult) => {
    const ref = toRef(place);
    if (saveSlot) {
      void usePlacesStore.getState().save(saveSlot, ref);
      setSaveSlot(null);
      return;
    }
    void usePlacesStore.getState().addRecent(ref);
    if (later) {
      // Later: save a planned trip + reminder, back to Home's countdown.
      const slot = slots.find((s) => s.id === slotId) ?? slots[0];
      if (!slot) return;
      void (async () => {
        const trip = await usePlannedStore.getState().plan(
          { name: place.name, address: place.address, lat: place.lat, lng: place.lng },
          slot.atMs,
        );
        if (trip) {
          useUiStore.getState().pushAlerts([
            {
              id: `planned-${trip.id}`,
              severity: "info",
              title: trip.notifId
                ? `Reminder set — ${slot.label}`
                : "Saved — reminders are off, enable them in Settings",
            },
          ]);
        }
        router.back();
      })();
      return;
    }
    router.push({
      pathname: "/create",
      params: {
        mode: "converge",
        limit: "10",
        duration: "12",
        name: `${place.name.slice(0, 60)}`,
        ...destCreateParams({ lat: place.lat, lng: place.lng, label: place.name }),
      },
    });
  };

  const pickSaved = (ref: PlaceRef) => pick({ ...ref, id: `saved-${ref.lat}-${ref.lng}`, distanceM: null });

  const slotLabel = later ? (slots.find((s) => s.id === slotId)?.label ?? "Later") : "Now";
  const clearQuery = () => {
    requestId.current += 1;
    setQuery("");
    setResults([]);
    setSearching(false);
    setSearched(false);
    setError(null);
  };

  return (
    <Screen>
      <NavHeader title="Plan your trip" />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Uber "Pick-up now ▾": one chip that opens the time choices. */}
        <View style={styles.whenRow}>
          <Pressable
            style={({ pressed }) => [styles.whenChip, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`When: ${slotLabel}`}
            accessibilityHint="Choose now or a reminder time"
            accessibilityState={{ expanded: whenOpen }}
            testID="plan-when"
            onPress={() => setWhenOpen((o) => !o)}
          >
            <AppSymbol name={icons.clock} fallback={icons.clock.fallback} size={18} tintColor={colors.text} />
            <Text style={styles.whenText}>{slotLabel}</Text>
            <AppSymbol
              name={whenOpen ? icons.collapse : icons.expand}
              fallback={(whenOpen ? icons.collapse : icons.expand).fallback}
              size={18}
              tintColor={colors.text}
            />
          </Pressable>
        </View>
        {whenOpen && (
          <View style={styles.slotRow}>
            <Chip
              label="Now"
              selected={!later}
              testID="plan-when-now"
              a11yLabel="Plan for now"
              onPress={() => {
                setLater(false);
                setWhenOpen(false);
              }}
            />
            <Chip
              label="Later"
              selected={later}
              testID="plan-when-later"
              a11yLabel="Schedule for later"
              onPress={() => setLater(true)}
            />
            {later &&
              slots.map((s) => (
                <Chip
                  key={s.id}
                  label={s.label}
                  selected={s.id === slotId}
                  testID={`plan-slot-${s.id}`}
                  onPress={() => {
                    setSlotId(s.id);
                    setWhenOpen(false);
                  }}
                />
              ))}
          </View>
        )}

        {saveSlot && (
          <Text style={[typeScale.meta, styles.arming]}>
            Pick a place to save as {saveSlot === "home" ? "Home" : "Work"}
          </Text>
        )}

        {/* Uber's outlined Where-to card: icon, field, clear. */}
        <View style={[styles.field, fieldFocused && styles.fieldFocused]}>
          <AppSymbol name={icons.search} fallback={icons.search.fallback} size={20} tintColor={colors.textDim} />
          <TextInput
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              if (t.trim().length < MIN_QUERY) {
                requestId.current += 1;
                setResults([]);
                setSearching(false);
                setSearched(false);
                setError(null);
              }
            }}
            onFocus={() => setFieldFocused(true)}
            onBlur={() => setFieldFocused(false)}
            placeholder="Where to?"
            placeholderTextColor={colors.textDim}
            autoFocus
            returnKeyType="search"
            style={styles.fieldInput}
            accessibilityLabel="Where to?"
            testID="plan-search-field"
          />
          {query.length > 0 && (
            <Pressable
              style={styles.clearBtn}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
              onPress={clearQuery}
            >
              <AppSymbol name={icons.close} fallback={icons.close.fallback} size={18} tintColor={colors.textDim} />
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.savedRow}
          keyboardShouldPersistTaps="handled"
        >
          <SavedChip
            icon={icons.home}
            label={saved.home ? saved.home.name : "Add Home"}
            a11yLabel={saved.home ? `Go to saved home, ${saved.home.name}` : "Save a home place"}
            testID="plan-saved-home"
            onPress={() => {
              if (saved.home) pickSaved(saved.home);
              else setSaveSlot((s) => (s === "home" ? null : "home"));
            }}
            onLongPress={() => setSaveSlot((s) => (s === "home" ? null : "home"))}
          />
          <SavedChip
            icon={icons.work}
            label={saved.work ? saved.work.name : "Add Work"}
            a11yLabel={saved.work ? `Go to saved work, ${saved.work.name}` : "Save a work place"}
            testID="plan-saved-work"
            onPress={() => {
              if (saved.work) pickSaved(saved.work);
              else setSaveSlot((s) => (s === "work" ? null : "work"));
            }}
            onLongPress={() => setSaveSlot((s) => (s === "work" ? null : "work"))}
          />
        </ScrollView>

        {searching && (
          <View
            accessible
            accessibilityLabel="Searching places"
            accessibilityState={{ busy: true }}
            accessibilityLiveRegion="polite"
          >
            <SearchResultSkeleton />
            <SearchResultSkeleton />
            <SearchResultSkeleton />
          </View>
        )}

        {!searching && !searched && (
          <>
            {(recents === null || recents.length === 0) && (
              <Text style={[typeScale.rowSub, styles.caption]}>Recent places will show up here.</Text>
            )}
            {(recents ?? []).map((r, i) => (
              <ListRow
                key={`${r.lat}-${r.lng}-${i}`}
                leading={<PlaceLead distance={null} />}
                title={r.name}
                sub={r.address || null}
                divider
                a11yLabel={`Plan a trip to ${r.name}`}
                testID={`plan-recent-${i}`}
                onPress={() => pick({ ...r, id: `recent-${i}`, distanceM: null })}
              />
            ))}
          </>
        )}

        {results.map((r, i) => (
          <ListRow
            key={r.id}
            leading={
              <PlaceLead
                distance={r.distanceM != null ? formatDistanceM(r.distanceM, units) : null}
                search
              />
            }
            title={r.name}
            sub={r.address || null}
            divider
            a11yLabel={`Plan a trip to ${r.name}`}
            testID={`plan-search-result-${i}`}
            onPress={() => pick(r)}
          />
        ))}

        {!searching && searched && results.length === 0 && !error && (
          <Text style={[typeScale.rowSub, styles.caption]} testID="plan-search-empty">
            No places found — try another name.
          </Text>
        )}
        <ErrorText>{error}</ErrorText>
        {error && !searching && (
          <Button
            label="Try again"
            variant="ghost"
            size="compact"
            testID="plan-search-retry"
            onPress={() => setRetryNonce((n) => n + 1)}
          />
        )}

        <ListRow
          leading={<IconTile icon={icons.globe} round />}
          title="Search in a different city"
          sub={unbiased ? "Searching everywhere" : "Searching near you"}
          divider
          a11yLabel="Search without nearby bias, for a different city"
          testID="plan-different-city"
          onPress={() => {
            setUnbiased((u) => !u);
            setRetryNonce((n) => n + 1);
          }}
        />
        <ListRow
          leading={<IconTile icon={icons.pin} round />}
          title="Set location on map"
          sub="Starts a room — then long-press the map"
          a11yLabel="Create a room first, then place the pin on the map"
          testID="plan-map"
          onPress={() => router.push("/create")}
        />
        <View style={{ height: space.xl }} />
      </ScrollView>
    </Screen>
  );
}

/** Fixed left column: clock (recent) or pin (result), distance under it. */
function PlaceLead({ distance, search }: { distance: string | null; search?: boolean }) {
  const icon = search ? icons.pin : icons.clock;
  return (
    <View style={styles.lead}>
      <AppSymbol name={icon} fallback={icon.fallback} size={20} tintColor={colors.text} />
      {distance ? (
        <Text style={styles.leadDist} numberOfLines={1}>
          {distance}
        </Text>
      ) : null}
    </View>
  );
}

function SavedChip({
  icon,
  label,
  a11yLabel,
  testID,
  onPress,
  onLongPress,
}: {
  icon: (typeof icons)["home"] | (typeof icons)["work"];
  label: string;
  a11yLabel: string;
  testID: string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.savedChip, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {/* Uber's Home/Work tiles are the one place blue reads as identity. */}
      <View style={styles.savedIcon}>
        <AppSymbol name={icon} fallback={icon.fallback} size={16} tintColor={colors.accent} />
      </View>
      <Text style={styles.savedText} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
  whenRow: { flexDirection: "row" },
  whenChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  whenText: { color: colors.text, fontSize: 16, fontFamily: fontFamily.semiBold },
  slotRow: { flexDirection: "row", flexWrap: "wrap", marginTop: space.md },
  arming: { marginTop: space.md, color: colors.text },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.surfaceAlt,
    paddingHorizontal: space.md,
    minHeight: 60,
  },
  fieldFocused: { borderColor: colors.text },
  fieldInput: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    fontFamily: fontFamily.medium,
    paddingVertical: 12,
  },
  clearBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  savedRow: { gap: space.sm, paddingVertical: space.md },
  savedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 6,
    maxWidth: 220,
  },
  savedIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: "rgba(79,142,247,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  savedText: { color: colors.text, fontSize: 16, fontFamily: fontFamily.medium, flexShrink: 1 },
  caption: { marginTop: space.sm, marginBottom: space.sm },
  lead: { width: 52, alignItems: "center", gap: 2 },
  leadDist: {
    color: colors.textDim,
    fontSize: 13,
    fontFamily: fontFamily.medium,
    fontVariant: ["tabular-nums"],
  },
});
