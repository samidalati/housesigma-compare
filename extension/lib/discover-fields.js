/* global HSCompare */
var HSCompare = globalThis.HSCompare || (globalThis.HSCompare = {});

HSCompare.discoverSlug = function discoverSlug(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
};

HSCompare.formatFieldValue = function formatFieldValue(value) {
  if (value == null || value === "") return "";
  if (Array.isArray(value)) {
    return value
      .map((v) => HSCompare.formatFieldValue(v))
      .filter(Boolean)
      .join("\n");
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (_) {
      return "";
    }
  }
  const s = String(value).trim();
  if (HSCompare.isRedacted && HSCompare.isRedacted(s)) return "";
  return s;
};

HSCompare.discoverSample = function discoverSample(value) {
  if (value == null || value === "") return "";
  if (Array.isArray(value)) {
    const parts = value
      .slice(0, 2)
      .map((v) => HSCompare.discoverSample(v))
      .filter(Boolean);
    return parts.join("; ").slice(0, 120);
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value).slice(0, 120);
    } catch (_) {
      return "";
    }
  }
  const s = String(value).trim();
  if (HSCompare.isRedacted && HSCompare.isRedacted(s)) return "(gated)";
  return s.slice(0, 120);
};

HSCompare.discoverAdd = function discoverAdd(map, entry) {
  if (!entry?.id || map.has(entry.id)) return;
  map.set(entry.id, entry);
};

HSCompare.discoverKeyFacts = function discoverKeyFacts(resp, map) {
  const kf = resp?.key_facts_v2 || resp?.key_facts;
  if (!kf || typeof kf !== "object") return;
  for (const [key, fact] of Object.entries(kf)) {
    if (!fact || typeof fact !== "object") continue;
    const label = String(fact.name || key).trim() || key;
    HSCompare.discoverAdd(map, {
      id: `kf_${key}`,
      label,
      source: "key_facts_v2",
      path: `key_facts_v2.${key}.value`,
      sample: HSCompare.discoverSample(fact.value),
      group: "Key facts",
    });
  }
};

HSCompare.discoverPropertyDetail = function discoverPropertyDetail(resp, map) {
  const pd = resp?.property_detail;
  if (!pd || typeof pd !== "object") return;
  for (const [sectionKey, section] of Object.entries(pd)) {
    if (!section || typeof section !== "object") continue;
    const items = section.value;
    if (!Array.isArray(items)) continue;
    const sectionLabel = String(section.name || sectionKey).trim() || sectionKey;
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const label = String(item.name || "").trim();
      if (!label) continue;
      const slug = HSCompare.discoverSlug(`${sectionKey}_${label}`);
      HSCompare.discoverAdd(map, {
        id: `pd_${slug}`,
        label,
        source: "property_detail",
        path: `property_detail.${sectionKey}`,
        sample: HSCompare.discoverSample(item.value),
        group: sectionLabel,
      });
    }
  }
};

HSCompare.discoverHouseScalars = function discoverHouseScalars(resp, map) {
  const house = resp?.house;
  if (!house || typeof house !== "object") return;
  const skip = new Set([
    "agent_user",
    "bind_agent_user",
    "list_status",
    "list_dates",
    "parking",
    "text",
    "house_area",
    "land",
    "map",
  ]);
  for (const [key, val] of Object.entries(house)) {
    if (skip.has(key)) continue;
    if (val != null && typeof val === "object") continue;
    HSCompare.discoverAdd(map, {
      id: `house_${key}`,
      label: HSCompare.titleCaseLabel
        ? HSCompare.titleCaseLabel(key)
        : key.replace(/_/g, " "),
      source: "house",
      path: `house.${key}`,
      sample: HSCompare.discoverSample(val),
      group: "Listing (house)",
    });
  }
  if (house.parking && typeof house.parking === "object") {
    for (const [key, val] of Object.entries(house.parking)) {
      HSCompare.discoverAdd(map, {
        id: `house_parking_${key}`,
        label: `Parking ${HSCompare.titleCaseLabel(key)}`,
        source: "house",
        path: `house.parking.${key}`,
        sample: HSCompare.discoverSample(val),
        group: "Listing (house)",
      });
    }
  }
  if (house.house_area && typeof house.house_area === "object") {
    for (const [key, val] of Object.entries(house.house_area)) {
      HSCompare.discoverAdd(map, {
        id: `house_area_${key}`,
        label: `Size ${HSCompare.titleCaseLabel(key)}`,
        source: "house",
        path: `house.house_area.${key}`,
        sample: HSCompare.discoverSample(val),
        group: "Listing (house)",
      });
    }
  }
};

HSCompare.discoverNestedSection = function discoverNestedSection(
  resp,
  map,
  key,
  group
) {
  const block = resp?.[key];
  if (!block || typeof block !== "object") return;
  for (const [subKey, val] of Object.entries(block)) {
    if (val == null) continue;
    const label = HSCompare.titleCaseLabel(subKey);
    HSCompare.discoverAdd(map, {
      id: `${key}_${subKey}`,
      label,
      source: key,
      path: `${key}.${subKey}`,
      sample: HSCompare.discoverSample(val),
      group,
    });
  }
};

HSCompare.discoverArrayObject = function discoverArrayObject(
  resp,
  map,
  key,
  group
) {
  const arr = resp?.[key];
  if (!Array.isArray(arr) || !arr.length || typeof arr[0] !== "object") return;
  for (const field of Object.keys(arr[0])) {
    HSCompare.discoverAdd(map, {
      id: `${key}_${field}`,
      label: HSCompare.titleCaseLabel(field),
      source: key,
      path: `${key}[].${field}`,
      sample: HSCompare.discoverSample(arr[0][field]),
      group,
    });
  }
};

/** Build catalog of fields present in a HouseSigma listing `resp` object. */
HSCompare.discoverListingFields = function discoverListingFields(resp) {
  const map = new Map();
  if (!resp || typeof resp !== "object") return [];

  HSCompare.discoverKeyFacts(resp, map);
  HSCompare.discoverPropertyDetail(resp, map);
  HSCompare.discoverHouseScalars(resp, map);
  HSCompare.discoverNestedSection(resp, map, "analytics", "Analytics");
  HSCompare.discoverNestedSection(
    resp,
    map,
    "community_stats",
    "Community stats"
  );
  HSCompare.discoverNestedSection(
    resp,
    map,
    "community_stats_all",
    "Community stats (all types)"
  );
  HSCompare.discoverArrayObject(resp, map, "school", "Schools");
  HSCompare.discoverArrayObject(resp, map, "listing_history", "Listing history");
  HSCompare.discoverArrayObject(resp, map, "rooms", "Rooms");
  HSCompare.discoverArrayObject(
    resp,
    map,
    "listing_price_change",
    "Price changes"
  );

  if (resp.picture?.photo_url) {
    HSCompare.discoverAdd(map, {
      id: "picture_photo_url",
      label: "Photo URL",
      source: "picture",
      path: "picture.photo_url",
      sample: HSCompare.discoverSample(resp.picture.photo_url),
      group: "Media",
    });
  }

  return [...map.values()].sort((a, b) => {
    const g = a.group.localeCompare(b.group);
    return g !== 0 ? g : a.label.localeCompare(b.label);
  });
};

/** key_facts / house keys already mapped in buildPropertyRow — skip duplicate columns. */
HSCompare.SKIP_EXTRACT_KF_KEYS = new Set([
  "tax",
  "days_on_site_or_market",
  "lot_size",
  "size_without_area_note",
  "description2",
  "summary",
]);

HSCompare.SKIP_EXTRACT_HOUSE_KEYS = new Set([
  "price",
  "bedroom",
  "bedroom_string",
  "washroom",
  "address",
  "address_navigation",
  "price_sold",
  "parking",
  "house_area",
  "land",
  "text",
  "list_status",
  "list_dates",
]);

/** Pull every HouseSigma field we can read into flat row keys + label map. */
HSCompare.extractAllRespFields = function extractAllRespFields(resp) {
  const values = {};
  const labels = {};
  if (!resp || typeof resp !== "object") {
    return { values, labels };
  }

  const kf = resp.key_facts_v2 || resp.key_facts;
  if (kf && typeof kf === "object") {
    for (const [key, fact] of Object.entries(kf)) {
      if (!fact || typeof fact !== "object") continue;
      if (HSCompare.SKIP_EXTRACT_KF_KEYS.has(key)) continue;
      const id = `kf_${key}`;
      const label = String(fact.name || key).trim() || key;
      labels[id] = label;
      const val = HSCompare.formatFieldValue(fact.value);
      if (val) values[id] = val;
    }
  }

  const pd = resp.property_detail;
  if (pd && typeof pd === "object") {
    for (const [sectionKey, section] of Object.entries(pd)) {
      if (!section || typeof section !== "object") continue;
      const items = section.value;
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const name = String(item.name || "").trim();
        if (!name) continue;
        const id = `pd_${HSCompare.discoverSlug(`${sectionKey}_${name}`)}`;
        labels[id] = name;
        const val = HSCompare.formatFieldValue(item.value);
        if (val) values[id] = val;
      }
    }
  }

  const house = resp.house;
  if (house && typeof house === "object") {
    const skip = new Set(["agent_user", "bind_agent_user", "map"]);
    for (const key of HSCompare.SKIP_EXTRACT_HOUSE_KEYS) skip.add(key);
    for (const [key, val] of Object.entries(house)) {
      if (skip.has(key)) continue;
      if (val != null && typeof val === "object") continue;
      const id = `house_${key}`;
      labels[id] = HSCompare.titleCaseLabel(key);
      const formatted = HSCompare.formatFieldValue(val);
      if (formatted) values[id] = formatted;
    }
    if (house.parking && typeof house.parking === "object") {
      for (const [key, val] of Object.entries(house.parking)) {
        const id = `house_parking_${key}`;
        labels[id] = `Parking ${HSCompare.titleCaseLabel(key)}`;
        const formatted = HSCompare.formatFieldValue(val);
        if (formatted) values[id] = formatted;
      }
    }
    if (house.house_area && typeof house.house_area === "object") {
      for (const [key, val] of Object.entries(house.house_area)) {
        const id = `house_area_${key}`;
        labels[id] = `Size ${HSCompare.titleCaseLabel(key)}`;
        const formatted = HSCompare.formatFieldValue(val);
        if (formatted) values[id] = formatted;
      }
    }
    if (house.land && typeof house.land === "object") {
      for (const [key, val] of Object.entries(house.land)) {
        const id = `house_land_${key}`;
        labels[id] = `Land ${HSCompare.titleCaseLabel(key)}`;
        const formatted = HSCompare.formatFieldValue(val);
        if (formatted) values[id] = formatted;
      }
    }
  }

  for (const blockKey of [
    "analytics",
    "community_stats",
    "community_stats_all",
  ]) {
    const block = resp[blockKey];
    if (!block || typeof block !== "object") continue;
    for (const [subKey, val] of Object.entries(block)) {
      if (val == null || typeof val === "object") continue;
      const id = `${blockKey}_${subKey}`;
      labels[id] = HSCompare.titleCaseLabel(subKey);
      const formatted = HSCompare.formatFieldValue(val);
      if (formatted) values[id] = formatted;
    }
  }

  for (const arrKey of ["school", "listing_history", "rooms", "listing_price_change"]) {
    const arr = resp[arrKey];
    if (!Array.isArray(arr) || !arr.length || typeof arr[0] !== "object") continue;
    arr.forEach((item, index) => {
      if (!item || typeof item !== "object") return;
      for (const [field, val] of Object.entries(item)) {
        if (val == null || typeof val === "object") continue;
        const id =
          arr.length === 1
            ? `${arrKey}_${field}`
            : `${arrKey}_${index}_${field}`;
        labels[id] = HSCompare.titleCaseLabel(field);
        const formatted = HSCompare.formatFieldValue(val);
        if (formatted) values[id] = formatted;
      }
    });
  }

  if (resp.picture?.photo_url) {
    labels.picture_photo_url = "Photo URL";
    values.picture_photo_url = String(resp.picture.photo_url);
  }

  return { values, labels };
};
