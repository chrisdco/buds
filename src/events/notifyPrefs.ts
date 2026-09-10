// Maps alert ids to user-facing notification categories (settings toggles).
// Foreground toasts always show; categories gate background OS notifications.

export type NotifyCategory = "arrivals" | "separation" | "detours" | "reconnections" | "other";

export function alertCategory(id: string): NotifyCategory {
  if (id.startsWith("arrive:")) return "arrivals";
  if (id.startsWith("sep:") || id.startsWith("breakaway:")) return "separation";
  if (id.startsWith("evt-dev-")) return "detours";
  if (id.startsWith("evt-rejoin-")) return "reconnections";
  return "other";
}

export const NOTIFY_CATEGORY_LABELS: Record<Exclude<NotifyCategory, "other">, string> = {
  arrivals: "Arrivals",
  separation: "Separation alerts",
  detours: "Detours",
  reconnections: "Reconnects",
};
