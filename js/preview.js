"use strict";

// ---------------- A4 sheet preview ----------------
let sheetView = false;
function addCutmarks(sheetEl) {
  const ox = (210 - 3 * 63.5) / 2, oy = (296 - 3 * 88.9) / 2;
  for (let c = 0; c <= 3; c++) for (const y of [oy - 7, oy + 3 * 88.9 + 1]) {
    const m = document.createElement("div");
    m.className = "cutmark v"; m.style.left = (ox + c * 63.5) + "mm"; m.style.top = y + "mm";
    sheetEl.appendChild(m);
  }
  for (let r = 0; r <= 3; r++) for (const x of [ox - 7, ox + 3 * 63.5 + 1]) {
    const m = document.createElement("div");
    m.className = "cutmark h"; m.style.top = (oy + r * 88.9) + "mm"; m.style.left = x + "mm";
    sheetEl.appendChild(m);
  }
}
function collectCards() {
  let ids = [...selected];
  if (!ids.length) ids = filteredSpells().map(s => s.id);
  const cards = [], appx = [];
  for (const id of ids) {
    const s = spellById(id);
    if (!s) continue;
    const r = cardsFor(s, lang);
    cards.push(...r.cards);
    if (r.appendix) appx.push(r.appendix);
  }
  return { cards, appx };
}
function toggleSheetView() {
  sheetView = !sheetView;
  document.getElementById("sheetBtn").classList.toggle("on", sheetView);
  document.getElementById("cardWrap").style.display = sheetView ? "none" : "";
  document.getElementById("zoomRow").style.display = sheetView ? "none" : "";
  if (!sheetView) {
    document.getElementById("sheetPreview")?.remove();
  }
  renderPreview();
}
function renderSheetPreview() {
  const center = document.getElementById("center");
  let host = document.getElementById("sheetPreview");
  if (!host) {
    host = document.createElement("div");
    host.id = "sheetPreview";
    center.appendChild(host);
  }
  const { cards, appx } = collectCards();
  const sheets = [];
  for (let i = 0; i < cards.length; i += 9) sheets.push(cards.slice(i, i + 9));
  host.innerHTML = sheets.map((cs, i) =>
    `<div class="sheet-caption">Bogen ${i + 1} / ${sheets.length}</div>` +
    `<div class="sheet-screen" lang="${lang}">${cs.join("")}</div>`
  ).join("") || "<div style='color:var(--muted);padding:40px'>Keine Karten ausgewählt oder gefiltert.</div>";
  host.querySelectorAll(".sheet-screen").forEach(addCutmarks);
  host.querySelectorAll(".card").forEach(fitCard);
  const note = document.getElementById("previewNote");
  note.textContent = appx.length
    ? `${cards.length} Karten auf ${sheets.length} Bögen · ${appx.length} sehr lange${appx.length === 1 ? "r" : ""} Zauber mit Anhang-Verweis`
    : (sheets.length ? `${cards.length} Karten auf ${sheets.length} ${sheets.length === 1 ? "Bogen" : "Bögen"}` : "");
  note.style.display = note.textContent ? "block" : "none";
}

function renderPreview() {
  if (sheetView) { renderSheetPreview(); return; }
  const host = document.getElementById("cardHost");
  const note = document.getElementById("previewNote");
  const s = spellById(currentId);
  if (!s) { host.innerHTML = "<div style='color:#a89f8d;padding:40px'>Keine Karte ausgewählt</div>"; note.style.display = "none"; return; }
  const res = cardsFor(s, lang);
  host.innerHTML = res.cards.join("");
  host.style.display = "flex"; host.style.gap = "6mm";
  host.querySelectorAll(".card").forEach(fitCard);
  const msgs = [];
  if (lang === "de" && !s.description.de && s.description.en) msgs.push("Kein deutscher SRD-Text vorhanden — englische Fassung wird angezeigt.");
  if (res.appendix) msgs.push("Sehr langer Zauber: Karte zeigt den Anfang, der vollständige Text landet im PDF-Anhang.");
  else if (res.abbreviated) msgs.push("Text automatisch abgekürzt (RW, TP, m …), damit er auf die Karte passt.");
  note.textContent = msgs.join(" ");
  note.style.display = msgs.length ? "block" : "none";
}

function applyZoom() {
  const z = parseFloat(document.getElementById("zoom").value);
  document.getElementById("cardWrap").style.transform = `scale(${z})`;
  document.getElementById("zoomVal").textContent = Math.round(z * 100) + "%";
}
