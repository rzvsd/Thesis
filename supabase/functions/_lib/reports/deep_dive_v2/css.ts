// Deep Dive 2.0: page CSS for the server-rendered share page and the PDF printed from it.
// Ported from the approved mockup (docs/deep-dive/mockup.html): tokens (light = Thesis paper, dark = Thesis app),
// layout, hero, chip nav, sections, cards, story layer and the "point 0" editorial polish, then the states this
// renderer adds (.nodata, .notseen, price box states) and print rules. The chart kit's own CSS (CHART_CSS) goes
// between the page rules and the print rules. The mockup's JS-only chart classes (.f1, .k1, .gridl, #tip, ...)
// are left out: the server charts use the CHART_CSS classes instead.
// Pure TS (no Deno APIs). The result is safe inside <style>: it never contains "</".

import { CHART_CSS } from "./charts.ts";

/** Light tokens (report paper). Also forced in print. */
const LIGHT_TOKENS = `
  --bg:#F5F1E8; --surface:#FFFDF8; --surface-2:#F8F4EB; --ink:#1A2128; --ink-2:#47525E; --muted:#68717C;
  --line:#E6DFD1; --line-2:#D3C9B6; --accent:#7E6337; --chip:#EFE9DD; --focus:#256bb1;
  --hero-bg:#121A22; --hero-ink:#F6F2EA; --hero-ink-2:#B7BFC8; --hero-accent:#D7B985; --hero-line:rgba(246,242,234,.16);
  --hero-chip:rgba(246,242,234,.08);
  --pos:#2F6A4F; --neg:#9B4A4A; --warn:#8C5E12;
  --s1:#b48226; --s2:#82498b; --s3:#6b8d38; --s4:#256bb1; --s5:#be5737; --s6:#008e7f;
  --deemph:#B9B1A4; --grid:#EEE8DC; --axis:#CDC3B1;
  --div-pos:#256bb1; --div-neg:#be5737; --div-mid:#ECE6DB;
  --hero-bg-2:#22303D; --hl:rgba(180,130,38,.20); --callout:#F3EADB;
  --card-shadow:0 1px 2px rgba(26,33,40,.04),0 10px 28px -20px rgba(26,33,40,.35);
  --hero-pos:#7FD3A2; --hero-neg:#F2A0A0;
  --sec-bg-2:#EEE7D8; --glow-a:rgba(180,130,38,.16); --glow-b:rgba(37,107,177,.10);
  color-scheme:light;`;

/** Dark tokens (Thesis app). */
const DARK_TOKENS = `
  --bg:#0A0A0A; --surface:#161616; --surface-2:#1C1C1C; --ink:#F2F2F0; --ink-2:#BDBDB8; --muted:#8E8E89;
  --line:#262626; --line-2:#363636; --accent:#C5A059; --chip:#1F1F1F; --focus:#C5A059;
  --hero-bg:#121212; --hero-ink:#F2F2F0; --hero-ink-2:#A9A9A4; --hero-accent:#C5A059; --hero-line:rgba(255,255,255,.10);
  --hero-chip:rgba(255,255,255,.06);
  --pos:#4ADE80; --neg:#F87171; --warn:#FBBF24;
  --s1:#ba882e; --s2:#a166aa; --s3:#779a45; --s4:#4c89cc; --s5:#cb6443; --s6:#1aa291;
  --deemph:#5B5B58; --grid:#222222; --axis:#3A3A3A;
  --div-pos:#4c89cc; --div-neg:#cb6443; --div-mid:#2A2A2A;
  --hero-bg-2:#1A1A1A; --hl:rgba(197,160,89,.22); --callout:#1C1913; --card-shadow:none;
  --hero-pos:#7FD3A2; --hero-neg:#F2A0A0;
  --sec-bg-2:#161616; --glow-a:rgba(197,160,89,.16); --glow-b:rgba(76,137,204,.14);
  color-scheme:dark;`;

const TOKENS_CSS = `
:root{${LIGHT_TOKENS}
  --f-display:"Newsreader", Georgia, "Times New Roman", serif;
  --f-body:system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){${DARK_TOKENS}
  }
}
:root[data-theme="dark"]{${DARK_TOKENS}
}`;

const LAYOUT_CSS = `
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{background:var(--bg);color:var(--ink);font:15px/1.55 var(--f-body);margin:0}
body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:30;background:var(--surface)}
a{color:inherit}
button,input{font:inherit;color:inherit}
[hidden]{display:none!important}
:focus-visible{outline:2px solid var(--focus);outline-offset:2px;border-radius:4px}
.wrap{max-width:900px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}

/* app bar */
.appbar{position:sticky;top:env(safe-area-inset-top,0px);z-index:20;background:var(--surface);border-bottom:1px solid var(--line)}
.appbar .wrap{display:flex;align-items:center;gap:12px;height:52px}
.brand{font:600 13px/1 var(--f-body);letter-spacing:.14em;text-transform:uppercase;color:var(--accent);text-decoration:none}
.appbar .tk{font:600 17px/1 var(--f-body)}
.sample-pill{font-size:11px;font-weight:600;letter-spacing:.04em;padding:4px 8px;border-radius:999px;background:var(--chip);color:var(--ink-2);white-space:nowrap}
.spacer{flex:1}
.iconbtn{border:1px solid var(--line-2);background:transparent;border-radius:999px;height:32px;padding:0 12px;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap;text-decoration:none;display:inline-flex;align-items:center}
.iconbtn:hover{background:var(--chip)}
.iconbtn .l{margin-right:.3em}
.sample-pill .s,.iconbtn .s{display:none}
@media (max-width:600px){.sample-pill .l,.iconbtn .l{display:none}.sample-pill .s{display:inline}.appbar .wrap{gap:10px}}
@media (max-width:380px){.appbar .wrap{gap:8px}.appbar .iconbtn{padding:0 10px}.appbar .sample-pill~.spacer~.iconbtn{padding:0 8px}.appbar .brand:has(~.sample-pill){display:none}}

/* chip nav */
.chipnav{position:sticky;top:calc(env(safe-area-inset-top,0px) + 52px);z-index:19;background:color-mix(in oklab,var(--bg) 92%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.chipnav .wrap{display:flex;gap:6px;overflow-x:auto;padding-block:10px;scrollbar-width:none}
.chipnav .wrap::-webkit-scrollbar{display:none}
.chipnav a{flex:none;text-decoration:none;font-size:13px;font-weight:500;color:var(--ink-2);padding:6px 12px;border-radius:999px;border:1px solid var(--line-2);background:var(--surface)}
.chipnav a.on{background:var(--ink);color:var(--surface);border-color:var(--ink)}

/* hero */
.hero{background:var(--hero-bg);color:var(--hero-ink)}
.hero .wrap{padding-block:28px 26px;display:grid;gap:22px}
.hero .eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--hero-accent);font-weight:600}
.hero h1{font:500 clamp(32px,6vw,46px)/1.02 var(--f-display);margin:6px 0 8px;letter-spacing:-.01em;text-wrap:balance;overflow-wrap:anywhere}
.hero .meta{color:var(--hero-ink-2);font-size:13.5px}
.hero .meta b{color:var(--hero-ink);font-weight:600}
.stance{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.pill{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;padding:5px 10px;border-radius:999px;background:var(--hero-chip);border:1px solid var(--hero-line);color:var(--hero-ink)}
.pill .dot{width:8px;height:8px;border-radius:50%;background:var(--hero-accent)}
.thesis{font:400 19px/1.45 var(--f-display);color:var(--hero-ink);max-width:62ch;margin:0}
.pricebox{display:grid;gap:14px;border:1px solid var(--hero-line);border-radius:12px;padding:16px;background:var(--hero-chip)}
.pricebox .row{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px}
.pricebox label{font-size:13px;color:var(--hero-ink-2)}
.priceinput{display:inline-flex;align-items:center;border:1px solid var(--hero-line);border-radius:8px;background:var(--hero-bg);padding:0 10px;height:38px}
.priceinput span{color:var(--hero-ink-2)}
.priceinput input{width:84px;border:0;background:transparent;color:var(--hero-ink);font-size:17px;font-weight:600;padding:0 4px;outline:none;font-variant-numeric:tabular-nums}
.priceinput:focus-within{outline:2px solid var(--hero-accent);outline-offset:2px}
.updown{font-size:15px;font-weight:600}
.small-note{font-size:12px;color:var(--hero-ink-2)}
.rangewrap{position:relative}
.rangewrap svg{display:block;width:100%;overflow:visible}
.kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:var(--hero-line);border:1px solid var(--hero-line);border-radius:12px;overflow:hidden}
@media (min-width:560px){.kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (min-width:880px){.kpis{grid-template-columns:repeat(6,minmax(0,1fr))}}
.kpi{background:var(--hero-bg);padding:12px 14px;min-width:0}
.kpi .l{font-size:12px;color:var(--hero-ink-2)}
.kpi .v{font:600 22px/1.2 var(--f-body);margin-top:2px;overflow-wrap:anywhere}
.kpi .d{font-size:12px;margin-top:2px;color:var(--hero-ink-2)}
.kpi .d.up{color:var(--hero-pos)}
.kpi .d.dn{color:var(--hero-neg)}
/* charts drawn on the dark header read the header tokens */
.hero .rangewrap,.hero .chart,.on-hero{--ink:var(--hero-ink);--ink-2:var(--hero-ink-2);--muted:var(--hero-ink-2);--grid:var(--hero-line);
  --axis:var(--hero-line);--surface:var(--hero-bg);--line:var(--hero-line);--deemph:var(--hero-line);--accent:var(--hero-accent)}
/* the price box is lighter than the header, so halos there match the box, not the header */
.pricebox .halo{stroke:color-mix(in oklab,var(--hero-ink) 6%,var(--hero-bg-2))}

/* sections */
main .wrap{display:grid;gap:56px;padding-block:32px 48px}
section{scroll-margin-top:calc(env(safe-area-inset-top,0px) + 112px);display:grid;gap:18px;min-width:0}
.sec-head{display:grid;gap:8px}
.sec-kicker{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.phase{font-size:11px;font-weight:600;letter-spacing:.03em;padding:3px 8px;border-radius:6px;border:1px solid var(--line-2);color:var(--ink-2);background:var(--surface);white-space:nowrap}
.phase.p1{border-color:color-mix(in oklab,var(--s3) 55%,var(--line-2))}
.phase.p2{border-color:color-mix(in oklab,var(--s4) 55%,var(--line-2))}
.phase.p3{border-color:color-mix(in oklab,var(--s5) 55%,var(--line-2))}
.phase.p4{border-color:color-mix(in oklab,var(--s2) 55%,var(--line-2))}
.phase i{display:inline-block;width:7px;height:7px;border-radius:2px;margin-right:6px;vertical-align:1px}
.phase.p1 i{background:var(--s3)} .phase.p2 i{background:var(--s4)} .phase.p3 i{background:var(--s5)} .phase.p4 i{background:var(--s2)}
.src{font-size:11.5px;color:var(--muted)}
h2{font:500 clamp(26px,4.2vw,32px)/1.1 var(--f-display);margin:0;letter-spacing:-.005em;text-wrap:balance}
.verdict{font-size:16.5px;line-height:1.5;color:var(--ink-2);max-width:66ch;margin:0}
.verdict b{color:var(--ink);font-weight:600}
.grid2{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;align-items:start}
@media (min-width:760px){.grid2{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.span2{grid-column:1/-1}}
.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px 16px 14px;min-width:0;display:grid;gap:10px;align-content:start}
.card h3{font:600 15px/1.35 var(--f-body);margin:0;text-wrap:balance}
.card .sub{font-size:12.5px;color:var(--muted);margin-top:-6px}
.card .foot{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:8px;margin-top:2px}
.tbtn{border:0;background:transparent;font-size:12px;font-weight:600;color:var(--accent);cursor:pointer;padding:4px 0}
.chart{position:relative;min-width:0}
.chart svg{display:block;width:100%;height:auto;overflow:visible}
.legend{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12.5px;color:var(--ink-2)}
.legend span{display:inline-flex;align-items:center;gap:6px}
.legend b{color:var(--ink);font-weight:600;font-variant-numeric:tabular-nums}
.sw{width:10px;height:10px;border-radius:3px;display:inline-block;flex:none}
.lk{width:14px;height:2px;border-radius:2px;display:inline-block;flex:none}
.tbl{overflow-x:auto}
.tbl table{border-collapse:collapse;width:100%;font-size:12.5px;font-variant-numeric:tabular-nums}
.tbl th,.tbl td{padding:6px 8px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
.tbl th:first-child,.tbl td:first-child{text-align:left}
.tbl th{font-weight:600;color:var(--muted);font-size:11.5px;white-space:normal;vertical-align:bottom}
.note{font-size:13px;color:var(--ink-2);margin:0}
.callout{border-radius:12px;padding:12px 14px;background:var(--surface-2);border:1px solid var(--line);font-size:14px;color:var(--ink-2)}
.callout b{color:var(--ink)}

/* list blocks */
.hbars{display:grid;gap:10px}
.hb{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;align-items:center}
.hb .n{font-size:13px;min-width:0;overflow-wrap:anywhere}
.hb .n small{color:var(--muted);font-size:11.5px;margin-left:4px}
.hb .v{font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;text-align:right}
.hb .track{grid-column:1/-1;height:8px;border-radius:4px;background:var(--grid);overflow:hidden}
.hb .fill{height:100%;border-radius:4px}
.segbar{display:flex;gap:2px;height:14px}
.segbar div{border-radius:4px;min-width:0}
.lh{display:inline-flex;align-items:center;gap:6px}
.believe{display:grid;gap:6px;font-size:13px;color:var(--ink-2)}
.believe div{display:grid;grid-template-columns:14px 1fr;gap:8px;align-items:baseline}
.believe b{color:var(--ink);font-weight:600}
.believe .lk{transform:translateY(-3px)}
@media (max-width:560px){
  .tbl.stack table,.tbl.stack tbody,.tbl.stack tr,.tbl.stack td{display:block}
  .tbl.stack thead{display:none}
  .tbl.stack tr{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;padding:10px 0;border-bottom:1px solid var(--line)}
  .tbl.stack tr:last-child{border-bottom:0}
  .tbl.stack td,.tbl.stack td:nth-child(n){border:0;padding:0;text-align:left;white-space:normal;min-width:0;font-size:13px}
  .tbl.stack td:first-child{grid-column:1/-1;font-weight:600;font-size:13.5px}
  .tbl.stack td[data-l]::before{content:attr(data-l);display:block;font-size:11px;color:var(--muted);font-weight:500}
  .tbl.stack.srcs tr{grid-template-columns:1fr}
  .tbl.stack td{overflow-wrap:anywhere}
  .tbl.stack caption{display:block}
}
.meters{display:grid;gap:12px}
.meter{display:grid;grid-template-columns:150px 1fr 44px;gap:10px;align-items:center}
.meter .n{font-size:13.5px;font-weight:500}
.meter .t{height:8px;border-radius:4px;background:var(--grid);overflow:hidden}
.meter .t div{height:100%;border-radius:4px;background:var(--s1)}
.meter .v{font-size:13px;font-weight:600;text-align:right;font-variant-numeric:tabular-nums}
.meter .r{grid-column:1/-1;font-size:12.5px;color:var(--muted);margin-top:-6px}
@media (max-width:460px){.meter{grid-template-columns:1fr 44px}.meter .t{grid-column:1/-1;grid-row:2}.meter .r{grid-row:3}}
.changes{display:grid;gap:10px}
.chg{display:grid;grid-template-columns:28px 1fr;gap:10px;align-items:start}
.chg .ic{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;font-weight:700;font-size:14px;background:var(--chip)}
.chg .ic.up{color:var(--pos)} .chg .ic.dn{color:var(--neg)} .chg .ic.w{color:var(--warn)}
.chg b{font-weight:600}
.chg p{margin:2px 0 0;font-size:13.5px;color:var(--ink-2)}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{font-size:12.5px;padding:5px 10px;border-radius:999px;background:var(--chip);color:var(--ink-2);border:1px solid var(--line)}
.chip b{color:var(--ink);font-weight:600}
.tl{display:grid;gap:0;border-left:2px solid var(--line-2);margin-left:6px}
.tl .e{position:relative;padding:0 0 16px 18px}
.tl .e::before{content:"";position:absolute;left:-7px;top:5px;width:12px;height:12px;border-radius:50%;background:var(--surface);border:2px solid var(--s1)}
.tl .d{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.tl .t{font-size:14px;font-weight:600}
.tl .x{font-size:13px;color:var(--ink-2)}
.tag{display:inline-block;font-size:10.5px;font-weight:600;letter-spacing:.03em;padding:2px 6px;border-radius:5px;background:var(--chip);color:var(--ink-2);margin-left:6px;vertical-align:1px}
.heat{display:grid;gap:2px;font-variant-numeric:tabular-nums}
.heat .c{padding:8px 4px;text-align:center;font-size:12.5px;font-weight:600;border-radius:4px}
.heat .h{font-size:11px;color:var(--muted);text-align:center;padding:4px 2px;align-self:center}
.status{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600}
.status.ok{color:var(--pos)} .status.watch{color:var(--warn)} .status.bad{color:var(--neg)} .status.none{color:var(--muted)}
.kill{display:grid;gap:10px}
.kill .k{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding-bottom:10px;border-bottom:1px solid var(--line)}
.kill .k:last-child{border-bottom:0;padding-bottom:0}
.kill .k span{font-size:13.5px}
.kill .k small{grid-column:1/-1;color:var(--muted);font-size:12px}
.tbl.srcs td,.tbl.srcs th{text-align:left;white-space:normal;overflow-wrap:anywhere;min-width:0}
.lockb{font-size:11px;font-weight:600;padding:3px 8px;border-radius:6px;background:var(--surface-2);border:1px solid color-mix(in oklab,var(--s5) 55%,var(--line-2));color:var(--ink-2);white-space:nowrap}
.tbl.wrapcells td,.tbl.wrapcells th{white-space:normal}
.tbl.wrapcells td:nth-child(2),.tbl.wrapcells th:nth-child(2){text-align:left;overflow-wrap:anywhere}

/* story layer: lede, narrative paragraphs, upshot. Hidden in "Charts only" mode. */
.chap{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin-right:4px}
.story{display:grid;gap:14px;max-width:68ch;font:400 17px/1.62 var(--f-display);color:var(--ink)}
.story p{margin:0}
.story .o{font-weight:600}
.figref{color:var(--accent);text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:2px;white-space:nowrap}
.upshot{margin:0;max-width:68ch;padding:10px 0 10px 16px;border-left:3px solid var(--accent);font-size:15.5px;line-height:1.55;color:var(--ink-2)}
.upshot b{color:var(--ink)}
.fignum{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:-6px}
@media screen{body.charts-only .story,body.charts-only .upshot,body.charts-only .bigq{display:none}}
.readmode{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:13px;color:var(--hero-ink-2)}
.readmode span{margin-right:4px}
.readmode button{border:1px solid var(--hero-line);background:transparent;color:var(--hero-ink);border-radius:999px;height:32px;padding:0 14px;font-size:13px;font-weight:500;cursor:pointer}
.readmode button[aria-pressed="true"]{background:var(--hero-ink);color:var(--hero-bg);border-color:var(--hero-ink)}
.bigq{border-radius:14px;padding:16px 18px;background:var(--surface);border:1px solid var(--line);display:grid;gap:6px}
.bigq .k{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--accent)}
.bigq p{margin:0;font:500 20px/1.35 var(--f-display);color:var(--ink);text-wrap:balance}
.chapters{margin:0;padding:0;list-style:none;display:grid;gap:10px;counter-reset:ch}
.chapters li{display:grid;grid-template-columns:30px 1fr;gap:10px;align-items:baseline;font-size:14px;color:var(--ink-2)}
.chapters li::before{counter-increment:ch;content:counter(ch,decimal-leading-zero);font-size:12px;font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums}
.chapters a{color:var(--ink);font-weight:600;text-decoration:none}
.chapters a:hover{text-decoration:underline}

/* price action */
.marks{display:grid;gap:8px;margin-top:2px}
.marks div{display:grid;grid-template-columns:22px 1fr;gap:10px;align-items:start;font-size:13px;color:var(--ink-2)}
.marks i{font-style:normal;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:11.5px;font-weight:700;border:1.5px solid var(--ink);color:var(--ink);background:var(--surface)}
.marks b{color:var(--ink);font-weight:600}
.mk circle{fill:var(--surface);stroke:var(--ink);stroke-width:1.5}
.mk text{fill:var(--ink);font:700 10.5px var(--f-body)}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.stats div{background:var(--surface);padding:10px 12px;min-width:0}
.stats .l{font-size:12px;color:var(--muted)}
.stats .v{font:600 18px/1.25 var(--f-body);font-variant-numeric:tabular-nums}
.stats .d{font-size:12px;color:var(--ink-2)}
.scan{display:grid;gap:0}
.scan .r{display:grid;grid-template-columns:minmax(0,190px) minmax(0,1fr) auto;gap:4px 14px;align-items:baseline;padding:10px 0;border-bottom:1px solid var(--line)}
.scan .r:last-child{border-bottom:0}
.scan .n{font-size:13.5px;font-weight:600}
.scan .n small{display:block;font-weight:400;color:var(--muted);font-size:12px}
.scan .x{font-size:13px;color:var(--ink-2)}
@media (max-width:560px){.scan .r{grid-template-columns:1fr auto}.scan .x{grid-column:1/-1}}
.odds{display:grid;gap:12px}
.odds div{display:grid;gap:2px;font-size:13px;color:var(--ink-2)}
.odds b{font:600 17px/1.2 var(--f-display);color:var(--ink)}
.wrong{display:grid;gap:10px}
.wrong div{display:grid;grid-template-columns:28px 1fr;gap:10px;align-items:start;font-size:14px;color:var(--ink-2)}
.wrong i{font-style:normal;width:28px;height:28px;border-radius:8px;display:grid;place-items:center;font-weight:700;background:var(--chip);color:var(--neg)}
.wrong b{color:var(--ink);font-weight:600}
footer .wrap{padding-block:24px 48px;border-top:1px solid var(--line);color:var(--muted);font-size:12.5px;display:grid;gap:6px}
footer p{margin:0}`;

/** The mockup's "point 0" editorial polish, kept last among the page rules so it wins. */
const POLISH_CSS = `
.hero{position:relative;isolation:isolate;background:
  radial-gradient(70% 120% at 100% 0%,color-mix(in oklab,var(--hero-accent) 24%,transparent) 0,transparent 60%),
  radial-gradient(60% 90% at 0% 100%,color-mix(in oklab,var(--s4) 22%,transparent) 0,transparent 65%),
  linear-gradient(165deg,var(--hero-bg) 0%,var(--hero-bg-2) 100%)}
.hero::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;background:linear-gradient(90deg,transparent,var(--hero-accent) 30%,var(--hero-accent) 70%,transparent);opacity:.55}
.hero .wrap{padding-block:40px 34px}
.hero .eyebrow{display:flex;align-items:center;gap:10px}
.hero .eyebrow::before{content:"";width:28px;height:1px;background:var(--hero-accent);flex:none}
.hero h1{font:400 clamp(40px,7.4vw,64px)/.98 var(--f-display);font-variation-settings:"opsz" 72;letter-spacing:-.022em;margin:10px 0 10px}
.thesis{font:italic 400 clamp(19px,2.6vw,23px)/1.42 var(--f-display);font-variation-settings:"opsz" 36;color:var(--hero-ink)}
.kpi .v{font:500 24px/1.15 var(--f-display);font-variation-settings:"opsz" 36;letter-spacing:-.01em}

main .wrap{gap:0;padding-block:0}
main section{padding-block:56px 60px}
html{overflow-x:clip}
/* every chapter carries the cover's background: soft gold glow top right, blue bottom left */
main section{position:relative;isolation:isolate}
main section::before{content:"";position:absolute;z-index:-1;top:0;bottom:0;left:calc(50% - 50vw);width:100vw;pointer-events:none;background:
  radial-gradient(min(70vw,900px) 560px at 100% 0,var(--glow-a) 0,transparent 70%),
  radial-gradient(min(60vw,760px) 480px at 0 100%,var(--glow-b) 0,transparent 70%),
  linear-gradient(165deg,var(--bg) 0%,var(--sec-bg-2) 100%)}
main section + section{border-top:1px solid color-mix(in oklab,var(--line-2) 60%,transparent)}

.sec-head{gap:12px}
.chap{display:inline-flex;align-items:center;gap:10px;font-size:11.5px;letter-spacing:.18em;margin-right:10px}
.chap em{font:italic 400 40px/.7 var(--f-display);font-variation-settings:"opsz" 72;letter-spacing:-.02em;color:var(--accent);text-transform:none}
h2{font:400 clamp(30px,5vw,44px)/1.04 var(--f-display);font-variation-settings:"opsz" 72;letter-spacing:-.018em}
.verdict{font:400 clamp(18px,2.4vw,20.5px)/1.5 var(--f-display);font-variation-settings:"opsz" 24;color:var(--ink-2);max-width:64ch}
.verdict b{font-weight:600;color:var(--ink)}

.story>p:first-child::first-letter{float:left;font:500 3.6em/.8 var(--f-display);font-variation-settings:"opsz" 72;margin:.07em .09em 0 -.02em;color:var(--accent)}
.story .o{background:linear-gradient(180deg,transparent 54%,var(--hl) 54%,var(--hl) 96%,transparent 96%);-webkit-box-decoration-break:clone;box-decoration-break:clone;padding-inline:.06em}
.story>p:first-child .o{background:none;padding-inline:0}
.upshot{padding:16px 20px 17px 22px;border:0;border-radius:12px;background:var(--callout);box-shadow:inset 3px 0 0 var(--accent);font:400 17px/1.55 var(--f-display);color:var(--ink)}
.upshot b{display:block;font:700 11px/1.2 var(--f-body);letter-spacing:.18em;text-transform:uppercase;color:var(--accent);margin-bottom:7px}

.card{box-shadow:var(--card-shadow)}
.card h3{font:500 18px/1.28 var(--f-display);font-variation-settings:"opsz" 24;letter-spacing:-.005em}
.fignum{letter-spacing:.14em;color:var(--accent);opacity:.9}

/* the closing chapter reads as a dark band, like the cover */
#bottom{--ink:var(--hero-ink);--ink-2:var(--hero-ink-2);--muted:var(--hero-ink-2);--accent:var(--hero-accent);--line:var(--hero-line);--line-2:var(--hero-line);
  --surface:color-mix(in oklab,var(--hero-ink) 5%,var(--hero-bg));--chip:var(--hero-chip);--neg:var(--hero-neg);--pos:var(--hero-pos);
  --callout:color-mix(in oklab,var(--hero-accent) 12%,var(--hero-bg));--hl:color-mix(in oklab,var(--hero-accent) 30%,transparent);--card-shadow:none;
  --grid:var(--hero-line);--axis:var(--hero-line);
  --glow-a:color-mix(in oklab,var(--hero-accent) 24%,transparent);--glow-b:color-mix(in oklab,var(--s4) 22%,transparent);
  --bg:var(--hero-bg);--sec-bg-2:var(--hero-bg-2);color:var(--hero-ink);border-top:0}
#bottom + section{border-top:0}`;

/** States this renderer adds: empty charts, chapters whose data comes in a later phase, the price box. */
const STATE_CSS = `
.nodata{display:grid;place-items:center;min-height:120px;padding:16px;border:1px dashed var(--line-2);border-radius:10px;
  color:var(--muted);font-size:13px;font-weight:500;text-align:center;background:color-mix(in oklab,var(--surface-2) 60%,transparent)}
.card.notseen{background:transparent;border:1.5px dashed var(--line-2);box-shadow:none;color:var(--muted)}
.card.notseen h3{color:var(--ink-2)}
.card.notseen p{margin:0;font-size:13.5px;line-height:1.5;color:var(--muted)}
.card.notseen p b{color:var(--ink-2);font-weight:600}
.card.notseen .phase{justify-self:start;background:transparent}
.ns-tag{display:inline-flex;align-items:center;gap:6px;justify-self:start;font-size:11px;font-weight:700;letter-spacing:.12em;
  text-transform:uppercase;color:var(--muted)}
.ns-tag::before{content:"";width:8px;height:8px;border-radius:50%;border:1.5px dashed var(--muted)}
.ns-row{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}
[data-dd="gap"].up{color:var(--pos)} [data-dd="gap"].dn{color:var(--neg)}
.hero [data-dd="gap"].up{color:var(--hero-pos)} .hero [data-dd="gap"].dn{color:var(--hero-neg)}
.pricebox .noprice{font-size:13.5px;color:var(--hero-ink-2)}
.ratios{display:grid;gap:0}
.ratios div{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--line);font-size:13.5px}
.ratios div:last-child{border-bottom:0}
.ratios b{font-weight:600;font-variant-numeric:tabular-nums;text-align:right}
.notice{font-size:12.5px;color:var(--muted)}`;

/**
 * Print (A4). The PDF is this page printed: "Save as PDF" on the share page and the app's Export PDF (Android
 * print of the in-app page). Light tokens, no app chrome, the "Show table" tables stay closed as on screen,
 * chapters flow one after another (a thin rule between them) after the cover page, page numbers bottom right.
 */
const PRINT_CSS = `
@page{size:A4;margin:14mm}
@page{@bottom-right{content:counter(page) " / " counter(pages);font:8pt system-ui,sans-serif;color:#8a8478}}
@media print{
  :root,:root:not([data-theme="light"]),:root[data-theme="dark"]{${LIGHT_TOKENS}
  }
  html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-size:10.5pt;background:#fff}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .appbar,.chipnav,.readmode,.iconbtn,.priceinput-edit,.tbtn,body::before{display:none!important}
  main section{break-before:auto;padding-block:14px 12px;scroll-margin-top:0;display:block}
  main section>*+*{margin-top:18px}
  main section:first-of-type{break-before:page}
  main section::before{display:none}
  main section + section{border-top:1px solid var(--line);margin-top:22px;padding-top:22px}
  .sec-head{break-inside:avoid;break-after:avoid}
  .card,.kpis,.upshot,.bigq,.pricebox,.stats,.tl .e,.kill .k,.chg,.wrong div{break-inside:avoid}
  h2,h3,.sec-head,.fignum{break-after:avoid}
  .story p{orphans:3;widows:3}
  .grid2{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .span2{grid-column:1/-1}
  .card{box-shadow:none}
  .figref{text-decoration:none}
  details.tbl{display:none!important}
  .tbl{overflow:visible}
  .hero,#bottom{--hero-bg:#fff;--hero-bg-2:#fff;--hero-ink:#1d1d1b;--hero-ink-2:#555;--hero-line:#ddd;--hero-chip:#f6f3ec;
    --hero-accent:#7E6337;--hero-pos:#2F6A4F;--hero-neg:#9B4A4A;background:#fff!important;box-shadow:none}
  .hero::after{display:none}
  .pricebox.noprice-state .row{display:none}
}`;

/** The page rules without the chart kit and print rules (tokens, layout, polish, states). */
export const BASE_CSS: string = (TOKENS_CSS + LAYOUT_CSS + POLISH_CSS + STATE_CSS).trim();

/** Print rules. Always last in the page CSS. */
export const PRINT_RULES: string = PRINT_CSS.trim();

/** Full page CSS for a given chart kit CSS: page rules, then the chart kit, then print. */
export function pageCss(chartCss: string): string {
  return [BASE_CSS, chartCss.trim(), PRINT_RULES].filter(Boolean).join("\n");
}

/** The share page CSS: put FONT_CSS + PAGE_CSS in the page's single <style>. */
export const PAGE_CSS: string = pageCss(CHART_CSS);
