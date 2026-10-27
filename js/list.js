"use strict";

// ---------------- list ----------------
function initFilters() {
  const fc = document.getElementById("fClass");
  CLASSES.forEach(c => fc.append(new Option(c, c)));
  const fs = document.getElementById("fSchool");
  SCHOOLS_EN.forEach(sc => fs.append(new Option(SCHOOL_DE[sc] + " / " + sc, sc)));
  const fq = document.getElementById("fSrc");
  [...new Set(db.spells.map(s => s.source).filter(Boolean))].forEach(s => fq.append(new Option(s, s)));
}

function filteredSpells() {
  const q = document.getElementById("q").value.trim().toLowerCase();
  const fl = document.getElementById("fLevel").value;
  const fc = document.getElementById("fClass").value;
  const fs = document.getElementById("fSchool").value;
  const fsel = document.getElementById("fSel").value;
  const fq = document.getElementById("fSrc").value;
  return db.spells.filter(s => {
    if (q && !((s.name.de || "").toLowerCase().includes(q) || (s.name.en || "").toLowerCase().includes(q)
        || (s.aka || "").toLowerCase().includes(q))) return false;
    if (fl !== "" && s.level !== parseInt(fl)) return false;
    if (fc && !(s.classes.de || []).includes(fc)) return false;
    if (fs && s.school.en !== fs) return false;
    if (fq && s.source !== fq) return false;
    if (fsel === "sel" && !selected.has(s.id)) return false;
    if (fsel === "custom" && !s.custom) return false;
    return true;
  });
}

function renderList() {
  const list = document.getElementById("spellList");
  const spells = filteredSpells();
  let html = "", lastLvl = null;
  for (const s of spells) {
    if (s.level !== lastLvl) {
      lastLvl = s.level;
      html += `<div class="lvl-group">${s.level === 0 ? "Zaubertricks" : "Grad " + s.level}</div>`;
    }
    html += `
    <div class="spell-item ${s.id === currentId ? "active" : ""} ${s.custom ? "custom" : ""}" data-id="${esc(s.id)}">
      <input type="checkbox" ${selected.has(s.id) ? "checked" : ""} onclick="event.stopPropagation(); toggleSel('${esc(s.id)}', this.checked)">
      <span class="nm">${esc(s.name[lang] || s.name.de || s.name.en)}</span>
      <span class="tag">${esc((s.school.de || "").slice(0, 4))}</span>
    </div>`;
  }
  list.innerHTML = html || "<div style='padding:16px;color:var(--muted)'>Keine Treffer</div>";
  list.querySelectorAll(".spell-item").forEach(el => el.onclick = () => selectSpell(el.dataset.id));
  document.getElementById("counts").textContent =
    `${spells.length} Karten · ${selected.size} ausgewählt`;
}

function toggleSel(id, on) {
  on ? selected.add(id) : selected.delete(id);
  document.getElementById("counts").textContent =
    `${filteredSpells().length} Karten · ${selected.size} ausgewählt`;
  if (sheetView) renderPreview();
}
function selectFiltered(on) {
  filteredSpells().forEach(s => on ? selected.add(s.id) : selected.delete(s.id));
  renderList();
  if (sheetView) renderPreview();
}

function selectSpell(id) {
  currentId = id;
  renderList(); renderPreview(); renderEditor();
}
