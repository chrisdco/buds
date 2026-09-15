import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ErrorText, Screen, TextField, Title } from "@/components/ui";
import { SearchResultSkeleton } from "@/components/Skeleton";
import { AppSymbol, icons } from "@/components/Symbol";
import { colors, radius } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { formatDistanceM } from "@/lib/geo";
import { searchPlaces, isAbortError, type PlaceResult } from "@/services/places/photon";
import { useMembersStore } from "@/stores/membersStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";

const MIN_QUERY = 3;
const DEBOUNCE_MS = 400;
// Server caps labels at 80 chars; truncate at pick time so confirms never trip it.
const LABEL_MAX = 80;

// Uber-style place search: bold name, dim address + distance, recents with
// clock glyphs, and a "set it on the map" escape hatch. Picks don't set
// anything directly — they seed adjust-pin mode back on the map, where the
// existing policy checks + set_destination RPC apply unchanged.
export default function DestSearchScreen() {
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

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY) return;
    const id = ++requestId.current;
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
        6,
        controller.signal,
      )
        .then((r) => {
          if (requestId.current !== id) return;
          setResults(r);
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
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      userCancelled.current = true;
      inFlight.current?.abort();
    };
    // Origin fixed per mount: re-biasing mid-typing reshuffles the list.
    // retryNonce re-fires the same query on explicit retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, retryNonce]);

  const pick = (place: PlaceResult) => {
    useUiStore.getState().setDestDraft({
      lat: place.lat,
      lng: place.lng,
      label: place.name.slice(0, LABEL_MAX),
    });
    router.back();
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Title>Set destination</Title>

        <TextField
          value={query}
          onChangeText={(t) => {
            // Short-query reset lives in the event (not the effect): keeps
            // the debounce effect free of synchronous setState.
            setQuery(t);
            if (t.trim().length < MIN_QUERY) {
              requestId.current += 1;
              setResults([]);
              setSearching(false);
              setSearched(false);
              setError(null);
            }
          }}
          placeholder="Search places"
          autoFocus
          returnKeyType="search"
          testID="dest-search-field"
        />

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
          <Text style={styles.caption}>Search places above — or set the pin directly on the map.</Text>
        )}

        {results.map((r) => {
          const sub = [r.address, r.distanceM != null ? formatDistanceM(r.distanceM, units) : null]
            .filter(Boolean)
            .join(" · ");
          return (
            <Pressable
              key={r.id}
              style={styles.row}
              accessibilityRole="button"
              accessibilityLabel={`Set destination to ${r.name}`}
              testID="dest-search-result"
              onPress={() => pick(r)}
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

const styles = StyleSheet.create({
  caption: { color: colors.textDim, fontSize: 13, fontFamily: fontFamily.regular, marginTop: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowBody: { flex: 1, flexShrink: 1 },
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
  rowName: { color: colors.text, fontSize: 16, fontFamily: fontFamily.semiBold },
  rowSub: { color: colors.textDim, fontSize: 13, fontFamily: fontFamily.regular, marginTop: 1 },
  chev: { color: colors.textDim, fontSize: 20, fontFamily: fontFamily.regular },
});
