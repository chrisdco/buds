// App icon rasters from the vector sources in assets/icons/src/ (each a
// 1024 square: black rect + one white glyph path). Re-run after editing or
// swapping a source; icons only change on device after a native rebuild.
//
// Usage: node scripts/render-icons.mjs
//
// DEFAULT becomes the app icon (assets/images/* + the iOS Icon Composer
// layer). ALTERNATES are the in-app choices (expo-alternate-app-icons):
// an opaque iOS PNG and a transparent Android adaptive foreground each.

import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "assets", "icons", "src");
const altDir = path.join(root, "assets", "icons", "alt");
const imagesDir = path.join(root, "assets", "images");

const DEFAULT = "geist-serif-buds";
// Alternate name (PascalCase, what setAlternateAppIcon takes) -> source.
const ALTERNATES = {
  GeistB: "geist-serif-b",
  FrauncesB: "fraunces-black-b",
};

// Android shows the middle 72 of the adaptive icon's 108dp canvas, so the
// glyph shrinks by 72/108 to look the same size as on the full iOS square.
const ADAPTIVE_SCALE = 72 / 108;

const read = (name) => fs.readFileSync(path.join(srcDir, `${name}.svg`), "utf8");
const glyphOnly = (svg) => svg.replace(/<rect[^>]*\/>/, "");
const scaled = (svg, k) =>
  glyphOnly(svg)
    .replace(/(<svg[^>]*>)/, `$1<g transform="translate(512 512) scale(${k}) translate(-512 -512)">`)
    .replace("</svg>", "</g></svg>");
const png = (svg, width) => new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();
const write = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  console.log(`wrote ${path.relative(root, file)}`);
};

const def = read(DEFAULT);
write(path.join(imagesDir, "icon.png"), png(def, 1024));
write(path.join(imagesDir, "android-icon-foreground.png"), png(scaled(def, ADAPTIVE_SCALE), 1024));
// Monochrome (Android 13 themed icons) uses alpha only: same as foreground.
write(path.join(imagesDir, "android-icon-monochrome.png"), png(scaled(def, ADAPTIVE_SCALE), 1024));
write(path.join(imagesDir, "splash-icon.png"), png(glyphOnly(def), 512));
write(path.join(imagesDir, "favicon.png"), png(def, 48));
// iOS 26 Icon Composer layer: the glyph alone, the black fill is icon.json's.
write(
  path.join(root, "assets", "expo.icon", "Assets", "glyph.svg"),
  glyphOnly(def).replace('height="1024">', 'height="1024" viewBox="0 0 1024 1024">'),
);

for (const [name, src] of Object.entries(ALTERNATES)) {
  const svg = read(src);
  write(path.join(altDir, `${name}-ios.png`), png(svg, 1024));
  write(path.join(altDir, `${name}-android.png`), png(scaled(svg, ADAPTIVE_SCALE), 1024));
}
