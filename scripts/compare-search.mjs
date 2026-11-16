#!/usr/bin/env node
// Side-by-side place search: Mapbox (what the app uses once MAPBOX_TOKEN is
// set on the `places` function) vs Photon/OSM (today's search).
//
//   MAPBOX_TOKEN=pk.xxx node scripts/compare-search.mjs --at 12.9716,77.5946 "third wave" "metro" "hsr layout"
//
// --at lat,lng biases results like the app does with your location.

const args = process.argv.slice(2);
let at = null;
const queries = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--at") at = args[++i].split(",").map(Number);
  else queries.push(args[i]);
}
const token = process.env.MAPBOX_TOKEN;
if (!token || queries.length === 0) {
  console.error('Usage: MAPBOX_TOKEN=pk.xxx node scripts/compare-search.mjs [--at lat,lng] "query" ...');
  process.exit(1);
}

const km = (lat, lng) => {
  if (!at) return "";
  const R = 6371;
  const dLat = ((lat - at[0]) * Math.PI) / 180;
  const dLng = ((lng - at[1]) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((at[0] * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return ` (${(2 * R * Math.asin(Math.sqrt(a))).toFixed(1)} km)`;
};

async function mapbox(q) {
  const p = new URLSearchParams({ q, access_token: token, limit: "6", language: "en", auto_complete: "true", types: "poi,address,street,neighborhood,locality,place" });
  if (at) p.set("proximity", `${at[1]},${at[0]}`);
  const res = await fetch(`https://api.mapbox.com/search/searchbox/v1/forward?${p}`);
  if (!res.ok) return [`HTTP ${res.status}: ${await res.text()}`];
  const data = await res.json();
  return (data.features ?? []).map((f) => {
    const [lng, lat] = f.geometry.coordinates;
    const pr = f.properties;
    return `${pr.name} — ${pr.place_formatted ?? pr.full_address ?? ""}${km(lat, lng)}`;
  });
}

async function photon(q) {
  const p = new URLSearchParams({ q, limit: "6", lang: "en" });
  if (at) {
    p.set("lat", String(at[0]));
    p.set("lon", String(at[1]));
    p.set("zoom", "14");
    p.set("location_bias_scale", "0.2");
  }
  const res = await fetch(`https://photon.komoot.io/api/?${p}`);
  if (!res.ok) return [`HTTP ${res.status}`];
  const data = await res.json();
  return (data.features ?? []).map((f) => {
    const [lng, lat] = f.geometry.coordinates;
    const pr = f.properties;
    const area = [pr.district ?? pr.locality, pr.city].filter(Boolean).join(", ");
    return `${pr.name ?? pr.street ?? "?"} — ${area}${km(lat, lng)}`;
  });
}

for (const q of queries) {
  const [m, o] = await Promise.all([mapbox(q), photon(q)]);
  console.log(`\n=== "${q}" ===`);
  console.log("Mapbox:");
  (m.length ? m : ["(nothing)"]).forEach((l) => console.log(`  ${l}`));
  console.log("Photon (current):");
  (o.length ? o : ["(nothing)"]).forEach((l) => console.log(`  ${l}`));
}
