import type { SceneArt } from "@/components/illustrations/scene";
import { DestinationArt } from "@/components/illustrations/DestinationArt";
import { LocationSearchArt } from "@/components/illustrations/LocationSearchArt";
import { OrderRideArt } from "@/components/illustrations/OrderRideArt";
import { ShareLocationArt } from "@/components/illustrations/ShareLocationArt";
import { TravelTogetherArt } from "@/components/illustrations/TravelTogetherArt";
import { cardTints } from "@/constants/theme";
import type { RoomMode } from "@/types/contracts";

// Home's "Ideas for your next trip" carousel (Uber's "Outstation getaways"
// slot): real situations mapped onto a mode with sensible defaults. Each
// one opens /create prefilled and editable, so it's a shortcut, not a new
// feature. Art is the bundled unDraw set on a tinted panel, since we have
// no photography.
export interface TripIdea {
  id: string;
  title: string;
  sub: string;
  Art: SceneArt;
  tint: string;
  mode: RoomMode;
  durationHours: number;
  nameFor: (displayName: string) => string;
}

const owned = (displayName: string, thing: string, fallback: string) =>
  displayName ? `${displayName}'s ${thing}` : fallback;

export const TRIP_IDEAS: TripIdea[] = [
  {
    id: "road-trip",
    title: "Road trip convoy",
    sub: "Follow the lead car and see who's falling behind",
    Art: OrderRideArt,
    tint: cardTints.blue,
    mode: "leader",
    durationHours: 12,
    nameFor: (n) => owned(n, "road trip", "Road trip"),
  },
  {
    id: "venue",
    title: "Meet at the venue",
    sub: "Everyone heads to one pin, with live ETAs",
    Art: DestinationArt,
    tint: cardTints.violet,
    mode: "converge",
    durationHours: 4,
    nameFor: (n) => owned(n, "meetup", "Meetup"),
  },
  {
    id: "hike",
    title: "Hike as a group",
    sub: "Get an alert when someone drifts off",
    Art: TravelTogetherArt,
    tint: cardTints.green,
    mode: "formation",
    durationHours: 12,
    nameFor: (n) => owned(n, "hike", "Group hike"),
  },
  {
    id: "pickup",
    title: "Pick someone up",
    sub: "Both of you see each other closing in",
    Art: LocationSearchArt,
    tint: cardTints.amber,
    mode: "converge",
    durationHours: 4,
    nameFor: (n) => owned(n, "pickup", "Pickup"),
  },
  {
    id: "home-safe",
    title: "Get home safe",
    sub: "Friends watch your trip until you arrive",
    Art: ShareLocationArt,
    tint: cardTints.rose,
    mode: "solo",
    durationHours: 4,
    nameFor: (n) => owned(n, "trip home", "Trip home"),
  },
];

/** Serialize an idea for /create's router params (everything is strings). */
export function ideaCreateParams(idea: TripIdea, displayName: string): Record<string, string> {
  return {
    mode: idea.mode,
    limit: "10",
    duration: String(idea.durationHours),
    name: idea.nameFor(displayName.trim()).slice(0, 60),
  };
}
