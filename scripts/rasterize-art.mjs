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

// name -> source file, render width at @1x (dp of largest use), recolors.
const ART = {
  destination: { src: "destination.svg", width: 320, recolor: { "#6c63ff": ACCENT } },
  "order-ride": { src: "order-ride.svg", width: 320, recolor: { "#6c63ff": ACCENT } },
  "travel-together": { src: "travel-together.svg", width: 320, recolor: { "#6c63ff": ACCENT } },
  "share-location": { src: "share-location.svg", width: 220, recolor: { "#6c63ff": ACCENT } },
  "location-search": { src: "location-search.svg", width: 200, recolor: { "#6c63ff": ACCENT } },
};

for (const [name, cfg] of Object.entries(ART)) {
  let svg = fs.readFileSync(path.join(srcDir, cfg.src), "utf8");
  for (const [from, to] of Object.entries(cfg.recolor)) {
    svg = svg.replaceAll(new RegExp(from, "gi"), to);
  }
  for (const scale of [1, 2, 3]) {
    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: cfg.width * scale } });
    const png = resvg.render().asPng();
    const suffix = scale === 1 ? "" : `@${scale}x`;
    fs.writeFileSync(path.join(outDir, `${name}${suffix}.png`), png);
  }
  console.log(`rasterized ${name} @1x/@2x/@3x (base ${cfg.width}px)`);
}
