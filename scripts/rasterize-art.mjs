// Build-time raster for complex scenes (the Uber/Notion pattern): vector
// sources stay in assets/illustrations/src/, and this emits transparent PNGs
// at @1x/@2x/@3x next to them. The app renders <Image> (one native view,
// GPU-decoded) instead of thousand-node SVG trees.
//
// Usage: node scripts/rasterize-art.mjs  (re-run after editing a source SVG)
// Brand recolors bake here, same map as scripts/svg-to-rn.mjs.

import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "assets", "illustrations");
const srcDir = path.join(outDir, "src");

const ACCENT = "#4F8EF7";
// Open Doodles are black ink + one pink; on our dark canvas the ink flips
// to white (chalk-on-slate) and the pink becomes the accent.
const DOODLE = { "#000000": "#FFFFFF", "#FF5678": ACCENT };

// name -> source file, render width at @1x (dp of largest use), recolors.
const ART = {
  destination: { src: "destination.svg", width: 320, recolor: DOODLE },
  "order-ride": { src: "order-ride.svg", width: 320, recolor: DOODLE },
  "travel-together": { src: "travel-together.svg", width: 320, recolor: DOODLE },
  "share-location": { src: "share-location.svg", width: 220, recolor: DOODLE },
  "location-search": { src: "location-search.svg", width: 200, recolor: DOODLE },
};

// Doodles sit in a 1024x768 artboard with wide margins; crop the viewBox to
// the drawn content (+4% pad) so every scene fills its frame the same way.
function cropToContent(svg) {
  const box = new Resvg(svg).getBBox();
  if (!box) return { svg, w: null, h: null };
  const pad = Math.max(box.width, box.height) * 0.04;
  const x = box.x - pad, y = box.y - pad, w = box.width + pad * 2, h = box.height + pad * 2;
  const out = svg
    .replace(/viewBox="[^"]*"/, `viewBox="${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}"`)
    .replace(/(<svg[^>]*?)\swidth="[^"]*"/, "$1")
    .replace(/(<svg[^>]*?)\sheight="[^"]*"/, "$1");
  return { svg: out, w, h };
}

for (const [name, cfg] of Object.entries(ART)) {
  let svg = fs.readFileSync(path.join(srcDir, cfg.src), "utf8");
  for (const [from, to] of Object.entries(cfg.recolor)) {
    svg = svg.replaceAll(new RegExp(from, "gi"), to);
  }
  const cropped = cropToContent(svg);
  svg = cropped.svg;
  for (const scale of [1, 2, 3]) {
    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: cfg.width * scale } });
    const png = resvg.render().asPng();
    const suffix = scale === 1 ? "" : `@${scale}x`;
    fs.writeFileSync(path.join(outDir, `${name}${suffix}.png`), png);
  }
  console.log(`rasterized ${name} @1x/@2x/@3x (base ${cfg.width}px) viewBox ${cropped.w?.toFixed(1)} x ${cropped.h?.toFixed(1)}`);
}
