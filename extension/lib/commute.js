/* global HSCompare */
var HSCompare = globalThis.HSCompare || (globalThis.HSCompare = {});

HSCompare.NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
HSCompare.OSRM_ROUTE_URL =
  "https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}";
HSCompare.NOMINATIM_UA =
  "housesigma-compare-extension/1.0 (personal property comparison)";

HSCompare.geocodeOffice = async function geocodeOffice(address) {
  const q = String(address || "").trim();
  if (!q) return null;
  const url =
    HSCompare.NOMINATIM_URL +
    "?format=json&limit=1&q=" +
    encodeURIComponent(q);
  const res = await fetch(url, {
    headers: { "User-Agent": HSCompare.NOMINATIM_UA },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data || !data.length) return null;
  const lat = parseFloat(data[0].lat);
  const lon = parseFloat(data[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return [lat, lon];
};

HSCompare.osrmDriveTime = async function osrmDriveTime(
  lat1,
  lon1,
  lat2,
  lon2
) {
  const path = HSCompare.OSRM_ROUTE_URL.replace("{lon1}", lon1)
    .replace("{lat1}", lat1)
    .replace("{lon2}", lon2)
    .replace("{lat2}", lat2);
  const res = await fetch(path + "?overview=false");
  if (!res.ok) return "";
  const data = await res.json();
  const route = data.routes && data.routes[0];
  if (!route || route.duration == null) return "";
  const mins = Math.round(route.duration / 60);
  return `${mins} min`;
};

HSCompare.coordsFromRow = function coordsFromRow(row) {
  const maps = (row && row.google_maps) || "";
  const m = maps.match(/query=([\d.-]+),([\d.-]+)/);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lon = parseFloat(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return [lat, lon];
};

HSCompare.propertyCoords = function propertyCoords(row) {
  if (row?._coords?.length === 2) return row._coords;
  return HSCompare.coordsFromRow(row);
};

/** OSRM public demo — one request per second. */
HSCompare.OSRM_DELAY_MS = 1100;

HSCompare.computeDriveTimeForRow = async function computeDriveTimeForRow(
  row,
  office
) {
  const coords = HSCompare.propertyCoords(row);
  if (!coords || !office) return "";
  try {
    return await HSCompare.osrmDriveTime(
      coords[0],
      coords[1],
      office[0],
      office[1]
    );
  } catch (_) {
    return "";
  }
};

/** Fill drive_to_office for listed properties; returns count updated. */
HSCompare.fillDriveTimesForUrls = async function fillDriveTimesForUrls(
  properties,
  urls,
  office,
  { force = false } = {}
) {
  if (!office) return 0;
  let updated = 0;
  for (const u of urls || []) {
    const row = properties[u];
    if (!row) continue;
    if (!force && row.drive_to_office) continue;
    const coords = HSCompare.propertyCoords(row);
    if (!coords) continue;
    const drive = await HSCompare.osrmDriveTime(
      coords[0],
      coords[1],
      office[0],
      office[1]
    );
    if (drive) {
      row.drive_to_office = drive;
      updated += 1;
    }
    await new Promise((r) => setTimeout(r, HSCompare.OSRM_DELAY_MS));
  }
  return updated;
};

/** Save destination address, geocode, refresh transit and drive for all rows. */
HSCompare.applyCommuteDestination = async function applyCommuteDestination(
  address
) {
  const trimmed = String(address || "").trim();
  if (!trimmed) {
    return { ok: false, error: "Enter an address" };
  }
  const data = await HSCompare.loadAll();
  data.settings.officeAddress = trimmed;
  data.settings.officeCoords = null;
  const office = await HSCompare.geocodeOffice(trimmed);
  if (!office) {
    return { ok: false, error: "Could not find that address — try a fuller street address" };
  }
  data.settings.officeCoords = office;
  let transitUpdated = 0;
  for (const u of data.urls) {
    const row = data.properties[u];
    if (!row) continue;
    row.drive_to_office = "";
    const coords = HSCompare.propertyCoords(row);
    if (coords) {
      row.transit_to_office = HSCompare.transitToOfficeUrl(
        coords[0],
        coords[1],
        office[0],
        office[1]
      );
      transitUpdated += 1;
    }
  }
  const driveUpdated = await HSCompare.fillDriveTimesForUrls(
    data.properties,
    data.urls,
    office,
    { force: true }
  );
  await HSCompare.saveAll(data);
  return {
    ok: true,
    officeAddress: trimmed,
    transitUpdated,
    driveUpdated,
  };
};

HSCompare.fillDriveTimes = async function fillDriveTimes(rows, settings) {
  let office = settings?.officeCoords;
  if (!office) {
    office = await HSCompare.geocodeOffice(settings?.officeAddress);
  }
  if (!office) return rows;
  const out = { ...rows };
  const urls = Object.keys(out);
  await HSCompare.fillDriveTimesForUrls(out, urls, office);
  return out;
};
