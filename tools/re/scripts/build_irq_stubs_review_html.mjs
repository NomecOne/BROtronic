import fs from "node:fs";

const data = JSON.parse(fs.readFileSync(new URL("../out/irq_stubs_review.json", import.meta.url), "utf8"));
const json = JSON.stringify(data);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>IRQ stubs review — RedLabel MCS-96</title>
<style>
:root {
  --bg: #141414;
  --panel: #1c1c1c;
  --text: #e8e8e8;
  --muted: #9a9a9a;
  --border: #333;
  --accent: #6cb6ff;
  --warn: #d4a017;
  --ok: #3d9a6a;
  --stub: #2a4a6a;
  --landing: #4a3a1a;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --sans: "Segoe UI", system-ui, sans-serif;
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 24px; font-family: var(--sans);
  background: var(--bg); color: var(--text); line-height: 1.45;
}
h1 { font-size: 22px; font-weight: 600; margin: 0 0 8px; }
h2 { font-size: 16px; font-weight: 600; margin: 28px 0 10px; }
p, li { color: var(--muted); font-size: 14px; }
code { font-family: var(--mono); font-size: 12px; color: var(--text); }
.banner {
  border: 1px solid var(--border); background: var(--panel);
  padding: 12px 14px; margin: 16px 0 20px; border-left: 3px solid var(--warn);
}
.stats { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.stat {
  border: 1px solid var(--border); background: var(--panel);
  padding: 10px 14px; min-width: 110px;
}
.stat b { display: block; font-size: 20px; color: var(--text); }
.stat span { font-size: 12px; color: var(--muted); }
.toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0 18px; }
button {
  background: var(--panel); color: var(--text); border: 1px solid var(--border);
  padding: 6px 10px; cursor: pointer; font-size: 13px;
}
button.active { border-color: var(--accent); color: var(--accent); }
table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 8px; }
th, td { border-bottom: 1px solid var(--border); padding: 8px 10px; text-align: left; vertical-align: top; }
th { color: var(--muted); font-weight: 500; }
tr:hover td { background: #222; cursor: pointer; }
.tag {
  display: inline-block; font-size: 11px; padding: 2px 6px;
  border: 1px solid var(--border); color: var(--muted);
}
.tag.data { color: var(--warn); border-color: #6a5410; }
.tag.code { color: var(--ok); border-color: #2a5a40; }
.site {
  border: 1px solid var(--border); background: var(--panel);
  padding: 14px 16px; margin: 14px 0; scroll-margin-top: 16px;
}
.site h3 { margin: 0 0 8px; font-size: 15px; }
.meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; margin: 10px 0; }
.meta div { font-size: 12px; color: var(--muted); }
.hex {
  font-family: var(--mono); font-size: 12px; display: flex; flex-wrap: wrap; gap: 4px;
  padding: 10px; background: #111; border: 1px solid var(--border); margin: 6px 0 12px;
}
.hex .b { padding: 2px 4px; color: var(--muted); }
.hex .b.focus { background: var(--stub); color: #fff; }
.hex .b.land { background: var(--landing); color: #fff; }
.explain { font-size: 13px; color: var(--text); margin: 8px 0; }
.decide { font-size: 13px; color: var(--warn); margin-top: 8px; }
.caption { font-size: 11px; color: var(--muted); margin-bottom: 4px; }
footer { margin-top: 32px; font-size: 12px; color: var(--muted); border-top: 1px solid var(--border); padding-top: 12px; }
</style>
</head>
<body>
  <h1>IRQ stubs review — RedLabel / MCS-96</h1>
  <p>Offline RE only. Blocker 1 (LJMP/LCALL PC-rel) is closed. Open issue: stub landings in high <code>0xAxxx</code> still labeled DATA by the coarse region map.</p>
  <div class="banner" id="banner"></div>
  <div class="stats" id="stats"></div>
  <div class="toolbar">
    <button type="button" class="active" data-filter="all">All sites</button>
    <button type="button" data-filter="axxx">0xAxxx DATA only</button>
    <button type="button" data-filter="code">CODE landing</button>
  </div>
  <h2>Index</h2>
  <table>
    <thead>
      <tr><th>Vec</th><th>Stub</th><th>Prologue</th><th>Ghidra LJMP</th><th>Landing</th><th>Region conflict</th></tr>
    </thead>
    <tbody id="index"></tbody>
  </table>
  <h2>Sites (hex + explanation)</h2>
  <div id="sites"></div>
  <footer id="footer"></footer>
<script>
const DATA = ${json};
function u16(n){ return "0x"+n.toString(16).toUpperCase().padStart(4,"0"); }
function hexBytes(hex){
  const out=[]; for(let i=0;i<hex.length;i+=2) out.push(hex.slice(i,i+2).toUpperCase()); return out;
}
function renderHex(hex, focusOffset, focusLen, cls){
  return hexBytes(hex).map((b,i)=>{
    const on = i>=focusOffset && i<(focusOffset+focusLen);
    return '<span class="b '+(on?cls:"")+'">'+b+"</span>";
  }).join("");
}
function decision(site){
  if(site.landing.inHighAxxx){
    return "Decide: keep DATA_CAL, carve a CODE island at the landing, or mark UNKNOWN-pending. Do not promote into shipping packs.";
  }
  return "Landing already in CODE — useful control case; Axxx sites are the blocker.";
}
document.getElementById("banner").innerHTML =
  "<strong>Review gate</strong> — "+DATA.shippingNote+" "+DATA.addressingNote;
document.getElementById("stats").innerHTML = [
  ["siteCount","IRQ stub sites"],
  ["axxxLandingCount","Land in 0xAxxx DATA"],
  ["dataLandingCount","DATA landings"],
].map(([k,l])=>'<div class="stat"><b>'+DATA[k]+"</b><span>"+l+"</span></div>").join("")
  + '<div class="stat"><b>'+DATA.ghidraLanguage+"</b><span>Ghidra language</span></div>";

const index=document.getElementById("index");
const sitesEl=document.getElementById("sites");
let filter="all";

function matches(site){
  if(filter==="all") return true;
  if(filter==="axxx") return site.landing.inHighAxxx;
  if(filter==="code") return site.landing.region_label==="CODE";
  return true;
}

function render(){
  index.innerHTML="";
  sitesEl.innerHTML="";
  DATA.sites.filter(matches).forEach(site=>{
    const conflict = site.landing.region_label==="DATA"
      ? '<span class="tag data">Ghidra CODE path → region DATA</span>'
      : '<span class="tag code">aligned CODE</span>';
    const tr=document.createElement("tr");
    tr.innerHTML =
      "<td>v"+site.vectorIndex+"</td><td><code>"+site.stubAddrHex+
      "</code></td><td>"+site.stubPrologue+"</td><td><code>"+site.ghidra_insn+
      "</code></td><td><code>"+site.landing.addrHex+"</code></td><td>"+conflict+"</td>";
    tr.onclick=()=>{ document.getElementById(site.id).scrollIntoView({behavior:"smooth"}); };
    index.appendChild(tr);

    const stubLen = site.stubBytes.hex.length/2;
    const nearby = (site.landing.ghidra_insns_nearby||[])
      .map(x=>"<li><code>"+x.addrHex+"</code> "+x.insn+"</li>").join("");
    const card=document.createElement("section");
    card.className="site";
    card.id=site.id;
    card.innerHTML =
      "<h3>"+site.id+" — vector["+site.vectorIndex+"] @ "+site.vectorAddrHex+"</h3>"+
      '<div class="meta">'+
        "<div>Stub <code>"+site.stubAddrHex+"</code> ("+site.stubPrologue+")</div>"+
        "<div>LJMP @ <code>"+site.ljmpAddrHex+"</code></div>"+
        "<div>Disp <code>"+site.cfg_edge_from.dispHex+"</code> → <code>"+site.landing.addrHex+"</code></div>"+
        "<div>CFG <code>"+site.cfg_edge_from.verificationStatus+"</code></div>"+
        '<div>Stub region <span class="tag code">'+site.region_label+"</span></div>"+
        '<div>Landing region <span class="tag '+(site.landing.region_label==="DATA"?"data":"code")+'">'+
          site.landing.region_label+"</span></div>"+
      "</div>"+
      '<div class="caption">Stub window (focus = prologue+LJMP) starting '+u16(site.bytes.start)+"</div>"+
      '<div class="hex">'+renderHex(site.bytes.hex, site.bytes.focusOffset, stubLen, "focus")+"</div>"+
      '<div class="caption">Landing window starting '+site.landing.addrHex+" (first 8 bytes emphasized)</div>"+
      '<div class="hex">'+renderHex(site.landing.bytes.hex, 0, 8, "land")+"</div>"+
      (nearby
        ? '<div class="caption">Ghidra nearby at landing</div><ul>'+nearby+"</ul>"
        : '<div class="caption">No Ghidra instructions at landing (outside seeded CODE disasm).</div>')+
      '<p class="explain">'+site.explanation+"</p>"+
      '<p class="decide">'+decision(site)+"</p>";
    sitesEl.appendChild(card);
  });
}
document.querySelectorAll(".toolbar button").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".toolbar button").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    filter=btn.dataset.filter;
    render();
  });
});
document.getElementById("footer").textContent =
  "Source: "+DATA.id+" · ROM "+DATA.rom+" · ISA "+DATA.isa+" · related: "+
  (DATA.relatedArtifacts||[]).join(", ");
render();
</script>
</body>
</html>
`;

fs.writeFileSync(new URL("../out/irq_stubs_review.html", import.meta.url), html);
console.log("wrote irq_stubs_review.html", html.length, "bytes");
