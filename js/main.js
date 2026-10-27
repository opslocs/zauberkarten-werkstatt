"use strict";

// ---------------- init ----------------
(async function init() {
  try {
    await loadDb();
  } catch (e) {
    alert("spells.json konnte nicht geladen werden. Bitte die Seite über einen Webserver öffnen (z. B. python3 -m http.server).");
    console.error(e);
    return;
  }
  initFilters();
  sortSpells();
  renderList();
  applyZoom();
  if (db.spells.length) selectSpell(db.spells[0].id);
  // re-measure once the card font is loaded (pagination depends on real metrics)
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => renderPreview());
})();
