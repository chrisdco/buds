import { StyleSheet } from "react-native";

import { colors, radius } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";

// Styles for the room map screen (app/room/[id]/index.tsx). Kept here, not
// beside the route: every file under src/app is a route to expo-router.

export const roomScreenStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  // Uber's map back control: a solid black circle, top-left, nothing else.
  backCircle: {
    position: "absolute",
    left: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
  },
  connBanner: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: colors.warning,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  connBannerText: {
    color: colors.onWarning,
    fontFamily: fontFamily.bold,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  adjustCard: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: colors.surface,
    elevation: 6,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  adjustLabel: { color: colors.text, fontSize: 15, fontFamily: fontFamily.semiBold },
  adjustHint: { color: colors.textDim, fontSize: 12, fontFamily: fontFamily.regular, marginTop: 2 },
  adjustRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  adjustBtn: { flex: 1 },
  // Pin height = circle (30) + tip (7) - overlap (1): tip lands on the center.
  adjustPin: {
    position: "absolute",
    top: "50%",
    marginTop: -36,
    alignSelf: "center",
    alignItems: "center",
  },
  pinCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.text,
  },
  pinGlyph: { color: colors.text, fontSize: 14, fontFamily: fontFamily.bold },
  pinTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -1,
  },
  loadingOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  waitingPill: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: colors.scrim,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  waitingText: { color: colors.textDim, fontFamily: fontFamily.semiBold, fontSize: 12 },
  // Floats just above the sheet's visible top (placed by the screen), and
  // hides at full detent — FABs never sit on top of sheet content.
  fabColumn: {
    position: "absolute",
    right: 16,
    alignItems: "flex-end",
    gap: 12,
  },
  fab: {
    minWidth: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    elevation: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  fabWide: { paddingHorizontal: 16 },
  fabSosActive: { borderColor: colors.danger, backgroundColor: colors.danger },
  fabText: { color: colors.text, fontSize: 16, fontFamily: fontFamily.semiBold },
  pressed: { opacity: 0.75 },
});
