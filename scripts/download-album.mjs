// Downloads every photo from a *shared* Google Photos album link into photos-original/album/.
//   npm run download -- https://photos.app.goo.gl/XXXX
// Only works for albums shared "with anyone who has the link". Videos are skipped.
// This reads Google's public share page, which is undocumented, so it may break if Google changes it;
// the fallback is "Download all" from the album in Google Photos and unzipping into photos-original/.

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "photos-original", "album");
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const link = process.argv[2];
if (!link) {
  console.error("Usage: npm run download -- <shared album link>");
  process.exit(1);
}

const res = await fetch(link, { headers: { "User-Agent": UA }, redirect: "follow" });
const html = await res.text();
const url = new URL(res.url);
const albumId = url.pathname.split("/").pop();
const key = url.searchParams.get("key");

const m = html.match(/AF_initDataCallback\(\{key: 'ds:1'.*?data:([\s\S]*?), sideChannel/);
if (!m) throw new Error("Couldn't find album data on the page. Is the album shared publicly?");
const data = JSON.parse(m[1]);
const title = data[3]?.[1] ?? "album";
let items = [...data[1]];
let token = data[2];

// Remaining pages come from the same RPC the web page uses when you scroll.
while (token) {
  const body = new URLSearchParams({
    "f.req": JSON.stringify([[["snAcKc", JSON.stringify([albumId, token, null, key]), null, "generic"]]]),
  });
  const r = await fetch("https://photos.google.com/_/PhotosUi/data/batchexecute", {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body,
  });
  const text = await r.text();
  const line = text.split("\n").find((l) => l.startsWith("[[") && l.includes("snAcKc"));
  if (!line) throw new Error(`Paging failed (HTTP ${r.status}) after ${items.length} items`);
  const page = JSON.parse(JSON.parse(line)[0][2]);
  items.push(...(page[1] ?? []));
  token = page[2];
  process.stdout.write(`\rListed ${items.length} items...`);
}
console.log(`\nAlbum "${title}": ${items.length} items`);

// Item: [id, [baseUrl, w, h, ...], takenMs, ..., ..., {flags}]. Video items carry key 76647426.
const isVideo = (it) => JSON.stringify(it.at(-1) ?? {}).includes("76647426");
const photos = items.filter((it) => !isVideo(it));
console.log(`${photos.length} photos, ${items.length - photos.length} videos (skipped)`);

await fs.mkdir(OUT, { recursive: true });
const existing = new Set(await fs.readdir(OUT));
let done = 0;
async function grab(it) {
  const [id, [base], takenMs] = it;
  const stamp = new Date(takenMs).toISOString().replace(/[:T]/g, "-").slice(0, 19);
  const prefix = `${stamp}_${id.slice(-10)}`;
  if ([...existing].some((f) => f.startsWith(prefix))) return done++;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(`${base}=d`, { headers: { "User-Agent": UA } }); // =d -> original file
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const type = r.headers.get("content-type") ?? "";
      const ext = type.includes("heic") || type.includes("heif") ? "heic" : type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
      await fs.writeFile(path.join(OUT, `${prefix}.${ext}`), Buffer.from(await r.arrayBuffer()));
      break;
    } catch (e) {
      if (attempt === 4) console.warn(`\nFailed ${id}: ${e.message}`);
      else await new Promise((s) => setTimeout(s, 1000 * attempt));
    }
  }
  process.stdout.write(`\rDownloaded ${++done}/${photos.length}`);
}
const queue = [...photos];
await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) await grab(queue.shift()); }));
console.log(`\nSaved to ${path.relative(ROOT, OUT)}/`);
