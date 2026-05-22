/* global HSCompare */
var HSCompare = globalThis.HSCompare || (globalThis.HSCompare = {});

HSCompare.COLUMNS = [
  "url",
  "photo",
  "address",
  "google_maps",
  "viewed",
  "score",
  "listed_price",
  "last_sold_price",
  "last_sold_date",
  "property_tax",
  "bedrooms",
  "bathrooms",
  "garages",
  "parking_spots",
  "lot_size",
  "lot_area",
  "size",
  "days_on_market",
  "drive_to_office",
  "transit_to_office",
  "low_income",
  "renters",
  "condos",
  "households_with_children",
  "average_home_value",
  "average_household_income",
  "elementary_school",
  "elementary_school_score",
  "scraped_at",
  "description",
  "user_notes",
];

HSCompare.TABLE_COLUMNS = HSCompare.COLUMNS.filter(
  (c) => !["url", "photo", "google_maps", "viewed", "score"].includes(c)
);

HSCompare.EXPORT_COLUMNS = [
  "url",
  "address",
  "score",
  ...HSCompare.TABLE_COLUMNS,
];

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
  scraped_at: "Scraped At",
};

HSCompare.titleCaseLabel = function titleCaseLabel(text) {
  return String(text || "")
    .replace(/_/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
};

HSCompare.columnLabel = function columnLabel(col) {
  if (HSCompare.COLUMN_LABELS[col]) return HSCompare.COLUMN_LABELS[col];
  return HSCompare.titleCaseLabel(col);
};

HSCompare.BACKUP_VERSION = 1;
