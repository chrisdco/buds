import type { ReactNode } from "react";
import { Pressable, Text } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";

import { AppSymbol, icons } from "@/components/Symbol";
import { space } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { makeStyles, useColors } from "@/theme";

const ACTION_W = 92;

/**
 * A GroupedCard row you can swipe left to reveal a red action (Gmail /
 * iOS Mail); tapping the action runs it. The row spans the card edge to
 * edge so the action slides in from the card's rim, not from inside its
 * padding.
 */
export function SwipeToDelete({
  label = "Delete",
  onDelete,
  testID,
  children,
}: {
  label?: string;
  onDelete: () => void;
  testID?: string;
  children: ReactNode;
}) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <ReanimatedSwipeable
      friction={1.6}
      rightThreshold={ACTION_W / 2}
      overshootRight={false}
      containerStyle={styles.container}
      childrenContainerStyle={styles.row}
      renderRightActions={(_progress, _translation, methods) => (
        <Pressable
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={label}
          testID={testID}
          onPress={() => {
            methods.close();
            onDelete();
          }}
        >
          <AppSymbol name={icons.trash} size={20} tintColor={colors.onStatus} />
          <Text style={styles.actionText}>{label}</Text>
        </Pressable>
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const useStyles = makeStyles((colors) => ({
  // Cancel GroupedCard's horizontal padding; the row re-applies it.
  container: { marginHorizontal: -space.md },
  row: { backgroundColor: colors.surface, paddingHorizontal: space.md },
  action: {
    width: ACTION_W,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  actionText: {
    color: colors.onStatus,
    fontFamily: fontFamily.semiBold,
    fontSize: 13,
  },
  pressed: { opacity: 0.8 },
}));
