import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, ErrorText, Label, Screen, TextField, Title } from "@/components/ui";
import { SearchResultSkeleton } from "@/components/Skeleton";
import { AppSymbol, icons } from "@/components/Symbol";
import { colors, radius } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { formatDistanceM } from "@/lib/geo";
import { destCreateParams } from "@/lib/tripPresets";
import type { PlaceRef } from "@/lib/places";
import { searchPlaces, isAbortError, type PlaceResult } from "@/services/places/photon";
import { usePlacesStore } from "@/stores/placesStore";
import { useSessionStore } from "@/stores/sessionStore";

const MIN_QUERY = 3;
const DEBOUNCE_MS = 400;

// Plan-your-trip (Uber grammar): Where-to field over Photon, saved
// Home/Work shortcuts, recent searches with distances, an unbiased
// "different city" retry, and a map escape hatch. Picks don't create
// anything directly — they route to /create with validated dest params,
// and the room's adjust-pin confirm applies unchanged post-create.
export default function PlanTripScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [unbiased, setUnbiased] = useState(false);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [saveSlot, setSaveSlot] = useState<"home" | "work" | null>(null);
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

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Title>Plan your trip</Title>
          {saveSlot && (
            <Text style={styles.arming}>Pick a place to save as {saveSlot === "home" ? "Home" : "Work"}</Text>
          )}
        </View>

        <TextField
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
          placeholder="Where to?"
          autoFocus
          returnKeyType="search"
          testID="plan-search-field"
        />

        <View style={styles.savedRow}>
          <Pressable
            style={({ pressed }) => [styles.savedChip, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={saved.home ? `Go to saved home, ${saved.home.name}` : "Save a home place"}
            testID="plan-saved-home"
            onPress={() => {
              if (saved.home) pickSaved(saved.home);
              else setSaveSlot((s) => (s === "home" ? null : "home"));
            }}
            onLongPress={() => setSaveSlot((s) => (s === "home" ? null : "home"))}
          >
            <AppSymbol
              name={icons.home}
              fallback={icons.home.fallback}
              size={16}
              tintColor={colors.accent}
            />
            <Text style={styles.savedText} numberOfLines={1}>
              {saved.home ? saved.home.name : "Add Home"}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.savedChip, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={saved.work ? `Go to saved work, ${saved.work.name}` : "Save a work place"}
            testID="plan-saved-work"
            onPress={() => {
              if (saved.work) pickSaved(saved.work);
              else setSaveSlot((s) => (s === "work" ? null : "work"));
            }}
            onLongPress={() => setSaveSlot((s) => (s === "work" ? null : "work"))}
          >
            <AppSymbol
              name={icons.trips}
              fallback={icons.trips.fallback}
              size={16}
              tintColor={colors.accent}
            />
            <Text style={styles.savedText} numberOfLines={1}>
              {saved.work ? saved.work.name : "Add Work"}
            </Text>
          </Pressable>
        </View>

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
              <Text style={styles.caption}>Search above — recent places will show up here.</Text>
            )}
            {(recents ?? []).map((r, i) => (
              <Pressable
                key={`${r.lat}-${r.lng}-${i}`}
                style={styles.row}
                accessibilityRole="button"
                accessibilityLabel={`Plan a trip to ${r.name}`}
                testID={`plan-recent-${i}`}
                onPress={() => pick({ ...r, id: `recent-${i}`, distanceM: null })}
              >
                <AppSymbol
                  name={icons.history}
                  fallback={icons.history.fallback}
                  size={20}
                  tintColor={colors.textDim}
                />
                <View style={styles.rowBody}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {r.name}
                  </Text>
                  {r.address !== "" && (
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {r.address}
                    </Text>
                  )}
                </View>
                <Text style={styles.chev}>›</Text>
              </Pressable>
            ))}
          </>
        )}

        {results.map((r, i) => {
          const distLabel = r.distanceM != null ? formatDistanceM(r.distanceM, units) : null;
          return (
            <Pressable
              key={r.id}
              style={styles.row}
              accessibilityRole="button"
              accessibilityLabel={`Plan a trip to ${r.name}`}
              testID={`plan-search-result-${i}`}
              onPress={() => pick(r)}
            >
              {distLabel ? (
                <Text style={styles.dist}>{distLabel}</Text>
              ) : (
                <AppSymbol
                  name={icons.history}
                  fallback={icons.history.fallback}
                  size={20}
                  tintColor={colors.textDim}
                />
              )}
              <View style={styles.rowBody}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {r.name}
                </Text>
                {r.address !== "" && (
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {r.address}
                  </Text>
                )}
              </View>
              <Text style={styles.chev}>›</Text>
            </Pressable>
          );
        })}

        {!searching && searched && results.length === 0 && !error && (
          <Text style={styles.caption} testID="plan-search-empty">
            No places found — try another name.
          </Text>
        )}
        <ErrorText>{error}</ErrorText>
        {error && !searching && (
          <Pressable
            style={styles.retry}
            accessibilityRole="button"
            accessibilityLabel="Retry search"
            testID="plan-search-retry"
            onPress={() => setRetryNonce((n) => n + 1)}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        )}

        <Label>More options</Label>
        <Pressable
          style={styles.row}
          accessibilityRole="button"
          accessibilityLabel="Search without nearby bias, for a different city"
          testID="plan-different-city"
          onPress={() => {
            setUnbiased((u) => !u);
            setRetryNonce((n) => n + 1);
          }}
        >
          <AppSymbol
            name={icons.search}
            fallback={icons.search.fallback}
            size={20}
            tintColor={colors.textDim}
          />
          <View style={styles.rowBody}>
            <Text style={styles.rowName}>Search in a different city</Text>
            <Text style={styles.rowSub}>{unbiased ? "Bias off" : "Currently biased nearby"}</Text>
          </View>
        </Pressable>

        <Pressable
          style={styles.row}
          accessibilityRole="button"
          accessibilityLabel="Create a room first, then place the pin on the map"
          accessibilityHint="Pin-placing needs a live room map"
          testID="plan-map"
          onPress={() => router.push("/create")}
        >
          <AppSymbol
            name={icons.recenter}
            fallback={icons.recenter.fallback}
            size={20}
            tintColor={colors.textDim}
          />
          <View style={styles.rowBody}>
            <Text style={styles.rowName}>Set location on map</Text>
            <Text style={styles.rowSub}>Create a room, then long-press to place the pin</Text>
          </View>
        </Pressable>

        <Button label="Back" variant="ghost" onPress={() => router.back()} />
        <View style={{ height: 24 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 24, marginBottom: 4 },
  arming: { color: colors.accent, fontSize: 13, fontFamily: fontFamily.semiBold, marginTop: 4 },
  caption: { color: colors.textDim, fontSize: 13, fontFamily: fontFamily.regular, marginTop: 12 },
  pressed: { opacity: 0.75 },
  savedRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  savedChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  savedText: { color: colors.text, fontSize: 14, fontFamily: fontFamily.semiBold, flex: 1, flexShrink: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dist: {
    color: colors.textDim,
    fontSize: 12,
    fontFamily: fontFamily.semiBold,
    minWidth: 48,
    fontVariant: ["tabular-nums"],
  },
  rowBody: { flex: 1, flexShrink: 1 },
  rowName: { color: colors.text, fontSize: 16, fontFamily: fontFamily.semiBold },
  rowSub: { color: colors.textDim, fontSize: 13, fontFamily: fontFamily.regular, marginTop: 1 },
  chev: { color: colors.textDim, fontSize: 20, fontFamily: fontFamily.regular },
  retry: {
    marginTop: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: "flex-start",
  },
  retryText: { color: colors.text, fontSize: 14, fontFamily: fontFamily.semiBold },
});
