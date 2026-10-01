// One-off focal preview: renders a zoomed window of an SVG source so crop
// choices for circular tiles can be judged on the laptop instead of burning
// emulator round-trips. Usage:
//   node scripts/preview-crop.mjs <src.svg> <fx> <fy> <window> <out.png>
// fx/fy = focal point as fractions of the viewBox, window = window size in
// source units (square). Renders at 400px.
import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";

const [, , src, fxS, fyS, winS, out] = process.argv;
const fx = Number(fxS);
const fy = Number(fyS);
const win = Number(winS);
if (!src || !out || !Number.isFinite(fx) || !Number.isFinite(fy) || !Number.isFinite(win)) {
  console.error("usage: node scripts/preview-crop.mjs <src.svg> <fx> <fy> <window> <out.png>");
  process.exit(1);
}
const svg = fs.readFileSync(src, "utf8");
const vb = /viewBox="([^"]+)"/.exec(svg)?.[1].trim().split(/\s+/).map(Number);
if (!vb || vb.length !== 4) {
  console.error("no viewBox");
  process.exit(1);
}
const [vx, vy, vw, vh] = vb;
const cx = vx + fx * vw;
const cy = vy + fy * vh;
const x = Math.min(Math.max(cx - win / 2, vx), vx + vw - win);
const y = Math.min(Math.max(cy - win / 2, vy), vy + vh - win);
const cropped = svg.replace(/viewBox="[^"]+"/, `viewBox="${x} ${y} ${win} ${win}"`);
const png = new Resvg(cropped, { fitTo: { mode: "width", value: 400 } }).render().asPng();
fs.writeFileSync(out, png);
console.log(`wrote ${out} (window ${win} @ ${x.toFixed(0)},${y.toFixed(0)})`);
