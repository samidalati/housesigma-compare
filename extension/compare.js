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
  const sortState = { column: null, dir: "asc" };
  let resizeDrag = null;
  let saveColumnWidthsTimer = null;

  const COLUMN_LAYOUT = {
    drag: { min: 28, max: 56, default: 32 },
    select: { min: 44, max: 72, default: 52 },
    viewed: { min: 52, max: 80, default: 56 },
    score: { min: 44, max: 72, default: 48 },
    photo: { min: 120, max: 180, default: 136 },
    property: { min: 96, max: 480, default: 168 },
    map: { min: 52, max: 120, default: 72 },
    address: { min: 96, max: 480, default: 168 },
    description: { min: 140, max: 560, default: 280 },
    user_notes: { min: 140, max: 560, default: 280 },
    listed_price: { min: 72, max: 160, default: 96 },
    last_sold_price: { min: 72, max: 160, default: 96 },
    drive_to_office: { min: 56, max: 120, default: 72 },
    transit_to_office: { min: 56, max: 120, default: 80 },
    lot_size: { min: 88, max: 200, default: 120 },
    lot_area: { min: 72, max: 160, default: 96 },
    size: { min: 72, max: 160, default: 96 },
    _default: { min: 56, max: 240, default: 88 },
  };

  const ICON_REFRESH =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.8 1.1 6.4 2.8L21 8"/><path d="M21 3v5h-5"/></svg>';
  const ICON_GRIP =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>';
  const ICON_MAP =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  const ICON_CHEVRON_DOWN =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';

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

  function parsePercent(val) {
    const m = String(val).match(/([\d.]+)/);
    return m ? parseFloat(m[1]) : NaN;
  }

  function sortValueForColumn(row, col) {
    if (col === "property") {
      return String(row.address || row.url || "").toLowerCase();
    }
    if (col === "viewed") return row.viewed ? 1 : 0;
    if (col === "score") return HSCompare.normalizeScore(row.score);
    if (col === "user_notes") {
      const notes = HSCompare.userNotesFromRow(row);
      return notes ? notes.toLowerCase() : null;
    }

    const s = String(row[col] ?? "").trim();
    if (!s) return null;

    if (col === "drive_to_office") {
      const m = s.match(/(\d+)\s*min/i);
      return m ? Number(m[1]) : null;
    }
    if (col === "last_sold_date" || col === "scraped_at") {
      const t = Date.parse(s);
      return Number.isFinite(t) ? t : null;
    }
    if (col === "days_on_market") {
      const m = s.match(/(\d+)/);
      return m ? Number(m[1]) : null;
    }
    if (col === "lot_area" || col === "lot_size") {
      const n = parseFloat(s.replace(/[^0-9.]/g, ""));
      return Number.isFinite(n) ? n : s.toLowerCase();
    }
    if (
      col === "listed_price" ||
      col === "last_sold_price" ||
      col === "property_tax" ||
      col === "average_home_value" ||
      col === "average_household_income"
    ) {
      const n = parseDollarAmount(s);
      return Number.isFinite(n) ? n : null;
    }
    if (
      col === "low_income" ||
      col === "renters" ||
      col === "condos" ||
      col === "households_with_children"
    ) {
      const n = parsePercent(s);
      return Number.isFinite(n) ? n : null;
    }
    if (
      col === "bedrooms" ||
      col === "bathrooms" ||
      col === "garages" ||
      col === "parking_spots" ||
      col === "elementary_school_score"
    ) {
      const n = parseFloat(s.replace(/[^\d.]/g, ""));
      return Number.isFinite(n) ? n : s.toLowerCase();
    }
    return s.toLowerCase();
  }

  function compareSortValues(a, b) {
    const aEmpty = a == null || a === "";
    const bEmpty = b == null || b === "";
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b), undefined, { numeric: true });
  }

  function orderUrlsForDisplay(urls) {
    const col = sortState.column;
    if (!col) return urls;
    const dir = sortState.dir === "desc" ? -1 : 1;
    return [...urls].sort((keyA, keyB) => {
      const rowA = rowForKey(keyA);
      const rowB = rowForKey(keyB);
      if (!rowA && !rowB) return 0;
      if (!rowA) return 1;
      if (!rowB) return -1;
      return (
        compareSortValues(
          sortValueForColumn(rowA, col),
          sortValueForColumn(rowB, col)
        ) * dir
      );
    });
  }

  function clearColumnSort() {
    sortState.column = null;
    sortState.dir = "asc";
    renderTableHead();
  }

  async function applyColumnSort(col) {
    if (sortState.column === col) {
      sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
    } else {
      sortState.column = col;
      sortState.dir = "asc";
    }
    const ordered = orderUrlsForDisplay(data.urls);
    const res = await HSCompare.reorderUrls(ordered);
    if (res.ok) {
      data.urls = res.urls;
      renderTableHead();
      renderTable(data.urls);
    } else {
      toast("Could not save sort order", true);
    }
  }

  function ensureColumnWidths() {
    if (!data.settings.columnWidths) data.settings.columnWidths = {};
  }

  function defaultColumnOrder() {
    return [
      "drag",
      "select",
      "viewed",
      "score",
      "photo",
      "property",
      "map",
      ...TABLE_COLS(),
    ];
  }

  function ensureColumnOrder() {
    if (!Array.isArray(data.settings.columnOrder)) {
      data.settings.columnOrder = [];
    }
  }

  function getColumnOrder() {
    const defaults = defaultColumnOrder();
    const saved = data.settings.columnOrder;
    if (!Array.isArray(saved) || !saved.length) return defaults;
    const valid = new Set(defaults);
    const order = [];
    for (const c of saved) {
      if (valid.has(c) && !order.includes(c)) order.push(c);
    }
    for (const c of defaults) {
      if (!order.includes(c)) order.push(c);
    }
    return order;
  }

  async function saveColumnOrder() {
    const stored = await HSCompare.loadAll();
    stored.settings = {
      ...HSCompare.defaultSettings(),
      ...(stored.settings || {}),
      columnOrder: [...getColumnOrder()],
      columnWidths: {
        ...(stored.settings?.columnWidths || {}),
        ...data.settings.columnWidths,
      },
    };
    await HSCompare.saveAll(stored);
  }

  function columnLayout(col) {
    return COLUMN_LAYOUT[col] || COLUMN_LAYOUT._default;
  }

  function clampColumnWidth(col, width) {
    const layout = columnLayout(col);
    return Math.round(Math.min(layout.max, Math.max(layout.min, width)));
  }

  function getColumnWidth(col) {
    ensureColumnWidths();
    const saved = data.settings.columnWidths[col];
    if (saved != null && Number.isFinite(saved)) {
      return clampColumnWidth(col, saved);
    }
    return columnLayout(col).default;
  }

  function setColumnWidth(col, widthPx) {
    ensureColumnWidths();
    const w = clampColumnWidth(col, widthPx);
    data.settings.columnWidths[col] = w;
    const colEl = document.querySelector(`#compare-cols col[data-col="${col}"]`);
    if (colEl) colEl.style.width = `${w}px`;
  }

  function renderColgroup() {
    const cg = document.getElementById("compare-cols");
    if (!cg) return;
    cg.innerHTML = getColumnOrder()
      .map((col) => {
        const w = getColumnWidth(col);
        return `<col data-col="${esc(col)}" style="width:${w}px">`;
      })
      .join("");
  }

  function measureColumnContentWidth(col) {
    const table = document.getElementById("compare-table");
    const layout = columnLayout(col);
    if (!table) return layout.default;
    const cells = table.querySelectorAll(`th.col-${col}, td.col-${col}`);
    if (!cells.length) return layout.default;
    const prevLayout = table.style.tableLayout;
    table.style.tableLayout = "auto";
    let maxW = layout.min;
    cells.forEach((cell) => {
      maxW = Math.max(maxW, cell.scrollWidth + 12);
    });
    table.style.tableLayout = prevLayout || "fixed";
    return clampColumnWidth(col, maxW);
  }

  function scheduleSaveColumnWidths() {
    clearTimeout(saveColumnWidthsTimer);
    saveColumnWidthsTimer = setTimeout(async () => {
      const stored = await HSCompare.loadAll();
      stored.settings = {
        ...HSCompare.defaultSettings(),
        ...(stored.settings || {}),
        columnWidths: { ...data.settings.columnWidths },
      };
      await HSCompare.saveAll(stored);
    }, 400);
  }

  function resizableTh(col, innerHtml, extraClass) {
    const cls = extraClass ? ` ${extraClass}` : "";
    return `<th class="col-${col} th-resizable${cls}" data-col="${col}"><div class="th-inner">${innerHtml}</div><span class="col-resize-handle" data-col="${col}" title="Drag to resize. Double-click to fit content." role="separator" aria-orientation="vertical"></span></th>`;
  }

  function sortableTh(col, label) {
    const active = sortState.column === col;
    const ariaSort = active
      ? sortState.dir === "asc"
        ? "ascending"
        : "descending"
      : "none";
    const arrow = active ? (sortState.dir === "asc" ? " ▲" : " ▼") : "";
    const inner = `<span class="th-sort-label">${esc(label)}</span><span class="sort-indicator" aria-hidden="true">${arrow}</span>`;
    const extra = `th-sortable${active ? ` is-sorted-${sortState.dir}` : ""}`;
    return `<th class="col-${col} th-resizable ${extra}" data-col="${col}" data-sort-col="${esc(col)}" aria-sort="${ariaSort}" tabindex="0" title="Sort by ${esc(label)}"><div class="th-inner">${inner}</div><span class="col-resize-handle" data-col="${col}" title="Drag to resize. Double-click to fit content." role="separator" aria-orientation="vertical"></span></th>`;
  }

  function bindColumnResize() {
    if (document.documentElement.dataset.colResizeBound) return;
    document.documentElement.dataset.colResizeBound = "1";

    document.addEventListener(
      "mousedown",
      (e) => {
        const handle = e.target.closest("#compare-head .col-resize-handle");
        if (!handle) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const col = handle.getAttribute("data-col");
        if (!col) return;
        const head = document.getElementById("compare-head");
        if (head?.columnSortable) head.columnSortable.option("disabled", true);
        resizeDrag = { col, startX: e.clientX, startW: getColumnWidth(col) };
        document.body.classList.add("is-col-resizing");
      },
      true
    );

    document.addEventListener(
      "dblclick",
      (e) => {
        const handle = e.target.closest("#compare-head .col-resize-handle");
        if (!handle) return;
        e.preventDefault();
        e.stopPropagation();
        const col = handle.getAttribute("data-col");
        if (!col) return;
        setColumnWidth(col, measureColumnContentWidth(col));
        scheduleSaveColumnWidths();
      },
      true
    );
  }

  function householdIncomeHighlightClass(val) {
    const n = parseDollarAmount(val);
    return Number.isFinite(n) && n < 100000 ? " cell-income-low" : "";
  }

  function propertyCoords(row) {
    return HSCompare.coordsFromRow(row);
  }

  function syncCommuteForm() {
    const input = document.getElementById("office-address");
    if (!input) return;
    input.value = data.settings?.officeAddress || "";
  }

  function updateCommuteOpenButton() {
    const btn = document.getElementById("commute-open-btn");
    if (!btn) return;
    const addr = data.settings?.officeAddress || "";
    btn.title = addr
      ? `Drive & Transit destination: ${addr}`
      : "Set commute destination for Drive & Transit";
  }

  function openCommuteModal() {
    syncCommuteForm();
    const modal = document.getElementById("commute-modal");
    if (!modal) return;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.getElementById("office-address")?.focus();
  }

  function closeCommuteModal() {
    const modal = document.getElementById("commute-modal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
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
      inner: `<button type="button" class="btn-drive-refresh" data-url="${urlAttrKey(key)}" title="Calculate drive time" aria-label="Calculate drive time">${ICON_REFRESH}</button>`,
    };
  }

  function descriptionCell(val) {
    const text = String(val ?? "").trim();
    if (!text) {
      return { cellClass: "cell-empty col-description", inner: "—" };
    }
    return {
      cellClass: "col-description",
      inner: `<div class="desc-cell">
        <div class="desc-body">${esc(text)}</div>
        <button type="button" class="btn-desc-expand" aria-expanded="false" aria-label="Expand description">${ICON_CHEVRON_DOWN}</button>
      </div>`,
    };
  }

  function photoCell(row, key) {
    const src = String(row.photo || "").trim();
    const href = esc(row.url || key || "");
    if (!src) {
      return '<div class="photo-slot photo-slot--empty" aria-label="No photo"></div>';
    }
    const img = `<img class="listing-photo" src="${esc(src)}" alt="" width="120" height="90" loading="lazy" decoding="async" />`;
    const inner = href
      ? `<a class="photo-link" href="${href}" target="_blank" rel="noopener" aria-label="Open listing on HouseSigma">${img}</a>`
      : img;
    return `<div class="photo-slot">${inner}</div>`;
  }

  function selectCell(key) {
    const checked = selectedKeys.has(key) ? " checked" : "";
    return `<td class="col-select"><input type="checkbox" class="select-checkbox" data-url="${esc(key)}"${checked} aria-label="Select for export" /></td>`;
  }

  function viewedCell(key, row) {
    const checked = row.viewed ? " checked" : "";
    return `<td class="col-viewed"><input type="checkbox" class="viewed-checkbox" data-url="${esc(key)}"${checked} aria-label="Mark as viewed" /></td>`;
  }

  function scoreCell(key, row) {
    const score = HSCompare.normalizeScore(row.score);
    const options = Array.from({ length: 11 }, (_, i) => {
      const selected = i === score ? " selected" : "";
      return `<option value="${i}"${selected}>${i}</option>`;
    }).join("");
    return `<td class="col-score"><select class="score-select" data-url="${esc(key)}" aria-label="Property score">${options}</select></td>`;
  }

  function userNotesInner(key, row) {
    const text = HSCompare.userNotesFromRow(row);
    return `<textarea class="notes-input" data-url="${esc(key)}" maxlength="${HSCompare.USER_NOTES_MAX}" rows="3" placeholder="Add notes…" aria-label="Notes">${esc(text)}</textarea>`;
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
    if (col === "score") return String(HSCompare.normalizeScore(row.score));
    if (col === "user_notes") return HSCompare.userNotesFromRow(row);
    return row[col] ?? "";
  }

  function orderedExportCols() {
    const allowed = new Set(EXPORT_COLS());
    const fromOrder = getColumnOrder().filter((c) => allowed.has(c));
    const seen = new Set(fromOrder);
    for (const c of EXPORT_COLS()) {
      if (!seen.has(c)) fromOrder.push(c);
    }
    return fromOrder;
  }

  function exportSelectedCsv() {
    const keys = data.urls.filter((k) => selectedKeys.has(k) && rowForKey(k));
    if (!keys.length) {
      toast("Select at least one property", true);
      return;
    }
    const cols = orderedExportCols();
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

  function headerForColumn(col) {
    const labels = COLUMN_LABELS();
    switch (col) {
      case "drag":
        return resizableTh(
          "drag",
          `<span class="col-header-drag-hint" aria-hidden="true">${ICON_GRIP}</span>`
        );
      case "select":
        return resizableTh(
          "select",
          '<input type="checkbox" class="select-checkbox" id="select-all-checkbox" aria-label="Select all" />'
        );
      case "viewed":
        return sortableTh("viewed", "Viewed");
      case "score":
        return sortableTh("score", "Score");
      case "photo":
        return resizableTh("photo", "Photo");
      case "property":
        return sortableTh("property", "Property");
      case "map":
        return resizableTh("map", "Map");
      default:
        if (TABLE_COLS().includes(col)) {
          return sortableTh(col, labels[col] || HSCompare.columnLabel(col));
        }
        return "";
    }
  }

  function bodyCellForColumn(col, key, row) {
    const title = row.address || row.url || key;
    const propLink = `<a class="property-link" href="${esc(row.url || key)}" target="_blank" rel="noopener">${esc(title)}</a>`;
    const maps = row.google_maps
      ? `<a class="map-link" href="${esc(row.google_maps)}" target="_blank" rel="noopener">${ICON_MAP}<span>Map</span></a>`
      : '<span class="cell-empty">—</span>';

    switch (col) {
      case "drag":
        return `<td class="col-drag"><span class="drag-handle" title="Drag to reorder row">${ICON_GRIP}</span></td>`;
      case "select":
        return selectCell(key);
      case "viewed":
        return viewedCell(key, row);
      case "score":
        return scoreCell(key, row);
      case "photo":
        return `<td class="col-photo">${photoCell(row, key)}</td>`;
      case "property":
        return `<td class="col-property">${propLink}</td>`;
      case "map":
        return `<td class="col-map">${maps}</td>`;
      default:
        break;
    }

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
      inner = `<a class="property-link" href="${esc(val)}" target="_blank" rel="noopener">Transit</a>`;
    } else if (col === "description") {
      const descCell = descriptionCell(val);
      cellClass = descCell.cellClass;
      inner = descCell.inner;
    } else if (col === "user_notes") {
      cellClass = "col-user_notes";
      inner = userNotesInner(key, row);
    } else {
      inner = esc(val);
    }
    return `<td class="${cellClass.trim()} col-${col}">${inner}</td>`;
  }

  function setupColumnHeaderSortable() {
    const head = document.getElementById("compare-head");
    if (!head || typeof Sortable === "undefined") return;
    if (head.columnSortable) head.columnSortable.destroy();
    head.columnSortable = Sortable.create(head, {
      animation: 150,
      handle: ".th-inner",
      draggable: "th",
      filter: "input, select, textarea, button, a",
      preventOnFilter: true,
      delay: 120,
      delayOnTouchOnly: false,
      ghostClass: "sortable-ghost",
      chosenClass: "sortable-chosen",
      onEnd: async () => {
        const order = [...head.querySelectorAll("th[data-col]")]
          .map((th) => th.getAttribute("data-col"))
          .filter(Boolean);
        if (!order.length) return;
        data.settings.columnOrder = order;
        try {
          await saveColumnOrder();
          renderColgroup();
          renderTable(data.urls);
          toast("Column order saved");
        } catch (e) {
          toast(String(e.message || e), true);
          renderTableHead();
        }
      },
    });
  }

  function renderTableHead() {
    const head = document.getElementById("compare-head");
    head.innerHTML = getColumnOrder().map(headerForColumn).join("");
    const selectAll = document.getElementById("select-all-checkbox");
    if (selectAll) {
      selectAll.onchange = () => {
        const keys = data.urls.filter((k) => rowForKey(k));
        if (selectAll.checked) keys.forEach((k) => selectedKeys.add(k));
        else keys.forEach((k) => selectedKeys.delete(k));
        renderTable(data.urls);
      };
    }
    renderColgroup();
    bindColumnResize();
    setupColumnHeaderSortable();
  }

  function renderTable(urls) {
    const tbody = document.getElementById("compare-body");
    const colSpan = getColumnOrder().length;
    const columns = getColumnOrder();
    const displayUrls = orderUrlsForDisplay(urls);
    const rows = displayUrls
      .map((key) => {
        const row = rowForKey(key);
        if (!row) return "";
        const selectedClass = selectedKeys.has(key) ? " is-selected" : "";
        const tds = columns
          .map((col) => bodyCellForColumn(col, key, row))
          .filter(Boolean)
          .join("");
        return `<tr class="compare-row${selectedClass}" data-url-key="${urlAttrKey(key)}">${tds}</tr>`;
      })
      .join("");
    tbody.innerHTML =
      rows || `<tr><td colspan="${colSpan}">No properties. Add listings from the extension popup on HouseSigma.</td></tr>`;
    setupSortable();
    updateExportUi();
    renderColgroup();
  }

  function renderAll() {
    updateCommuteOpenButton();
    renderTableHead();
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
    if (payload.settings) {
      data.settings = {
        ...HSCompare.defaultSettings(),
        ...payload.settings,
        columnWidths: { ...(payload.settings.columnWidths || {}) },
        columnOrder: [...(payload.settings.columnOrder || [])],
      };
    }
    ensureColumnWidths();
    ensureColumnOrder();
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
            clearColumnSort();
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

  document.getElementById("commute-open-btn").addEventListener("click", openCommuteModal);
  document.getElementById("commute-modal-close").addEventListener("click", closeCommuteModal);
  document.getElementById("commute-cancel-btn").addEventListener("click", closeCommuteModal);
  document.getElementById("commute-modal-backdrop").addEventListener("click", closeCommuteModal);

  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Escape" &&
      document.getElementById("commute-modal")?.classList.contains("is-open")
    ) {
      closeCommuteModal();
    }
  });

  document.getElementById("commute-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("office-address");
    const btn = e.submitter || document.querySelector(".btn-commute-save");
    const address = (input?.value || "").trim();
    if (!address) {
      toast("Enter a destination address", true);
      return;
    }
    if (btn) btn.disabled = true;
    closeCommuteModal();
    toast("Saving destination and calculating drive times…");
    try {
      const res = await HSCompare.applyCommuteDestination(address);
      if (res.ok) {
        await reload();
        const parts = ["Destination saved."];
        if (res.driveUpdated > 0) {
          parts.push(
            `Drive updated for ${res.driveUpdated} propert${res.driveUpdated === 1 ? "y" : "ies"}.`
          );
        }
        if (res.transitUpdated > 0) {
          parts.push(
            `Transit updated for ${res.transitUpdated} propert${res.transitUpdated === 1 ? "y" : "ies"}.`
          );
        }
        if (!res.driveUpdated && !res.transitUpdated) {
          parts.push("Add properties or refresh listings to get commute times.");
        }
        toast(parts.join(" "));
      } else {
        toast(res.error || "Could not save destination", true);
      }
    } catch (err) {
      toast(String(err.message || err), true);
    } finally {
      if (btn) btn.disabled = false;
    }
  });

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

  document.getElementById("compare-head").addEventListener("click", (e) => {
    if (e.target.closest(".col-resize-handle")) return;
    const th = e.target.closest(".th-sortable");
    if (!th) return;
    const col = th.getAttribute("data-sort-col");
    if (!col) return;
    applyColumnSort(col);
  });
  document.addEventListener("mousemove", (e) => {
    if (!resizeDrag) return;
    const dx = e.clientX - resizeDrag.startX;
    setColumnWidth(resizeDrag.col, resizeDrag.startW + dx);
  });

  document.addEventListener("mouseup", () => {
    if (!resizeDrag) return;
    resizeDrag = null;
    document.body.classList.remove("is-col-resizing");
    const head = document.getElementById("compare-head");
    if (head?.columnSortable) head.columnSortable.option("disabled", false);
    scheduleSaveColumnWidths();
  });

  document.getElementById("compare-head").addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (e.target.closest(".col-resize-handle")) return;
    const th = e.target.closest(".th-sortable");
    if (!th) return;
    e.preventDefault();
    const col = th.getAttribute("data-sort-col");
    if (col) applyColumnSort(col);
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
    if (viewedCb) {
      const url = viewedCb.getAttribute("data-url");
      if (!url) return;
      const res = await HSCompare.setViewed(url, viewedCb.checked);
      if (res.ok) {
        const row = rowForKey(url);
        if (row) row.viewed = viewedCb.checked;
      }
      return;
    }
    const scoreSel = e.target.closest(".score-select");
    if (scoreSel) {
      const url = scoreSel.getAttribute("data-url");
      if (!url) return;
      const score = HSCompare.normalizeScore(scoreSel.value);
      const res = await HSCompare.setScore(url, score);
      if (res.ok) {
        const row = rowForKey(url);
        if (row) row.score = res.score;
      }
      return;
    }
  });

  document.getElementById("compare-body").addEventListener("blur", async (e) => {
    const notesInput = e.target.closest(".notes-input");
    if (!notesInput) return;
    const url = notesInput.getAttribute("data-url");
    if (!url) return;
    const text = HSCompare.normalizeUserNotes(notesInput.value);
    notesInput.value = text;
    const row = rowForKey(url);
    const prev = HSCompare.userNotesFromRow(row);
    if (text === prev) return;
    const res = await HSCompare.setUserNotes(url, text);
    if (res.ok && row) row.user_notes = res.user_notes;
  }, true);

  document.body.addEventListener("click", async (e) => {
    const descBtn = e.target.closest(".btn-desc-expand");
    if (descBtn) {
      e.preventDefault();
      const cell = descBtn.closest(".desc-cell");
      if (cell) {
        const expanded = cell.classList.toggle("is-expanded");
        descBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
        descBtn.setAttribute(
          "aria-label",
          expanded ? "Collapse description" : "Expand description"
        );
      }
      return;
    }
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
          toast(`Drive time: ${res.drive}`);
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

  bindColumnResize();
  renderTableHead();
  loadSortable()
    .then(() => reload())
    .catch((e) => {
      console.error(e);
      toast("Drag reorder unavailable (Sortable failed to load)", true);
      reload();
    });
})();
