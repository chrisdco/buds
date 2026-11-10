import { Button, Text, TextButton } from "@expo/ui/jetpack-compose";
import { fillMaxWidth, height, testID as testTag } from "@expo/ui/jetpack-compose/modifiers";

import { fontFamily } from "@/constants/fonts";
import { useColors } from "@/theme";

import type { SheetButtonProps } from "./SheetButton";

// Android: Compose buttons with our palette. The universal Button has no
// color props, so it would render in stock Material purple.
export function SheetButton({ label, onPress, variant = "primary", tone = "default", testID }: SheetButtonProps) {
  const colors = useColors();
  const modifiers = [fillMaxWidth(), height(variant === "primary" ? 52 : 48), ...(testID ? [testTag(testID)] : [])];
  const textColor =
    variant === "primary" ? colors.onPrimary : tone === "danger" ? colors.danger : colors.text;
  const content = (
    <Text
      color={textColor}
      style={{
        fontSize: 16,
        fontWeight: variant === "primary" ? "700" : "600",
        fontFamily: variant === "primary" ? fontFamily.bold : fontFamily.semiBold,
      }}
    >
      {label}
    </Text>
  );
  if (variant === "primary") {
    const bg = tone === "danger" ? colors.danger : colors.primary;
    return (
      <Button onClick={onPress} modifiers={modifiers} colors={{ containerColor: bg, contentColor: textColor }}>
        {content}
      </Button>
    );
  }
  return (
    <TextButton onClick={onPress} modifiers={modifiers} colors={{ contentColor: textColor }}>
      {content}
    </TextButton>
  );
}
