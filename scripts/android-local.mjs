// Local emulator launcher: `npm run android:local`.
//
// Picks the first free Metro port from 8081 upward (never steals another
// project's server — e.g. sehat on 8081), starts Expo on it, points the
// installed debug build at it, and launches the app. Replaces the manual
// dance of `--port`, prefs edits, and `monkey` launches.
//
// Why not `adb reverse` (Expo's default handoff)? This emulator's reverse
// tunnel forwards device->host but drops the return bytes, so the app uses
// the emulator NAT alias 10.0.2.2, which carries full TCP both ways.
// The override is written to the app's own SharedPreferences
// (debug builds are debuggable, no root needed) and persists, so a plain
// relaunch keeps working until the next port change.

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serial = process.env.ANDROID_SERIAL ?? "emulator-5554";
const adb = () => {
  const sdk = process.env.ANDROID_SDK_ROOT ?? process.env.ANDROID_HOME ?? "";
  const exe = process.platform === "win32" ? "adb.exe" : "adb";
  if (sdk) return path.join(sdk, "platform-tools", exe);
  return exe; // fall back to PATH
};

function adbRun(args, { input } = {}) {
  return execFileSync(adb(), ["-s", serial, ...args], {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    input,
    timeout: 60000,
  }).trim();
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const sock = net.connect(port, "127.0.0.1");
    sock.once("connect", () => {
      sock.destroy();
      resolve(false); // something answers -> occupied
    });
    sock.once("error", () => resolve(true)); // refused -> free
    sock.setTimeout(2000, () => {
      sock.destroy();
      resolve(false); // ambiguous: treat as occupied, move on
    });
  });
}

async function pickPort() {
  for (let port = 8081; port <= 8090; port++) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(port)) return port;
  }
  throw new Error("no free Metro port in 8081..8090");
}

async function waitForStatus(port, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/status`, {
        signal: AbortSignal.timeout(5000),
      });
      const text = await res.text();
      if (text.includes("packager-status:running")) return;
    } catch {
      // not up yet
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`Metro on :${port} never became ready`);
}

async function main() {
  // Fail fast with a clear message if the emulator isn't there.
  const devices = execFileSync(adb(), ["devices"], { encoding: "utf8" });
  if (!devices.split("\n").some((l) => l.startsWith(serial) && l.includes("\tdevice"))) {
    throw new Error(
      `device ${serial} not found. Start it first, e.g.: ` +
        `emulator -avd buds_pixel (then re-run). ANDROID_SERIAL overrides.`,
    );
  }

  const port = await pickPort();
  console.log(`starting Metro on :${port}`);

  const logFile = path.join(os.tmpdir(), `buds-metro-${port}.log`);
  const logFd = fs.openSync(logFile, "a");
  const child = spawn(
    process.execPath,
    [path.join(root, "node_modules", "expo", "bin", "cli"), "start", "--port", String(port)],
    { cwd: root, detached: true, stdio: ["ignore", logFd, logFd], windowsHide: true },
  );
  child.unref();
  console.log(`metro pid ${child.pid}, logs: ${logFile}`);

  await waitForStatus(port);
  console.log(`Metro up on :${port}`);

  // Tell the installed build where Metro lives (10.0.2.2 = this laptop
  // as seen from the emulator). Written via run-as: no root required.
  const prefs =
    `<?xml version='1.0' encoding='utf-8' standalone='yes' ?>\n` +
    `<map>\n<string name="debug_http_host">10.0.2.2:${port}</string>\n</map>\n`;
  adbRun(["shell", "run-as com.buds.app sh -c 'cat > shared_prefs/com.buds.app_preferences.xml'"], {
    input: prefs,
  });
  console.log(`dev host set to 10.0.2.2:${port}`);

  adbRun(["shell", "am force-stop com.buds.app"]);
  adbRun(["shell", "am start -n com.buds.app/.MainActivity"]);
  console.log("app launched — first bundle build can take a minute or two");
}

main().catch((e) => {
  console.error(`android:local failed: ${e.message}`);
  process.exit(1);
});
