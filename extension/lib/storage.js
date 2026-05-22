/* global HSCompare */
var HSCompare = globalThis.HSCompare || (globalThis.HSCompare = {});

const STORAGE_KEYS = ["urls", "properties", "settings"];

HSCompare.defaultSettings = function defaultSettings() {
  return {
    officeAddress: "",
    officeCoords: null,
    columnWidths: {},
    columnOrder: [],
  };
};

HSCompare.loadAll = function loadAll() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS, (data) => {
      resolve({
        urls: data.urls || [],
        properties: data.properties || {},
        settings: { ...HSCompare.defaultSettings(), ...(data.settings || {}) },
      });
    });
  });
};

HSCompare.saveAll = function saveAll(payload) {
  return new Promise((resolve) => {
    chrome.storage.local.set(
      {
        urls: payload.urls || [],
        properties: payload.properties || {},
        settings: payload.settings || HSCompare.defaultSettings(),
      },
      resolve
    );
  });
};

HSCompare.findDuplicateUrl = function findDuplicateUrl(urls, url) {
  const key = HSCompare.normalizeUrl(url);
  return urls.includes(key) ? key : null;
};

HSCompare.addProperty = async function addProperty(url, row) {
  const data = await HSCompare.loadAll();
  const key = HSCompare.normalizeUrl(url);
  row.url = key;
  if (data.urls.includes(key)) {
    return { ok: false, error: "URL already in comparison list" };
  }
  const dup = HSCompare.findDuplicateAddress(data.properties, row.address);
  if (dup) {
    return {
      ok: false,
      error: `Address already saved: ${dup[1].address || dup[0]}`,
    };
  }
  data.properties[key] = {
    ...row,
    url: key,
    viewed: false,
    score: 0,
    user_notes: "",
  };
  data.urls.push(key);
  await HSCompare.saveAll(data);
  return { ok: true, url: key, count: data.urls.length };
};

HSCompare.refreshProperty = async function refreshProperty(urlKey, row) {
  const data = await HSCompare.loadAll();
  const oldKey = HSCompare.resolveStoredUrlKey(data.urls, urlKey);
  if (!oldKey || !data.properties[oldKey]) {
    return { ok: false, error: "Property not in comparison list" };
  }
  const prev = data.properties[oldKey];
  const viewed = !!prev.viewed;
  const score = HSCompare.normalizeScore(prev.score);
  const user_notes = HSCompare.userNotesFromRow(prev);
  const newKey = HSCompare.normalizeUrl(row.url || oldKey);
  row.url = newKey;
  row.viewed = viewed;
  row.score = score;
  row.user_notes = user_notes;
  if (newKey !== oldKey) {
    data.urls = data.urls.map((u) => (u === oldKey ? newKey : u));
    delete data.properties[oldKey];
  }
  data.properties[newKey] = { ...prev, ...row, viewed, score, user_notes };
  await HSCompare.saveAll(data);
  return { ok: true, url: newKey, address: row.address || "" };
};

HSCompare.deleteProperty = async function deleteProperty(url) {
  return HSCompare.deleteProperties([url]);
};

HSCompare.deleteProperties = async function deleteProperties(urls) {
  const data = await HSCompare.loadAll();
  const toDelete = new Set();
  for (const u of urls || []) {
    const key =
      HSCompare.resolveStoredUrlKey(data.urls, String(u)) ||
      (() => {
        try {
          return HSCompare.normalizeUrl(String(u));
        } catch (_) {
          return null;
        }
      })();
    if (key && data.urls.includes(key)) toDelete.add(key);
  }
  if (!toDelete.size) {
    return { ok: false, error: "Nothing to delete" };
  }
  data.urls = data.urls.filter((u) => !toDelete.has(u));
  for (const k of toDelete) delete data.properties[k];
  await HSCompare.saveAll(data);
  return { ok: true, count: data.urls.length, deleted: toDelete.size };
};

HSCompare.normalizeScore = function normalizeScore(value) {
  const n = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return 0;
  return Math.min(10, Math.max(0, n));
};

HSCompare.USER_NOTES_MAX = 1000;

HSCompare.normalizeUserNotes = function normalizeUserNotes(value) {
  return String(value ?? "").slice(0, HSCompare.USER_NOTES_MAX);
};

HSCompare.userNotesFromRow = function userNotesFromRow(row) {
  return HSCompare.normalizeUserNotes(row?.user_notes ?? row?.notes ?? "");
};

/** Match a DOM attribute value to a key in urls[] (exact, decoded, or normalized). */
HSCompare.resolveStoredUrlKey = function resolveStoredUrlKey(urls, candidate) {
  const raw = String(candidate || "").trim();
  if (!raw) return null;
  if (urls.includes(raw)) return raw;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch (_) {
    decoded = raw;
  }
  if (decoded !== raw && urls.includes(decoded)) return decoded;
  try {
    const normalized = HSCompare.normalizeUrl(decoded);
    if (urls.includes(normalized)) return normalized;
  } catch (_) {
    /* not a valid HouseSigma URL string */
  }
  return null;
};

HSCompare.resolvePropertyKey = function resolvePropertyKey(data, url) {
  const resolved = HSCompare.resolveStoredUrlKey(data.urls, url);
  if (resolved) return resolved;
  return HSCompare.normalizeUrl(url);
};

HSCompare.setViewed = async function setViewed(url, viewed) {
  const data = await HSCompare.loadAll();
  const key = HSCompare.resolvePropertyKey(data, url);
  if (!data.properties[key]) return { ok: false, error: "Not found" };
  data.properties[key].viewed = !!viewed;
  await HSCompare.saveAll(data);
  return { ok: true };
};

HSCompare.setScore = async function setScore(url, score) {
  const data = await HSCompare.loadAll();
  const key = HSCompare.resolvePropertyKey(data, url);
  if (!data.properties[key]) return { ok: false, error: "Not found" };
  data.properties[key].score = HSCompare.normalizeScore(score);
  await HSCompare.saveAll(data);
  return { ok: true, score: data.properties[key].score };
};

HSCompare.setUserNotes = async function setUserNotes(url, text) {
  const data = await HSCompare.loadAll();
  const key = HSCompare.resolvePropertyKey(data, url);
  if (!data.properties[key]) return { ok: false, error: "Not found" };
  data.properties[key].user_notes = HSCompare.normalizeUserNotes(text);
  await HSCompare.saveAll(data);
  return { ok: true, user_notes: data.properties[key].user_notes };
};

HSCompare.reorderUrls = async function reorderUrls(ordered) {
  const data = await HSCompare.loadAll();
  const seen = new Set();
  const next = [];
  for (const u of ordered) {
    const key = HSCompare.resolveStoredUrlKey(data.urls, u);
    if (key && !seen.has(key)) {
      next.push(key);
      seen.add(key);
    }
  }
  for (const u of data.urls) {
    if (!seen.has(u)) next.push(u);
  }
  data.urls = next;
  await HSCompare.saveAll(data);
  return { ok: true, urls: data.urls };
};

HSCompare.exportBackup = async function exportBackup() {
  const data = await HSCompare.loadAll();
  return {
    version: HSCompare.BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    urls: data.urls,
    properties: data.properties,
    settings: data.settings,
  };
};

HSCompare.importBackup = async function importBackup(backup, { merge } = { merge: false }) {
  if (!backup || typeof backup !== "object") {
    return { ok: false, error: "Invalid backup JSON" };
  }
  const urls = Array.isArray(backup.urls)
    ? [...new Set(backup.urls.map((u) => HSCompare.normalizeUrl(String(u))))]
    : [];
  const rawProps =
    backup.properties && typeof backup.properties === "object"
      ? backup.properties
      : {};
  const properties = {};
  for (const [k, v] of Object.entries(rawProps)) {
    try {
      const nk = HSCompare.normalizeUrl(String(v?.url || k));
      properties[nk] = { ...v, url: nk };
    } catch (_) {
      /* skip invalid keys */
    }
  }
  const settings = backup.settings || HSCompare.defaultSettings();

  if (merge) {
    const current = await HSCompare.loadAll();
    const mergedUrls = [...current.urls];
    const mergedProps = { ...current.properties };
    for (const u of urls) {
      if (!mergedUrls.includes(u)) mergedUrls.push(u);
      if (properties[u]) mergedProps[u] = properties[u];
    }
    await HSCompare.saveAll({
      urls: mergedUrls,
      properties: mergedProps,
      settings: { ...current.settings, ...settings },
    });
    return { ok: true, count: mergedUrls.length };
  }

  await HSCompare.saveAll({ urls, properties, settings });
  return { ok: true, count: urls.length };
};

HSCompare.buildAppData = async function buildAppData() {
  const data = await HSCompare.loadAll();
  const properties = {};
  for (const u of data.urls) {
    const row = { ...(data.properties[u] || {}) };
    row.url = row.url || u;
    row.google_maps = row.google_maps || HSCompare.mapsLinkForRow(row);
    row.viewed = !!row.viewed;
    row.score = HSCompare.normalizeScore(row.score);
    row.user_notes = HSCompare.userNotesFromRow(row);
    delete row.notes;
    properties[u] = row;
  }
  return {
    generated: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
    urls: data.urls,
    properties,
    settings: data.settings,
    tableColumns: HSCompare.TABLE_COLUMNS,
    exportColumns: HSCompare.EXPORT_COLUMNS,
    columnLabels: HSCompare.COLUMN_LABELS,
  };
};
