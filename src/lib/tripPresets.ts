import type { ComponentType } from "react";

import type { IconName } from "@/components/Symbol";
import type { RoomMode } from "@/types/contracts";
import { DestinationArt } from "@/components/illustrations/DestinationArt";
import { OrderRideArt } from "@/components/illustrations/OrderRideArt";
import { TravelTogetherArt } from "@/components/illustrations/TravelTogetherArt";

// Trip templates: plain-language cards over the convoy modes (the wedge:
// converge/leader/formation). Solo/multitrack stay off the cards — they're
// experimental and remain selectable on /create. A template is just
// validated /create params: same RPC, same policy gates, zero new backend.

export type TripPresetId = "meet-up" | "follow-leader" | "stay-together";

export interface TripPreset {
  id: TripPresetId;
  title: string;
  blurb: string;
  icon: IconName;
  /** Short badge over the tile (Uber "Promo"/"Faster" language). */
  badge?: string;
  /**
   * Uber-style tile art: a full-bleed scene per preset (unDraw, brand
   * recolor — see illustration notes in docs/design.md). Circles show a
   * zoomed window, not the whole scene: (fx, fy) is the focal point as
   * viewBox fractions, window its size in source units. Focals were chosen
   * against laptop renders (scripts/preview-crop.mjs), not blind.
   * Symbols stay as the loading-safe fallback, never alongside the art.
   */
  image: {
    Art: ComponentType<{ width?: number }>;
    vbW: number;
    vbH: number;
    fx: number;
    fy: number;
    window: number;
  };
  mode: RoomMode;
  limit: number;
  durationHours: number | null;
  /** Editable suggestion, Uber-style: prefilled, never locked. */
  nameFor: (displayName: string) => string;
}

export const TRIP_PRESETS: TripPreset[] = [
  {
    id: "meet-up",
    title: "Meet up",
    blurb: "Everyone heads to one spot",
    icon: "flag",
    badge: "Popular",
    image: { Art: DestinationArt, vbW: 1033.241, vbH: 835.664, fx: 0.55, fy: 0.36, window: 420 },
    mode: "converge",
    limit: 10,
    durationHours: 12,
    nameFor: (displayName) => (displayName ? `${displayName}'s meetup` : "Our meetup"),
  },
  {
    id: "follow-leader",
    title: "Follow leader",
    blurb: "One leader, everyone keeps up",
    icon: "star",
    image: { Art: OrderRideArt, vbW: 918.58215, vbH: 432.0506, fx: 0.5, fy: 0.5, window: 420 },
    mode: "leader",
    limit: 10,
    durationHours: 12,
    nameFor: (displayName) => (displayName ? `${displayName}'s convoy` : "Our convoy"),
  },
  {
    id: "stay-together",
    title: "Stay together",
    blurb: "Hold formation on the move",
    icon: "recenter",
    image: { Art: TravelTogetherArt, vbW: 743.31832, vbH: 819.52927, fx: 0.6, fy: 0.62, window: 430 },
    mode: "formation",
    limit: 10,
    durationHours: 12,
    nameFor: (displayName) => (displayName ? `${displayName}'s group trip` : "Our group trip"),
  },
];

const MODES: RoomMode[] = ["solo", "converge", "multitrack", "leader", "formation"];

export interface CreateParams {
  mode: RoomMode;
  limit: number;
  durationHours: number | null;
  name?: string;
  /** Place picked on Home search: seeded into adjust-pin flow post-create. */
  dest?: { lat: number; lng: number; label: string };
}

/** Serialize a picked place for router params (everything travels as strings). */
export function destCreateParams(dest: { lat: number; lng: number; label: string }): Record<string, string> {
  return {
    destLat: String(dest.lat),
    destLng: String(dest.lng),
    destLabel: dest.label.slice(0, 80),
  };
}

/** Validate/coerce /create params; anything unknown falls back to defaults. */
export function parseCreateParams(params: {
  mode?: string | string[];
  limit?: string | string[];
  duration?: string | string[];
  name?: string | string[];
  destLat?: string | string[];
  destLng?: string | string[];
  destLabel?: string | string[];
}): CreateParams {
  const one = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;
  const mode = one(params.mode);
  const limit = Number.parseInt(one(params.limit) ?? "", 10);
  const duration = one(params.duration);
  const name = one(params.name)?.trim().slice(0, 60);
  const destLat = Number(one(params.destLat) ?? "");
  const destLng = Number(one(params.destLng) ?? "");
  const destLabel = one(params.destLabel)?.trim().slice(0, 80);
  return {
    mode: MODES.includes(mode as RoomMode) ? (mode as RoomMode) : "converge",
    limit: Number.isInteger(limit) && limit >= 1 && limit <= 10 ? limit : 10,
    durationHours:
      duration === "none" ? null : duration === "4" || duration === "12" || duration === "24"
        ? Number(duration)
        : 12,
    name: name && name.length > 0 ? name : undefined,
    dest:
      Number.isFinite(destLat) && Number.isFinite(destLng) && destLabel
        ? { lat: destLat, lng: destLng, label: destLabel }
        : undefined,
  };
}

/** Serialize a preset for router params (everything travels as strings). */
export function presetCreateParams(preset: TripPreset, displayName: string): Record<string, string> {
  return {
    preset: preset.id,
    mode: preset.mode,
    limit: String(preset.limit),
    duration: preset.durationHours == null ? "none" : String(preset.durationHours),
    name: preset.nameFor(displayName.trim()).slice(0, 60),
  };
}
