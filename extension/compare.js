/* global HSCompare, Sortable */

(function () {
  function loadSortable() {
    return new Promise((resolve, reject) => {
      if (typeof Sortable !== "undefined") {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("vendor/Sortable.min.js");
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Failed to load Sortable.js from extension"));
      document.head.appendChild(script);
    });
  }

  let data = {
    urls: [],
    properties: {},
    settings: HSCompare.defaultSettings(),
    tableColumns: HSCompare.TABLE_COLUMNS,
    exportColumns: HSCompare.EXPORT_COLUMNS,
    columnLabels: HSCompare.COLUMN_LABELS,
    generated: "",
  };
  const selectedKeys = new Set();

  const ICON_EXTERNAL =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
  const ICON_REFRESH =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.8 1.1 6.4 2.8L21 8"/><path d="M21 3v5h-5"/></svg>';
  const ICON_GRIP =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>';
  const ICON_MAP =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';

  const TABLE_COLS = () => data.tableColumns;
  const EXPORT_COLS = () => data.exportColumns;
  const COLUMN_LABELS = () => data.columnLabels;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function urlAttrKey(key) {
    return encodeURIComponent(String(key || ""));
  }

  function urlFromAttr(attr) {
    if (!attr) return "";
    try {
      return decodeURIComponent(attr);
    } catch (_) {
      return attr;
    }
  }

  function setButtonLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle("is-loading", loading);
  }

  function toast(msg, isError) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.style.background = isError ? "#c0392b" : "#1a2332";
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 4500);
  }

  function rowForKey(key) {
    return data.properties[key] || null;
  }

  function percentHighlightClass(val, threshold, cssClass, op) {
    const m = String(val).match(/([\d.]+)/);
    if (!m) return "";
    const n = parseFloat(m[1]);
    if (!Number.isFinite(n)) return "";
    const hit = op === "lt" ? n < threshold : n > threshold;
    return hit ? ` ${cssClass}` : "";
  }

  function lowIncomeHighlightClass(val) {
    return percentHighlightClass(val, 10, "cell-low-income-high", "gt");
  }
  function rentersHighlightClass(val) {
    return percentHighlightClass(val, 30, "cell-renters-high", "gt");
  }
  function householdsChildrenHighlightClass(val) {
    return percentHighlightClass(val, 40, "cell-households-children-low", "lt");
  }
  function parseDollarAmount(val) {
    const digits = String(val).replace(/[^0-9.]/g, "");
    if (!digits) return NaN;
    return parseFloat(digits);
  }
  function householdIncomeHighlightClass(val) {
    const n = parseDollarAmount(val);
    return Number.isFinite(n) && n < 100000 ? " cell-income-low" : "";
  }

  function propertyCoords(row) {
    const maps = row.google_maps || "";
    const m = maps.match(/query=([\d.-]+),([\d.-]+)/);
    if (!m) return null;
    const lat = parseFloat(m[1]);
    const lon = parseFloat(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return [lat, lon];
  }

  async function getOfficeCoords() {
    const stored = await HSCompare.loadAll();
    let office = stored.settings?.officeCoords;
    if (!office) {
      office = await HSCompare.geocodeOffice(stored.settings?.officeAddress);
      if (office) {
        stored.settings.officeCoords = office;
        await HSCompare.saveAll(stored);
        data.settings = stored.settings;
      }
    }
    return office;
  }

  async function refreshDriveTimeForKey(attrKey) {
    const key =
      HSCompare.resolveStoredUrlKey(data.urls, urlFromAttr(attrKey)) ||
      urlFromAttr(attrKey);
    const row = rowForKey(key);
    if (!row) return { ok: false, error: "Property not found" };

    const coords = propertyCoords(row);
    if (!coords) {
      return {
        ok: false,
        error: "No map coordinates for this property",
      };
    }

    const office = await getOfficeCoords();
    if (!office) {
      return { ok: false, error: "Could not geocode office address" };
    }

    const drive = await HSCompare.osrmDriveTime(
      coords[0],
      coords[1],
      office[0],
      office[1]
    );
    if (!drive) {
      return { ok: false, error: "Could not calculate drive time" };
    }

    const stored = await HSCompare.loadAll();
    const saveKey = HSCompare.resolveStoredUrlKey(stored.urls, key) || key;
    if (!stored.properties[saveKey]) {
      return { ok: false, error: "Property not found" };
    }
    stored.properties[saveKey].drive_to_office = drive;
    await HSCompare.saveAll(stored);
    data.properties[saveKey] = stored.properties[saveKey];
    return { ok: true, drive, key: saveKey };
  }

  function driveToOfficeCell(key, row) {
    const val = String(row.drive_to_office ?? "").trim();
    if (val) {
      return { cellClass: "col-drive_to_office", inner: esc(val) };
    }
    return {
      cellClass: "cell-empty col-drive_to_office",
      inner: `<button type="button" class="btn-drive-refresh" data-url="${urlAttrKey(key)}" title="Calculate drive to office" aria-label="Calculate drive to office">${ICON_REFRESH}</button>`,
    };
  }

  function photoCell(row) {
    const src = row.photo || "";
    if (!src) return '<span class="no-photo">No photo</span>';
    return `<img class="listing-photo" src="${esc(src)}" alt="Listing photo" loading="lazy" />`;
  }

  function selectCell(key) {
    const checked = selectedKeys.has(key) ? " checked" : "";
    return `<td class="col-select"><input type="checkbox" class="select-checkbox" data-url="${esc(key)}"${checked} aria-label="Select for export" /></td>`;
  }

  function viewedCell(key, row) {
    const checked = row.viewed ? " checked" : "";
    return `<td class="col-viewed"><input type="checkbox" class="viewed-checkbox" data-url="${esc(key)}"${checked} aria-label="Mark as viewed" /></td>`;
  }

  function updateExportUi() {
    const n = selectedKeys.size;
    const countEl = document.getElementById("selected-count");
    const exportBtn = document.getElementById("export-selected-btn");
    const deleteBtn = document.getElementById("delete-selected-btn");
    if (countEl) countEl.textContent = n === 1 ? "1 selected" : `${n} selected`;
    if (exportBtn) exportBtn.disabled = n === 0;
    if (deleteBtn) deleteBtn.disabled = n === 0;
    const tbody = document.getElementById("compare-body");
    if (tbody) {
      tbody.querySelectorAll("tr.compare-row").forEach((tr) => {
        const key = urlFromAttr(tr.getAttribute("data-url-key"));
        tr.classList.toggle("is-selected", key && selectedKeys.has(key));
      });
    }
    const selectAll = document.getElementById("select-all-checkbox");
    if (selectAll) {
      const keys = data.urls.filter((k) => rowForKey(k));
      const all = keys.length > 0 && keys.every((k) => selectedKeys.has(k));
      const some = keys.some((k) => selectedKeys.has(k));
      selectAll.checked = all;
      selectAll.indeterminate = some && !all;
    }
  }

  function csvEscape(val) {
    const s = String(val ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function exportValue(row, col) {
    if (col === "viewed") return row.viewed ? "yes" : "";
    return row[col] ?? "";
  }

  function exportSelectedCsv() {
    const keys = data.urls.filter((k) => selectedKeys.has(k) && rowForKey(k));
    if (!keys.length) {
      toast("Select at least one property", true);
      return;
    }
    const cols = EXPORT_COLS();
    const labels = COLUMN_LABELS();
    const header = cols.map((c) => labels[c] || HSCompare.columnLabel(c));
    const lines = [header.map(csvEscape).join(",")];
    for (const key of keys) {
      const row = rowForKey(key);
      lines.push(cols.map((c) => csvEscape(exportValue(row, c))).join(","));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const stamp = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `housesigma-selected-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast(`Exported ${keys.length} propert${keys.length === 1 ? "y" : "ies"}`);
  }

  function renderTableHead() {
    const head = document.getElementById("compare-head");
    const labels = COLUMN_LABELS();
    let html = [
      `<th class="col-select"><input type="checkbox" id="select-all-checkbox" aria-label="Select all" /></th>`,
      `<th class="col-viewed">Viewed</th>`,
      `<th class="col-drag"></th>`,
      `<th class="col-photo">Photo</th>`,
      `<th class="col-property">Property</th>`,
      `<th class="col-map">Map</th>`,
    ];
    for (const col of TABLE_COLS()) {
      html.push(
        `<th class="col-${col}">${esc(labels[col] || HSCompare.columnLabel(col))}</th>`
      );
    }
    head.innerHTML = html.join("");
    const selectAll = document.getElementById("select-all-checkbox");
    if (selectAll) {
      selectAll.addEventListener("change", () => {
        const keys = data.urls.filter((k) => rowForKey(k));
        if (selectAll.checked) keys.forEach((k) => selectedKeys.add(k));
        else keys.forEach((k) => selectedKeys.delete(k));
        renderTable(data.urls);
      });
    }
  }

  function renderTable(urls) {
    const tbody = document.getElementById("compare-body");
    const colSpan = 6 + TABLE_COLS().length;
    const rows = urls
      .map((key) => {
        const row = rowForKey(key);
        if (!row) return "";
        const title = row.address || row.url || key;
        const propLink = `<a class="property-link" href="${esc(row.url || key)}" target="_blank" rel="noopener">${esc(title)} ${ICON_EXTERNAL}</a>`;
        const maps = row.google_maps
          ? `<a class="map-link" href="${esc(row.google_maps)}" target="_blank" rel="noopener">${ICON_MAP}<span>Map</span></a>`
          : '<span class="cell-empty">—</span>';
        const selectedClass = selectedKeys.has(key) ? " is-selected" : "";
        let tds = [
          selectCell(key),
          viewedCell(key, row),
          `<td class="col-drag"><span class="drag-handle" title="Drag to reorder">${ICON_GRIP}</span></td>`,
          `<td class="col-photo">${photoCell(row)}</td>`,
          `<td class="col-property">${propLink}</td>`,
          `<td class="col-map">${maps}</td>`,
        ];
        for (const col of TABLE_COLS()) {
          const val = row[col] ?? "";
          let cellClass = String(val).trim() ? "" : "cell-empty";
          if (col === "low_income") cellClass += lowIncomeHighlightClass(val);
          if (col === "renters") cellClass += rentersHighlightClass(val);
          if (col === "households_with_children") {
            cellClass += householdsChildrenHighlightClass(val);
          }
          if (col === "average_household_income") {
            cellClass += householdIncomeHighlightClass(val);
          }
          let inner;
          if (col === "drive_to_office") {
            const driveCell = driveToOfficeCell(key, row);
            cellClass = driveCell.cellClass;
            inner = driveCell.inner;
          } else if (col === "transit_to_office" && String(val).startsWith("http")) {
            inner = `<a class="property-link" href="${esc(val)}" target="_blank" rel="noopener">Plan transit ${ICON_EXTERNAL}</a>`;
          } else {
            inner = esc(val);
          }
          tds.push(`<td class="${cellClass.trim()} col-${col}">${inner}</td>`);
        }
        return `<tr class="compare-row${selectedClass}" data-url-key="${urlAttrKey(key)}">${tds.join("")}</tr>`;
      })
      .join("");
    tbody.innerHTML =
      rows || `<tr><td colspan="${colSpan}">No properties. Add listings from the extension popup on HouseSigma.</td></tr>`;
    setupSortable();
    updateExportUi();
  }

  function renderAll() {
    renderTable(data.urls);
    document.getElementById("prop-count").textContent = String(data.urls.length);
    document.getElementById("generated").textContent =
      "Updated " + (data.generated || "—");
  }

  async function applyPayload(payload) {
    if (!payload) return;
    data.urls = payload.urls || data.urls;
    data.properties = payload.properties || data.properties;
    if (payload.generated) data.generated = payload.generated;
    if (payload.settings) data.settings = payload.settings;
    const valid = new Set(data.urls);
    for (const key of [...selectedKeys]) {
      if (!valid.has(key)) selectedKeys.delete(key);
    }
    renderAll();
  }

  async function reload() {
    const payload = await HSCompare.buildAppData();
    await applyPayload(payload);
  }

  function setupSortable() {
    const tbody = document.getElementById("compare-body");
    if (!tbody) return;
    if (typeof Sortable === "undefined") {
      console.warn("Sortable.js not loaded — drag reorder disabled");
      return;
    }
    if (tbody.sortable) tbody.sortable.destroy();
    tbody.sortable = Sortable.create(tbody, {
      handle: ".drag-handle",
      draggable: "tr.compare-row",
      animation: 150,
      ghostClass: "sortable-ghost",
      chosenClass: "sortable-chosen",
      onEnd: async () => {
        const order = [...tbody.querySelectorAll("tr.compare-row")]
          .map((tr) => urlFromAttr(tr.getAttribute("data-url-key")))
          .filter(Boolean);
        if (!order.length) return;
        try {
          const res = await HSCompare.reorderUrls(order);
          if (res.ok) {
            data.urls = res.urls;
            toast("Order saved");
          } else {
            toast("Could not save order", true);
            await reload();
          }
        } catch (e) {
          toast(String(e.message || e), true);
          await reload();
        }
      },
    });
  }

  function downloadJson(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  document.getElementById("export-selected-btn").addEventListener("click", exportSelectedCsv);

  document
    .getElementById("delete-selected-btn")
    .addEventListener("click", async () => {
      const keys = data.urls.filter((k) => selectedKeys.has(k) && rowForKey(k));
      if (!keys.length) {
        toast("Select at least one property", true);
        return;
      }
      const noun = keys.length === 1 ? "property" : "properties";
      if (
        !confirm(
          `Remove ${keys.length} ${noun} from your comparison? This cannot be undone.`
        )
      ) {
        return;
      }
      const res = await HSCompare.deleteProperties(keys);
      if (res.ok) {
        for (const k of keys) selectedKeys.delete(k);
        await reload();
        toast(
          `Deleted ${res.deleted} ${res.deleted === 1 ? "property" : "properties"}`
        );
      } else {
        toast(res.error || "Delete failed", true);
      }
    });

  document.getElementById("export-backup-btn").addEventListener("click", async () => {
    const backup = await HSCompare.exportBackup();
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJson(backup, `housesigma-compare-backup-${stamp}.json`);
    toast("Backup exported");
  });

  const importFile = document.getElementById("import-file");
  function promptImport(merge) {
    importFile.onchange = async () => {
      const file = importFile.files?.[0];
      importFile.value = "";
      if (!file) return;
      try {
        const text = await file.text();
        const backup = JSON.parse(text);
        const res = await HSCompare.importBackup(backup, { merge });
        if (res.ok) {
          await reload();
          toast(
            merge
              ? `Merged — ${res.count} properties total`
              : `Imported ${res.count} properties`
          );
        } else {
          toast(res.error || "Import failed", true);
        }
      } catch (e) {
        toast(String(e.message || e), true);
      }
    };
    importFile.click();
  }

  document.getElementById("import-backup-btn").addEventListener("click", () => {
    if (!confirm("Replace all saved properties with the backup file?")) return;
    promptImport(false);
  });
  document.getElementById("import-merge-btn").addEventListener("click", () => {
    promptImport(true);
  });

  document.getElementById("compare-body").addEventListener("change", async (e) => {
    const selectCb = e.target.closest(".select-checkbox");
    if (selectCb) {
      const url = selectCb.getAttribute("data-url");
      if (!url) return;
      if (selectCb.checked) selectedKeys.add(url);
      else selectedKeys.delete(url);
      updateExportUi();
      return;
    }
    const viewedCb = e.target.closest(".viewed-checkbox");
    if (!viewedCb) return;
    const url = viewedCb.getAttribute("data-url");
    if (!url) return;
    const res = await HSCompare.setViewed(url, viewedCb.checked);
    if (res.ok) {
      const row = rowForKey(url);
      if (row) row.viewed = viewedCb.checked;
    }
  });

  document.body.addEventListener("click", async (e) => {
    const driveBtn = e.target.closest(".btn-drive-refresh");
    if (driveBtn) {
      e.preventDefault();
      const attrKey = driveBtn.getAttribute("data-url");
      if (!attrKey) return;
      driveBtn.disabled = true;
      driveBtn.classList.add("is-loading");
      try {
        const res = await refreshDriveTimeForKey(attrKey);
        if (res.ok) {
          renderTable(data.urls);
          toast(`Drive to office: ${res.drive}`);
        } else {
          toast(res.error || "Drive time failed", true);
        }
      } catch (err) {
        toast(String(err.message || err), true);
      } finally {
        driveBtn.disabled = false;
        driveBtn.classList.remove("is-loading");
      }
      return;
    }
  });

  renderTableHead();
  loadSortable()
    .then(() => reload())
    .catch((e) => {
      console.error(e);
      toast("Drag reorder unavailable (Sortable failed to load)", true);
      reload();
    });
})();
