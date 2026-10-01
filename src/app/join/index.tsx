import { CameraView, useCameraPermissions } from "expo-camera";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button, Chip, ErrorText, Label, Screen, TextField, Title } from "@/components/ui";
import { LocationSearchArt } from "@/components/illustrations/LocationSearchArt";
import { colors, radius } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { setActiveRoom } from "@/lib/activeRoom";
import { CODE_LENGTH, normalizeCode, parseInviteCode } from "@/lib/ids";
import { roomsRpc } from "@/services/rpc/rooms";
import { useSessionStore } from "@/stores/sessionStore";
import type { MemberRole, RpcError } from "@/types/contracts";

export function joinErrorMessage(error: RpcError): string {
  switch (error) {
    case "bad_code":
      return "Room not found — double-check the code.";
    case "room_full":
      return "All traveler spots are taken.";
    case "room_locked":
      return "The host has locked this room.";
    case "room_ended":
      return "That room has ended.";
    case "kicked":
      return "You were removed from this room.";
    case "bad_display_name":
      return "Please enter a valid name (1–24 characters).";
    default:
      return "Couldn't join — check your connection and try again.";
  }
}

export default function JoinRoomScreen() {
  const router = useRouter();
  const displayName = useSessionStore((s) => s.displayName);
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
      <View style={styles.header}>
        <Title>Join a room</Title>
      </View>

      {/* Finding-a-room scene (unDraw, brand recolor). Compact: this form
      has no scroll, so the art stays small. */}
      <View style={styles.art} accessible={false}>
        <LocationSearchArt width={150} />
      </View>

      {scanning ? (
        <>
          <View style={styles.scannerBox}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={({ data }) => onScanned(data)}
            />
            <View style={styles.scanFrame} pointerEvents="none" />
          </View>
          <Text style={styles.scanHint}>Point at a Buds invite QR code</Text>
          <Button label="Cancel scan" variant="ghost" onPress={() => setScanning(false)} />
        </>
      ) : (
        <>
          <Label>Room code</Label>
          <TextField
            value={code}
            onChangeText={(text) => {
              const next = normalizeCode(text);
              setCode(next);
              if (next === clipboardCode) setClipboardCode(null);
            }}
            placeholder="ABC123"
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            maxLength={CODE_LENGTH}
            returnKeyType="go"
            onSubmitEditing={() => {
              if (code.length === CODE_LENGTH) void join(code, role);
            }}
            style={styles.codeInput}
            testID="join-code"
          />
          {clipboardCode && code.length === 0 && (
            <Button
              label={`Paste ${clipboardCode}`}
              variant="ghost"
              size="compact"
              testID="join-paste"
              onPress={() => {
                setCode(clipboardCode);
                setClipboardCode(null);
              }}
            />
          )}

          <Label>Join as</Label>
          <Text style={styles.caption}>
            Travelers share location (max 10). Spectators just watch.
          </Text>
          <View style={styles.chips}>
            <Chip
              label="Traveler"
              selected={role === "traveler"}
              testID="join-role-traveler"
              a11yLabel="Join as traveler"
              onPress={() => setRole("traveler")}
            />
            <Chip
              label="Spectator"
              selected={role === "spectator"}
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
              onPress={() => void join(code, "spectator")}
            />
          )}

          <Button
            label="Join room"
            busy={busy}
            disabled={code.length !== CODE_LENGTH}
            testID="join-submit"
            onPress={() => void join(code, role)}
          />
          <Button
            label="Scan QR code"
            variant="ghost"
            testID="join-scan"
            onPress={() => void startScan()}
          />
          <Button label="Back" variant="ghost" onPress={() => router.back()} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 24, marginBottom: 4 },
  art: { alignItems: "center", marginVertical: 4 },
  caption: { color: colors.textDim, fontSize: 13, fontFamily: fontFamily.regular, marginTop: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  codeInput: {
    fontSize: 24,
    fontFamily: fontFamily.bold,
    letterSpacing: 8,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    color: colors.text,
  },
  scannerBox: {
    height: 320,
    borderRadius: radius.lg,
    overflow: "hidden",
    marginTop: 12,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrame: {
    width: 200,
    height: 200,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.text,
  },
  scanHint: {
    color: colors.textDim,
    textAlign: "center",
    marginTop: 10,
    fontSize: 13,
    fontFamily: fontFamily.regular,
  },
});
