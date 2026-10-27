"use strict";

// ---------------- print ----------------
function printCards() {
  let ids = [...selected];
  if (!ids.length) ids = filteredSpells().map(s => s.id);
  if (!ids.length) return alert("Keine Karten ausgewählt oder gefiltert.");
  const spells = ids.map(spellById).filter(Boolean);
  const allCards = [];
  const appxSpells = [];
  for (const s of spells) {
    const res = cardsFor(s, lang);
    allCards.push(...res.cards);
    if (res.appendix) appxSpells.push(res.appendix);
  }
  const root = document.getElementById("printRoot");
  root.innerHTML = "";
  const perPage = 9;
  for (let i = 0; i < allCards.length; i += perPage) {
    const sheet = document.createElement("div");
    sheet.className = "sheet";
    sheet.innerHTML = allCards.slice(i, i + perPage).join("");
    root.appendChild(sheet);
  }
  if (appxSpells.length) {
    const appx = document.createElement("div");
    appx.className = "appx-flow";
    appx.setAttribute("lang", lang);
    appx.innerHTML = `<h2>${lang === "de" ? "Anhang: Vollständige Zaubertexte" : "Appendix: Full Spell Texts"}</h2>` +
      appxSpells.map(s => {
        const labels = cardLabels(s, lang);
        const hl = TX(s.higherLevels, lang).trim();
        return `<h3>${esc(s.name[lang] || s.name.de || s.name.en)}</h3>
          <div class="meta">${esc(typeLine(s, lang))} · ${esc(classesLine(s, lang))}<br>
          ${labels.time}: ${esc(TX(s.castingTime, lang))} · ${labels.range}: ${esc(withSquares(TX(s.range, lang), txLang(s.range, lang)))} ·
          ${labels.dur}: ${esc(TX(s.duration, lang))} · ${labels.comp}: ${esc(TX(s.components, lang))}</div>
          ${descParas(s, lang).join("")}
          ${hl ? `<p><b>${labels.higher}:</b> ${md(hl)}</p>` : ""}`;
      }).join("");
    root.appendChild(appx);
  }
  // cut marks at the grid frame (3x4 vertical, 4x3 horizontal grid line ends)
  const ox = (210 - 3 * 63.5) / 2, oy = (296 - 3 * 88.9) / 2;
  root.querySelectorAll(".sheet").forEach(sheet => {
    for (let c = 0; c <= 3; c++) {
      for (const y of [oy - 7, oy + 3 * 88.9 + 1]) {
        const m = document.createElement("div");
        m.className = "cutmark v";
        m.style.left = (ox + c * 63.5) + "mm"; m.style.top = y + "mm";
        sheet.appendChild(m);
      }
    }
    for (let r = 0; r <= 3; r++) {
      for (const x of [ox - 7, ox + 3 * 63.5 + 1]) {
        const m = document.createElement("div");
        m.className = "cutmark h";
        m.style.top = (oy + r * 88.9) + "mm"; m.style.left = x + "mm";
        sheet.appendChild(m);
      }
    }
  });
  // fit text after sheets are in DOM (must be displayed for measurement)
  root.style.display = "block";
  root.style.position = "absolute"; root.style.left = "-9999px"; root.style.top = "0"; root.style.background = "#fff";
  requestAnimationFrame(() => {
    root.querySelectorAll(".card").forEach(fitCard);
    setTimeout(() => {
      root.style.display = ""; root.style.position = ""; root.style.left = ""; root.style.top = "";
      window.print();
    }, 60);
  });
}
