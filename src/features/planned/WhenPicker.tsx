import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { useState } from "react";
import { Text, View } from "react-native";

import { Chip } from "@/components/ui";
import { space } from "@/constants/theme";

import { combineDateTime, MAX_AHEAD_MS, planTimeError, timeSlots, whenLabel } from "@/lib/planned";
import { makeStyles, useColors, useTypeScale } from "@/theme";

/**
 * "When" for a planned trip: one-tap presets for the usual intents, plus
 * "Pick date & time" for everything else (native date dialog, then time
 * dialog). The chosen instant is always spelled out underneath, so a
 * preset never hides what it actually means.
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
  const colors = useColors();
  const ts = useTypeScale();
  // Presets and "now" snapshot at mount: a picker open for a minute
  // shouldn't reshuffle under your thumb.
  const [nowMs] = useState(() => Date.now());
  const [slots] = useState(() => timeSlots(nowMs));
  const [step, setStep] = useState<"date" | "time" | null>(null);
  const [day, setDay] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isPreset = atMs != null && slots.some((s) => Math.abs(s.atMs - atMs) < 60_000);
  const seed = new Date(atMs ?? nowMs + 3_600_000);

  const commit = (at: number) => {
    const problem = planTimeError(at, nowMs);
    setError(problem);
    if (!problem) onChange(at);
  };

  return (
    <View>
      <View style={styles.chips}>
        {slots.map((s) => (
          <Chip
            key={s.id}
            label={s.label}
            selected={atMs != null && Math.abs(s.atMs - atMs) < 60_000}
            testID={`${testID}-slot-${s.id}`}
            onPress={() => commit(s.atMs)}
          />
        ))}
        <Chip
          label={atMs != null && !isPreset ? whenLabel(atMs, nowMs) : "Pick date & time"}
          selected={atMs != null && !isPreset}
          testID={`${testID}-custom`}
          a11yLabel="Pick a date and time"
          onPress={() => setStep("date")}
        />
      </View>
      {atMs != null && !error ? (
        <Text style={[ts.meta, styles.summary]} testID={`${testID}-summary`}>
          {whenLabel(atMs, nowMs)}
        </Text>
      ) : null}
      {error ? <Text style={[ts.meta, styles.error]}>{error}</Text> : null}

      {step === "date" && (
        <DateTimePicker
          value={seed}
          mode="date"
          minimumDate={new Date(nowMs)}
          maximumDate={new Date(nowMs + MAX_AHEAD_MS)}
          themeVariant="dark"
          accentColor={colors.accent}
          onChange={(e, date) => {
            if (e.type === "set" && date) {
              setDay(date);
              setStep("time");
            } else {
              setStep(null);
            }
          }}
        />
      )}
      {step === "time" && day && (
        <DateTimePicker
          value={seed}
          mode="time"
          themeVariant="dark"
          accentColor={colors.accent}
          onChange={(e, time) => {
            setStep(null);
            if (e.type === "set" && time) commit(combineDateTime(day, time));
          }}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  summary: { marginTop: space.sm, color: colors.text },
  error: { marginTop: space.sm, color: colors.danger },
}));
