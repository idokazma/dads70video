// Reads every image in photos-original/ (any sub-folder, so you can unzip a
// Google Photos download straight into it), fixes rotation, converts HEIC,
// resizes, and writes web-friendly JPEGs to public/photos/ plus src/photos.json.
//
//   npm run photos             -> sort by date taken (EXIF), fallback to filename
//   npm run photos -- --by-name -> sort by filename (rename 001_x.jpg, 002_y.jpg ... to control order)
//
// Captions/years you add to src/photos.json are kept when you re-run this.

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import exifr from "exifr";
import heicConvert from "heic-convert";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const IN_DIR = path.join(ROOT, "photos-original");
const OUT_DIR = path.join(ROOT, "public", "photos");
const MANIFEST = path.join(ROOT, "src", "photos.json");
const LONG_EDGE = 2400; // enough headroom for slow zooms at 1080p
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".tif", ".tiff", ".gif"]);
const byName = process.argv.includes("--by-name");

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

async function loadExisting() {
  try {
    const list = JSON.parse(await fs.readFile(MANIFEST, "utf8"));
    return new Map(list.map((p) => [p.original, p]));
  } catch {
    return new Map();
  }
}

const files = (await walk(IN_DIR)).sort();
const images = files.filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()));
const skipped = files.filter((f) => !IMAGE_EXT.has(path.extname(f).toLowerCase()) && !f.endsWith(".json"));
if (!images.length) {
  console.error(`No images found in ${IN_DIR}. Put your Google Photos download there first.`);
  process.exit(1);
}

const existing = await loadExisting();
const entries = [];
for (const f of images) {
  const rel = path.relative(IN_DIR, f);
  let date = null;
  try {
    const exif = await exifr.parse(f, ["DateTimeOriginal", "CreateDate"]);
    const d = exif?.DateTimeOriginal ?? exif?.CreateDate;
    if (d instanceof Date && !isNaN(d)) date = d.toISOString();
  } catch {}
  entries.push({ file: f, rel, date });
}

entries.sort((a, b) => {
  if (!byName && a.date && b.date) return a.date.localeCompare(b.date);
  if (!byName && a.date !== b.date) return a.date ? -1 : 1;
  return a.rel.localeCompare(b.rel, undefined, { numeric: true });
});

await fs.rm(OUT_DIR, { recursive: true, force: true });
await fs.mkdir(OUT_DIR, { recursive: true });

const manifest = [];
let i = 0;
for (const e of entries) {
  i++;
  const name = `${String(i).padStart(3, "0")}.jpg`;
  try {
    let input = e.file;
    if ([".heic", ".heif"].includes(path.extname(e.file).toLowerCase())) {
      // sharp's prebuilt binaries can read HEIC headers but not decode HEVC pixels
      input = Buffer.from(await heicConvert({ buffer: await fs.readFile(e.file), format: "JPEG", quality: 0.95 }));
    }
    const info = await sharp(input)
      .rotate() // apply EXIF orientation
      .resize({ width: LONG_EDGE, height: LONG_EDGE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88, mozjpeg: true })
      .toFile(path.join(OUT_DIR, name));
    const prev = existing.get(e.rel) ?? {};
    manifest.push({
      src: `photos/${name}`,
      original: e.rel,
      width: info.width,
      height: info.height,
      date: e.date,
      caption: prev.caption ?? "",
      year: prev.year ?? "", // fill in by hand: EXIF dates on scanned photos are the scan date
    });
    process.stdout.write(`\r${i}/${entries.length} ${e.rel.slice(0, 60).padEnd(60)}`);
  } catch (err) {
    console.warn(`\nSkipping ${e.rel}: ${err.message}`);
  }
}

await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
console.log(`\n\nWrote ${manifest.length} photos to public/photos and src/photos.json`);
if (skipped.length) console.log(`Ignored ${skipped.length} non-image files (e.g. videos): ${skipped.slice(0, 5).map((f) => path.basename(f)).join(", ")}${skipped.length > 5 ? " ..." : ""}`);
