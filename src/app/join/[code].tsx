import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { joinErrorMessage } from "./index";
import { Button, Screen, Title } from "@/components/ui";
import { colors } from "@/constants/theme";
import { setActiveRoom } from "@/lib/activeRoom";
import { CODE_LENGTH, normalizeCode } from "@/lib/ids";
import { roomsRpc } from "@/services/rpc/rooms";
import { useSessionStore } from "@/stores/sessionStore";
import type { RpcError } from "@/types/contracts";

// Deep-link target: buds://join/CODE (QR codes and shared invites land here).
export default function DeepLinkJoinScreen() {
  const router = useRouter();
  const { code: rawCode } = useLocalSearchParams<{ code: string }>();
  const ready = useSessionStore((s) => s.ready);
  const [error, setError] = useState<RpcError | null>(null);
  const [retryBusy, setRetryBusy] = useState(false);
  // Keyed by code (not a plain boolean) so a second invite link opened over
  // this screen attempts its own join instead of being swallowed.
  const attemptedCode = useRef<string | null>(null);

  // expo-router can hand back string[] on remounts/dupes — never let that
  // reach normalizeCode (which would throw on .toUpperCase).
  const raw = Array.isArray(rawCode) ? (rawCode[0] ?? "") : (rawCode ?? "");
  const code = normalizeCode(raw);
  const codeValid = code.length === CODE_LENGTH;

  useEffect(() => {
    if (!ready || attemptedCode.current === code) return;
    attemptedCode.current = code;
    // Malformed links (buds://join/!!!) normalize to empty/short — skip the
    // join and let the render path show a typed error (no spinner forever,
    // no setState-in-effect).
    if (!codeValid) return;
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
  }, [ready, code, codeValid, router]);

  // RPC failure, or a malformed invite link once the session is ready.
  const shownError: RpcError | null =
    error ?? (ready && !codeValid ? "bad_code" : null);

  return (
    <Screen>
      <View style={styles.center}>
        <Title>{shownError ? "Couldn't join" : `Joining ${code}…`}</Title>
        {!shownError && <ActivityIndicator size="large" color={colors.accent} style={styles.spinner} />}
        {shownError && (
          <>
            <Text style={styles.error}>{joinErrorMessage(shownError)}</Text>
            {shownError === "room_full" && (
              <Button
                label="Join as spectator"
                busy={retryBusy}
                onPress={() => {
                  if (retryBusy) return;
                  setRetryBusy(true);
                  setError(null);
                  void (async () => {
                    try {
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
                    } finally {
                      setRetryBusy(false);
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
