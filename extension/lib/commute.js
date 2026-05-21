/* global HSCompare */
var HSCompare = globalThis.HSCompare || (globalThis.HSCompare = {});

HSCompare.NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
HSCompare.OSRM_ROUTE_URL =
  "https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}";
HSCompare.NOMINATIM_UA =
  "housesigma-compare-extension/1.0 (personal property comparison)";

HSCompare.geocodeOffice = async function geocodeOffice(address) {
  const q = String(address || HSCompare.DEFAULT_OFFICE_ADDRESS).trim();
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

HSCompare.fillDriveTimes = async function fillDriveTimes(rows, settings) {
  let office = settings?.officeCoords;
  if (!office) {
    office = await HSCompare.geocodeOffice(settings?.officeAddress);
  }
  if (!office) return rows;
  const out = { ...rows };
  for (const [key, row] of Object.entries(out)) {
    if (row.drive_to_office) continue;
    const coords = row._coords;
    if (!coords || coords.length !== 2) continue;
    try {
      const drive = await HSCompare.osrmDriveTime(
        coords[0],
        coords[1],
        office[0],
        office[1]
      );
      if (drive) row.drive_to_office = drive;
      await new Promise((r) => setTimeout(r, 1100));
    } catch (_) {}
  }
  return out;
};
