import { Button } from "@expo/ui";

export interface SheetButtonProps {
  label: string;
  onPress: () => void;
  /** Filled main action, or a quiet text row. */
  variant?: "primary" | "text";
  /** Destructive actions (leave, end, remove) read in the danger color. */
  tone?: "default" | "danger";
  testID?: string;
}

// iOS: the native SwiftUI button already follows the system look; the
// Android twin (SheetButton.android.tsx) applies our palette.
export function SheetButton({ label, onPress, variant = "primary", testID }: SheetButtonProps) {
  return <Button label={label} variant={variant === "primary" ? "filled" : "text"} testID={testID} onPress={onPress} />;
}
