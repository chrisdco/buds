import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { Button, Screen, Title } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useRoomStore } from "@/stores/roomStore";

export default function InviteScreen() {
  const router = useRouter();
  const room = useRoomStore((s) => s.room);
  const [copied, setCopied] = useState(false);

  if (!room) return null;
  const link = `buds://join/${room.code}`;

  const share = () =>
    void Share.share({
      message: `Join my Buds room “${room.name}” — code ${room.code}\n${link}`,
    });

  return (
    <Screen>
      <View style={styles.header}>
        <Title>Invite your buds</Title>
        <Text style={styles.sub}>
          Scan the QR with a phone camera, or share the code.
        </Text>
      </View>

      <View style={styles.qrBox}>
        <QRCode value={link} size={210} backgroundColor="#FFFFFF" color="#0F1115" />
      </View>

      <Text style={styles.code}>{room.code}</Text>

      <Button
        label={copied ? "Copied!" : "Copy code"}
        variant="ghost"
        onPress={() => {
          void Clipboard.setStringAsync(room.code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      />
      <Button label="Share invite" onPress={share} />
      <Button label="Back to map" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 24, marginBottom: 18 },
  sub: { color: colors.textDim, fontSize: 14, marginTop: 4 },
  qrBox: {
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
  },
  code: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: 10,
    textAlign: "center",
    marginTop: 18,
  },
});
