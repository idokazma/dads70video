// Applies the text from the storyboard's "Copy changes" button to src/story.json.
//   npm run apply -- changes.txt      (or pipe the text on stdin)
// Numbers refer to the current story.json order (as numbered in the storyboard built from it).

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const STORY = path.join(ROOT, "src/story.json");
const text = fs.readFileSync(process.argv[2] ?? 0, "utf8");
const story = JSON.parse(fs.readFileSync(STORY, "utf8"));

const byNum = new Map(); // n -> photo path
const subs = new Map(); // chapter -> sub
const chapterOrder = [];
let n = 0;
for (const s of story) {
  if (s.chapter) { subs.set(s.chapter, s.sub ?? ""); chapterOrder.push(s.chapter); }
  else byNum.set(++n, s.photo);
}

const removed = new Set();
for (const m of text.matchAll(/^#(\d+)\s+(\S+)\s*$/gm)) {
  const k = +m[1];
  if (byNum.get(k) !== m[2]) throw new Error(`#${k} is ${byNum.get(k)}, but the list says ${m[2]}. Was the storyboard built from an older story.json?`);
  removed.add(k);
}

let order = null;
const orderBlock = text.split(/New order[^\n]*\n/)[1];
if (orderBlock) {
  order = [];
  for (const line of orderBlock.split("\n")) {
    const m = line.match(/^(.+?):\s*([\d,\s]*)$/);
    if (!m) continue;
    const title = m[1].trim();
    if (!subs.has(title)) throw new Error(`Unknown chapter "${title}"`);
    order.push({ title, ids: m[2].split(",").map((x) => x.trim()).filter(Boolean).map(Number) });
  }
} else {
  // removals only: keep current structure
  order = [];
  let cur = null, k = 0;
  for (const s of story) {
    if (s.chapter) order.push((cur = { title: s.chapter, ids: [] }));
    else cur.ids.push(++k);
  }
  for (const c of order) c.ids = c.ids.filter((i) => !removed.has(i));
}

const placed = order.flatMap((c) => c.ids);
const dup = placed.filter((x, i) => placed.indexOf(x) !== i);
if (dup.length) throw new Error(`Placed twice: ${dup.join(", ")}`);
const bad = placed.filter((i) => !byNum.has(i) || removed.has(i));
if (bad.length) throw new Error(`Unknown or removed numbers in order: ${bad.join(", ")}`);
const missing = [...byNum.keys()].filter((i) => !removed.has(i) && !placed.includes(i));
if (missing.length) throw new Error(`Not placed and not removed: ${missing.join(", ")}`);

const out = order.flatMap((c) => [{ chapter: c.title, sub: subs.get(c.title) }, ...c.ids.map((i) => ({ photo: byNum.get(i) }))]);
fs.writeFileSync(STORY, JSON.stringify(out, null, 1) + "\n");
console.log(`Removed ${removed.size}; now ${placed.length} photos in ${order.length} chapters:`);
for (const c of order) console.log(`  ${c.title}: ${c.ids.length}`);
