import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/constants/theme";

export function InsightsPanel({ headline }: { headline: string | null }) {
  if (!headline) return null;
  return (
    <View style={styles.pill}>
      <Text style={styles.text} numberOfLines={2}>
        {headline}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "center",
    backgroundColor: "rgba(15,17,21,0.85)",
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 8,
    maxWidth: "92%",
  },
  text: { color: colors.text, fontSize: 13, fontWeight: "600", textAlign: "center" },
});
