import { create } from "zustand";

import {
  addPlannedTrip,
  getPlannedTrips,
  plannedTripId,
  removePlannedTrip,
  type PlannedPlace,
  type PlannedTrip,
} from "@/lib/planned";
import {
  cancelPlannedReminder,
  ensureNotificationPermission,
  schedulePlannedReminder,
} from "@/services/notifications";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";

// Planned trips ("Later"): place + fire time, resident in memory, reminded
// once via a scheduled local notification. Trips save even when reminders
// are denied — the Home countdown still works, the row just says so.
interface PlannedState {
  /** null = not loaded yet. */
  planned: PlannedTrip[] | null;
  refresh: () => Promise<void>;
  /** Schedules + saves; double-prompt primes notifications at intent. */
  plan: (place: PlannedPlace, atMs: number) => Promise<PlannedTrip | null>;
  cancel: (id: string) => Promise<void>;
}

export const usePlannedStore = create<PlannedState>()((set) => ({
  planned: null,

  refresh: async () => {
    set({ planned: await getPlannedTrips() });
  },

  plan: async (place, atMs) => {
    // Double-prompt at intent (same rule as location/background priming):
    // our sheet first, OS dialog second. "Not now" still saves the trip.
    const session = useSessionStore.getState();
    let reminder = false;
    if (!session.primedNotifications) {
      session.setPrimed("notifications");
      const ok = await useUiStore.getState().requestConfirm({
        title: "Remind you when it's time?",
        body: "Buds can nudge you at the scheduled time, even with the screen off.",
        confirmLabel: "Continue",
        cancelLabel: "Not now",
        destructive: false,
      });
      if (ok) reminder = await ensureNotificationPermission();
    } else {
      reminder = await ensureNotificationPermission();
    }

    const id = plannedTripId();
    let notifId: string | null = null;
    if (reminder) {
      notifId = await schedulePlannedReminder({
        plannedId: id,
        title: `Time to head to ${place.name}?`,
        body: "Tap to create the room — your destination is prefilled.",
        atMs,
      });
    }
    const trip: PlannedTrip = { id, place, atMs, notifId };
    set({ planned: await addPlannedTrip(trip) });
    return trip;
  },

  cancel: async (id) => {
    const current = await getPlannedTrips();
    const trip = current.find((t) => t.id === id);
    if (trip?.notifId) await cancelPlannedReminder(trip.notifId);
    set({ planned: await removePlannedTrip(id) });
  },
}));
