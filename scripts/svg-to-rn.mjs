// SVG -> react-native-svg converter for flat vector art (unDraw / Open Peeps
// style: groups, transforms, solid fills, basic shapes). NOT general-purpose:
// filters, gradients, masks, clip paths, text, and inline styles are rejected
// loudly instead of rendering wrong.
//
// Usage:
//   node scripts/svg-to-rn.mjs <in.svg> <ComponentName> <out.tsx> [--set OLD=NEW ...] [--thin=FILL:N ...]
//
// --set recolors at conversion time (e.g. brand primary, dark-theme remaps)
// and is recorded in the emitted file header so swaps stay reproducible.

import fs from "node:fs";

const TAG_MAP = {
  svg: "Svg",
  g: "G",
  path: "Path",
  circle: "Circle",
  rect: "Rect",
  ellipse: "Ellipse",
  polygon: "Polygon",
  polyline: "Polyline",
  line: "Line",
};

const ATTR_MAP = {
  "fill-rule": "fillRule",
  "fill-opacity": "fillOpacity",
  "stroke-width": "strokeWidth",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "stroke-miterlimit": "strokeMiterlimit",
  "stroke-opacity": "strokeOpacity",
};

const REJECT = [
  "<filter",
  "<linearGradient",
  "<radialGradient",
  "<pattern",
  "<mask",
  "<clipPath",
  "<text",
  "<tspan",
  "<image",
  "foreignObject",
  "<use",
  "<a ",
  "style=",
];

function fail(msg) {
  console.error(`svg-to-rn: ${msg}`);
  process.exit(1);
}

const [, , inFile, compName, outFile, ...rest] = process.argv;
if (!inFile || !compName || !outFile) {
  fail("usage: node scripts/svg-to-rn.mjs <in.svg> <ComponentName> <out.tsx> [--set OLD=NEW ...]");
}
const recolors = new Map();
let thin = null; // { fill, n } — drop all but every nth tiny dot element
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === "--set" && i + 1 < rest.length && rest[i + 1].includes("=")) {
    const eq = rest[i + 1].indexOf("=");
    recolors.set(rest[i + 1].slice(0, eq).toLowerCase(), rest[i + 1].slice(eq + 1));
    i++;
    continue;
  }
  const tm = /^--thin=([^:]+):(\d+)$/.exec(rest[i]);
  if (tm) {
    thin = { fill: tm[1].toLowerCase(), n: Number(tm[2]) };
    continue;
  }
  fail(`bad flag (want --set OLD=NEW or --thin=FILL:N): ${rest[i]}`);
}

let src = fs.readFileSync(inFile, "utf8");
for (const bad of REJECT) {
  if (src.includes(bad)) fail(`${inFile} uses unsupported SVG feature: ${bad}`);
}

const vb = /viewBox="([^"]+)"/.exec(src);
if (!vb) fail(`${inFile}: no viewBox`);
const [, , vbW, vbH] = vb[1].trim().split(/\s+/).map(Number);
if (!vbW || !vbH) fail(`${inFile}: bad viewBox ${vb[1]}`);

let body = src
  .replace(/<\?xml[^?]*\?>/g, "")
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/<title>[\s\S]*?<\/title>/g, "")
  .replace(/<desc>[\s\S]*?<\/desc>/g, "")
  .replace(/<\/?defs>/g, "");

// Thin out halftone dot fields (e.g. unDraw dotted globes: ~1300 2px dots).
// Drops all but every nth tiny dot of the given fill; larger shapes with
// the same fill are untouched. Documented per-file in the emit header.
if (thin) {
  let seen = 0;
  body = body.replace(/<(circle|path)\b[^<>]*\/?>/g, (el) => {
    if (!el.toLowerCase().includes(`fill="${thin.fill}"`)) return el;
    const tiny =
      /<circle\b[^<>]*r="2\.[0-9]/.test(el) || /a2\.15[0-9]/.test(el);
    if (!tiny) return el;
    seen++;
    return seen % thin.n === 0 ? el : "";
  });
  console.log(`thinned ${thin.fill}: kept 1 in ${thin.n} dots`);
}

// Convert tags + attributes inside tags only (path data untouched).
const used = new Set();
body = body.replace(/<\/?[a-zA-Z][^<>]*\/?>/g, (tag) => {
  const m = /^<(\/?)([a-zA-Z]+)/.exec(tag);
  if (!m) return tag;
  const [, close, name] = m;
  const mapped = TAG_MAP[name];
  if (!mapped) {
    if (name === "svg") return tag; // handled below via Svg root rewrite
    fail(`unsupported element <${name}>`);
  }
  used.add(mapped);
  let out = tag.replace(m[0], `<${close}${mapped}`);
  out = out.replace(
    /([a-zA-Z-]+)="([^"]*)"/g,
    (attr, key, val) => {
      if (key === "xmlns" || key === "xmlns:xlink" || key === "id" || key === "class" || key === "version" || key === "width" || key === "height" || key === "viewBox") {
        return "";
      }
      const renamed = ATTR_MAP[key] ?? key;
      if (/^(fill|stroke)$/.test(key)) {
        const hit = recolors.get(val.toLowerCase());
        if (hit) val = hit;
      }
      return ` ${renamed}="${val}"`;
    },
  );
  return out.replace(/\s+\/>/g, "/>").replace(/<(\w+)\s+>/g, "<$1>");
});

// Swap the root <Svg ...> for the sized component root.
used.delete("Svg");
body = body.replace(
  /<Svg[^<>]*>/,
  `<Svg width={width} height={height} viewBox="${vb[1].trim()}" accessible={false}>`,
);

const parts = ["Svg", ...[...used].sort()];
const importStmt =
  parts.length === 1
    ? `import Svg from "react-native-svg";`
    : `import Svg, { ${parts.slice(1).join(", ")} } from "react-native-svg";`;
const recolorNote =
  recolors.size === 0
    ? "no recolors"
    : [...recolors].map(([a, b]) => `${a} -> ${b}`).join(", ");

const tsx = `${importStmt}

// ${compName} — converted from ${inFile.split(/[\\/]/).pop()} (see docs/design.md illustration notes).
// Recolors baked at conversion (${recolorNote}); re-run scripts/svg-to-rn.mjs to change.
const VIEW_W = ${vbW};
const VIEW_H = ${vbH};

export function ${compName}({ width = 240 }: { width?: number }) {
  const height = (width * VIEW_H) / VIEW_W;
  return (
${body
  .split("\n")
  .map((l) => (l.trim() ? `    ${l.trim().replace(/\s{2,}/g, " ")}` : ""))
  .join("\n")
  .replace(/\n{3,}/g, "\n\n")}
  );
}
`;

fs.writeFileSync(outFile, tsx + "\n");
console.log(`wrote ${outFile} (${compName}, viewBox ${vb[1].trim()}, parts: ${parts.join("+")})`);
