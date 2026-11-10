import { BottomSheet, Column, Text } from "@expo/ui";

import { space } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { useMembersStore } from "@/stores/membersStore";
import { useUiStore } from "@/stores/uiStore";
import { useColors } from "@/theme";

import { SheetButton } from "./SheetButton";

// Long-press menu for a member (docs/route-view.md 5.2 #3): from a face on
// the map or a row in the list. "Only them" is the fast path into a
// one-person Focus; the rest are the member's quick actions. Native modal
// sheet, same pattern as ConfirmSheet; the screen supplies navigation.

export function MemberActionSheet({
  myUserId,
  onNavigate,
  onDetails,
}: {
  myUserId: string | null;
  /** In-app navigation to this member. */
  onNavigate: (userId: string) => void;
  onDetails: (userId: string) => void;
}) {
  const colors = useColors();
  const userId = useUiStore((s) => s.memberActionsFor);
  const focusUserIds = useUiStore((s) => s.focusUserIds);
  const member = useMembersStore((s) => (userId ? s.members[userId] : undefined));
  const close = () => useUiStore.getState().setMemberActionsFor(null);

  const isTraveler = member?.role === "traveler";
  const isSelf = member != null && member.userId === myUserId;
  const focused = member != null && focusUserIds.includes(member.userId);
  const onlyThem = focused && focusUserIds.length === 1;
  const name = member ? (isSelf ? "You" : member.name) : "";

  const run = (fn: () => void) => () => {
    close();
    fn();
  };
  const focusOnly = () => {
    if (!member) return;
    const ui = useUiStore.getState();
    ui.setFocusUserIds([member.userId]);
    ui.setCameraMode("auto");
  };
  const toggleFocus = () => {
    if (!member) return;
    const ui = useUiStore.getState();
    ui.toggleFocusUserId(member.userId);
    ui.setCameraMode("auto");
  };

  return (
    <BottomSheet
      isPresented={member != null}
      onDismiss={close}
      testID="member-actions"
      containerColor={colors.surface}
    >
      <Column spacing={space.sm} style={{ padding: space.md }}>
        <Text
          testID="member-actions-title"
          textStyle={{ fontSize: 20, fontWeight: "700", fontFamily: fontFamily.bold, color: colors.text }}
        >
          {name}
        </Text>
        {isTraveler && !onlyThem && (
          <SheetButton label="Only them" testID="member-only-them" onPress={run(focusOnly)} />
        )}
        {isTraveler && focusUserIds.length > 0 && !onlyThem && (
          <SheetButton
            label={focused ? "Remove from focus" : "Add to focus"}
            variant="text"
            testID="member-toggle-focus"
            onPress={run(toggleFocus)}
          />
        )}
        {onlyThem && (
          <SheetButton label="Stop focusing" testID="member-stop-focus" onPress={run(() => useUiStore.getState().setFocusUserIds([]))} />
        )}
        {member?.pos && !isSelf && (
          <SheetButton
            label="Navigate to them"
            variant="text"
            testID="member-actions-navigate"
            onPress={run(() => onNavigate(member.userId))}
          />
        )}
        {member && (
          <SheetButton
            label="Details"
            variant="text"
            testID="member-actions-details"
            onPress={run(() => onDetails(member.userId))}
          />
        )}
        <SheetButton label="Cancel" variant="text" testID="member-actions-cancel" onPress={close} />
      </Column>
    </BottomSheet>
  );
}
