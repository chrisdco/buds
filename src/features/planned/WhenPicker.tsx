import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Chip } from "@/components/ui";
import { radius, space } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { dayChoices, dayStart, planTimeError, timeChoices, timeSlots, whenLabel } from "@/lib/planned";
import { makeStyles, useTypeScale } from "@/theme";

const DAY_W = 84;
const TIME_W = 88;
const GAP = space.sm;

/**
 * "When" for a planned trip: one-tap presets for the usual intents, plus
 * "Pick a time", which opens a compact in-app picker — a strip of days
 * (Today, Tomorrow, Wed 12…) over a strip of half-hour times — instead of
 * a full calendar dialog. The chosen instant is always spelled out
 * underneath, so a preset never hides what it actually means.
 */
export function WhenPicker({
  atMs,
  onChange,
  testID = "when",
}: {
  atMs: number | null;
  onChange: (atMs: number) => void;
  testID?: string;
}) {
  const styles = useStyles();
  const ts = useTypeScale();
  // Presets and "now" snapshot at mount: a picker open for a minute
  // shouldn't reshuffle under your thumb.
  const [nowMs] = useState(() => Date.now());
  const [slots] = useState(() => timeSlots(nowMs));
  const days = useMemo(() => dayChoices(nowMs), [nowMs]);
  const isPreset = atMs != null && slots.some((s) => Math.abs(s.atMs - atMs) < 60_000);
  const [open, setOpen] = useState(atMs != null && !isPreset);
  // The day being browsed; a time tap commits day + time.
  const [day, setDay] = useState(() => dayStart(atMs ?? days[0]?.dayMs ?? nowMs));
  const times = useMemo(() => timeChoices(day, nowMs), [day, nowMs]);
  const [error, setError] = useState<string | null>(null);

  const commit = (at: number) => {
    const problem = planTimeError(at, nowMs);
    setError(problem);
    if (!problem) onChange(at);
  };

  // Bring the chosen (or first sensible) time into view on open / day switch.
  const timesRef = useRef<ScrollView>(null);
  const daysRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (!open) return;
    const sel = atMs != null ? times.findIndex((t) => Math.abs(t.atMs - atMs) < 60_000) : -1;
    // No pick on this day: start at 9 AM-ish, or the first slot left today.
    const fallback = Math.max(
      0,
      times.findIndex((t) => new Date(t.atMs).getHours() >= 9),
    );
    const i = sel >= 0 ? sel : fallback;
    timesRef.current?.scrollTo({ x: Math.max(0, i * (TIME_W + GAP) - TIME_W), animated: false });
  }, [open, day, times, atMs]);
  useEffect(() => {
    if (!open) return;
    const i = days.findIndex((d) => d.dayMs === day);
    if (i > 2) daysRef.current?.scrollTo({ x: (i - 1) * (DAY_W + GAP), animated: false });
    // Only on open: day taps shouldn't yank the strip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <View>
      <View style={styles.chips}>
        {slots.map((s) => (
          <Chip
            key={s.id}
            label={s.label}
            selected={atMs != null && Math.abs(s.atMs - atMs) < 60_000}
            testID={`${testID}-slot-${s.id}`}
            onPress={() => {
              setOpen(false);
              commit(s.atMs);
            }}
          />
        ))}
        <Chip
          label="Pick a time"
          selected={open || (atMs != null && !isPreset)}
          testID={`${testID}-custom`}
          a11yLabel="Pick a day and time"
          onPress={() => setOpen((o) => !o)}
        />
      </View>

      {open && (
        <View style={styles.panel} testID={`${testID}-panel`}>
          <ScrollView
            ref={daysRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.strip}
            keyboardShouldPersistTaps="handled"
          >
            {days.map((d) => (
              <Pill
                key={d.dayMs}
                label={d.label}
                width={DAY_W}
                selected={d.dayMs === day}
                testID={`${testID}-day-${d.dayMs}`}
                onPress={() => setDay(d.dayMs)}
              />
            ))}
          </ScrollView>
          <ScrollView
            ref={timesRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.strip}
            keyboardShouldPersistTaps="handled"
          >
            {times.map((t) => (
              <Pill
                key={t.atMs}
                label={t.label}
                width={TIME_W}
                selected={atMs != null && Math.abs(t.atMs - atMs) < 60_000}
                testID={`${testID}-time-${t.atMs}`}
                onPress={() => commit(t.atMs)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {atMs != null && !error ? (
        <Text style={[ts.meta, styles.summary]} testID={`${testID}-summary`}>
          {whenLabel(atMs, nowMs)}
        </Text>
      ) : null}
      {error ? <Text style={[ts.meta, styles.error]}>{error}</Text> : null}
    </View>
  );
}

function Pill({
  label,
  width,
  selected,
  testID,
  onPress,
}: {
  label: string;
  width: number;
  selected: boolean;
  testID: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      style={({ pressed }) => [styles.pill, { width }, selected && styles.pillOn, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
    >
      <Text style={[styles.pillText, selected && styles.pillTextOn]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  panel: {
    marginTop: space.md,
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: space.sm,
  },
  strip: { gap: GAP, paddingHorizontal: space.sm },
  pill: {
    height: 40,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceAlt,
  },
  pillOn: { backgroundColor: colors.primary },
  pillText: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 14 },
  pillTextOn: { color: colors.onPrimary },
  pressed: { opacity: 0.75 },
  summary: { marginTop: space.sm, color: colors.text },
  error: { marginTop: space.sm, color: colors.danger },
}));
