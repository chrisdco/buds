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

/**
 * Fixed reminder slots (no custom picker — one fewer native dependency,
 * and four presets cover the real intents). All strictly future; a slot
 * already past today rolls to tomorrow.
 */
export function timeSlots(nowMs: number): TimeSlot[] {
  const now = new Date(nowMs);
  const in1h = nowMs + 3_600_000;
  const in3h = nowMs + 3 * 3_600_000;
  let am = atHour(now, 8).getTime();
  if (am <= nowMs + 30 * 60_000) am += 86_400_000;
  let pm = atHour(now, 18).getTime();
  if (pm <= nowMs + 30 * 60_000) pm += 86_400_000;
  return [
    { id: "1h", label: `In 1 hour · ${fmtTime(in1h)}`, atMs: in1h },
    { id: "3h", label: `In 3 hours · ${fmtTime(in3h)}`, atMs: in3h },
    {
      id: "tomorrow-am",
      label: am - nowMs > 20 * 3_600_000 ? `Tomorrow 8 AM` : `Today 8 AM`,
      atMs: am,
    },
    {
      id: "tomorrow-pm",
      label: pm - nowMs > 20 * 3_600_000 ? `Tomorrow 6 PM` : `Today 6 PM`,
      atMs: pm,
    },
  ];
}

/** "In 45m" / "In 3h" / "Tomorrow 8 AM" countdown for rows. */
export function countdownLabel(atMs: number, nowMs: number): string {
  const diff = atMs - nowMs;
  if (diff <= 0) return "Due now";
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `In ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 20) return `In ${hours}h`;
  return fmtTime(atMs);
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

export async function addPlannedTrip(trip: PlannedTrip): Promise<PlannedTrip[]> {
  const trips = await getPlannedTrips();
  const next = [trip, ...trips.filter((t) => t.id !== trip.id)].slice(0, MAX_PLANNED);
  await writePlanned(next);
  return next;
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
