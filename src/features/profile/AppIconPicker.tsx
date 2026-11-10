import {
  getAppIconName,
  setAlternateAppIcon,
  supportsAlternateIcons,
} from "expo-alternate-app-icons";
import { useState } from "react";
import { Image, Platform, Pressable, Text, View, type ImageSourcePropType } from "react-native";

import { radius, space } from "@/constants/theme";

import { useUiStore } from "@/stores/uiStore";
import { makeStyles, useTypeScale } from "@/theme";

// Home-screen icon choice. null = the default icon (app.json "icon"); the
// names match the expo-alternate-app-icons entries in app.json. Art comes
// from scripts/render-icons.mjs.
const OPTIONS: { name: string | null; label: string; source: ImageSourcePropType }[] = [
  { name: null, label: "buds", source: require("../../../assets/images/icon.png") },
  { name: "GeistB", label: "Serif b", source: require("../../../assets/icons/alt/GeistB-ios.png") },
  { name: "FrauncesB", label: "Bold b", source: require("../../../assets/icons/alt/FrauncesB-ios.png") },
];

/** Three icon tiles; selected = 2px white ring. Hidden where switching isn't supported. */
export function AppIconPicker() {
  const styles = useStyles();
  const ts = useTypeScale();
  const [current, setCurrent] = useState<string | null>(() => {
    try {
      return getAppIconName();
    } catch {
      return null;
    }
  });
  const [error, setError] = useState<string | null>(null);

  if (!supportsAlternateIcons) return null;

  const choose = (name: string | null) => {
    if (name === current) return;
    void (async () => {
      // Android swaps the launcher entry, which can close the app; say so
      // before it happens rather than look like a crash.
      if (Platform.OS === "android") {
        const ok = await useUiStore.getState().requestConfirm({
          title: "Change app icon?",
          body: "Android may close Buds to apply it. Just open it again from the new icon.",
          confirmLabel: "Change",
          destructive: false,
        });
        if (!ok) return;
      }
      setError(null);
      try {
        await setAlternateAppIcon(name);
        setCurrent(name);
      } catch {
        setError("Couldn't change the icon on this device.");
      }
    })();
  };

  return (
    <View>
      <View style={styles.row} accessibilityRole="radiogroup">
        {OPTIONS.map((o) => {
          const selected = o.name === current;
          return (
            <Pressable
              key={o.label}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
              accessibilityRole="radio"
              accessibilityLabel={`${o.label} icon`}
              accessibilityState={{ selected }}
              testID={`profile-icon-${o.name ?? "default"}`}
              onPress={() => choose(o.name)}
            >
              <View style={[styles.ring, selected && styles.ringSelected]}>
                <Image source={o.source} style={styles.icon} accessible={false} />
              </View>
              <Text style={[ts.meta, selected && styles.labelSelected]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={[ts.meta, styles.error]}>{error}</Text> : null}
    </View>
  );
}

const ICON = 64;

const useStyles = makeStyles((colors) => ({
  pressed: { opacity: 0.75 },
  row: { flexDirection: "row", gap: space.lg },
  option: { alignItems: "center", gap: space.sm },
  // Always 2px so selection never shifts the row.
  ring: { padding: 3, borderRadius: radius.lg + 3, borderWidth: 2, borderColor: "transparent" },
  ringSelected: { borderColor: colors.text },
  icon: { width: ICON, height: ICON, borderRadius: radius.lg },
  labelSelected: { color: colors.text },
  error: { color: colors.danger, marginTop: space.sm },
}));
