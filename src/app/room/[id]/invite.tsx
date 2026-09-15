import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { Button, LoadingView, Screen, Title } from "@/components/ui";
import { colors, radius } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { useRoomStore } from "@/stores/roomStore";

export default function InviteScreen() {
  const router = useRouter();
  const room = useRoomStore((s) => s.room);
  const [copied, setCopied] = useState(false);

  // Deep-linked before the snapshot arrived: honest loading, not a white screen.
  if (!room) {
    return (
      <Screen>
        <LoadingView label="Loading invite…" />
      </Screen>
    );
  }
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
        {/* QR stays pure black-on-white regardless of theme: scanners need
        the contrast, so these two literals are intentionally not tokens. */}
        <QRCode value={link} size={210} backgroundColor="#FFFFFF" color="#0F1115" />
      </View>

      <Text style={styles.code}>{room.code}</Text>

      <Button
        label={copied ? "Copied!" : "Copy code"}
        variant="ghost"
        testID="invite-copy"
        onPress={() => {
          void Clipboard.setStringAsync(room.code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      />
      <Button label="Share invite" testID="invite-share" onPress={share} />
      <Button
        label="Back to map"
        variant="ghost"
        testID="invite-back"
        onPress={() => router.back()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 24, marginBottom: 18 },
  sub: { color: colors.textDim, fontSize: 14, fontFamily: fontFamily.regular, marginTop: 4 },
  qrBox: {
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: radius.lg,
    padding: 14,
  },
  code: {
    color: colors.text,
    fontSize: 34,
    fontFamily: fontFamily.extraBold,
    letterSpacing: 10,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
    marginTop: 18,
  },
});
