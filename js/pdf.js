"use strict";

// ---------------- PDF file export (jsPDF, vector text) ----------------
const PDF = {
  CARD_W: 63.5, CARD_H: 88.9, BORDER: 1.25,
  PT: 0.3528,                       // pt -> mm
  COLORS: {
    Evocation: [181,52,42], Abjuration: [217,126,38], Necromancy: [110,110,112],
    Transmutation: [217,168,39], Conjuration: [62,138,68], CunningActions: [110,120,70],
    Illusion: [59,107,176], Maneuver: [122,92,63], Divination: [93,163,168], Enchantment: [176,80,156],
  },
  PAPER: [240,224,189], PAPER2: [246,236,212], INK: [36,29,18], LABEL: [92,74,35], DARK: [26,23,19],
};
function pdfDarken(c, f) { return c.map(v => Math.round(v * f)); }
function pdfLighten(c, f) { return c.map(v => Math.round(v + (255 - v) * f)); }

// render a school emoji to a transparent PNG (color emoji keep their colors,
// monochrome glyphs are drawn white to sit on the dark circle)
const emojiPngCache = {};
function emojiDataUrl(ch) {
  if (emojiPngCache[ch]) return emojiPngCache[ch];
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const ctx = c.getContext("2d");
  ctx.font = "72px 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji','Segoe UI Symbol',sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(ch, 48, 54);
  return (emojiPngCache[ch] = c.toDataURL("image/png"));
}

// tokenize "**bold** and *italic*" into styled words
function pdfTokenize(text) {
  const out = [];
  let bold = false, italic = false;
  for (const chunk of (text || "").split(/(\*\*|\*)/)) {
    if (chunk === "**") { bold = !bold; continue; }
    if (chunk === "*") { italic = !italic; continue; }
    for (const w of chunk.split(/\s+/)) {
      if (w) out.push({ t: w, b: bold, i: italic });
    }
  }
  return out;
}
function pdfFont(doc, w, size) {
  doc.setFont("FiraCond", w.b && w.i ? "bolditalic" : w.b ? "bold" : w.i ? "italic" : "normal");
  doc.setFontSize(size);
}
// hyphenation break candidates for a token: [prefix-with-hyphen, rest], longest first
function breakCandidates(t, hyph) {
  const cands = [];
  for (let i = t.length - 2; i > 0; i--) {
    if (t[i] === "-") cands.push([t.slice(0, i + 1), t.slice(i + 1)]);
  }
  const m = t.match(/^([^A-Za-zÄÖÜäöüß]*)([A-Za-zÄÖÜäöüß]+)([^A-Za-zÄÖÜäöüß]*)$/);
  if (m && m[2].length >= 6) {
    const parts = hyph(m[2]);
    for (let k = parts.length - 1; k >= 1; k--) {
      cands.push([m[1] + parts.slice(0, k).join("") + "-", parts.slice(k).join("") + m[3]]);
    }
  }
  cands.sort((a, b) => b[0].length - a[0].length);
  return cands;
}
// wrap styled words to maxW (mm) at font size (pt); returns lines [{words:[{t,b,i,w}], width, spaceW, last}]
function pdfWrap(doc, words, maxW, size, hyph) {
  doc.setFontSize(size);
  doc.setFont("FiraCond", "normal");
  const spaceW = doc.getTextWidth(" ");
  const lines = [];
  let cur = [], curW = 0;
  const push = () => { if (cur.length) { lines.push({ words: cur, width: curW, spaceW }); cur = []; curW = 0; } };
  const queue = [...words];
  let guard = 8000;
  while (queue.length && guard-- > 0) {
    let w = queue.shift();
    pdfFont(doc, w, size);
    let ww = doc.getTextWidth(w.t);
    const gap = cur.length ? spaceW : 0;
    if (curW + gap + ww > maxW) {
      // fill the line with a hyphenated prefix if possible
      let placed = false;
      const room = maxW - curW - gap;
      if (hyph && room > spaceW * 4) {
        for (const [pre, rest] of breakCandidates(w.t, hyph)) {
          const pw = doc.getTextWidth(pre);
          if (pw <= room) {
            cur.push({ t: pre, b: w.b, i: w.i, w: pw });
            curW += gap + pw;
            queue.unshift({ t: rest, b: w.b, i: w.i });
            placed = true;
            break;
          }
        }
      }
      push();
      if (placed) continue;
      if (ww > maxW) {  // hard-break monster words that exceed a whole line
        let piece = "";
        for (const ch of w.t) {
          if (doc.getTextWidth(piece + ch) > maxW - 1 && piece) {
            lines.push({ words: [{ t: piece, b: w.b, i: w.i, w: doc.getTextWidth(piece) }], width: doc.getTextWidth(piece), spaceW });
            piece = "";
          }
          piece += ch;
        }
        w = { t: piece, b: w.b, i: w.i };
        ww = doc.getTextWidth(piece);
      }
    }
    cur.push({ ...w, w: ww });
    curW += (cur.length > 1 ? spaceW : 0) + ww;
  }
  push();
  if (lines.length) lines[lines.length - 1].last = true;
  return lines;
}
// draw wrapped lines at (x,y), justified to maxW except last line; returns new y
function pdfDrawLines(doc, lines, x, y, maxW, size, lh, color, justify) {
  doc.setTextColor(...color);
  for (const line of lines) {
    let gap = line.spaceW;
    if (justify && !line.last && line.words.length > 1) {
      const extra = (maxW - line.width) / (line.words.length - 1);
      if (extra > 0 && extra < line.spaceW * 2.2) gap = line.spaceW + extra;
    }
    let cx = x;
    for (const w of line.words) {
      pdfFont(doc, w, size);
      doc.text(w.t, cx, y, { baseline: "top" });
      cx += w.w + gap;
    }
    y += lh;
  }
  return y;
}

// pre-layout a spell: computes sizes/blocks; returns {size, subH, statsH, hlH, parts:[{items,first,last,appx?}], appendix?, abbreviated?}
const PDF_APPX_H = 4.2;  // height of the "→ Anhang" bar
function pdfLayoutSpell(doc, s, lg) {
  const hyph = hyphFor(lg);
  const innerW = PDF.CARD_W - 2 * PDF.BORDER;
  const innerH = PDF.CARD_H - 2 * PDF.BORDER;
  const contentW = innerW - 3.6;                        // 1.8mm side padding
  const labels = cardLabels(s, lg);
  const headH = 6.0, footH = 2.7, bodyPadV = 1.8;

  // sub bar: type left, classes right
  const typeStr = typeLine(s, lg), clsStr = classesLine(s, lg);
  doc.setFont("FiraCond", "normal"); doc.setFontSize(5.4);
  const typeW = doc.getTextWidth(typeStr);
  const clsLines = pdfWrap(doc, pdfTokenize(clsStr), Math.max(contentW - typeW - 3, contentW * 0.42), 5.4);
  const subRows = Math.max(1, clsLines.length);
  const subH = subRows * 2.25 + 0.8;

  // stats block (first card only), labels inline: "**Zeit:** Aktion"
  const [compShort, material] = splitComponents(TX(s.components, lg));
  const colW = contentW / 2 - 1;
  const cells = [
    [labels.time, TX(s.castingTime, lg)], [labels.range, withSquares(TX(s.range, lg), txLang(s.range, lg))],
    [labels.dur, TX(s.duration, lg)], [labels.comp, compShort],
  ].map(([lab, val]) => ({
    lines: pdfWrap(doc, [{ t: lab + ":", b: true, i: false }, ...pdfTokenize(val)], colW, 5.4, hyph),
  }));
  const row1 = Math.max(cells[0].lines.length, cells[1].lines.length);
  const row2 = Math.max(cells[2].lines.length, cells[3].lines.length);
  const matLines = material ? pdfWrap(doc, pdfTokenize("M: " + material), contentW, 4.8, hyph) : [];
  const statsH = 1.1 + row1 * 1.95 + 0.5 + row2 * 1.95 + (matLines.length ? matLines.length * 1.85 + 0.5 : 0) + 0.8;

  const build = sx => {
    const hlTxt = TX(sx.higherLevels, lg).trim();
    const hlLines = hlTxt ? pdfWrap(doc, pdfTokenize("**" + labels.higher + ":** " + hlTxt), contentW, 5.2, hyph) : [];
    const hlH = hlLines.length ? hlLines.length * 2.2 + 1.6 : 0;
    const paras = TX(sx.description, lg).split(/\n\n+/).filter(p => p.trim());
    return { hlLines, hlH, paras };
  };
  const capOf = (first, last, hlH, appx) =>
    innerH - headH - subH - footH - bodyPadV - (first ? statsH : 0) - (last ? hlH : 0) - (appx ? PDF_APPX_H : 0);
  const layoutAt = (paras, size) => {
    const lh = size * PDF.PT * 1.24;
    const pg = size * PDF.PT * 0.55;
    const items = [];
    paras.forEach((p, pi) => {
      const lines = pdfWrap(doc, pdfTokenize(p), contentW, size, hyph);
      lines.forEach((ln, li) => items.push({ ln, gapBefore: li === 0 && pi > 0 ? pg : 0, h: lh }));
    });
    return { items, lh };
  };
  const common = { subH, statsH, cells, matLines, clsLines, typeStr, headH, footH };

  // 1) single card: raw text first, then abbreviated
  for (const sx of [s, abbrevSpell(s, lg)]) {
    const B = build(sx);
    for (let size = 7.0; size >= 5.2; size -= 0.2) {
      const { items, lh } = layoutAt(B.paras, size);
      const h = items.reduce((a, it) => a + it.h + it.gapBefore, 0);
      if (h <= capOf(true, true, B.hlH, false)) {
        return { ...common, size, lh, hlLines: B.hlLines, hlH: B.hlH, abbreviated: sx !== s,
                 parts: [{ items, first: true, last: true }] };
      }
    }
  }
  // 2) continuation cards (abbreviated text)
  const sa = abbrevSpell(s, lg);
  const B = build(sa);
  const size = 6.0;
  const { items, lh } = layoutAt(B.paras, size);
  const parts = [];
  let cur = [], curH = 0;
  for (const it of items) {
    const first = parts.length === 0;
    const cap = capOf(first, false, 0, false);
    const add = it.h + (cur.length ? it.gapBefore : 0);
    if (curH + add > cap && cur.length) { parts.push({ items: cur, first, last: false }); cur = []; curH = 0; }
    cur.push(it); curH += cur.length === 1 ? it.h : add;
  }
  if (cur.length) parts.push({ items: cur, first: parts.length === 0, last: false });
  const lastCap = capOf(parts.length === 1, true, B.hlH, false);
  const lastH = parts[parts.length - 1].items.reduce((a, it, i) => a + it.h + (i ? it.gapBefore : 0), 0);
  if (B.hlH && lastH > lastCap) parts.push({ items: [], first: false, last: true });
  parts[parts.length - 1].last = true;
  if (parts.length < APPENDIX_MIN_PARTS) {
    return { ...common, size, lh, hlLines: B.hlLines, hlH: B.hlH, abbreviated: true, parts };
  }
  // 3) really long: teaser card + full text in the appendix
  const cap = capOf(true, false, 0, true);
  const teaser = [];
  let th = 0;
  for (const it of items) {
    const add = it.h + (teaser.length ? it.gapBefore : 0);
    if (th + add > cap) break;
    teaser.push(it); th += add;
  }
  return { ...common, size, lh, hlLines: [], hlH: 0, abbreviated: true, appendix: true,
           parts: [{ items: teaser, first: true, last: false, appx: true }] };
}

function pdfDrawCard(doc, s, lg, L, part, partIdx, x, y) {
  const col = PDF.COLORS[s.school.en] || [100,100,100];
  const colDark = pdfDarken(col, 0.72);
  const labels = cardLabels(s, lg);
  const bx = x + PDF.BORDER, by = y + PDF.BORDER;
  const innerW = PDF.CARD_W - 2 * PDF.BORDER, innerH = PDF.CARD_H - 2 * PDF.BORDER;
  const cx = bx + 2, contentW = innerW - 4;

  // frame + paper
  doc.setFillColor(...PDF.DARK);
  doc.roundedRect(x, y, PDF.CARD_W, PDF.CARD_H, 3.2, 3.2, "F");
  doc.setFillColor(...PDF.PAPER);
  doc.roundedRect(bx, by, innerW, innerH, 2, 2, "F");

  // header
  doc.setFillColor(...col);
  doc.roundedRect(bx, by, innerW, L.headH + 2, 2, 2, "F");
  doc.rect(bx, by + L.headH - 1, innerW, 1, "F"); // square off bottom
  doc.setFillColor(...pdfDarken(col, 0.55));
  doc.circle(bx + 4.4, by + L.headH / 2, 2.2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("FiraCond", "bold");
  doc.setFontSize(8);
  try {
    doc.addImage(emojiDataUrl(SCHOOL_GLYPH[s.school.en] || "✶"), "PNG",
                 bx + 4.4 - 1.75, by + L.headH / 2 - 1.75, 3.5, 3.5);
  } catch (e) {  // fallback: school initial
    doc.text((s.school.en || "?")[0], bx + 4.4, by + L.headH / 2, { align: "center", baseline: "middle" });
  }
  const name = s.name[lg] || s.name.de;
  let nameSize = 11.5;
  doc.setFontSize(nameSize);
  while (doc.getTextWidth(name) > contentW - 8 && nameSize > 6.5) { nameSize -= 0.5; doc.setFontSize(nameSize); }
  doc.text(name, bx + 7.8, by + L.headH / 2, { baseline: "middle" });

  let cy = by + L.headH;
  // sub bar
  doc.setFillColor(...colDark);
  doc.rect(bx, cy, innerW, L.subH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("FiraCond", "normal"); doc.setFontSize(5.4);
  doc.text(L.typeStr, cx, cy + 0.6, { baseline: "top" });
  let ry = cy + 0.6;
  for (const ln of L.clsLines) {
    const str = ln.words.map(w => w.t).join(" ");
    doc.text(str, bx + innerW - 1.8, ry, { align: "right", baseline: "top" });
    ry += 2.25;
  }
  cy += L.subH;

  // stats (first card) — inline bold labels
  if (part.first) {
    doc.setFillColor(...PDF.PAPER2);
    doc.rect(bx, cy, innerW, L.statsH, "F");
    doc.setDrawColor(120, 105, 70); doc.setLineWidth(0.15);
    doc.line(bx, cy + L.statsH, bx + innerW, cy + L.statsH);
    const colW = contentW / 2 - 1;
    let sy = cy + 1.1;
    for (const rowIdx of [0, 1]) {
      const rowCells = L.cells.slice(rowIdx * 2, rowIdx * 2 + 2);
      let rowH = 0;
      rowCells.forEach((cell, ci) => {
        const cxx = cx + ci * (colW + 2);
        const yAfter = pdfDrawLines(doc, cell.lines, cxx, sy, colW, 5.4, 1.95, PDF.INK, false);
        rowH = Math.max(rowH, yAfter - sy);
      });
      sy += rowH + 0.5;
    }
    if (L.matLines.length) {
      pdfDrawLines(doc, L.matLines, cx, sy, contentW, 4.8, 1.85, [107, 90, 51], false);
    }
    cy += L.statsH;
  }

  // body
  let byy = cy + 1.0;
  for (const it of part.items) {
    byy += it.gapBefore;
    byy = pdfDrawLines(doc, [it.ln], cx, byy, contentW, L.size, L.lh, PDF.INK, true);
  }

  // higher levels / appendix bar (last card), anchored above foot
  const footY = y + PDF.CARD_H - PDF.BORDER - L.footH;
  if (part.appx) {
    const abY = footY - PDF_APPX_H;
    doc.setFillColor(...col);
    doc.rect(bx, abY, innerW, PDF_APPX_H, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("FiraCond", "bold"); doc.setFontSize(5.4);
    const txt = (lg === "de" ? "→ Vollständiger Text: Anhang" : "→ Full text: appendix")
      + (L.appxPage ? (lg === "de" ? `, S. ${L.appxPage}` : `, p. ${L.appxPage}`) : "");
    doc.text(txt, cx, abY + PDF_APPX_H / 2, { baseline: "middle" });
  } else if (part.last && L.hlH) {
    const hlY = footY - L.hlH;
    doc.setFillColor(...col);
    doc.rect(bx, hlY, innerW, L.hlH, "F");
    pdfDrawLines(doc, L.hlLines, cx, hlY + 0.85, contentW, 5.2, 2.2, [255, 255, 255], false);
  }

  // foot
  doc.setFillColor(...colDark);
  doc.rect(bx, footY, innerW, L.footH, "F");
  doc.rect(bx, footY + L.footH - 2, innerW, 2, "F");
  doc.setFillColor(...PDF.DARK);  // re-round bottom corners
  doc.setTextColor(255, 255, 255);
  doc.setFont("FiraCond", "normal"); doc.setFontSize(4.6);
  doc.text((s.source || "") + (s.custom ? " · eigene Karte" : ""), cx, footY + L.footH / 2, { baseline: "middle" });
  // badges right
  const badges = [];
  if (L.parts.length > 1) badges.push(`${partIdx + 1}/${L.parts.length}`);
  if (s.concentration) badges.push(lg === "de" ? "K" : "C");
  if (s.ritual) badges.push("R");
  badges.push(String(s.level));
  let bxr = bx + innerW - 2;
  doc.setFont("FiraCond", "bold"); doc.setFontSize(4.8);
  for (const b of badges.reverse()) {
    const bw = Math.max(doc.getTextWidth(b) + 1.6, 3);
    bxr -= bw;
    doc.setFillColor(...pdfLighten(colDark, 0.25));
    doc.roundedRect(bxr, footY + 0.55, bw, L.footH - 1.6, 0.8, 0.8, "F");
    doc.setTextColor(255, 255, 255);
    doc.text(b, bxr + bw / 2, footY + L.footH / 2 - 0.25, { align: "center", baseline: "middle" });
    bxr -= 1;
  }
}

// lay out appendix (full spell texts) in 2-column A4 pages; assigns L.appxPage
function pdfLayoutAppendix(doc, appxList, lg, cardPages) {
  const hyph = hyphFor(lg);
  const M = 14, colGap = 7, colW = (210 - 2 * M - colGap) / 2;
  const top = 16, bottom = 283;
  const items = [];  // {page, draw(doc)}
  let page = 0, col = 0, y = 24;  // page 0 leaves room for the title
  const colX = () => M + col * (colW + colGap);
  const advance = h => {
    if (y + h > bottom) {
      col++;
      if (col > 1) { col = 0; page++; }
      y = page === 0 ? 24 : top;
    }
  };
  items.push({ page: 0, draw: d => {
    d.setTextColor(0, 0, 0); d.setFont("FiraCond", "bold"); d.setFontSize(13);
    d.text(lg === "de" ? "Anhang: Vollständige Zaubertexte" : "Appendix: Full Spell Texts", M, top, { baseline: "top" });
  }});
  for (const { s, L } of appxList) {
    const labels = cardLabels(s, lg);
    const metaStr = typeLine(s, lg) + " · " + classesLine(s, lg);
    const statsStr = `${labels.time}: ${TX(s.castingTime, lg)} · ${labels.range}: ${withSquares(TX(s.range, lg), txLang(s.range, lg))} · ` +
                     `${labels.dur}: ${TX(s.duration, lg)} · ${labels.comp}: ${TX(s.components, lg)}`;
    const metaLines = pdfWrap(doc, pdfTokenize(metaStr), colW, 7.2, hyph);
    const statsLines = pdfWrap(doc, pdfTokenize(statsStr), colW, 7.2, hyph);
    const headH = 5 + (metaLines.length + statsLines.length) * 2.9 + 1.5;
    advance(headH + 8);  // keep title with some body
    L.appxPage = cardPages + 1 + page;
    const hx = colX(), hy = y;
    items.push({ page, draw: d => {
      d.setTextColor(0, 0, 0); d.setFont("FiraCond", "bold"); d.setFontSize(10.5);
      d.text(s.name[lg] || s.name.de, hx, hy, { baseline: "top" });
      let yy = hy + 5;
      for (const ln of metaLines) {
        d.setFont("FiraCond", "italic"); d.setFontSize(7.2); d.setTextColor(80, 80, 80);
        d.text(ln.words.map(w => w.t).join(" "), hx, yy, { baseline: "top" });
        yy += 2.9;
      }
      yy = pdfDrawLines(d, statsLines, hx, yy, colW, 7.2, 2.9, [50, 50, 50], false);
    }});
    y += headH;
    const size = 8.2, lh = size * PDF.PT * 1.3, pg = 1.6;
    const paras = TX(s.description, lg).split(/\n\n+/).filter(p => p.trim());
    const hl = TX(s.higherLevels, lg).trim();
    if (hl) paras.push("**" + labels.higher + ":** " + hl);
    paras.forEach((p, pi) => {
      if (pi > 0) y += pg;
      const lines = pdfWrap(doc, pdfTokenize(p), colW, size, hyph);
      for (const ln of lines) {
        advance(lh);
        const lx = colX(), ly = y;
        items.push({ page, draw: d => pdfDrawLines(d, [ln], lx, ly, colW, size, lh, [0, 0, 0], true) });
        y += lh;
      }
    });
    y += 4;
  }
  return { items, pages: page + 1 };
}

function exportPdf() {
  let ids = [...selected];
  if (!ids.length) ids = filteredSpells().map(s => s.id);
  if (!ids.length) return alert("Keine Karten ausgewählt oder gefiltert.");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  window.registerCardFonts(doc);

  // pass 1: layout all spells, collect appendix spells
  const flat = [], appxList = [];
  for (const id of ids) {
    const s = spellById(id);
    if (!s) continue;
    const L = pdfLayoutSpell(doc, s, lang);
    if (L.appendix) appxList.push({ s, L });
    L.parts.forEach((part, i) => flat.push({ s, L, part, i }));
  }
  const cardPages = Math.max(1, Math.ceil(flat.length / 9));

  // pass 2: appendix layout (assigns page numbers used on the teaser cards)
  let appx = { items: [], pages: 0 };
  if (appxList.length) appx = pdfLayoutAppendix(doc, appxList, lang, cardPages);

  // pass 3: draw card sheets
  const ox = (210 - 3 * PDF.CARD_W) / 2, oy = (297 - 3 * PDF.CARD_H) / 2;
  flat.forEach((item, idx) => {
    const pos = idx % 9;
    if (idx > 0 && pos === 0) doc.addPage();
    if (pos === 0) {
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.12);
      for (let c = 0; c <= 3; c++) {
        const mx = ox + c * PDF.CARD_W;
        doc.line(mx, oy - 7, mx, oy - 2);
        doc.line(mx, oy + 3 * PDF.CARD_H + 2, mx, oy + 3 * PDF.CARD_H + 7);
      }
      for (let r = 0; r <= 3; r++) {
        const my = oy + r * PDF.CARD_H;
        doc.line(ox - 7, my, ox - 2, my);
        doc.line(ox + 3 * PDF.CARD_W + 2, my, ox + 3 * PDF.CARD_W + 7, my);
      }
    }
    const gx = ox + (pos % 3) * PDF.CARD_W, gy = oy + Math.floor(pos / 3) * PDF.CARD_H;
    pdfDrawCard(doc, item.s, lang, item.L, item.part, item.i, gx, gy);
  });

  // pass 4: appendix pages
  let curAppxPage = -1;
  for (const it of appx.items) {
    while (curAppxPage < it.page) { doc.addPage(); curAppxPage++; }
    doc.setPage(cardPages + 1 + it.page);
    it.draw(doc);
  }

  const date = new Date().toISOString().slice(0, 10);
  doc.save(`zauberkarten-${date}.pdf`);
}
