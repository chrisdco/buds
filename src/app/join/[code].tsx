import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { joinErrorMessage } from "./index";
import { Button, Screen, Title } from "@/components/ui";
import { colors } from "@/constants/theme";
import { setActiveRoom } from "@/lib/activeRoom";
import { normalizeCode } from "@/lib/ids";
import { roomsRpc } from "@/services/rpc/rooms";
import { useSessionStore } from "@/stores/sessionStore";
import type { RpcError } from "@/types/contracts";

// Deep-link target: buds://join/CODE (QR codes and shared invites land here).
export default function DeepLinkJoinScreen() {
  const router = useRouter();
  const { code: rawCode } = useLocalSearchParams<{ code: string }>();
  const ready = useSessionStore((s) => s.ready);
  const [error, setError] = useState<RpcError | null>(null);
  const attempted = useRef(false);

  const code = normalizeCode(rawCode ?? "");

  useEffect(() => {
    if (!ready || attempted.current || code.length === 0) return;
    attempted.current = true;
    void (async () => {
      const name = useSessionStore.getState().displayName.trim() || "Anonymous";
      const result = await roomsRpc.joinRoom({ code, displayName: name, role: "traveler" });
      if (result.ok) {
        setActiveRoom({
          id: result.room.id,
          code: result.room.code,
          name: result.room.name,
          role: result.member.role,
        });
        router.replace(`/room/${result.room.id}`);
      } else {
        setError(result.error);
      }
    })();
  }, [ready, code, router]);

  return (
    <Screen>
      <View style={styles.center}>
        <Title>{error ? "Couldn't join" : `Joining ${code}…`}</Title>
        {!error && <ActivityIndicator size="large" color={colors.accent} style={styles.spinner} />}
        {error && (
          <>
            <Text style={styles.error}>{joinErrorMessage(error)}</Text>
            {error === "room_full" && (
              <Button
                label="Join as spectator"
                onPress={() => {
                  attempted.current = false;
                  setError(null);
                  void (async () => {
                    const name =
                      useSessionStore.getState().displayName.trim() || "Anonymous";
                    const result = await roomsRpc.joinRoom({
                      code,
                      displayName: name,
                      role: "spectator",
                    });
                    if (result.ok) {
                      setActiveRoom({
                        id: result.room.id,
                        code: result.room.code,
                        name: result.room.name,
                        role: "spectator",
                      });
                      router.replace(`/room/${result.room.id}`);
                    } else {
                      setError(result.error);
                    }
                  })();
                }}
              />
            )}
            <Button label="Enter a code manually" variant="ghost" onPress={() => router.replace("/join")} />
            <Button label="Home" variant="ghost" onPress={() => router.replace("/")} />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center" },
  spinner: { marginTop: 24 },
  error: { color: colors.danger, fontSize: 15, marginTop: 8, marginBottom: 12 },
});
