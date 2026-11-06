// Map style images (MapLibre <Images>): small icons drawn by symbol layers,
// rasterized from assets/map/src/*.svg at @1x/@2x/@3x so RN's asset
// resolver hands MapLibre the right density.
//
// Usage: node scripts/rasterize-map-icons.mjs  (re-run after editing a source)

import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "assets", "map");
const srcDir = path.join(outDir, "src");

// name -> width at @1x (dp)
const ICONS = { "route-chevron": 24 };

for (const [name, width] of Object.entries(ICONS)) {
  const svg = fs.readFileSync(path.join(srcDir, `${name}.svg`), "utf8");
  for (const scale of [1, 2, 3]) {
    const png = new Resvg(svg, { fitTo: { mode: "width", value: width * scale } }).render().asPng();
    const suffix = scale === 1 ? "" : `@${scale}x`;
    fs.writeFileSync(path.join(outDir, `${name}${suffix}.png`), png);
  }
  console.log(`${name}: ${width}dp @1x/@2x/@3x`);
}
