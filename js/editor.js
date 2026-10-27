"use strict";

// ---------------- editor ----------------
function fld(label, id, val, big) {
  return `<label>${label}</label><textarea id="${id}" class="${big ? "big" : ""}" oninput="fieldChanged()">${esc(val || "")}</textarea>`;
}
function fldInput(label, id, val) {
  return `<label>${label}</label><input type="text" id="${id}" value="${esc(val || "")}" oninput="fieldChanged()">`;
}

function renderEditor() {
  const ed = document.getElementById("edForm");
  const s = spellById(currentId);
  if (!s) { ed.innerHTML = "<p class='hint'>Karte in der Liste anklicken oder neue Karte anlegen.</p>"; return; }
  document.getElementById("edTitle").textContent =
    (s.custom ? "Eigene Karte: " : "Karte: ") + (s.name[lang] || s.name.de || s.name.en);
  const clsBoxes = CLASSES.map(c =>
    `<label style="display:inline-flex;align-items:center;gap:4px;margin:2px 8px 2px 0;text-transform:none;font-size:12px;color:var(--ink)">
      <input type="checkbox" data-cls="${c}" ${(s.classes.de || []).includes(c) ? "checked" : ""} onchange="fieldChanged()">${c}</label>`).join("");
  ed.innerHTML = `
    <div class="grid2">
      <div>${fldInput("Name (DE)", "e_name_de", s.name.de)}</div>
      <div>${fldInput("Name (EN)", "e_name_en", s.name.en)}</div>
    </div>
    <div class="grid2">
      <div>
        <label>Grad</label>
        <select id="e_level" onchange="fieldChanged()">
          ${[0,1,2,3,4,5,6,7,8,9].map(l => `<option value="${l}" ${s.level === l ? "selected" : ""}>${l === 0 ? "Zaubertrick" : l}</option>`).join("")}
        </select>
      </div>
      <div>
        <label>Schule</label>
        <select id="e_school" onchange="fieldChanged()">
          ${SCHOOLS_EN.map(sc => `<option value="${sc}" ${s.school.en === sc ? "selected" : ""}>${SCHOOL_DE[sc]}</option>`).join("")}
        </select>
      </div>
    </div>
    <label>Klassen</label>
    <div>${clsBoxes}</div>
    <div class="grid2">
      <div>${fldInput("Zeitaufwand (DE)", "e_time_de", s.castingTime.de)}</div>
      <div>${fldInput("Casting Time (EN)", "e_time_en", s.castingTime.en)}</div>
      <div>${fldInput("Reichweite (DE)", "e_range_de", s.range.de)}</div>
      <div>${fldInput("Range (EN)", "e_range_en", s.range.en)}</div>
      <div>${fldInput("Komponenten (DE)", "e_comp_de", s.components.de)}</div>
      <div>${fldInput("Components (EN)", "e_comp_en", s.components.en)}</div>
      <div>${fldInput("Wirkungsdauer (DE)", "e_dur_de", s.duration.de)}</div>
      <div>${fldInput("Duration (EN)", "e_dur_en", s.duration.en)}</div>
    </div>
    ${fld("Beschreibung (DE) — **fett**, *kursiv*, Leerzeile = Absatz", "e_desc_de", s.description.de, true)}
    ${fld("Description (EN)", "e_desc_en", s.description.en, true)}
    ${fld("Höhere Grade / Aufwertung (DE)", "e_hl_de", s.higherLevels.de)}
    ${fld("Higher Levels (EN)", "e_hl_en", s.higherLevels.en)}
    ${fldInput("Quelle", "e_source", s.source)}
    <p class="hint">Konzentration/Ritual werden automatisch aus Wirkungsdauer und Zeitaufwand erkannt. Leere DE-Felder fallen auf den englischen Text zurück.</p>
  `;
}

let saveTimer = null;
function fieldChanged() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(applyEditor, 250);
}
function applyEditor() {
  const s = spellById(currentId);
  if (!s) return;
  const v = id => document.getElementById(id)?.value ?? "";
  s.name.de = v("e_name_de"); s.name.en = v("e_name_en");
  s.level = parseInt(v("e_level"));
  const scEn = v("e_school");
  s.school = { en: scEn, de: SCHOOL_DE[scEn] };
  const cls = [...document.querySelectorAll("#edForm [data-cls]")].filter(c => c.checked).map(c => c.dataset.cls);
  s.classes = { de: cls, en: cls.map(c => CLASS_EN[c]) };
  s.castingTime = { de: v("e_time_de"), en: v("e_time_en") };
  s.range = { de: v("e_range_de"), en: v("e_range_en") };
  s.components = { de: v("e_comp_de"), en: v("e_comp_en") };
  s.duration = { de: v("e_dur_de"), en: v("e_dur_en") };
  s.description = { de: v("e_desc_de"), en: v("e_desc_en") };
  s.higherLevels = { de: v("e_hl_de"), en: v("e_hl_en") };
  s.source = v("e_source");
  s.concentration = /^(Konzentration|Concentration)/i.test(s.duration.de + s.duration.en);
  s.ritual = /Ritual/i.test(s.castingTime.de + " " + s.castingTime.en);
  saveDb();
  renderPreview();
  renderList();
}
