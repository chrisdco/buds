import AsyncStorage from "@react-native-async-storage/async-storage";

export interface PlannedPlace {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface PlannedTrip {
  id: string;
  place: PlannedPlace;
  /** Fire time, epoch ms. */
  atMs: number;
  /** expo-notifications identifier, when a reminder was scheduled. */
  notifId: string | null;
}

const KEY = "buds.plannedTrips";
const MAX_PLANNED = 5;

export interface TimeSlot {
  id: string;
  label: string;
  atMs: number;
}

function atHour(base: Date, h: number): Date {
  const d = new Date(base);
  d.setHours(h, 0, 0, 0);
  return d;
}

function fmtTime(atMs: number): string {
  return new Date(atMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** "Today" / "Tomorrow" by calendar day (local time), never by elapsed hours. */
function dayWord(atMs: number, nowMs: number): "Today" | "Tomorrow" | null {
  const day = (ms: number) => {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  // Round: DST days are 23/25h long.
  const diffDays = Math.round((day(atMs) - day(nowMs)) / 86_400_000);
  return diffDays === 0 ? "Today" : diffDays === 1 ? "Tomorrow" : null;
}

/** Earliest a plan may be set for, and how far ahead (reminders past a month are noise). */
export const MIN_LEAD_MS = 5 * 60_000;
export const MAX_AHEAD_MS = 30 * 86_400_000;

/**
 * Smart presets for "Later": the common intents in one tap, all strictly
 * future. Presets that make no sense right now drop out (no "Tonight" at
 * 11 PM, no "This weekend" when it already is). Anything else goes through
 * the custom date + time picker.
 */
export function timeSlots(nowMs: number): TimeSlot[] {
  const now = new Date(nowMs);
  const slots: TimeSlot[] = [
    { id: "30m", label: "In 30 min", atMs: nowMs + 30 * 60_000 },
    { id: "1h", label: "In 1 hour", atMs: nowMs + 3_600_000 },
  ];
  const tonight = atHour(now, 19).getTime();
  if (tonight > nowMs + 60 * 60_000) slots.push({ id: "tonight", label: "Tonight 7 PM", atMs: tonight });
  let am = atHour(now, 9).getTime();
  if (am <= nowMs + 30 * 60_000) am += 86_400_000;
  // Labels come from the calendar day: at 9 PM the 9 AM slot is
  // tomorrow's even though it is only 12 hours away.
  slots.push({ id: "morning", label: `${dayWord(am, nowMs)} 9 AM`, atMs: am });
  const dow = now.getDay(); // 0 Sun .. 6 Sat
  if (dow >= 1 && dow <= 5) {
    const sat = atHour(new Date(nowMs + (6 - dow) * 86_400_000), 10).getTime();
    slots.push({ id: "weekend", label: "Saturday 10 AM", atMs: sat });
  }
  return slots;
}

/** "Today 7:00 PM", "Tomorrow 9:00 AM", or "Sat 8 Nov, 10:00 AM". */
export function whenLabel(atMs: number, nowMs: number): string {
  const day = dayWord(atMs, nowMs);
  if (day) return `${day} ${fmtTime(atMs)}`;
  const date = new Date(atMs).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
  return `${date}, ${fmtTime(atMs)}`;
}

/** Why a picked time can't be used, or null when it's fine. */
export function planTimeError(atMs: number, nowMs: number): string | null {
  if (atMs < nowMs + MIN_LEAD_MS) return "Pick a time at least 5 minutes from now.";
  if (atMs > nowMs + MAX_AHEAD_MS) return "Plans can be up to 30 days ahead.";
  return null;
}

/** A picked calendar day + clock time as one instant (local time). */
export function combineDateTime(day: Date, time: Date): number {
  const d = new Date(day);
  d.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return d.getTime();
}

/** "In 45m" / "In 3h" / "Tomorrow 8:00 AM" countdown for rows. */
export function countdownLabel(atMs: number, nowMs: number): string {
  const diff = atMs - nowMs;
  if (diff <= 0) return "Due now";
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `In ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 20) return `In ${hours}h`;
  const day = dayWord(atMs, nowMs);
  return day ? `${day} ${fmtTime(atMs)}` : fmtTime(atMs);
}

function isPlannedTrip(t: unknown): t is PlannedTrip {
  if (typeof t !== "object" || t === null) return false;
  const p = t as Record<string, unknown>;
  const place = p.place as Record<string, unknown> | undefined;
  return (
    typeof p.id === "string" &&
    typeof place === "object" &&
    place !== null &&
    typeof place.name === "string" &&
    typeof p.atMs === "number" &&
    Number.isFinite(p.atMs)
  );
}

export async function getPlannedTrips(nowMs = Date.now()): Promise<PlannedTrip[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return [];
    // Prune the past on read; trips fire once via notification.
    return parsed.filter(isPlannedTrip).filter((t) => t.atMs > nowMs - 15 * 60_000);
  } catch {
    return [];
  }
}

async function writePlanned(trips: PlannedTrip[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(trips.slice(0, MAX_PLANNED)));
  } catch {
    // Convenience state only.
  }
}

/**
 * Saves a trip (newest first, capped). Returns the kept list plus any trips
 * the cap evicted, so the caller can cancel their scheduled reminders —
 * otherwise an evicted trip's notification still fires and its tap finds
 * nothing to open.
 */
export async function addPlannedTrip(
  trip: PlannedTrip,
): Promise<{ trips: PlannedTrip[]; evicted: PlannedTrip[] }> {
  const trips = await getPlannedTrips();
  const all = [trip, ...trips.filter((t) => t.id !== trip.id)];
  const next = all.slice(0, MAX_PLANNED);
  await writePlanned(next);
  return { trips: next, evicted: all.slice(MAX_PLANNED) };
}

export async function removePlannedTrip(id: string): Promise<PlannedTrip[]> {
  const trips = await getPlannedTrips();
  const next = trips.filter((t) => t.id !== id);
  await writePlanned(next);
  return next;
}

export function plannedTripId(): string {
  return `plan-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}
