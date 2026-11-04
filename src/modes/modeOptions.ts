import { icons } from "@/components/Symbol";
import type { RoomMode } from "@/types/contracts";

// User-facing mode list, shared by /create and room settings so both show
// the same names, one-line meta and icons. Uber ride-list grammar: icon
// left, name + one line of meta, the popular option badged. Internal
// maturity flags stay out of the UI.
export const MODE_OPTIONS: {
  id: RoomMode;
  label: string;
  blurb: string;
  tag?: string;
  icon: (typeof icons)[keyof typeof icons];
}[] = [
  { id: "converge", label: "Converge", blurb: "Everyone heads to one shared destination.", tag: "Popular", icon: icons.flag },
  { id: "leader", label: "Follow leader", blurb: "One leader, everyone keeps up.", icon: icons.star },
  { id: "formation", label: "Formation", blurb: "Stay within a set radius of the group.", icon: icons.group },
  { id: "multitrack", label: "Multi-track", blurb: "Each traveler has their own destination.", icon: icons.trips },
  { id: "solo", label: "Solo", blurb: "Just share where you are. Others can watch.", icon: icons.profile },
];
