// Builds the storyboard: an in-browser preview of the video's flow (player + editable,
// numbered storyboard) from src/story.json and src/config.ts.
//   npm run storyboard              -> out/storyboard.html (one self-contained file)
//   npm run storyboard -- --artifact -> out/artifact/ (index.html + img/ + segs.json) for claude.ai
// Edits (remove / reorder) are saved in the artifact's db (doc storyboard/edits) when
// published as an artifact, so Claude can read them; otherwise in the browser.

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ARTIFACT = process.argv.includes("--artifact");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "out", ARTIFACT ? "artifact" : "");
const photos = JSON.parse(await fs.readFile(path.join(ROOT, "src/photos.json"), "utf8"));
const story = JSON.parse(await fs.readFile(path.join(ROOT, "src/story.json"), "utf8"));
const cfgSrc = await fs.readFile(path.join(ROOT, "src/config.ts"), "utf8");
const cfg = (k) => {
  const m = cfgSrc.match(new RegExp(`\\b${k}:\\s*("([^"]*)"|[\\d.]+)`));
  return m ? (m[2] ?? Number(m[1])) : undefined;
};
const C = {
  introTitle: cfg("introTitle"), introSubtitle: cfg("introSubtitle"),
  outroTitle: cfg("outroTitle"), outroSubtitle: cfg("outroSubtitle"),
  intro: cfg("introSeconds"), outro: cfg("outroSeconds"), chapter: cfg("chapterSeconds"),
  photo: cfg("secondsPerPhoto"), fade: cfg("transitionSeconds"),
};

if (ARTIFACT) {
  await fs.rm(path.join(OUT, "img"), { recursive: true, force: true });
  await fs.mkdir(path.join(OUT, "img"), { recursive: true });
}
const byOriginal = new Map(photos.map((p) => [p.original, p]));
const segs = [{ kind: "title", big: "70", title: C.introTitle, sub: C.introSubtitle, dur: C.intro, key: "intro" }];
let n = 0;
for (const s of story) {
  if (s.chapter) {
    segs.push({ kind: "chapter", title: s.chapter, sub: s.sub ?? "", dur: C.chapter, key: "ch:" + s.chapter });
    continue;
  }
  const p = byOriginal.get(s.photo);
  if (!p) continue;
  const img = sharp(path.join(ROOT, "public", p.src)).resize({ width: 640, height: 640, fit: "inside" }).jpeg({ quality: 64, mozjpeg: true });
  let src;
  if (ARTIFACT) {
    const name = "img/" + p.original.replace(/^.*\//, "").replace(/\.[^.]+$/, "") + ".jpg";
    await img.toFile(path.join(OUT, name));
    src = name;
  } else src = `data:image/jpeg;base64,${(await img.toBuffer()).toString("base64")}`;
  segs.push({
    kind: "photo", n: ++n, dur: C.photo, w: p.width, h: p.height,
    caption: [p.year, p.caption].filter(Boolean).join(" · "),
    file: p.original.split("/").pop(), orig: p.original, key: p.original, isNew: !!s.new, img: src,
  });
}
segs.push({ kind: "title", title: C.outroTitle, sub: C.outroSubtitle, dur: C.outro, key: "outro" });
let t0 = 0;
for (const s of segs) t0 += s.dur - C.fade;
const total = t0 + C.fade;
const nChapters = segs.filter((s) => s.kind === "chapter").length;

function fmt(s) {
  s = Math.floor(s);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const head = `<title>Dad's 70 Storyboard</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
/* Single dark look on purpose: it mirrors the video's own palette (warm black, gold, cream). */
:root{color-scheme:dark;
 --bg:#14110d;--panel:#1e1913;--panel-2:#0b0907;--line:#3a2f22;--line-strong:#5a4526;
 --text:#f3ece2;--muted:#a89a87;--gold:#f2c46d;--on-gold:#1b1408;--new:#3fa66b;--danger:#c0392b;--shade:rgba(0,0,0,.75);
 --card:radial-gradient(circle at 50% 40%,#3a2c18 0%,#14110d 75%);
 --display:"Playfair Display",Georgia,"Times New Roman",serif;--body:Montserrat,system-ui,-apple-system,"Segoe UI",sans-serif}
*{box-sizing:border-box}[hidden]{display:none!important}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--body)}
.wrap{max-width:1200px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
header.wrap{padding-block:36px 8px}
h1{font-family:var(--display);font-weight:400;font-size:clamp(28px,5vw,44px);margin:0 0 6px;text-wrap:balance}
h1 b{color:var(--gold);font-weight:700}
.stats{color:var(--muted);font-size:14px;display:flex;gap:6px 18px;flex-wrap:wrap;align-items:center}
.sync{font-size:12px;padding:3px 10px;border-radius:999px;border:1px solid var(--line);color:var(--muted)}
.sync.ok{border-color:var(--new);color:var(--text)}
main.wrap{padding-block:16px}
.player{position:relative;aspect-ratio:16/9;max-width:100%;background:#000;border-radius:10px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.5);container-type:inline-size}
.layer{position:absolute;inset:0;opacity:0}
.bgblur{position:absolute;inset:-40px;background-size:cover;background-position:center;filter:blur(30px) brightness(.45) saturate(1.2)}
.kb{position:absolute;inset:0;background-repeat:no-repeat;background-position:center}
.vig{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.45) 100%)}
.tcard{position:absolute;inset:0;background:var(--card);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:4%}
.tcard .big{font-family:var(--display);font-weight:700;color:var(--gold);font-size:min(19cqw,180px);line-height:1;text-shadow:0 6px 40px rgba(242,196,109,.35)}
.tcard .t{font-family:var(--display);font-size:min(5.2cqw,52px)}
.tcard.ch .t{font-style:italic;font-size:min(6cqw,60px)}
.tcard .s{font-weight:500;letter-spacing:.25em;text-transform:uppercase;color:var(--gold);font-size:min(2.4cqw,24px);margin-top:2.5%}
.cap{position:absolute;left:4%;bottom:6%;font-family:var(--display);font-size:min(3cqw,30px);text-shadow:0 2px 12px #000}
.controls{display:flex;align-items:center;gap:10px;margin-top:12px;flex-wrap:wrap}
button{background:var(--gold);color:var(--on-gold);border:0;border-radius:999px;padding:9px 18px;font:600 14px var(--body);cursor:pointer}
button.ghost{background:transparent;color:var(--text);border:1px solid var(--line)}
button.warn{background:var(--danger);color:#fff}
button:focus-visible,.seg:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
input[type=range]{flex:1 1 160px;accent-color:var(--gold);min-width:0}
.time{font-variant-numeric:tabular-nums;color:var(--muted);font-size:13px;white-space:nowrap}
.now{color:var(--muted);font-size:13px;margin-top:6px;min-height:1.2em;overflow-wrap:anywhere}
h2{font-family:var(--display);font-weight:400;font-size:24px;margin:40px 0 4px}
.legend{color:var(--muted);font-size:13px;margin-bottom:16px;max-width:75ch;line-height:1.5}
.legend b{color:var(--text);font-weight:600}
.board{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
@media (max-width:480px){.board{grid-template-columns:repeat(2,minmax(0,1fr))}}
.seg{background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden;cursor:pointer;transition:border-color .15s;min-width:0}
.seg:hover{border-color:var(--gold)}
.seg:not(.fixed){cursor:grab}
.ghost-drop{opacity:.3;outline:2px dashed var(--gold)}
.chosen{box-shadow:0 10px 30px rgba(0,0,0,.6)}
.seg.active{border-color:var(--gold);box-shadow:0 0 0 2px var(--gold)}
.thumb{aspect-ratio:16/9;max-width:100%;background:#000 center/cover no-repeat;position:relative}
.thumb.contain{background-size:contain;background-color:var(--panel-2)}
.num{position:absolute;top:6px;left:6px;background:var(--shade);color:var(--gold);font-weight:600;font-size:12px;padding:2px 7px;border-radius:4px;font-variant-numeric:tabular-nums}
.seg.moved .num{background:var(--gold);color:var(--on-gold)}
.newb{position:absolute;bottom:6px;left:6px;background:var(--new);color:#fff;font-weight:700;font-size:10px;letter-spacing:.08em;padding:2px 6px;border-radius:4px}
.meta{padding:6px 8px;font-size:11.5px;color:var(--muted);display:flex;justify-content:space-between;gap:6px;font-variant-numeric:tabular-nums}
.meta span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.seg.card{grid-column:1/-1;background:var(--card);border-color:var(--line-strong);display:flex;align-items:center;gap:16px;padding:18px 20px}
.seg.card .ct{font-family:var(--display);font-size:26px}
.seg.card.ch .ct{font-style:italic}
.seg.card .cs{color:var(--gold);letter-spacing:.2em;text-transform:uppercase;font-size:13px}
.seg.card .cbig{font-family:var(--display);font-weight:700;color:var(--gold);font-size:44px;line-height:1}
.seg.card .ctime{margin-left:auto;color:var(--muted);font-size:13px;white-space:nowrap;font-variant-numeric:tabular-nums}
.x{position:absolute;top:6px;right:6px;width:30px;height:30px;border-radius:50%;border:0;padding:0;background:var(--shade);color:#fff;font-size:15px;line-height:30px;cursor:pointer}
.x:hover{background:var(--danger)}
.seg.removed{opacity:.4;border-style:dashed}
.seg.removed .thumb{filter:grayscale(1)}
.seg.removed .x{background:var(--gold);color:var(--on-gold);width:auto;padding:0 10px;border-radius:999px;font:600 12px/30px var(--body)}
.seg.removed .meta span:first-child{text-decoration:line-through}
.edits{position:sticky;bottom:0;z-index:50;background:rgba(20,17,13,.95);backdrop-filter:blur(8px);border-top:1px solid var(--line);padding-block:12px calc(12px + env(safe-area-inset-bottom,0px))}
.edits .in{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.edits .msg{flex:1 1 200px;font-size:14px;min-width:0}
.edits .msg b{color:var(--gold)}
.toast{position:fixed;left:50%;bottom:calc(84px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:var(--gold);color:var(--on-gold);padding:8px 16px;border-radius:999px;font-weight:600;font-size:13px;opacity:0;transition:opacity .2s;pointer-events:none;z-index:60}
.toast.on{opacity:1}
footer{color:var(--muted);font-size:12px;text-align:center;padding-block:40px}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>`;

const bodyHtml = `<header class="wrap">
<h1>Dad's <b>70</b>: the video, scene by scene</h1>
<div class="stats"><span id="stLen">${fmt(total)} long</span><span id="stN">${n} photos</span><span>${nChapters} chapters</span><span>${C.photo}s per photo · ${C.fade}s crossfades</span><span class="sync" id="sync">Loading edits…</span></div>
</header>
<main class="wrap">
<div class="player" id="player" aria-label="Video preview"></div>
<div class="controls">
<button id="play">▶ Play</button><button class="ghost" id="prev" aria-label="Previous scene">‹</button><button class="ghost" id="next" aria-label="Next scene">›</button>
<input type="range" id="seek" min="0" max="${total}" step="0.1" value="0" aria-label="Position"><span class="time" id="time"></span>
</div>
<div class="now" id="now"></div>
<h2>Storyboard</h2>
<p class="legend"><b>Drag</b> photos or chapter cards to reorder. <b>✕</b> takes a photo out (Restore puts it back). <b>Click</b> a tile to preview it. Photos keep their number; moved ones turn gold, and <span style="color:var(--new);font-weight:700">NEW</span> marks photos added from the latest album download.</p>
<div class="board" id="board"></div>
</main>
<div class="edits" id="edits" hidden><div class="wrap in"><div class="msg" id="emsg"></div>
<button class="ghost" id="reset">Undo all edits</button><button id="copy">Copy changes</button></div></div>
<div class="toast" id="toast" role="status"></div>
<footer class="wrap">A preview of the flow. The rendered video is the final word on timing and motion.</footer>`;

// Page logic. Plain string (no template interpolation inside); data arrives via DATA.
const appJs = String.raw`
const FADE=DATA.fade;let SEGS=DATA.segs;const ORIG=SEGS.slice();
const fmt=s=>{s=Math.max(0,Math.floor(s));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")};
const esc=v=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const MOVES=[[1,-1,0,1.12,1,-1],[1.12,1,1,1,-1,0],[1.02,0,1,1.14,0,-1],[1.14,-1,-1,1.02,1,1]];
const $=id=>document.getElementById(id);
const player=$("player"),board=$("board");
let removed=new Set(),moved=new Set(),LIVE=[],TOTAL=0,t=0,playing=false,last=0,active=-1;

// ---- build player layers and tiles ----
SEGS.forEach(s=>{const L=document.createElement("div");L.className="layer";
 const fill=s.kind==="photo"&&s.w/s.h>16/9*0.85,u="url('"+s.img+"')";
 if(s.kind==="photo")L.innerHTML=(fill?"":'<div class="bgblur" style="background-image:'+u+'"></div>')+'<div class="kb" style="background-image:'+u+';background-size:'+(fill?"cover":"contain")+'"></div><div class="vig"></div>'+(s.caption?'<div class="cap">'+esc(s.caption)+'</div>':"");
 else L.innerHTML='<div class="tcard '+(s.kind==="chapter"?"ch":"")+'">'+(s.big?'<div class="big">'+esc(s.big)+'</div>':"")+'<div class="t">'+esc(s.title)+'</div><div class="s">'+esc(s.sub)+'</div></div>';
 s.el=L;player.appendChild(L);
 const B=document.createElement("div");B.tabIndex=0;
 if(s.kind==="photo"){B.className="seg";
  B.innerHTML='<div class="thumb '+(fill?"":"contain")+'" style="background-image:'+u+'"><span class="num">#'+s.n+'</span>'+(s.isNew?'<span class="newb">NEW</span>':'')+'<button class="x" aria-label="Remove photo '+s.n+'">✕</button></div><div class="meta"><span class="st"></span><span>'+esc(s.caption||(s.w>s.h?"landscape":"portrait"))+'</span></div>';
  B.querySelector(".x").onclick=e=>{e.stopPropagation();toggleRemove(s)};}
 else{B.className="seg card "+(s.kind==="chapter"?"ch":"fixed");B.innerHTML=(s.big?'<div class="cbig">'+esc(s.big)+'</div>':"")+'<div><div class="ct">'+esc(s.title)+'</div><div class="cs">'+esc(s.sub)+'</div></div><div class="ctime"><span class="st"></span> · '+s.dur+'s</div>';}
 B.onclick=()=>{if(s.removed)return;show(s);player.scrollIntoView({behavior:"smooth",block:"center"})};
 B.onkeydown=e=>{if(e.key==="Enter"&&e.target===B)B.click()};
 B.dataset.key=s.key;s.tile=B;board.appendChild(B);});
const byKey=new Map(SEGS.map(s=>[s.key,s]));
const orderChanged=()=>SEGS.some((s,i)=>s!==ORIG[i]);

// ---- edit state: {removed:[paths], order:[keys]|null, moved:[keys]} ----
const LS="dad70-edits-v2";
const snapshot=()=>({removed:[...removed].sort(),order:orderChanged()?SEGS.map(s=>s.key):null,moved:[...moved].sort()});
function applyState(st){st=st||{};
 removed=new Set((st.removed||[]).filter(k=>byKey.has(k)));moved=new Set((st.moved||[]).filter(k=>byKey.has(k)));
 const o=st.order;SEGS=(Array.isArray(o)&&o.length===ORIG.length&&o.every(k=>byKey.has(k)))?o.map(k=>byKey.get(k)):ORIG.slice();
 SEGS.forEach(s=>board.appendChild(s.tile));layout();active=-1;render();}
try{applyState(JSON.parse(localStorage.getItem(LS)))}catch(e){}
let dbDoc=null,writing=false,again=false,timer=0;
function setSync(kind){const el=$("sync");
 el.textContent=kind==="ok"?"✓ Edits saved · Claude can see them":kind==="local"?"Edits saved in this browser":kind==="error"?"Couldn't save to the shared store · saved in this browser":"Loading edits…";
 el.classList.toggle("ok",kind==="ok");}
async function flush(){try{localStorage.setItem(LS,JSON.stringify(snapshot()))}catch(e){}
 if(!dbDoc)return;if(writing){again=true;return}writing=true;
 try{await dbDoc.set(Object.assign(snapshot(),{updatedAt:new Date().toISOString()}));setSync("ok")}catch(e){setSync("error")}
 writing=false;if(again){again=false;flush()}}
function persist(){clearTimeout(timer);timer=setTimeout(flush,500)}
(async()=>{const db=window.claude&&window.claude.use?await window.claude.use("db").catch(()=>null):null;
 if(!db){setSync("local");return}
 let doc;try{doc=db.doc("storyboard/edits")}catch(e){setSync("local");return}
 const slow=setTimeout(()=>setSync("error"),10000);
 doc.onSnapshot(snap=>{if(snap.metadata.hasPendingWrites)return;
  if(!snap.metadata.fromCache)clearTimeout(slow);
  dbDoc=doc;
  if(snap.exists){const d=snap.data(),mine=snapshot();
   if(JSON.stringify({removed:d.removed||[],order:d.order||null,moved:d.moved||[]})!==JSON.stringify(mine))applyState(d);
   setSync("ok");}
  else if(!snap.metadata.fromCache){const mine=snapshot();if(mine.removed.length||mine.order)flush();else setSync("ok")}
 },()=>{clearTimeout(slow);dbDoc=null;setSync("error")});})();

// ---- drag to reorder ----
if(window.Sortable)new Sortable(board,{animation:150,filter:".fixed,.x",preventOnFilter:false,draggable:".seg:not(.fixed)",
 ghostClass:"ghost-drop",chosenClass:"chosen",delay:150,delayOnTouchOnly:true,scroll:true,bubbleScroll:true,
 onMove:e=>!(e.related.dataset.key==="intro"&&!e.willInsertAfter)&&!(e.related.dataset.key==="outro"&&e.willInsertAfter),
 onEnd:e=>{if(e.oldIndex===e.newIndex)return;moved.add(e.item.dataset.key);
  SEGS=[...board.children].map(el=>byKey.get(el.dataset.key));layout();active=-1;render();persist();}});

function layout(){let acc=0;LIVE=[];
 SEGS.forEach(s=>{s.removed=s.kind==="photo"&&removed.has(s.key);s.tile.classList.toggle("removed",s.removed);
  s.tile.classList.toggle("moved",moved.has(s.key));
  const x=s.tile.querySelector(".x");if(x){x.textContent=s.removed?"Restore":"✕";x.setAttribute("aria-label",(s.removed?"Restore photo ":"Remove photo ")+s.n)}
  if(s.removed){s.el.style.opacity=0;s.tile.querySelector(".st").textContent="removed";return}
  s.start=acc;acc+=s.dur-FADE;LIVE.push(s);s.tile.querySelector(".st").textContent=fmt(s.start);});
 TOTAL=acc+FADE;$("seek").max=TOTAL;if(t>TOTAL)t=TOTAL;
 const n=LIVE.filter(s=>s.kind==="photo").length;$("stN").textContent=n+" photos";$("stLen").textContent=fmt(TOTAL)+" long";
 const r=SEGS.filter(s=>s.removed).length,oc=orderChanged();$("edits").hidden=!(r||oc);
 $("emsg").innerHTML=(r?"<b>"+r+"</b> removed · ":"")+(oc?"<b>order changed</b> · ":"")+"now <b>"+n+"</b> photos, <b>"+fmt(TOTAL)+"</b>";}
function toggleRemove(s){removed.has(s.key)?removed.delete(s.key):removed.add(s.key);layout();active=-1;render();persist();}

// ---- player ----
function render(){LIVE.forEach((s,i)=>{const lt=t-s.start;
  if(lt<0||lt>=s.dur){s.el.style.opacity=0;return}
  s.el.style.opacity=i===0?1:Math.min(1,lt/FADE);s.el.style.zIndex=i;
  if(s.kind==="photo"){const m=MOVES[i%4],p=lt/s.dur,e=p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
   const sc=m[0]+(m[3]-m[0])*e,x=(m[1]+(m[4]-m[1])*e)*1.5,y=(m[2]+(m[5]-m[2])*e)*1.5;
   s.el.querySelector(".kb").style.transform="scale("+sc+") translate("+x+"%,"+y+"%)";}
  else s.el.querySelector(".tcard").style.opacity=Math.min(1,(s.dur-lt)/0.66);});
 const cur=curIdx();
 if(cur!==active&&LIVE[cur]){SEGS.forEach(s=>s.tile.classList.remove("active"));active=cur;const s=LIVE[cur];s.tile.classList.add("active");
  $("now").textContent=s.kind==="photo"?"Photo #"+s.n+" · "+s.file:(s.kind==="chapter"?"Chapter: ":"")+s.title;}
 $("seek").value=t;$("time").textContent=fmt(t)+" / "+fmt(TOTAL);}
function curIdx(){let c=0;LIVE.forEach((s,i)=>{if(t>=s.start)c=i});return c}
function loop(ts){if(!playing)return;t+=(ts-last)/1000;last=ts;if(t>=TOTAL){t=TOTAL;toggle(false)}render();requestAnimationFrame(loop)}
function toggle(on){playing=on??!playing;$("play").textContent=playing?"❚❚ Pause":"▶ Play";if(playing){if(t>=TOTAL)t=0;last=performance.now();requestAnimationFrame(loop)}}
function seek(v){t=Math.max(0,Math.min(TOTAL,v));render()}
// land just after the crossfade so the chosen scene is fully visible, not the one fading out
function show(s){const i=LIVE.indexOf(s);seek(i<=0?0:s.start+FADE+0.05)}
function toast(m){const e=$("toast");e.textContent=m;e.classList.add("on");setTimeout(()=>e.classList.remove("on"),2000)}
$("play").onclick=()=>toggle();
$("seek").oninput=e=>seek(+e.target.value);
$("prev").onclick=()=>show(LIVE[Math.max(0,curIdx()-1)]);
$("next").onclick=()=>show(LIVE[Math.min(LIVE.length-1,curIdx()+1)]);
let armed=0;
$("reset").onclick=()=>{const b=$("reset");
 if(!armed){b.textContent="Tap again to undo all";b.classList.add("warn");armed=setTimeout(()=>{armed=0;b.textContent="Undo all edits";b.classList.remove("warn")},3000);return}
 clearTimeout(armed);armed=0;b.textContent="Undo all edits";b.classList.remove("warn");
 removed.clear();moved.clear();applyState(null);persist();toast("All edits undone");};
function listText(){const r=SEGS.filter(s=>s.removed),L=[];
 if(r.length)L.push("Remove these "+r.length+" photos:\n"+r.map(s=>"#"+s.n+" "+s.orig).join("\n"));
 if(orderChanged()){const lines=[];let cur=null;
  SEGS.forEach(s=>{if(s.kind==="chapter"){cur={t:s.title,n:[]};lines.push(cur)}else if(s.kind==="photo"&&!s.removed){if(!cur){cur={t:"(before first chapter)",n:[]};lines.push(cur)}cur.n.push(s.n)}});
  L.push("New order (photo numbers per chapter):\n"+lines.map(c=>c.t+": "+c.n.join(", ")).join("\n"));}
 return L.join("\n\n")||"No changes";}
$("copy").onclick=()=>{const txt=listText();
 navigator.clipboard.writeText(txt).then(()=>toast("Copied. Paste it to Claude"),()=>{const ta=document.createElement("textarea");ta.value=txt;document.body.appendChild(ta);ta.select();try{document.execCommand("copy");toast("Copied. Paste it to Claude")}catch(e){toast("Select and copy the text")}ta.remove()});};
document.addEventListener("keydown",e=>{if(/INPUT|TEXTAREA/.test(e.target.tagName))return;if(e.code==="Space"&&e.target===document.body){e.preventDefault();toggle()}if(e.code==="ArrowRight")$("next").click();if(e.code==="ArrowLeft")$("prev").click()});
layout();render();
`;

const data = { fade: C.fade, segs };
await fs.mkdir(OUT, { recursive: true });
if (ARTIFACT) {
  await fs.writeFile(path.join(OUT, "segs.json"), JSON.stringify(data));
  const page = `${head}
${bodyHtml}
<script src="https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.2/Sortable.min.js"></script>
<script>
fetch("segs.json").then(r=>r.json()).then(DATA=>{${appJs}}).catch(()=>{document.getElementById("now").textContent="Couldn't load the storyboard data. Reload the page to try again."});
</script>`;
  await fs.writeFile(path.join(OUT, "index.html"), page);
  const imgs = (await fs.readdir(path.join(OUT, "img"))).length;
  console.log(`Wrote out/artifact/ (index.html, segs.json, ${imgs} images; ${n} photos, ${fmt(total)})`);
} else {
  const sortableJs = await fs.readFile(path.join(ROOT, "node_modules/sortablejs/Sortable.min.js"), "utf8");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${head}</head><body>
${bodyHtml}
<script>${sortableJs}</script>
<script>const DATA=${JSON.stringify(data).replace(/</g, "\\u003c")};
${appJs}</script></body></html>`;
  await fs.writeFile(path.join(OUT, "storyboard.html"), html);
  console.log(`Wrote out/storyboard.html (${(html.length / 1e6).toFixed(1)} MB, ${n} photos, ${fmt(total)})`);
}
