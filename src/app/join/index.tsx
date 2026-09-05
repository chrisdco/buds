import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button, Chip, ErrorText, Label, Screen, TextField, Title } from "@/components/ui";
import { colors } from "@/constants/theme";
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
  const scanHandled = useRef(false);

  const join = async (joinCode: string, joinRole: MemberRole) => {
    setBusy(true);
    setError(null);
    const result = await roomsRpc.joinRoom({
      code: joinCode,
      displayName: displayName.trim() || "Anonymous",
      role: joinRole,
    });
    setBusy(false);
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

      {scanning ? (
        <>
          <View style={styles.scannerBox}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={({ data }) => onScanned(data)}
            />
          </View>
          <Text style={styles.scanHint}>Point at a Buds invite QR code</Text>
          <Button label="Cancel scan" variant="ghost" onPress={() => setScanning(false)} />
        </>
      ) : (
        <>
          <Label>Room code</Label>
          <TextField
            value={code}
            onChangeText={(text) => setCode(normalizeCode(text))}
            placeholder="ABC123"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={CODE_LENGTH}
            style={styles.codeInput}
          />

          <Label>Join as</Label>
          <View style={styles.chips}>
            <Chip
              label="Traveler"
              selected={role === "traveler"}
              onPress={() => setRole("traveler")}
            />
            <Chip
              label="Spectator"
              selected={role === "spectator"}
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
            onPress={() => void join(code, role)}
          />
          <Button label="Scan QR code" variant="ghost" onPress={() => void startScan()} />
          <Button label="Back" variant="ghost" onPress={() => router.back()} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 24, marginBottom: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  codeInput: {
    fontSize: 24,
    letterSpacing: 8,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    color: colors.text,
  },
  scannerBox: {
    height: 320,
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 12,
    backgroundColor: colors.surface,
  },
  scanHint: {
    color: colors.textDim,
    textAlign: "center",
    marginTop: 10,
    fontSize: 13,
  },
});
