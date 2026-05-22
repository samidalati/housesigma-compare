/* global HSCompare */
var HSCompare = globalThis.HSCompare || (globalThis.HSCompare = {});

HSCompare.isRedacted = function isRedacted(value) {
  const s = String(value ?? "").trim();
  if (!s) return true;
  const lower = s.toLowerCase();
  if (
    lower.includes("sign-in") ||
    lower.includes("login required") ||
    lower.includes("agreement required")
  ) {
    return true;
  }
  if (/^[\*\s]+$/.test(s)) return true;
  if (s === "0" || s === "***") return true;
  return false;
};

HSCompare.normalizeUrl = function normalizeUrl(url) {
  let u = String(url || "").trim();
  if (!u.startsWith("http")) u = "https://" + u;
  if (!u.includes("housesigma.com")) {
    throw new Error(`Not a HouseSigma URL: ${url}`);
  }
  return u.split("#")[0];
};

HSCompare.normalizeAddress = function normalizeAddress(address) {
  let s = String(address || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[,#]+/g, " ");
  return s.replace(/\s+/g, " ").trim();
};

HSCompare.addressCompareKey = function addressCompareKey(address) {
  const key = HSCompare.normalizeAddress(address);
  if (!key || HSCompare.isRedacted(key)) return null;
  return key;
};

HSCompare.findDuplicateAddress = function findDuplicateAddress(
  props,
  address,
  excludeUrl
) {
  const key = HSCompare.addressCompareKey(address);
  if (!key) return null;
  let exclude = null;
  if (excludeUrl) {
    try {
      exclude = HSCompare.normalizeUrl(excludeUrl);
    } catch (_) {
      exclude = null;
    }
  }
  for (const [urlKey, row] of Object.entries(props || {})) {
    const rowUrl = HSCompare.normalizeUrl(String(row.url || urlKey));
    if (exclude && (urlKey === exclude || rowUrl === exclude)) continue;
    const existing = HSCompare.addressCompareKey(String(row.address || ""));
    if (existing && existing === key) return [urlKey, row];
  }
  return null;
};

HSCompare.parseLotArea = function parseLotArea(lotSize) {
  const s = String(lotSize || "").trim();
  if (!s) return "";
  const m = s.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  if (!m) return "";
  const width = parseFloat(m[1]);
  const length = parseFloat(m[2]);
  const area = width * length;
  const areaStr =
    area === Math.floor(area)
      ? Math.floor(area).toLocaleString("en-CA")
      : area.toLocaleString("en-CA", { maximumFractionDigits: 1 });
  const lower = s.toLowerCase();
  if (
    /\bm\b|metre|meter/.test(lower) &&
    !/feet|foot|\bft\b/.test(lower)
  ) {
    return `${areaStr} m²`;
  }
  return `${areaStr} sq ft`;
};

HSCompare.isCatholicSchool = function isCatholicSchool(school) {
  const parts = [
    school.name,
    school.school_type,
    school.board,
    school.category,
  ];
  return parts
    .filter(Boolean)
    .map(String)
    .join(" ")
    .toLowerCase()
    .includes("catholic");
};

HSCompare.isRatingOutOf10 = function isRatingOutOf10(score) {
  const v = parseFloat(score);
  return Number.isFinite(v) && v > 0 && v <= 10;
};

HSCompare.isAcademicPerformanceEntry = function isAcademicPerformanceEntry(
  entry
) {
  const year = entry.year;
  const rankName = String(entry.rank_name || "")
    .trim()
    .toUpperCase();
  if (typeof year === "string" && year.includes("-")) return true;
  if (
    rankName.startsWith("G") &&
    rankName.length > 1 &&
    /^\d+$/.test(rankName.slice(1))
  ) {
    return true;
  }
  return false;
};

HSCompare.formatAcademicPerformance = function formatAcademicPerformance(
  entry
) {
  const year = String(entry.year || "");
  const rankName = String(entry.rank_name || "");
  const rankValue = String(entry.rank_value || "");
  const scoreName = String(entry.score_name || "");
  const scoreValue = String(entry.score_value || "");
  if (year || rankName) {
    return `${year}${rankName}: ${rankValue}${scoreName}: ${scoreValue}`;
  }
  return scoreValue;
};

HSCompare.schoolScoreDisplay = function schoolScoreDisplay(school) {
  const score = school.score;
  const sj = school.score_json_v2 || [];
  if (HSCompare.isRatingOutOf10(score)) return String(score);
  if (sj.length) {
    const entry = sj[0];
    if (HSCompare.isAcademicPerformanceEntry(entry)) {
      return HSCompare.formatAcademicPerformance(entry);
    }
    const val = entry.score_value;
    if (val != null && String(val).trim()) return String(val);
  }
  if (score != null && score !== 0 && score !== "") return String(score);
  return "";
};

HSCompare.elementarySchool = function elementarySchool(schools) {
  if (!schools || !schools.length) return ["", ""];
  let elementary = schools.filter(
    (s) =>
      String(s.school_type || "").toLowerCase() === "elementary" &&
      s.display !== false &&
      !HSCompare.isCatholicSchool(s)
  );
  if (!elementary.length) {
    elementary = schools.filter(
      (s) =>
        String(s.school_type || "").toLowerCase() === "elementary" &&
        !HSCompare.isCatholicSchool(s)
    );
  }
  if (!elementary.length) return ["", ""];
  const closest = elementary.reduce((a, b) =>
    (a.distance ?? 999999) <= (b.distance ?? 999999) ? a : b
  );
  return [closest.name || "", HSCompare.schoolScoreDisplay(closest)];
};

HSCompare.historyEvent = function historyEvent(entry) {
  return String(entry.status || entry.event || "")
    .trim()
    .toLowerCase();
};

HSCompare.historyPrice = function historyPrice(entry) {
  for (const key of ["price_sold", "price"]) {
    const val = entry[key];
    if (val != null && !HSCompare.isRedacted(val)) return String(val).trim();
  }
  return "";
};

HSCompare.historySoldDate = function historySoldDate(entry) {
  for (const key of ["date_end", "date_start"]) {
    const val = entry[key];
    if (val != null && !HSCompare.isRedacted(val)) {
      const s = String(val).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
    }
  }
  return "";
};

HSCompare.lastSold = function lastSold(history) {
  if (!history || !history.length) return ["", "", ""];
  const sold = history.filter((h) => HSCompare.historyEvent(h) === "sold");
  if (!sold.length) return ["", "", ""];
  sold.sort((a, b) =>
    HSCompare.historySoldDate(b).localeCompare(HSCompare.historySoldDate(a))
  );
  for (const entry of sold) {
    const price = HSCompare.historyPrice(entry);
    if (price) {
      return [price, HSCompare.historySoldDate(entry), ""];
    }
  }
  if (sold.some((e) => HSCompare.isRedacted(HSCompare.historyPrice(e)))) {
    return [
      "",
      "",
      "Sold history gated by MLS board — confirm login on the listing page.",
    ];
  }
  return ["", "", ""];
};

HSCompare.googleMapsUrl = function googleMapsUrl(house, address) {
  const lat = (house.map || {}).lat;
  const lon = (house.map || {}).lon;
  if (lat != null && lon != null) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
  }
  const query = String(
    address || house.address_navigation || house.address || ""
  ).trim();
  if (query) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }
  return "";
};

HSCompare.mapsLinkForRow = function mapsLinkForRow(row) {
  if (row.google_maps) return row.google_maps;
  return HSCompare.googleMapsUrl({}, row.address || "");
};

HSCompare.transitToOfficeUrl = function transitToOfficeUrl(
  lat,
  lon,
  officeLat,
  officeLon
) {
  const origin = `${lat},${lon}`;
  const dest = `${officeLat},${officeLon}`;
  return (
    "https://www.google.com/maps/dir/?api=1" +
    `&origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(dest)}` +
    "&travelmode=transit"
  );
};

HSCompare.nowIso = function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
};

/** HouseSigma key_facts_v2 "Description" (description2); summary bullets if empty. */
HSCompare.listingDescription = function listingDescription(keyFacts) {
  const kf = keyFacts || {};
  const candidates = [kf.description2?.value, kf.description?.value];
  for (const raw of candidates) {
    if (raw == null || raw === "") continue;
    const s = (Array.isArray(raw) ? raw.join("\n") : String(raw)).trim();
    if (s && !HSCompare.isRedacted(s)) return s;
  }
  const summary = kf.summary?.value;
  if (Array.isArray(summary) && summary.length) {
    const joined = summary
      .map((p) => String(p).trim())
      .filter((p) => p && !HSCompare.isRedacted(p))
      .join("\n");
    if (joined) return joined;
  }
  return "";
};

HSCompare.buildPropertyRow = function buildPropertyRow(raw, pageUrl) {
  const resp = raw.resp || {};
  const house = resp.house || {};
  const keyFacts = resp.key_facts_v2 || {};
  const history = resp.listing_history;
  const schools = resp.school;
  const demo = raw.demographic || {};
  const domSold = raw.domSold || {};

  const lat = (house.map || {}).lat;
  const lon = (house.map || {}).lon;

  let [lastSoldPrice, lastSoldDate, soldNote] = HSCompare.lastSold(history);
  if (!lastSoldPrice && domSold.price) {
    lastSoldPrice = domSold.price;
    lastSoldDate = domSold.date || "";
    soldNote = "";
  }
  if (!lastSoldPrice && house.price_sold && !HSCompare.isRedacted(house.price_sold)) {
    lastSoldPrice = String(house.price_sold);
  }

  const [elemName, elemScore] = HSCompare.elementarySchool(schools);
  const taxVal = (keyFacts.tax || {}).value || "";
  let domVal = (keyFacts.days_on_site_or_market || {}).value || "";
  if (!domVal) domVal = (house.text || {}).dom_long || "";

  const photoUrl = (resp.picture || {}).photo_url || "";

  const address =
    house.address_navigation || house.address || "";
  const lotSizeVal =
    (keyFacts.lot_size || {}).value ||
    (house.land || {}).text ||
    "";

  let finalUrl = pageUrl;
  try {
    finalUrl = HSCompare.normalizeUrl(pageUrl);
  } catch (_) {
    finalUrl = pageUrl;
  }

  const parking = house.parking || {};
  const office = raw.officeCoords;
  let transitToOffice = "";
  if (lat != null && lon != null && office) {
    transitToOffice = HSCompare.transitToOfficeUrl(
      lat,
      lon,
      office[0],
      office[1]
    );
  }

  return {
    url: finalUrl,
    photo: photoUrl,
    address,
    description: HSCompare.listingDescription(keyFacts),
    google_maps: HSCompare.googleMapsUrl(house, address),
    viewed: false,
    score: 0,
    listed_price: house.price ?? "",
    last_sold_price: lastSoldPrice,
    last_sold_date: lastSoldDate,
    property_tax: taxVal,
    bedrooms: house.bedroom_string || String(house.bedroom ?? ""),
    bathrooms: String(house.washroom ?? ""),
    garages: String(parking.garage ?? ""),
    parking_spots: String(parking.parking ?? parking.total ?? ""),
    lot_size: lotSizeVal,
    lot_area: HSCompare.parseLotArea(lotSizeVal),
    size:
      (keyFacts.size_without_area_note || {}).value ||
      (house.house_area || {}).area ||
      "",
    days_on_market: domVal,
    drive_to_office: "",
    transit_to_office: transitToOffice,
    low_income: demo.low_income ?? "",
    renters: demo.renter ?? "",
    condos: demo.condos ?? "",
    households_with_children: demo.household_with_children ?? "",
    average_home_value: demo.average_listing_value ?? "",
    average_household_income: demo.income_household_average ?? "",
    elementary_school: elemName,
    elementary_school_score: elemScore,
    scraped_at: HSCompare.nowIso(),
    user_notes: "",
    _coords: lat != null && lon != null ? [lat, lon] : null,
  };
};
