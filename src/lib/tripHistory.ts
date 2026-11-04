import type { ActiveRoomRef } from "@/lib/activeRoom";

// Derived views over the device's recent rooms for Trips and Profile.
// Everything here is computed from what this device saw; there is no
// server-side history.

export interface TripStats {
  trips: number;
  /** Distinct people seen across rooms (not you). */
  buds: number;
  /** Distinct room destinations. */
  places: number;
}

export function tripStats(rooms: ActiveRoomRef[]): TripStats {
  const buds = new Set<string>();
  const places = new Set<string>();
  for (const r of rooms) {
    for (const b of r.buds ?? []) buds.add(b.userId);
    if (r.destLabel) places.add(r.destLabel.trim().toLowerCase());
  }
  return { trips: rooms.length, buds: buds.size, places: places.size };
}

export interface Bud {
  userId: string;
  name: string;
  /** Rooms shared with this person. */
  trips: number;
}

/** People you've been in rooms with, most shared trips first. */
export function frequentBuds(rooms: ActiveRoomRef[], limit = 10): Bud[] {
  const byId = new Map<string, Bud>();
  // rooms are newest first, so the first name seen is the latest one.
  for (const r of rooms) {
    for (const b of r.buds ?? []) {
      const prev = byId.get(b.userId);
      if (prev) prev.trips += 1;
      else byId.set(b.userId, { userId: b.userId, name: b.name, trips: 1 });
    }
  }
  return [...byId.values()].sort((a, b) => b.trips - a.trips).slice(0, limit);
}

/** Rooms you shared with one person, newest first. */
export function tripsWith(rooms: ActiveRoomRef[], userId: string): ActiveRoomRef[] {
  return rooms.filter((r) => r.buds?.some((b) => b.userId === userId));
}

export interface TripSection {
  title: string;
  rooms: ActiveRoomRef[];
}

const DAY_MS = 86_400_000;

/**
 * Uber Activity buckets: This week, This month, Earlier. Rooms saved by
 * older builds have no timestamp and land in Earlier. Empty buckets drop.
 */
export function groupByRecency(rooms: ActiveRoomRef[], nowMs: number): TripSection[] {
  const week: ActiveRoomRef[] = [];
  const month: ActiveRoomRef[] = [];
  const earlier: ActiveRoomRef[] = [];
  for (const r of rooms) {
    const age = r.lastAtMs == null ? Infinity : nowMs - r.lastAtMs;
    if (age < 7 * DAY_MS) week.push(r);
    else if (age < 30 * DAY_MS) month.push(r);
    else earlier.push(r);
  }
  return [
    { title: "This week", rooms: week },
    { title: "This month", rooms: month },
    { title: "Earlier", rooms: earlier },
  ].filter((s) => s.rooms.length > 0);
}

/** "Tue 3 Nov" (this year) or "3 Nov 2025"; null without a timestamp. */
export function shortDate(ms: number | undefined, nowMs: number): string | null {
  if (ms == null) return null;
  const d = new Date(ms);
  const sameYear = d.getFullYear() === new Date(nowMs).getFullYear();
  return d.toLocaleDateString(undefined, sameYear
    ? { weekday: "short", day: "numeric", month: "short" }
    : { day: "numeric", month: "short", year: "numeric" });
}

/** "with Asha, Ben +2" for a row subtitle; null when nobody else was there. */
export function budsLabel(buds: { name: string }[] | undefined): string | null {
  if (!buds || buds.length === 0) return null;
  const names = buds.slice(0, 2).map((b) => b.name);
  const more = buds.length - names.length;
  return `with ${names.join(", ")}${more > 0 ? ` +${more}` : ""}`;
}

/**
 * /create params to repeat a past trip: same mode and name, and the same
 * place when we know its coordinates. Group size and length use defaults.
 */
export function goAgainParams(ref: ActiveRoomRef): Record<string, string> {
  const params: Record<string, string> = { name: ref.name.slice(0, 60) };
  if (ref.mode) params.mode = ref.mode;
  if (ref.destLabel && ref.destLat != null && ref.destLng != null) {
    params.destLat = String(ref.destLat);
    params.destLng = String(ref.destLng);
    params.destLabel = ref.destLabel.slice(0, 80);
  }
  return params;
}
