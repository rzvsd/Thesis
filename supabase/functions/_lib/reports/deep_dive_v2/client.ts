// Deep Dive 2.0: the one inline script of the share page, and its CSP hash.
// The page works without it (every chart is static SVG). It only enhances:
//   1. Theme button `button[data-dd-theme]`: Auto -> Light -> Dark, sets or removes html[data-theme], label
//      "Theme: Auto|Light|Dark", remembered in localStorage "dd-theme". With nothing stored it starts from the
//      server's html[data-theme] (the ?theme= of the in-app page). A page without the button (the in-app embed)
//      never touches html[data-theme], so the theme the server set stays.
//   2. Reading mode `button[data-dd-mode="story"|"charts"]`: toggles body.charts-only and aria-pressed,
//      remembered in localStorage "dd-mode".
//   3. Chip nav `nav.chipnav a[href^="#"]`: class "on" for the section in view, scrolled into view sideways.
//   4. Price box: reads `script#dd-data` (ClientData) and `input[data-dd="price"]`; on input it fills
//      `[data-dd="pe"]`, `[data-dd="gap"]` (+ class up|dn), `[data-dd="implied"]`, `[data-dd="price-text"]`,
//      moves `[data-dd="marker"]` groups and shows `[data-dd-when="price"]` or `[data-dd-when="noprice"]`.
// Marker contract: <g data-dd="marker" data-min data-max data-x0 data-x1 [data-x]> where [data-min, data-max] is
// the axis domain drawn from x0 to x1 (viewBox units). The client sets transform="translate(X - data-x, 0)" with
// X the price mapped (clamped) into [x0, x1]. A price off the axis keeps the marker at the edge and its
// [data-dd="marker-text"] label gains an arrow pointing off the axis ("Your price ->"), so the chart never shows it
// as the edge value. So either draw the marker's children around x = 0 and omit data-x,
// or draw them at the server's price position and set data-x to that position.
// The math is identical to dcf.ts (valuePerShare and the impliedGrowth bisection, same operation order).
// The texts match priceTexts() below, so the server can render the same initial state.
// CLIENT_JS is ASCII-only, contains no "</", and must be emitted byte for byte: `<script>${CLIENT_JS}</script>`.
// Pure TS (no Deno APIs).

import { type DcfInputs, impliedGrowth } from "./dcf.ts";

/** The JSON in `<script type="application/json" id="dd-data">` (escape "<" as < when serialising). */
export interface ClientData {
  price: number | null;
  eps: number | null;
  scenarios: { bear: number | null; base: number | null; bull: number | null } | null;
  dcf: DcfInputs | null;
  /** The fact pack's reporting currency. Anything but "USD" ships with price, eps, scenarios and dcf all null. */
  currency: string;
}

/** Text shown in the price fields when no price is stored and none is typed. */
export const NO_PRICE_TEXT = "Type a price";
/** Text shown when a ratio cannot be computed (no EPS, EPS not positive, no model, price outside the model). */
export const NA_TEXT = "n/a";

/** Pure part: DCF math and text formatting. No DOM access, evaluated on its own in the tests. */
export const CLIENT_CORE_JS: string = String.raw`
var MI="\u2212",NP="Type a price",NA="n/a";
function isF(v){return typeof v==="number"&&isFinite(v)}
function okI(i){return !!i&&isF(i.baseFcf)&&isF(i.shares)&&i.shares>0&&isF(i.netCash)&&isF(i.wacc)&&isF(i.terminal)&&
i.wacc>i.terminal&&i.wacc>-100&&i.terminal>-100&&Number.isInteger(i.years)&&i.years>=1&&i.years<=100&&
Number.isInteger(i.fade)&&i.fade>=0&&i.fade<=i.years}
function gAt(i,g,t){return t<=i.fade||i.years===i.fade?g:g+(i.terminal-g)*(t-i.fade)/(i.years-i.fade)}
function vps(i,g){if(!okI(i)||!isF(g))return NaN;var w=i.wacc/100,tg=i.terminal/100,f=i.baseFcf,ds=1,pv=0;
for(var t=1;t<=i.years;t++){f*=1+gAt(i,g,t)/100;ds*=1+w;pv+=f/ds}
var v=(pv+f*(1+tg)/(w-tg)/ds+i.netCash)/i.shares;return isF(v)?v:NaN}
function ig(i,p){if(!okI(i)||i.baseFcf<=0||!isF(p)||p<=0)return null;var lo=-20,hi=40,a=vps(i,lo),b=vps(i,hi);
if(!isF(a)||!isF(b)||p<a||p>b)return null;for(var k=0;k<60;k++){var m=(lo+hi)/2;if(vps(i,m)>p)hi=m;else lo=m}
return (lo+hi)/2}
function grp(v,k){var s=Math.abs(v).toFixed(k).split(".");return s[0].replace(/\B(?=(\d{3})+(?!\d))/g,",")+(s[1]?"."+s[1]:"")}
function neg(v,k){return v<0&&Number(Math.abs(v).toFixed(k))!==0}
function texts(D,p){var o={pe:NP,gap:NP,cls:"",implied:NP,price:""};if(!isF(p)||p<=0)return o;
var e=D&&D.eps,b=D&&D.scenarios?D.scenarios.base:null,x;o.price="$"+grp(p,2);
o.pe=isF(e)&&e>0?grp(p/e,1)+"x":NA;
if(isF(b)){x=(b/p-1)*100;var z=Number(Math.abs(x).toFixed(0))===0;o.cls=z?"":x<0?"dn":"up";
o.gap=(z?"":x<0?MI:"+")+grp(x,0)+"% to the base value ("+(neg(b,0)?MI:"")+"$"+grp(b,0)+")"}else o.gap=NA;
x=D&&D.dcf?ig(D.dcf,p):null;o.implied=x===null?NA:(neg(x,1)?MI:"")+grp(x,1)+"% a year";return o}
`;

const CLIENT_DOM_JS = String.raw`
var d=document,de=d.documentElement,W=window;
function qa(s){return Array.prototype.slice.call(d.querySelectorAll(s))}
function sg(k){try{return W.localStorage.getItem(k)}catch(e){return null}}
function ss(k,v){try{W.localStorage.setItem(k,v)}catch(e){}}
var TM=["auto","light","dark"],tb=qa("button[data-dd-theme]"),ti=Math.max(0,TM.indexOf(sg("dd-theme")||de.getAttribute("data-theme")));
function thm(){var m=TM[ti],t=m.charAt(0).toUpperCase()+m.slice(1);
if(m==="auto")de.removeAttribute("data-theme");else de.setAttribute("data-theme",m);
tb.forEach(function(b){var l=d.createElement("span");l.className="l";l.textContent="Theme: ";b.textContent="";
b.appendChild(l);b.appendChild(d.createTextNode(t));b.setAttribute("aria-label","Theme: "+t+". Switch light or dark")})}
tb.forEach(function(b){b.addEventListener("click",function(){ti=(ti+1)%3;thm();ss("dd-theme",TM[ti])})});if(tb.length)thm();
var mb=qa("button[data-dd-mode]");
function mode(m){d.body.classList.toggle("charts-only",m==="charts");
mb.forEach(function(b){b.setAttribute("aria-pressed",String(b.getAttribute("data-dd-mode")===m))})}
mb.forEach(function(b){b.addEventListener("click",function(){var m=b.getAttribute("data-dd-mode");mode(m);ss("dd-mode",m)})});
var sm=sg("dd-mode");if(sm==="story"||sm==="charts")mode(sm);
var cl=qa('nav.chipnav a[href^="#"]');
function chip(id){var on=null;cl.forEach(function(a){var h=a.getAttribute("href")==="#"+id;a.classList.toggle("on",h);if(h)on=a});
var n=on&&on.parentNode;if(!n||!(n.scrollWidth>n.clientWidth))return;var r=on.getBoundingClientRect(),nr=n.getBoundingClientRect(),
x=n.scrollLeft+(r.left-nr.left)-(n.clientWidth-r.width)/2,rm=W.matchMedia&&W.matchMedia("(prefers-reduced-motion: reduce)").matches;
if(n.scrollTo)n.scrollTo({left:x,behavior:rm?"auto":"smooth"});else n.scrollLeft=x}
if(cl.length&&W.IntersectionObserver){var io=new W.IntersectionObserver(function(es){es.forEach(function(en){
if(en.isIntersecting)chip(en.target.id)})},{rootMargin:"-45% 0px -50% 0px"});
cl.forEach(function(a){var s=d.getElementById(a.getAttribute("href").slice(1));if(s)io.observe(s)})}
var D={},dj=d.querySelector("script#dd-data");if(dj){try{D=JSON.parse(dj.textContent)||{}}catch(e){D={}}}
var inp=d.querySelector('input[data-dd="price"]');
function rd(){if(!inp)return isF(D.price)&&D.price>0?D.price:null;var s=String(inp.value||"").replace(/[$,\s]/g,"");
if(s==="")return null;var v=Number(s);return isF(v)&&v>0?v:null}
function put(s,t){qa(s).forEach(function(el){el.textContent=t})}
function upd(){var p=rd(),o=texts(D,p),has=p!==null;put('[data-dd="pe"]',o.pe);put('[data-dd="implied"]',o.implied);
put('[data-dd="price-text"]',o.price);qa('[data-dd="gap"]').forEach(function(el){el.textContent=o.gap;
el.classList.toggle("up",o.cls==="up");el.classList.toggle("dn",o.cls==="dn")});
qa('[data-dd="marker"]').forEach(function(g){var f=function(a){return parseFloat(g.getAttribute(a))},mn=f("data-min"),
mx=f("data-max"),x0=f("data-x0"),x1=f("data-x1"),bx=f("data-x")||0;
if(!has||!isF(mn)||!isF(mx)||!(mx>mn)||!isF(x0)||!isF(x1)){g.setAttribute("display","none");return}
var x=x0+(Math.min(mx,Math.max(mn,p))-mn)/(mx-mn)*(x1-x0);g.setAttribute("transform","translate("+Math.round((x-bx)*100)/100+",0)");
var t=g.querySelector('[data-dd="marker-text"]');if(t){t.textContent=p>mx?"Your price \u2192":p<mn?"\u2190 Your price":"Your price";
t.setAttribute("text-anchor",p>mx?"end":p<mn?"start":"middle")}
g.removeAttribute("display")});
qa("[data-dd-when]").forEach(function(el){if((el.getAttribute("data-dd-when")==="price")===has)el.removeAttribute("hidden");
else el.setAttribute("hidden","")})}
if(inp){inp.addEventListener("input",upd);inp.addEventListener("change",upd)}upd();
`;

/** The page's only inline script. Emit exactly as is. */
export const CLIENT_JS: string = `(function(){"use strict";${CLIENT_CORE_JS}${CLIENT_DOM_JS}})();`;

/** base64(sha256(CLIENT_JS)), for `script-src 'sha256-<this>'`. Checked by client_test.ts. */
export const CLIENT_JS_SHA256 = "8n94pzjpTpedDl2djGiF+n2vlUhMrnUx9OujKV9KyZ0=";

/** The CSP header value for the share page. */
export const SHARE_PAGE_CSP: string = `default-src 'none'; script-src 'sha256-${CLIENT_JS_SHA256}'; ` +
  "style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; " +
  "frame-ancestors 'none'";

export interface PriceTexts {
  /** P/E at the price, "25.6x", or NA_TEXT / NO_PRICE_TEXT. */
  pe: string;
  /** "+7% to the base value ($204)" / "−4% to the base value ($204)", or NA_TEXT / NO_PRICE_TEXT. */
  gap: string;
  /** Class for the gap element: "up" (base above price), "dn", or "" (rounds to 0% or no value). */
  gapClass: "" | "up" | "dn";
  /** Growth the price assumes, "3.1% a year", or NA_TEXT / NO_PRICE_TEXT. */
  implied: string;
  /** "$191.00", or "" without a price. */
  price: string;
}

const MINUS = "\u2212";
const isF = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function grp(v: number, k: number): string {
  const [i, f] = Math.abs(v).toFixed(k).split(".");
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (f ? "." + f : "");
}

const neg = (v: number, k: number): boolean => v < 0 && Number(Math.abs(v).toFixed(k)) !== 0;

/** TS twin of the client's texts(): the strings the price box shows at `price`, for the server's first render. */
export function priceTexts(data: ClientData | null, price: number | null): PriceTexts {
  const o: PriceTexts = {
    pe: NO_PRICE_TEXT,
    gap: NO_PRICE_TEXT,
    gapClass: "",
    implied: NO_PRICE_TEXT,
    price: "",
  };
  if (!isF(price) || price <= 0) return o;
  o.price = "$" + grp(price, 2);
  const eps = data?.eps;
  o.pe = isF(eps) && eps > 0 ? grp(price / eps, 1) + "x" : NA_TEXT;
  const base = data?.scenarios ? data.scenarios.base : null;
  if (isF(base)) {
    const x = (base / price - 1) * 100;
    const zero = Number(Math.abs(x).toFixed(0)) === 0;
    o.gapClass = zero ? "" : x < 0 ? "dn" : "up";
    o.gap = (zero ? "" : x < 0 ? MINUS : "+") + grp(x, 0) + "% to the base value (" +
      (neg(base, 0) ? MINUS : "") +
      "$" + grp(base, 0) + ")";
  } else o.gap = NA_TEXT;
  const g = data?.dcf ? impliedGrowth(data.dcf, price) : null;
  o.implied = g === null ? NA_TEXT : (neg(g, 1) ? MINUS : "") + grp(g, 1) + "% a year";
  return o;
}
