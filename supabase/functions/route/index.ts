// Routing proxy (docs/route-view.md, phase 0).
//
// POST { from: {lat,lng}, to: {lat,lng}, profile?: "drive"|"walk"|"cycle" }
// -> 200 { coords: [lng,lat][], distanceM, durationS, provider }
// -> 4xx/5xx { error }   (the app then falls back to its direct chain)
//
// Why a proxy: provider keys stay server-side, one shared cache serves
// every user (convoys ask for nearly identical routes), per-user rate
// limiting protects the free tiers, and the provider can change here
// without an app release.
//
// Providers, in order: ORS (if the ORS_API_KEY secret is set) -> OSRM
// (OSRM_URL_DRIVE / _WALK / _CYCLE secrets, else the public demo for
// driving and FOSSGIS for walk and cycle).

import { createClient } from "jsr:@supabase/supabase-js@2";

type Profile = "drive" | "walk" | "cycle";
interface LatLng {
  lat: number;
  lng: number;
}
interface Route {
  coords: [number, number][];
  distanceM: number;
  durationS: number;
  provider: "ors" | "osrm";
}

const CACHE_TTL_S = 10 * 60;
const PROVIDER_TIMEOUT_MS = 7_000;
// Best-effort per-user limit, per function instance. Enough to stop a
// runaway client loop; a shared limit would need a table and isn't worth
// the latency yet.
const RATE_PER_MIN = 40;
// ~5 m: OSRM/ORS geometries carry far more points than a phone map needs.
const SIMPLIFY_TOLERANCE_DEG = 0.00005;

const ORS_PROFILE: Record<Profile, string> = {
  drive: "driving-car",
  walk: "foot-walking",
  cycle: "cycling-regular",
};
const OSRM_DEFAULT: Record<Profile, string> = {
  drive: "https://router.project-osrm.org/route/v1/driving",
  walk: "https://routing.openstreetmap.de/routed-foot/route/v1/foot",
  cycle: "https://routing.openstreetmap.de/routed-bike/route/v1/bike",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const hits = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(userId, recent);
  if (hits.size > 5_000) hits.clear(); // bound memory on a long-lived instance
  return recent.length > RATE_PER_MIN;
}

function isLatLng(v: unknown): v is LatLng {
  const p = v as LatLng;
  return (
    !!p &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  );
}

const r5 = (n: number) => n.toFixed(5);
const cacheKey = (p: Profile, a: LatLng, b: LatLng) =>
  `${p}:${r5(a.lat)},${r5(a.lng)}>${r5(b.lat)},${r5(b.lng)}`;

/** Douglas-Peucker on lng/lat degrees (fine at route scale). */
function simplify(points: [number, number][], tol: number): [number, number][] {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    const [ax, ay] = points[s];
    const [bx, by] = points[e];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const [px, py] = points[i];
      let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx - px;
      const ey = ay + t * dy - py;
      const d = ex * ex + ey * ey;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx !== -1 && maxD > tol * tol) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROVIDER_TIMEOUT_MS);
  try {
    return await run(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function viaOrs(p: Profile, a: LatLng, b: LatLng, key: string): Promise<Route> {
  return withTimeout(async (signal) => {
    const res = await fetch(
      `https://api.openrouteservice.org/v2/directions/${ORS_PROFILE[p]}/geojson`,
      {
        method: "POST",
        signal,
        headers: { Authorization: key, "Content-Type": "application/json" },
        body: JSON.stringify({ coordinates: [[a.lng, a.lat], [b.lng, b.lat]] }),
      },
    );
    if (!res.ok) throw new Error(`ORS ${res.status}`);
    const json = await res.json();
    const f = json?.features?.[0];
    if (!f) throw new Error("ORS no route");
    return {
      coords: f.geometry.coordinates,
      distanceM: f.properties.summary.distance,
      durationS: f.properties.summary.duration,
      provider: "ors",
    };
  });
}

async function viaOsrm(p: Profile, a: LatLng, b: LatLng): Promise<Route> {
  const custom = Deno.env.get(`OSRM_URL_${p.toUpperCase()}`)?.replace(/\/+$/, "");
  const base = custom || OSRM_DEFAULT[p];
  return withTimeout(async (signal) => {
    const res = await fetch(
      `${base}/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`,
      { signal, headers: { "User-Agent": "buds-routing-proxy" } },
    );
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const json = await res.json();
    const r = json?.routes?.[0];
    if (json?.code !== "Ok" || !r) throw new Error(`OSRM ${json?.code ?? "no route"}`);
    return {
      coords: r.geometry.coordinates,
      distanceM: r.distance,
      durationS: r.duration,
      provider: "osrm",
    };
  });
}

function valid(r: Route): boolean {
  return (
    Array.isArray(r.coords) &&
    r.coords.length >= 2 &&
    Number.isFinite(r.distanceM) &&
    Number.isFinite(r.durationS) &&
    r.coords.every((c) => Number.isFinite(c?.[0]) && Number.isFinite(c?.[1]))
  );
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only" });

  // verify_jwt (on by default) already rejected missing/invalid tokens;
  // decode the subject only for rate limiting.
  const token = req.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
  let userId = "anon";
  try {
    userId = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub ?? "anon";
  } catch {
    // keep "anon"
  }
  if (rateLimited(userId)) return json(429, { error: "rate limited" });

  let body: { from?: unknown; to?: unknown; profile?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid JSON" });
  }
  const { from, to } = body;
  const profile: Profile =
    body.profile === "walk" || body.profile === "cycle" ? body.profile : "drive";
  if (!isLatLng(from) || !isLatLng(to)) return json(400, { error: "from/to must be {lat,lng}" });

  const key = cacheKey(profile, from, to);
  const { data: cached } = await admin
    .from("route_cache")
    .select("route")
    .eq("key", key)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (cached?.route) return json(200, { ...cached.route, cached: true });

  const orsKey = Deno.env.get("ORS_API_KEY");
  const chain: (() => Promise<Route>)[] = [];
  if (orsKey) chain.push(() => viaOrs(profile, from, to, orsKey));
  chain.push(() => viaOsrm(profile, from, to));

  for (const attempt of chain) {
    try {
      const route = await attempt();
      if (!valid(route)) continue;
      route.coords = simplify(route.coords, SIMPLIFY_TOLERANCE_DEG);
      const expires = new Date(Date.now() + CACHE_TTL_S * 1000).toISOString();
      // Fire-and-forget: a cache write failure must not fail the request.
      // waitUntil keeps the instance alive until the write lands.
      const write = admin
        .from("route_cache")
        .upsert({ key, route, expires_at: expires })
        .then(() => {
          if (Math.random() < 0.02) {
            return admin.from("route_cache").delete().lt("expires_at", new Date().toISOString());
          }
        });
      (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime?.waitUntil(
        Promise.resolve(write),
      );
      return json(200, route);
    } catch {
      // next provider
    }
  }
  return json(502, { error: "all providers failed" });
});
