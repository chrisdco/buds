// Place search proxy: Mapbox Search Box text search, key kept server-side.
//
// POST { q: string, lat?: number, lng?: number, limit?: number }
// -> 200 { results: { id, name, address, lat, lng, kind }[], provider: "mapbox" }
// -> 503 when MAPBOX_TOKEN isn't set, 502 when Mapbox fails
//    (the app then falls back to its keyless Photon search).

const MAPBOX = "https://api.mapbox.com/search/searchbox/v1/forward";
const TIMEOUT_MS = 4_000;
// Best-effort per-user limit per instance: stops a runaway client loop.
const RATE_PER_MIN = 60;

interface Feature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    mapbox_id?: string;
    name?: string;
    full_address?: string;
    place_formatted?: string;
    address?: string;
    feature_type?: string;
    poi_category?: string[];
  };
}

const hits = new Map<string, number[]>();
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(userId, recent);
  if (hits.size > 5_000) hits.clear();
  return recent.length > RATE_PER_MIN;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function toResult(f: Feature, i: number) {
  const c = f.geometry?.coordinates;
  const p = f.properties ?? {};
  if (!Array.isArray(c) || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) return null;
  const name = p.name || p.address || "Dropped pin";
  // "place_formatted" is the area line under a POI name; full_address
  // repeats the name for addresses, so prefer the shorter one.
  const address = p.place_formatted || (p.full_address && p.full_address !== name ? p.full_address : "") || "";
  const category = p.poi_category?.[0];
  const kind = category ? cap(category) : null;
  return { id: p.mapbox_id ?? `mb${i}`, name, address, lng: c[0], lat: c[1], kind };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only" });
  const token = Deno.env.get("MAPBOX_TOKEN");
  if (!token) return json(503, { error: "search provider not configured" });

  const auth = req.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
  let userId = "anon";
  try {
    userId = JSON.parse(atob(auth.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub ?? "anon";
  } catch {
    // keep "anon"
  }
  if (rateLimited(userId)) return json(429, { error: "rate limited" });

  let body: { q?: unknown; lat?: unknown; lng?: unknown; limit?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid JSON" });
  }
  const q = typeof body.q === "string" ? body.q.trim().slice(0, 200) : "";
  if (q.length < 2) return json(400, { error: "q too short" });
  const limit = Math.min(10, Math.max(1, Number(body.limit) || 6));
  const lat = Number(body.lat);
  const lng = Number(body.lng);

  const params = new URLSearchParams({
    q,
    access_token: token,
    limit: String(limit),
    language: "en",
    auto_complete: "true",
    types: "poi,address,street,neighborhood,locality,place",
  });
  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    params.set("proximity", `${lng},${lat}`);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${MAPBOX}?${params}`, { signal: ctrl.signal });
    if (!res.ok) return json(502, { error: `mapbox ${res.status}` });
    const data = (await res.json()) as { features?: Feature[] };
    const results = (data.features ?? []).map(toResult).filter((r) => r != null);
    return json(200, { results, provider: "mapbox" });
  } catch {
    return json(502, { error: "mapbox unreachable" });
  } finally {
    clearTimeout(timer);
  }
});
