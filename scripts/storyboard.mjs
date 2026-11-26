// Builds out/storyboard.html: a self-contained preview of the video's flow
// (in-browser player + numbered storyboard), from src/story.json and src/config.ts.
//   npm run storyboard

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
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

const byOriginal = new Map(photos.map((p) => [p.original, p]));
const segs = [{ kind: "title", big: "70", title: C.introTitle, sub: C.introSubtitle, dur: C.intro }];
let n = 0;
for (const s of story) {
  if (s.chapter) segs.push({ kind: "chapter", title: s.chapter, sub: s.sub ?? "", dur: C.chapter });
  else {
    const p = byOriginal.get(s.photo);
    if (!p) continue;
    const img = await sharp(path.join(ROOT, "public", p.src))
      .resize({ width: 640, height: 640, fit: "inside" })
      .jpeg({ quality: 64, mozjpeg: true })
      .toBuffer();
    segs.push({
      kind: "photo", n: ++n, dur: C.photo, w: p.width, h: p.height,
      caption: [p.year, p.caption].filter(Boolean).join(" · "),
      file: p.original.split("/").pop(),
      img: `data:image/jpeg;base64,${img.toString("base64")}`,
    });
  }
}
segs.push({ kind: "title", title: C.outroTitle, sub: C.outroSubtitle, dur: C.outro });
let t = 0;
for (const s of segs) { s.start = t; t += s.dur - C.fade; }
const total = t + C.fade;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dad 70 Storyboard</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--bg:#14110d;--panel:#1e1913;--line:#3a2f22;--text:#f3ece2;--muted:#a89a87;--gold:#f2c46d;--card:radial-gradient(circle at 50% 40%,#3a2c18 0%,#14110d 75%)}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--text);font-family:Montserrat,system-ui,sans-serif}
header{max-width:1200px;margin:0 auto;padding:40px 16px 8px}
h1{font-family:"Playfair Display",serif;font-weight:400;font-size:clamp(28px,5vw,44px);margin:0 0 6px}
h1 b{color:var(--gold);font-weight:700}
.stats{color:var(--muted);font-size:14px;display:flex;gap:18px;flex-wrap:wrap}
main{max-width:1200px;margin:0 auto;padding:16px}
/* player */
.player{position:relative;aspect-ratio:16/9;background:#000;border-radius:10px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.layer{position:absolute;inset:0;opacity:0;transition:opacity linear}
.layer.on{opacity:1}
.bgblur{position:absolute;inset:-40px;background-size:cover;background-position:center;filter:blur(30px) brightness(.45) saturate(1.2)}
.kb{position:absolute;inset:0;background-repeat:no-repeat;background-position:center}
.vig{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.45) 100%)}
.tcard{position:absolute;inset:0;background:var(--card);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:4%}
.tcard .big{font-family:"Playfair Display",serif;font-weight:700;color:var(--gold);font-size:min(19cqw,180px);line-height:1;text-shadow:0 6px 40px rgba(242,196,109,.35)}
.tcard .t{font-family:"Playfair Display",serif;font-size:min(5.2cqw,52px)}
.tcard.ch .t{font-style:italic;font-size:min(6cqw,60px)}
.tcard .s{font-weight:500;letter-spacing:.25em;text-transform:uppercase;color:var(--gold);font-size:min(2.4cqw,24px);margin-top:2.5%}
.player{container-type:inline-size}
.cap{position:absolute;left:4%;bottom:6%;font-family:"Playfair Display",serif;font-size:min(3cqw,30px);text-shadow:0 2px 12px #000}
.controls{display:flex;align-items:center;gap:12px;margin:12px 0 0}
button{background:var(--gold);color:#1b1408;border:0;border-radius:999px;padding:9px 18px;font:600 14px Montserrat,sans-serif;cursor:pointer}
button.ghost{background:transparent;color:var(--text);border:1px solid var(--line)}
input[type=range]{flex:1;accent-color:var(--gold);min-width:0}
.time{font-variant-numeric:tabular-nums;color:var(--muted);font-size:13px;white-space:nowrap}
.now{color:var(--muted);font-size:13px;margin-top:6px;min-height:1.2em}
/* storyboard */
h2{font-family:"Playfair Display",serif;font-weight:400;font-size:24px;margin:40px 0 4px}
.legend{color:var(--muted);font-size:13px;margin-bottom:16px}
.board{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.seg{background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden;cursor:pointer;transition:transform .15s,border-color .15s}
.seg:hover{transform:translateY(-2px);border-color:var(--gold)}
.seg.active{border-color:var(--gold);box-shadow:0 0 0 2px var(--gold)}
.thumb{aspect-ratio:16/9;background:#000 center/cover no-repeat;position:relative}
.thumb.contain{background-size:contain;background-color:#0b0907}
.num{position:absolute;top:6px;left:6px;background:rgba(0,0,0,.75);color:var(--gold);font-weight:600;font-size:12px;padding:2px 7px;border-radius:4px}
.meta{padding:6px 8px;font-size:11.5px;color:var(--muted);display:flex;justify-content:space-between;gap:6px}
.meta span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.seg.card{grid-column:1/-1;background:var(--card);border-color:#5a4526;display:flex;align-items:center;gap:16px;padding:18px 20px}
.seg.card .ct{font-family:"Playfair Display",serif;font-size:26px}
.seg.card.ch .ct{font-style:italic}
.seg.card .cs{color:var(--gold);letter-spacing:.2em;text-transform:uppercase;font-size:13px}
.seg.card .cbig{font-family:"Playfair Display",serif;font-weight:700;color:var(--gold);font-size:44px;line-height:1}
.seg.card .ctime{margin-left:auto;color:var(--muted);font-size:13px;white-space:nowrap}
footer{color:var(--muted);font-size:12px;text-align:center;padding:40px 16px}
</style></head><body>
<header>
<h1>Dad's <b>70</b>: video flow</h1>
<div class="stats"><span>${fmt(total)} long</span><span>${n} photos</span><span>${segs.filter((s) => s.kind === "chapter").length} chapters</span><span>${C.photo}s per photo · ${C.fade}s crossfades</span></div>
</header>
<main>
<div class="player" id="player"></div>
<div class="controls">
<button id="play">▶ Play</button><button class="ghost" id="prev">‹</button><button class="ghost" id="next">›</button>
<input type="range" id="seek" min="0" max="${total}" step="0.1" value="0"><span class="time" id="time">0:00 / ${fmt(total)}</span>
</div>
<div class="now" id="now"></div>
<h2>Storyboard</h2>
<div class="legend">Click any segment to jump the player there. Numbers match the photo numbers to use when asking for changes.</div>
<div class="board" id="board"></div>
</main>
<footer>Preview approximation. The rendered MP4 is the final word on timing and motion.</footer>
<script>
const SEGS=${JSON.stringify(segs)};const TOTAL=${total};const FADE=${C.fade};
const fmt=s=>{s=Math.max(0,Math.floor(s));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")};
const MOVES=[[1,-1,0,1.12,1,-1],[1.12,1,1,1,-1,0],[1.02,0,1,1.14,0,-1],[1.14,-1,-1,1.02,1,1]];
const player=document.getElementById("player"),board=document.getElementById("board");
// build layers
SEGS.forEach((s,i)=>{const L=document.createElement("div");L.className="layer";
 if(s.kind==="photo"){const fill=s.w/s.h>16/9*0.85;
  L.innerHTML=(fill?"":'<div class="bgblur" style="background-image:url('+s.img+')"></div>')+'<div class="kb" style="background-image:url('+s.img+');background-size:'+(fill?"cover":"contain")+'"></div><div class="vig"></div>'+(s.caption?'<div class="cap">'+s.caption+'</div>':"");}
 else L.innerHTML='<div class="tcard '+(s.kind==="chapter"?"ch":"")+'">'+(s.big?'<div class="big">'+s.big+'</div>':"")+'<div class="t">'+s.title+'</div><div class="s">'+s.sub+'</div></div>';
 s.el=L;player.appendChild(L);
 // board tile
 const B=document.createElement("div");
 if(s.kind==="photo"){B.className="seg";const fill=s.w/s.h>16/9*0.85;
  B.innerHTML='<div class="thumb '+(fill?"":"contain")+'" style="background-image:url('+s.img+')"><span class="num">#'+s.n+'</span></div><div class="meta"><span>'+fmt(s.start)+'</span><span>'+(s.caption||(s.w>s.h?"landscape":"portrait"))+'</span></div>';}
 else{B.className="seg card "+(s.kind==="chapter"?"ch":"");B.innerHTML=(s.big?'<div class="cbig">'+s.big+'</div>':"")+'<div><div class="ct">'+s.title+'</div><div class="cs">'+s.sub+'</div></div><div class="ctime">'+fmt(s.start)+' · '+s.dur+'s</div>';}
 B.onclick=()=>{seek(s.start+0.01);player.scrollIntoView({behavior:"smooth",block:"center"})};s.tile=B;board.appendChild(B);});
let t=0,playing=false,last=0,active=-1;
function render(){SEGS.forEach((s,i)=>{const lt=t-s.start;const vis=lt>=0&&lt<s.dur;
  if(!vis){s.el.style.opacity=0;return}
  const fin=i===0?1:Math.min(1,lt/FADE);s.el.style.opacity=fin;s.el.style.zIndex=i;
  if(s.kind==="photo"){const m=MOVES[i%4],p=lt/s.dur,e=p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
   const sc=m[0]+(m[3]-m[0])*e,x=(m[1]+(m[4]-m[1])*e)*1.5,y=(m[2]+(m[5]-m[2])*e)*1.5;
   s.el.querySelector(".kb").style.transform="scale("+sc+") translate("+x+"%,"+y+"%)";}
  else{const tc=s.el.querySelector(".tcard");tc.style.opacity=Math.min(1,(s.dur-lt)/0.66);}});
 let cur=-1;SEGS.forEach((s,i)=>{if(t>=s.start)cur=i});
 if(cur!==active){if(active>=0)SEGS[active].tile.classList.remove("active");active=cur;const s=SEGS[cur];s.tile.classList.add("active");
  document.getElementById("now").textContent=s.kind==="photo"?"Photo #"+s.n+" · "+s.file:(s.kind==="chapter"?"Chapter: ":"")+s.title;}
 document.getElementById("seek").value=t;document.getElementById("time").textContent=fmt(t)+" / "+fmt(TOTAL);}
function loop(ts){if(!playing)return;t+=(ts-last)/1000;last=ts;if(t>=TOTAL){t=TOTAL;toggle(false)}render();requestAnimationFrame(loop)}
function toggle(on){playing=on??!playing;document.getElementById("play").textContent=playing?"❚❚ Pause":"▶ Play";if(playing){if(t>=TOTAL)t=0;last=performance.now();requestAnimationFrame(loop)}}
function seek(v){t=Math.max(0,Math.min(TOTAL,v));render()}
document.getElementById("play").onclick=()=>toggle();
document.getElementById("seek").oninput=e=>seek(+e.target.value);
document.getElementById("prev").onclick=()=>{const c=SEGS.filter(s=>s.start<t-0.5).pop();seek(c?c.start+0.01:0)};
document.getElementById("next").onclick=()=>{const c=SEGS.find(s=>s.start>t+0.01);if(c)seek(c.start+0.01)};
document.addEventListener("keydown",e=>{if(e.code==="Space"){e.preventDefault();toggle()}if(e.code==="ArrowRight")document.getElementById("next").click();if(e.code==="ArrowLeft")document.getElementById("prev").click()});
render();
</script></body></html>`;

function fmt(s) {
  s = Math.floor(s);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
await fs.mkdir(path.join(ROOT, "out"), { recursive: true });
await fs.writeFile(path.join(ROOT, "out/storyboard.html"), html);
console.log(`Wrote out/storyboard.html (${(html.length / 1e6).toFixed(1)} MB, ${n} photos, ${fmt(total)})`);
