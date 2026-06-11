// The mode framework: all five operational modes are configuration over one
// engine. A strategy is a bundle of PURE functions over a ClientSnapshot —
// every viewer computes insights/alerts locally (plan §4/§6), nothing here
// touches the network or stores.

import type {
  DestRow,
  MemberLive,
  RoomMode,
  RoomRow,
  RouteResult,
} from "@/types/contracts";

export interface ClientSnapshot {
  room: RoomRow;
  members: Record<string, MemberLive>; // keyed by user_id
  destRoom: DestRow | null;
  destByMember: Record<string, DestRow>; // keyed by member_id
  routes: Record<string, RouteResult>; // keyed by user_id
  nowMs: number;
}

export type DestinationPolicy =
  | "room"
  | "per-member"
  | "leader-position"
  | "optional-personal";

export interface EffectiveDest {
  lat: number;
  lng: number;
  label: string;
  kind: "room" | "personal" | "leader";
}

export interface MemberInsight {
  userId: string;
  etaS?: number;
  remainingM?: number;
  arrivedRank?: number;
  distanceToLeaderM?: number;
  distanceFromCentroidM?: number;
  outsideRadius?: boolean;
  overlapPct?: number; // route overlap with the viewer's route
}

export interface ModeInsights {
  headline: string | null;
  perMember: Record<string, MemberInsight>;
}

export interface AlertCondition {
  id: string;
  active: boolean;
  /** How long the condition must hold before the alert fires. */
  sustainMs: number;
  severity: "info" | "warn";
  title: string;
  body?: string;
}

export type CameraTarget =
  | { kind: "follow"; userId: string }
  | { kind: "fitUsers"; userIds: string[] }
  | { kind: "fitAll" };

export interface ModeStrategy {
  id: RoomMode;
  label: string;
  destinationPolicy: DestinationPolicy;
  /** Where this member is headed under the current mode, or null. */
  effectiveDestinationFor(snap: ClientSnapshot, userId: string): EffectiveDest | null;
  computeInsights(snap: ClientSnapshot, viewerId: string): ModeInsights;
  alertConditions(snap: ClientSnapshot, viewerId: string): AlertCondition[];
  cameraTarget(snap: ClientSnapshot, viewerId: string): CameraTarget;
}

// Defaults for rooms.settings knobs (overridable per room).
export const DEFAULT_ARRIVAL_RADIUS_M = 75;
export const DEFAULT_SEPARATION_ALERT_M = 500;
export const DEFAULT_FORMATION_RADIUS_M = 200;
