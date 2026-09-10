import { BottomSheet, Button, Column, Text } from "@expo/ui";

import { colors, space } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { useUiStore } from "@/stores/uiStore";

// Native replacement for Alert.alert confirms (leave, end, kick, set
// destination). Native modal sheet with scrim on both platforms — the
// pattern Uber/Maps/Life360 use instead of OS-default alert boxes.
// Mounted once in the room layout; callers await requestConfirm().
export function ConfirmSheet() {
  const confirm = useUiStore((s) => s.confirm);
  const resolveConfirm = useUiStore((s) => s.resolveConfirm);

  return (
    <BottomSheet
      isPresented={confirm != null}
      onDismiss={() => resolveConfirm(false)}
      testID="confirm-sheet"
      // Native sheets follow the system theme (light here) — pin our dark
      // canvas explicitly so white title text stays legible.
      containerColor={colors.surface}
    >
      <Column spacing={space.sm} style={{ padding: space.md }}>
        <Text
          testID="confirm-title"
          textStyle={{
            fontSize: 20,
            fontWeight: "700",
            fontFamily: fontFamily.bold,
            color: colors.text,
          }}
        >
          {confirm?.title ?? ""}
        </Text>
        {confirm?.body ? (
          <Text
            textStyle={{
              fontSize: 15,
              fontWeight: "400",
              fontFamily: fontFamily.regular,
              color: colors.textDim,
            }}
          >
            {confirm.body}
          </Text>
        ) : null}
        <Button
          label={confirm?.confirmLabel ?? "Confirm"}
          testID="confirm-ok"
          onPress={() => resolveConfirm(true)}
        />
        <Button
          label={confirm?.cancelLabel ?? "Cancel"}
          variant="text"
          testID="confirm-cancel"
          onPress={() => resolveConfirm(false)}
        />
      </Column>
    </BottomSheet>
  );
}
