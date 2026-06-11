import { convergeStrategy } from "@/modes/converge";
import { formationStrategy } from "@/modes/formation";
import { leaderStrategy } from "@/modes/leader";
import { multitrackStrategy } from "@/modes/multitrack";
import { soloStrategy } from "@/modes/solo";
import type { ModeStrategy } from "@/modes/types";
import type { RoomMode } from "@/types/contracts";

// The room screen never branches on mode — it renders whatever the active
// strategy returns. Anything inexpressible through the ModeStrategy interface
// goes to the backlog, by design.
export const modeRegistry: Record<RoomMode, ModeStrategy> = {
  solo: soloStrategy,
  converge: convergeStrategy,
  multitrack: multitrackStrategy,
  leader: leaderStrategy,
  formation: formationStrategy,
};
