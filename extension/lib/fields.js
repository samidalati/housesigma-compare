/* global HSCompare */
var HSCompare = globalThis.HSCompare || (globalThis.HSCompare = {});

/** HouseSigma-sourced fields the user can toggle (defaults = all enabled). */
HSCompare.EXTRACTABLE_FIELDS = [
  { id: "address", label: "Address", group: "Listing", default: true },
  { id: "listed_price", label: "Listed Price", group: "Listing", default: true },
  { id: "last_sold_price", label: "Last Sold Price", group: "Listing", default: true },
  { id: "last_sold_date", label: "Last Sold Date", group: "Listing", default: true },
  { id: "property_tax", label: "Property Tax", group: "Listing", default: true },
  { id: "days_on_market", label: "Days on Market", group: "Listing", default: true },
  { id: "description", label: "Description", group: "Listing", default: true },
  { id: "bedrooms", label: "Beds", group: "Property", default: true },
  { id: "bathrooms", label: "Bath", group: "Property", default: true },
  { id: "garages", label: "Garages", group: "Property", default: true },
  { id: "parking_spots", label: "Parking", group: "Property", default: true },
  { id: "lot_size", label: "Lot Size", group: "Property", default: true },
  { id: "lot_area", label: "Lot Area", group: "Property", default: true },
  { id: "size", label: "Size", group: "Property", default: true },
  { id: "drive_to_office", label: "Drive", group: "Commute", default: true },
  { id: "transit_to_office", label: "Transit", group: "Commute", default: true },
  { id: "low_income", label: "Low Income", group: "Demographics", default: true },
  { id: "renters", label: "Renters", group: "Demographics", default: true },
  { id: "condos", label: "Condos", group: "Demographics", default: true },
  {
    id: "households_with_children",
    label: "Households With Children",
    group: "Demographics",
    default: true,
  },
  { id: "average_home_value", label: "Avg Home Value", group: "Demographics", default: true },
  {
    id: "average_household_income",
    label: "Avg Household Income",
    group: "Demographics",
    default: true,
  },
  { id: "elementary_school", label: "Elementary School", group: "Schools", default: true },
  {
    id: "elementary_school_score",
    label: "Elementary Score",
    group: "Schools",
    default: true,
  },
];

HSCompare.EXTRACTABLE_FIELD_IDS = HSCompare.EXTRACTABLE_FIELDS.map((f) => f.id);

HSCompare.DEFAULT_EXTRACT_FIELDS = HSCompare.EXTRACTABLE_FIELDS.filter(
  (f) => f.default
).map((f) => f.id);

/** Always extracted for core UI (photo, map, property link) — not shown in field picker. */
HSCompare.ALWAYS_EXTRACT_FIELDS = ["url", "photo", "google_maps"];

HSCompare.COLUMNS = [
  "url",
  "photo",
  "address",
  "google_maps",
  "viewed",
  "score",
  ...HSCompare.EXTRACTABLE_FIELD_IDS,
  "user_notes",
];

HSCompare.UI_ONLY_FIELDS = ["viewed", "score", "user_notes"];

HSCompare.getEnabledExtractFields = function getEnabledExtractFields(settings) {
  return HSCompare.getEnabledVisibleFields(settings, {});
};

/** All field ids discovered across properties + defaults. */
HSCompare.allKnownFieldIds = function allKnownFieldIds(properties, settings) {
  const ids = new Set(HSCompare.EXTRACTABLE_FIELD_IDS);
  for (const id of Object.keys(settings?.fieldLabels || {})) ids.add(id);
  for (const row of Object.values(properties || {})) {
    for (const key of Object.keys(row)) {
      if (HSCompare.INTERNAL_ROW_KEYS.has(key)) continue;
      if (key.startsWith("_")) continue;
      ids.add(key);
    }
  }
  return [...ids];
};

/** Which HouseSigma fields appear as columns in the compare table. */
HSCompare.getEnabledVisibleFields = function getEnabledVisibleFields(
  settings,
  properties
) {
  const valid = new Set(HSCompare.allKnownFieldIds(properties, settings));
  const saved = settings?.visibleFields ?? settings?.extractFields;
  if (!Array.isArray(saved) || !saved.length) {
    return [...HSCompare.DEFAULT_EXTRACT_FIELDS];
  }
  const enabled = saved.filter((id) => valid.has(id));
  return enabled.length ? enabled : [...HSCompare.DEFAULT_EXTRACT_FIELDS];
};

/** Row keys stored but not shown as data columns in the compare table. */
HSCompare.INTERNAL_ROW_KEYS = new Set([
  "url",
  "photo",
  "google_maps",
  "viewed",
  "score",
  "user_notes",
  "scraped_at",
  "_coords",
]);

HSCompare.getTableColumns = function getTableColumns(settings, properties) {
  const enabled = new Set(
    HSCompare.getEnabledVisibleFields(settings, properties)
  );
  const seen = new Set();
  const cols = [];
  for (const id of HSCompare.EXTRACTABLE_FIELD_IDS) {
    if (!enabled.has(id)) continue;
    seen.add(id);
    cols.push(id);
  }
  const extra = new Set();
  for (const row of Object.values(properties || {})) {
    for (const key of Object.keys(row)) {
      if (HSCompare.INTERNAL_ROW_KEYS.has(key)) continue;
      if (key.startsWith("_")) continue;
      if (seen.has(key)) continue;
      if (!enabled.has(key)) continue;
      extra.add(key);
    }
  }
  cols.push(...[...extra].sort());
  return cols;
};

HSCompare.TABLE_COLUMNS = HSCompare.getTableColumns({}, {});

HSCompare.getExportColumns = function getExportColumns(settings, properties) {
  return [
    "url",
    "address",
    "score",
    ...HSCompare.getTableColumns(settings, properties),
    "user_notes",
  ];
};

HSCompare.EXPORT_COLUMNS = HSCompare.getExportColumns({});

HSCompare.COLUMN_LABELS = {
  score: "Score",
  address: "Address",
  description: "Description",
  user_notes: "Notes",
  bedrooms: "Beds",
  bathrooms: "Bath",
  lot_size: "Lot Size",
  lot_area: "Lot Area",
  size: "Size",
  drive_to_office: "Drive",
  transit_to_office: "Transit",
  low_income: "Low Income",
  renters: "Renters",
  condos: "Condos",
  households_with_children: "Households With Children",
  average_home_value: "Avg Home Value",
  average_household_income: "Avg Household Income",
  elementary_school: "Elementary School",
  elementary_school_score: "Elementary Score",
  listed_price: "Listed Price",
  last_sold_price: "Last Sold",
  last_sold_date: "Last Sold Date",
  property_tax: "Property Tax",
  parking_spots: "Parking",
  days_on_market: "Days on Market",
};

HSCompare.extractFieldLabel = function extractFieldLabel(id) {
  const found = HSCompare.EXTRACTABLE_FIELDS.find((f) => f.id === id);
  if (found) return found.label;
  return HSCompare.columnLabel(id);
};

HSCompare.maskExtractedFields = function maskExtractedFields(row, settings) {
  const enabled = new Set(HSCompare.getEnabledExtractFields(settings));
  const out = { ...row };
  for (const id of HSCompare.EXTRACTABLE_FIELD_IDS) {
    if (!enabled.has(id)) out[id] = "";
  }
  return out;
};

HSCompare.titleCaseLabel = function titleCaseLabel(text) {
  return String(text || "")
    .replace(/_/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
};

HSCompare.fieldGroupForId = function fieldGroupForId(id) {
  if (id.startsWith("kf_")) return "Key facts";
  if (id.startsWith("pd_")) return "Property detail";
  if (id.startsWith("house_parking_")) return "Listing (house)";
  if (id.startsWith("house_area_")) return "Listing (house)";
  if (id.startsWith("house_land_")) return "Listing (house)";
  if (id.startsWith("house_")) return "Listing (house)";
  if (id.startsWith("analytics_")) return "Analytics";
  if (id.startsWith("community_stats_all_")) return "Community stats (all types)";
  if (id.startsWith("community_stats_")) return "Community stats";
  if (id.startsWith("school_")) return "Schools";
  if (id.startsWith("listing_history_")) return "Listing history";
  if (id.startsWith("listing_price_change_")) return "Price changes";
  if (id.startsWith("rooms_")) return "Rooms";
  const found = HSCompare.EXTRACTABLE_FIELDS.find((f) => f.id === id);
  if (found) return found.group;
  return "Other";
};

HSCompare.rowHasFieldValue = function rowHasFieldValue(row, id) {
  const v = row?.[id];
  if (v == null || v === "") return false;
  if (HSCompare.isRedacted && HSCompare.isRedacted(v)) return false;
  return true;
};

/** Catalog of HouseSigma fields across saved properties (for settings panel). */
HSCompare.buildFieldCatalog = function buildFieldCatalog(properties, settings) {
  const labels = {
    ...HSCompare.COLUMN_LABELS,
    ...(settings?.fieldLabels || {}),
  };
  const ids = new Set();
  for (const id of HSCompare.EXTRACTABLE_FIELD_IDS) ids.add(id);
  for (const id of Object.keys(settings?.fieldLabels || {})) ids.add(id);
  for (const row of Object.values(properties || {})) {
    for (const key of Object.keys(row)) {
      if (HSCompare.INTERNAL_ROW_KEYS.has(key)) continue;
      if (key.startsWith("_")) continue;
      ids.add(key);
    }
  }
  const enabledVisible = new Set(
    HSCompare.getEnabledVisibleFields(settings, properties)
  );
  const rows = [];
  for (const id of ids) {
    const label =
      labels[id] ||
      HSCompare.extractFieldLabel(id) ||
      HSCompare.columnLabel(id, settings);
    let filled = 0;
    let sample = "";
    for (const row of Object.values(properties || {})) {
      if (!HSCompare.rowHasFieldValue(row, id)) continue;
      filled += 1;
      if (!sample) sample = String(row[id]).slice(0, 80);
    }
    rows.push({
      id,
      label,
      group: HSCompare.fieldGroupForId(id),
      filled,
      total: Object.keys(properties || {}).length,
      sample,
      inTable: !HSCompare.INTERNAL_ROW_KEYS.has(id),
      visible: enabledVisible.has(id),
    });
  }
  rows.sort((a, b) => {
    const g = a.group.localeCompare(b.group);
    return g !== 0 ? g : a.label.localeCompare(b.label);
  });
  return rows;
};

HSCompare.columnLabel = function columnLabel(col, settings) {
  if (HSCompare.COLUMN_LABELS[col]) return HSCompare.COLUMN_LABELS[col];
  const custom = settings?.fieldLabels?.[col];
  if (custom) return custom;
  if (col.startsWith("kf_")) return HSCompare.titleCaseLabel(col.slice(3));
  if (col.startsWith("pd_")) return HSCompare.titleCaseLabel(col.slice(3));
  if (col.startsWith("house_parking_")) {
    return `Parking ${HSCompare.titleCaseLabel(col.slice(14))}`;
  }
  if (col.startsWith("house_area_")) {
    return `Size ${HSCompare.titleCaseLabel(col.slice(11))}`;
  }
  if (col.startsWith("house_land_")) {
    return `Land ${HSCompare.titleCaseLabel(col.slice(11))}`;
  }
  if (col.startsWith("house_")) return HSCompare.titleCaseLabel(col.slice(6));
  return HSCompare.titleCaseLabel(col);
};

HSCompare.mergeFieldLabels = function mergeFieldLabels(settings, labels) {
  return { ...(settings?.fieldLabels || {}), ...(labels || {}) };
};

HSCompare.BACKUP_VERSION = 1;
