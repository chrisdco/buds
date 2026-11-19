import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { NavHeader } from "@/components/layout";
import { Chip, ErrorText, Screen, TextField } from "@/components/ui";
import { SearchResultSkeleton } from "@/components/Skeleton";
import { AppSymbol, icons } from "@/components/Symbol";
import { radius, space } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { formatDistanceM } from "@/lib/geo";
import { byDistance, categoryFor, PLACE_CATEGORIES, recentsWithDistance } from "@/lib/placeCategories";
import { searchPlaces, isAbortError, type PlaceResult } from "@/services/places/search";
import { useMembersStore } from "@/stores/membersStore";
import { usePlacesStore } from "@/stores/placesStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";
import { makeStyles, useColors } from "@/theme";

const MIN_QUERY = 3;
const DEBOUNCE_MS = 400;
/** Category taps want a few more options to choose the nearest from. */
const CATEGORY_LIMIT = 8;
// Server caps labels at 80 chars; truncate at pick time so confirms never trip it.
const LABEL_MAX = 80;

// Uber-style place search: bold name, dim address + distance, recents with
// clock glyphs, quick-stop category chips (nearest first), and a "set it on
// the map" escape hatch. Picks don't set
// anything directly — they seed adjust-pin mode back on the map, where the
// existing policy checks + set_destination RPC apply unchanged.
export default function DestSearchScreen() {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const requestId = useRef(0);
  const inFlight = useRef<AbortController | null>(null);
  // True when the latest abort came from us (retype / retry / unmount) as
  // opposed to searchPlaces' own transport timeout: only our cancels are
  // silent — a timeout is a real failure and must reach the error state.
  const userCancelled = useRef(false);

  const myUserId = useSessionStore((s) => s.userId);
  const units = useSessionStore((s) => s.units);
  const membersMap = useMembersStore((s) => s.members);
  const origin = myUserId ? (membersMap[myUserId]?.pos ?? null) : null;
  const recents = usePlacesStore((s) => s.recents);
  useEffect(() => {
    if (usePlacesStore.getState().recents === null) void usePlacesStore.getState().refresh();
  }, []);
  // Distances from where you are now; origin is read once (see below), so
  // this doesn't recompute on every position tick.
  const [originAtOpen] = useState(origin);
  const recentRows = useMemo(() => recentsWithDistance(recents ?? [], originAtOpen), [recents, originAtOpen]);
  const activeCategory = categoryFor(query);

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY) return;
    const id = ++requestId.current;
    // A category chip (or its exact words) searches straight away and shows
    // the nearest few; free text waits for typing to pause.
    const category = categoryFor(q);
    // Spinner starts with the request (not the keystroke): no flash for fast
    // answers, and no synchronous setState in the effect body.
    const timer = setTimeout(() => {
      // Retype/unmount cancels the previous request (expo-data-fetching
      // skill): the requestId guard alone would leave it burning data and
      // battery to discard the answer.
      inFlight.current?.abort();
      userCancelled.current = true;
      const controller = new AbortController();
      inFlight.current = controller;
      userCancelled.current = false;
      setSearching(true);
      void searchPlaces(
        q,
        origin ? { lat: origin.lat, lng: origin.lng } : undefined,
        category ? CATEGORY_LIMIT : 6,
        controller.signal,
      )
        .then((r) => {
          if (requestId.current !== id) return;
          setResults(category ? byDistance(r) : r);
          setSearched(true);
          setError(null);
        })
        .catch((e: unknown) => {
          // Stale responses die here. Our own cancels die here too — but a
          // transport-timeout abort is a failure like any other: it falls
          // through to the error state with its retry.
          if (requestId.current !== id) return;
          if (isAbortError(e) && userCancelled.current) return;
          setResults([]);
          setSearched(true);
          setError("Couldn't search — check your connection, or set the pin on the map.");
        })
        .finally(() => {
          if (requestId.current === id) setSearching(false);
        });
    }, category ? 0 : DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      userCancelled.current = true;
      inFlight.current?.abort();
    };
    // Origin fixed per mount: re-biasing mid-typing reshuffles the list.
    // retryNonce re-fires the same query on explicit retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, retryNonce]);

  const onChangeQuery = (t: string) => {
    // Short-query reset lives in the event (not the effect): keeps the
    // debounce effect free of synchronous setState.
    setQuery(t);
    if (t.trim().length < MIN_QUERY) {
      requestId.current += 1;
      setResults([]);
      setSearching(false);
      setSearched(false);
      setError(null);
    }
  };

  const pick = (place: { name: string; address: string; lat: number; lng: number }) => {
    void usePlacesStore
      .getState()
      .addRecent({ name: place.name, address: place.address, lat: place.lat, lng: place.lng, atMs: Date.now() });
    useUiStore.getState().setDestDraft({
      lat: place.lat,
      lng: place.lng,
      label: place.name.slice(0, LABEL_MAX),
    });
    router.back();
  };

  return (
    <Screen>
      <NavHeader title="Set destination" />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <TextField
          value={query}
          onChangeText={onChangeQuery}
          placeholder="Search places"
          autoFocus
          returnKeyType="search"
          testID="dest-search-field"
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          keyboardShouldPersistTaps="handled"
        >
          {PLACE_CATEGORIES.map((c) => {
            const on = activeCategory?.id === c.id;
            return (
              <Chip
                key={c.id}
                label={c.label}
                selected={on}
                a11yLabel={on ? `Clear ${c.label} search` : `Find ${c.label.toLowerCase()} nearby`}
                testID={`dest-search-cat-${c.id}`}
                onPress={() => onChangeQuery(on ? "" : c.query)}
              />
            );
          })}
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

        {!searching && !searched && recentRows.length === 0 && (
          <Text style={styles.caption}>Search places above — or set the pin directly on the map.</Text>
        )}

        {!searching &&
          !searched &&
          recentRows.map((r, i) => {
            const distLabel = r.distanceM != null ? formatDistanceM(r.distanceM, units) : null;
            return (
              <Pressable
                key={`${r.lat}-${r.lng}-${i}`}
                style={styles.row}
                accessibilityRole="button"
                accessibilityLabel={`Set destination to ${r.name}${distLabel ? `, ${distLabel} away` : ""}`}
                testID={`dest-search-recent-${i}`}
                onPress={() => pick(r)}
              >
                <View style={styles.lead}>
                  <AppSymbol name={icons.history} fallback={icons.history.fallback} size={18} tintColor={colors.textDim} />
                  {distLabel && (
                    <Text style={styles.dist} numberOfLines={1}>
                      {distLabel}
                    </Text>
                  )}
                </View>
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

        {results.map((r, i) => {
          // Distance lives in the left column; the subtitle is what and where.
          const sub = [r.kind, r.address].filter(Boolean).join(" · ");
          const distLabel = r.distanceM != null ? formatDistanceM(r.distanceM, units) : null;
          return (
            <Pressable
              key={r.id}
              style={styles.row}
              accessibilityRole="button"
              accessibilityLabel={`Set destination to ${r.name}${distLabel ? `, ${distLabel} away` : ""}`}
              testID={`dest-search-result-${i}`}
              onPress={() => pick(r)}
            >
              {/* Uber Plan-trip grammar: distance leads left when known,
              clock glyph otherwise. Keeps rows scannable at a glance. */}
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
                {sub !== "" && (
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {sub}
                  </Text>
                )}
              </View>
              <Text style={styles.chev}>›</Text>
            </Pressable>
          );
        })}

        {!searching && searched && results.length === 0 && !error && (
          <Text style={styles.caption} testID="dest-search-empty">
            No places found — try another name, or set the pin on the map.
          </Text>
        )}
        <ErrorText>{error}</ErrorText>
        {/* Error carries its own retry (skill: every error state offers one)
        plus the map escape hatch below — retyping also refires, this just
        says so. Hidden while a request is in flight. */}
        {error && !searching && (
          <Pressable
            style={styles.retry}
            accessibilityRole="button"
            accessibilityLabel="Retry search"
            testID="dest-search-retry"
            onPress={() => setRetryNonce((n) => n + 1)}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        )}

        <Pressable
          style={styles.row}
          accessibilityRole="button"
          accessibilityLabel="Set location on map instead"
          testID="dest-search-map"
          onPress={() => router.back()}
        >
          <AppSymbol
            name={icons.recenter}
            fallback={icons.recenter.fallback}
            size={20}
            tintColor={colors.textDim}
          />
          <View style={styles.rowBody}>
            <Text style={styles.rowName}>Set location on map</Text>
            <Text style={styles.rowSub}>Go back and long-press to place the pin</Text>
          </View>
        </Pressable>

        <View style={{ height: 24 }} />
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  chips: { gap: space.sm, paddingVertical: space.md },
  lead: { minWidth: 48, alignItems: "flex-start", gap: 2 },
  caption: { color: colors.textDim, fontSize: 13, fontFamily: fontFamily.regular, marginTop: 12 },
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
  retry: {
    marginTop: 12,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: "flex-start",
  },
  retryText: { color: colors.text, fontSize: 14, fontFamily: fontFamily.semiBold },
  rowName: { color: colors.text, fontSize: 16, fontFamily: fontFamily.semiBold },
  rowSub: { color: colors.textDim, fontSize: 13, fontFamily: fontFamily.regular, marginTop: 1 },
  chev: { color: colors.textDim, fontSize: 20, fontFamily: fontFamily.regular },
}));
