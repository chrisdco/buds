import { CameraView, useCameraPermissions } from "expo-camera";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { IconTile, NavHeader, SelectableRow, StickyFooter } from "@/components/layout";
import { AppSymbol, icons } from "@/components/Symbol";
import { Button, ErrorText, Screen, TextField } from "@/components/ui";
import { colors, radius, space } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { typeScale } from "@/constants/typography";
import { setActiveRoom } from "@/lib/activeRoom";
import { CODE_LENGTH, normalizeCode, parseInviteCode } from "@/lib/ids";
import { joinErrorMessage } from "@/lib/joinErrors";
import { roomsRpc } from "@/services/rpc/rooms";
import { useSessionStore } from "@/stores/sessionStore";
import type { MemberRole, RpcError } from "@/types/contracts";

export default function JoinRoomScreen() {
  const router = useRouter();
  const displayName = useSessionStore((s) => s.displayName);
  const { scan } = useLocalSearchParams<{ scan?: string }>();
  // Asked here, at the moment of need, only while no name is set yet; the
  // field stays put while typing (frozen at mount) so it doesn't vanish
  // after the first letter.
  const [askName] = useState(() => displayName.trim().length === 0);
  const [code, setCode] = useState("");
  const [role, setRole] = useState<MemberRole>("traveler");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<RpcError | null>(null);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [clipboardCode, setClipboardCode] = useState<string | null>(null);
  const scanHandled = useRef(false);
  // Double-submit guard (same race as create: the `busy` state lags a render).
  const busyRef = useRef(false);

  // Micro-convenience: if the clipboard already holds a room code (shared
  // from Messages/WhatsApp), offer it as a one-tap paste — no retyping.
  useEffect(() => {
    void (async () => {
      try {
        const text = await Clipboard.getStringAsync();
        const parsed = text ? parseInviteCode(text) : null;
        if (parsed && parsed !== code) setClipboardCode(parsed);
      } catch {
        // Clipboard is best-effort only.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const join = async (joinCode: string, joinRole: MemberRole) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await roomsRpc.joinRoom({
        code: joinCode,
        displayName: displayName.trim() || "Anonymous",
        role: joinRole,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setActiveRoom({
        id: result.room.id,
        code: result.room.code,
        name: result.room.name,
        role: result.member.role,
      });
      router.replace(`/room/${result.room.id}`);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const startScan = async () => {
    if (!permission?.granted) {
      const response = await requestPermission();
      if (!response.granted) return;
    }
    scanHandled.current = false;
    setScanning(true);
  };

  // Home's "Scan QR" tile opens straight into the camera. Deferred to a
  // microtask: setting state synchronously in an effect is a cascading-render
  // hazard (same rule as the room screen's destDraft hand-off).
  useEffect(() => {
    if (scan === "1") queueMicrotask(() => void startScan());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScanned = (data: string) => {
    if (scanHandled.current) return;
    const scanned = parseInviteCode(data);
    if (!scanned) return;
    scanHandled.current = true;
    setScanning(false);
    setCode(scanned);
    void join(scanned, role);
  };

  return (
    <Screen>
      <NavHeader
        title={scanning ? "Scan invite" : "Join a room"}
        onBack={scanning ? () => setScanning(false) : undefined}
      />
      {scanning ? (
        <View style={styles.scanWrap}>
          <View style={styles.scannerBox}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={({ data }) => onScanned(data)}
            />
            <View style={styles.scanFrame} pointerEvents="none" />
          </View>
          <Text style={[typeScale.rowSub, styles.scanHint]}>Point at a Buds invite QR code</Text>
        </View>
      ) : (
        <>
          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            {askName && (
              <View style={styles.nameBlock}>
                <TextField
                  value={displayName}
                  onChangeText={(t) => useSessionStore.getState().setDisplayName(t)}
                  placeholder="Your name"
                  maxLength={24}
                  autoCapitalize="words"
                  accessibilityLabel="Your name"
                  testID="join-name"
                />
                <Text style={[typeScale.meta, styles.nameHint]}>Your buds see this name.</Text>
              </View>
            )}
            {/* One field, its tools inside it: scan sits at the trailing edge
            (Uber nests Later inside the search box the same way). */}
            <View style={styles.codeBox}>
              <TextInput
                value={code}
                onChangeText={(text) => {
                  const next = normalizeCode(text);
                  setCode(next);
                  if (next === clipboardCode) setClipboardCode(null);
                }}
                placeholder="Room code"
                placeholderTextColor={colors.textDim}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus={!askName}
                maxLength={CODE_LENGTH}
                returnKeyType="go"
                onSubmitEditing={() => {
                  if (code.length === CODE_LENGTH) void join(code, role);
                }}
                style={[styles.codeInput, code.length > 0 && styles.codeInputFilled]}
                accessibilityLabel="Room code"
                testID="join-code"
              />
              <Pressable
                style={({ pressed }) => [styles.scanBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Scan QR code"
                testID="join-scan"
                hitSlop={6}
                onPress={() => void startScan()}
              >
                <AppSymbol name={icons.qr} fallback={icons.qr.fallback} size={22} tintColor={colors.text} />
              </Pressable>
            </View>
            {clipboardCode && code.length === 0 && (
              <Pressable
                style={({ pressed }) => [styles.pasteChip, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Paste code ${clipboardCode}`}
                testID="join-paste"
                onPress={() => {
                  setCode(clipboardCode);
                  setClipboardCode(null);
                }}
              >
                <AppSymbol name={icons.paste} fallback={icons.paste.fallback} size={16} tintColor={colors.text} />
                <Text style={styles.pasteText}>Paste {clipboardCode}</Text>
              </Pressable>
            )}

            <Text style={[typeScale.sheetTitle, styles.joinAsTitle]} accessibilityRole="header">
              Join as
            </Text>
            <View accessibilityRole="radiogroup">
              <SelectableRow
                title="Traveler"
                meta="Share your live location with the room (max 10)."
                selected={role === "traveler"}
                leading={<IconTile icon={icons.navigate} round />}
                testID="join-role-traveler"
                a11yLabel="Join as traveler"
                onPress={() => setRole("traveler")}
              />
              <SelectableRow
                title="Spectator"
                meta="Just watch the map. Nothing about you is shared."
                selected={role === "spectator"}
                leading={<IconTile icon={icons.group} round />}
                testID="join-role-spectator"
                a11yLabel="Join as spectator"
                onPress={() => setRole("spectator")}
              />
            </View>

            <ErrorText>{error ? joinErrorMessage(error) : null}</ErrorText>
            {error === "room_full" && role === "traveler" && (
              <Button
                label="Join as spectator instead"
                variant="ghost"
                size="compact"
                onPress={() => void join(code, "spectator")}
              />
            )}
          </ScrollView>
          <StickyFooter>
            <Button
              label={role === "spectator" ? "Join as spectator" : "Join room"}
              busy={busy}
              disabled={code.length !== CODE_LENGTH}
              testID="join-submit"
              onPress={() => void join(code, role)}
            />
          </StickyFooter>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  pressed: { opacity: 0.7 },
  codeBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingLeft: space.md,
    paddingRight: space.xs,
    minHeight: 64,
  },
  codeInput: {
    flex: 1,
    color: colors.text,
    fontSize: 20,
    fontFamily: fontFamily.medium,
    paddingVertical: 14,
  },
  // Typed code reads like a ticket number; the placeholder stays plain.
  codeInputFilled: {
    fontSize: 26,
    fontFamily: fontFamily.bold,
    letterSpacing: 6,
    fontVariant: ["tabular-nums"],
  },
  scanBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  pasteChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: space.sm,
    marginTop: space.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pasteText: { color: colors.text, fontSize: 15, fontFamily: fontFamily.semiBold },
  nameBlock: { marginBottom: space.md },
  nameHint: { marginTop: space.xs },
  joinAsTitle: { marginTop: space.xl, marginBottom: space.sm },
  scanWrap: { flex: 1 },
  scannerBox: {
    flex: 1,
    maxHeight: 460,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrame: {
    width: 220,
    height: 220,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.text,
  },
  scanHint: { textAlign: "center", marginTop: space.md },
});
