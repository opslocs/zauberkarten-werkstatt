"use strict";

// ---------------- card rendering ----------------
function cardLabels(s, lg) {
  return lg === "de"
    ? { time:"Zeit", range:"Reichweite", dur:"Dauer", comp:"Komp.", higher: s.level === 0 ? "Zaubertrick-Aufwertung" : "Höhere Grade", conc:"K", rit:"R" }
    : { time:"Time", range:"Range", dur:"Duration", comp:"Comp.", higher: s.level === 0 ? "Cantrip Upgrade" : "Higher Levels", conc:"C", rit:"R" };
}

function partHtml(s, lg, parasHtml, opts) {
  const { first = true, last = true, part = 1, parts = 1, appx = false } = opts || {};
  const [compShort, material] = splitComponents(TX(s.components, lg));
  const labels = cardLabels(s, lg);
  const hl = TX(s.higherLevels, lg).trim();
  const name = s.name[lg] || s.name.de || s.name.en;
  const appxText = lg === "de" ? "→ Vollständiger Text im Anhang" : "→ Full text in the appendix";
  return `
  <div class="card s-${esc(s.school.en)}" data-id="${esc(s.id)}" lang="${lg}">
    <div class="inner">
      <div class="c-head">
        <div class="glyph">${SCHOOL_GLYPH[s.school.en] || "✶"}</div>
        <h3 class="${name.length > 22 ? "long" : ""}">${esc(name)}</h3>
      </div>
      <div class="c-sub">
        <span>${esc(typeLine(s, lg))}</span>
        <span class="cls">${esc(classesLine(s, lg))}</span>
      </div>
      ${first ? `<div class="c-stats">
        <div class="c-stat"><b>${labels.time}:</b> ${esc(TX(s.castingTime, lg))}</div>
        <div class="c-stat"><b>${labels.range}:</b> ${esc(withSquares(TX(s.range, lg), txLang(s.range, lg)))}</div>
        <div class="c-stat"><b>${labels.dur}:</b> ${esc(TX(s.duration, lg))}</div>
        <div class="c-stat"><b>${labels.comp}:</b> ${esc(compShort)}</div>
        ${material ? `<div class="c-mat">M: ${esc(material)}</div>` : ""}
      </div>` : ""}
      <div class="c-body">${parasHtml}</div>
      ${appx ? `<div class="c-higher"><b>${esc(appxText)}</b></div>`
             : (last && hl ? `<div class="c-higher"><b>${labels.higher}:</b> ${md(hl)}</div>` : "")}
      <div class="c-foot">
        <span>${esc(s.source || "")}${s.custom ? " · eigene Karte" : ""}</span>
        <span class="badges">
          ${parts > 1 ? `<span class="badge">${part}/${parts}</span>` : ""}
          ${s.concentration ? `<span class="badge" title="Konzentration">${labels.conc}</span>` : ""}
          ${s.ritual ? `<span class="badge" title="Ritual">${labels.rit}</span>` : ""}
          <span class="badge">${s.level === 0 ? "0" : s.level}</span>
        </span>
      </div>
    </div>
  </div>`;
}

function descParas(s, lg) {
  return TX(s.description, lg).split(/\n\n+/).filter(p => p.trim()).map(p => `<p>${md(p)}</p>`);
}

let measureHost = null;
function getMeasureHost() {
  if (!measureHost) {
    measureHost = document.createElement("div");
    measureHost.style.cssText = "position:absolute;left:-9999px;top:0;";
    document.body.appendChild(measureHost);
  }
  return measureHost;
}
function overflows(html, sizeMm) {
  const host = getMeasureHost();
  host.innerHTML = html;
  const card = host.querySelector(".card");
  card.style.setProperty("--body-size", sizeMm + "mm");
  const body = card.querySelector(".c-body");
  return body.scrollHeight > body.clientHeight + 1;
}

function splitSentences(pHtml) {
  // split an oversized paragraph into sentence chunks (~3 sentences each)
  const inner = pHtml.replace(/^<p>|<\/p>$/g, "");
  const sentences = inner.split(/(?<=\.)\s+(?=[A-ZÄÖÜ<])/);
  const chunks = [];
  for (let i = 0; i < sentences.length; i += 3)
    chunks.push("<p>" + sentences.slice(i, i + 3).join(" ") + "</p>");
  return chunks;
}

const APPENDIX_MIN_PARTS = 3;  // spells needing this many cards go to the appendix instead

function paginateHtml(s, lg) {
  const SIZE = 2.12;
  let paras = descParas(s, lg);
  // pre-split any paragraph that alone overflows a continuation card
  paras = paras.flatMap(p => overflows(partHtml(s, lg, p, { first: false, last: false }), SIZE) ? splitSentences(p) : [p]);
  const groups = [];
  let cur = [];
  for (const p of paras) {
    cur.push(p);
    const first = groups.length === 0;
    if (overflows(partHtml(s, lg, cur.join(""), { first, last: false }), SIZE)) {
      cur.pop();
      if (cur.length === 0) { cur = [p]; continue; }  // safety
      groups.push(cur); cur = [p];
    }
  }
  if (cur.length) groups.push(cur);
  const hl = TX(s.higherLevels, lg).trim();
  if (hl && overflows(partHtml(s, lg, groups[groups.length - 1].join(""), { first: groups.length === 1, last: true }), SIZE)) {
    groups.push([]);
  }
  return groups;
}

// returns { cards: [html...], appendix?: spell, abbreviated?: bool }
function cardsFor(s, lg) {
  const single = partHtml(s, lg, descParas(s, lg).join(""), {});
  if (!overflows(single, 1.83)) return { cards: [single] };
  // 1st fallback: auto-abbreviations
  const sa = abbrevSpell(s, lg);
  const singleA = partHtml(sa, lg, descParas(sa, lg).join(""), {});
  if (!overflows(singleA, 1.83)) return { cards: [singleA], abbreviated: true };
  // 2nd: continuation cards
  const groups = paginateHtml(sa, lg);
  if (groups.length < APPENDIX_MIN_PARTS) {
    return {
      abbreviated: true,
      cards: groups.map((g, i) => partHtml(sa, lg, g.join(""), {
        first: i === 0, last: i === groups.length - 1, part: i + 1, parts: groups.length,
      })),
    };
  }
  // 3rd: really long -> teaser card + appendix (full, unabbreviated text)
  const SIZE = 2.12;
  const paras = descParas(sa, lg);
  let k = paras.length;
  while (k > 1 && overflows(partHtml(sa, lg, paras.slice(0, k).join(""), { appx: true }), SIZE)) k--;
  return { cards: [partHtml(sa, lg, paras.slice(0, k).join(""), { appx: true })], appendix: s, abbreviated: true };
}

function cardsHtml(s, lg) { return cardsFor(s, lg).cards; }
function cardHtml(s, lg) { return partHtml(s, lg, descParas(s, lg).join(""), {}); }

function fitCard(cardEl) {
  const body = cardEl.querySelector(".c-body");
  if (!body) return;
  let size = 2.55; // mm
  cardEl.style.setProperty("--body-size", size + "mm");
  let guard = 24;
  while (body.scrollHeight > body.clientHeight + 1 && size > 1.45 && guard-- > 0) {
    size -= 0.06;
    cardEl.style.setProperty("--body-size", size.toFixed(2) + "mm");
  }
  cardEl.classList.toggle("overflow-warn", body.scrollHeight > body.clientHeight + 1);
}
