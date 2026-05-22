/* global HSCompare */
var HSCompare = globalThis.HSCompare || (globalThis.HSCompare = {});

/** Table / UI columns that are never plotted. */
HSCompare.NON_CHARTABLE_COLUMNS = new Set([
  "drag",
  "select",
  "viewed",
  "photo",
  "property",
  "map",
  "user_notes",
  "description",
  "address",
  "elementary_school",
  "transit_to_office",
  "url",
  "google_maps",
]);

HSCompare.parseDollarAmount = function parseDollarAmount(val) {
  const digits = String(val).replace(/[^0-9.]/g, "");
  if (!digits) return NaN;
  return parseFloat(digits);
};

HSCompare.parsePercent = function parsePercent(val) {
  const m = String(val).match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : NaN;
};

/** Beds, baths, etc.: "3+2" → 5, "2.5" → 2.5, "3" → 3 (not 32). */
HSCompare.parseCountValue = function parseCountValue(val) {
  const s = String(val ?? "").trim();
  if (!s) return NaN;

  if (/\d\s*\+\s*\d/.test(s)) {
    const parts = s.split(/\+/).map((part) => {
      const m = part.trim().match(/(\d+(?:\.\d+)?)/);
      return m ? parseFloat(m[1]) : NaN;
    });
    const nums = parts.filter((n) => Number.isFinite(n));
    if (nums.length) return nums.reduce((sum, n) => sum + n, 0);
  }

  const range = s.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  if (range) {
    const lo = parseFloat(range[1]);
    const hi = parseFloat(range[2]);
    if (Number.isFinite(lo) && Number.isFinite(hi)) return (lo + hi) / 2;
  }

  const m = s.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : NaN;
};

/** First number in text; uses parseCountValue when value looks like "3+2". */
HSCompare.parseLooseNumber = function parseLooseNumber(val) {
  const s = String(val ?? "").trim();
  if (!s) return NaN;
  if (/\d\s*\+\s*\d/.test(s)) return HSCompare.parseCountValue(s);
  const m = s.match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
};

HSCompare.formatRoundedNumber = function formatRoundedNumber(value) {
  const r = Math.round(Number(value) * 10) / 10;
  return Number.isInteger(r) ? String(r) : String(r);
};

HSCompare.isCountColumn = function isCountColumn(col) {
  if (
    col === "bedrooms" ||
    col === "bathrooms" ||
    col === "garages" ||
    col === "parking_spots"
  ) {
    return true;
  }
  return /bed|bath|washroom|garage|parking/i.test(String(col || ""));
};

/** Numeric value for sorting and charts; null when not a number. */
HSCompare.numericValueForColumn = function numericValueForColumn(row, col) {
  if (!row) return null;
  if (col === "score") {
    const n = HSCompare.normalizeScore(row.score);
    return Number.isFinite(n) ? n : null;
  }

  const s = String(row[col] ?? "").trim();
  if (!s) return null;

  if (col === "drive_to_office") {
    const m = s.match(/(\d+(?:\.\d+)?)\s*min/i);
    if (m) {
      const n = Number(m[1]);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }
  if (col === "last_sold_date") {
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : null;
  }
  if (col === "days_on_market") {
    const m = s.match(/(\d+)/);
    return m ? Number(m[1]) : null;
  }
  if (col === "lot_area" || col === "lot_size") {
    const n = parseFloat(s.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  if (
    col === "listed_price" ||
    col === "last_sold_price" ||
    col === "property_tax" ||
    col === "average_home_value" ||
    col === "average_household_income"
  ) {
    const n = HSCompare.parseDollarAmount(s);
    return Number.isFinite(n) ? n : null;
  }
  if (
    col === "low_income" ||
    col === "renters" ||
    col === "condos" ||
    col === "households_with_children"
  ) {
    const n = HSCompare.parsePercent(s);
    return Number.isFinite(n) ? n : null;
  }
  if (col === "elementary_school_score") {
    const n = HSCompare.parseLooseNumber(s);
    return Number.isFinite(n) ? n : null;
  }
  if (HSCompare.isCountColumn(col)) {
    const n = HSCompare.parseCountValue(s);
    return Number.isFinite(n) ? n : null;
  }

  const generic = HSCompare.parseLooseNumber(s);
  return Number.isFinite(generic) ? generic : null;
};

HSCompare.chartValueFormat = function chartValueFormat(col) {
  if (
    col === "listed_price" ||
    col === "last_sold_price" ||
    col === "property_tax" ||
    col === "average_home_value" ||
    col === "average_household_income"
  ) {
    return "dollar";
  }
  if (
    col === "low_income" ||
    col === "renters" ||
    col === "condos" ||
    col === "households_with_children"
  ) {
    return "percent";
  }
  if (col === "drive_to_office") return "minutes";
  if (col === "last_sold_date") return "date";
  return "number";
};

/** Y-axis max and tick values from the largest plotted number. */
HSCompare.computeChartYAxis = function computeChartYAxis(maxValue, tickCount = 5) {
  const max = Number(maxValue);
  const count = Math.max(2, tickCount);
  if (!Number.isFinite(max) || max <= 0) {
    return { yMax: 1, ticks: Array.from({ length: count }, (_, i) => i / (count - 1)) };
  }
  const padded = max * 1.08;
  let yMax;
  if (padded <= 12) yMax = Math.ceil(padded);
  else if (padded <= 60) yMax = Math.ceil(padded / 5) * 5;
  else if (padded <= 120) yMax = Math.ceil(padded / 10) * 10;
  else if (padded <= 600) yMax = Math.ceil(padded / 30) * 30;
  else yMax = Math.ceil(padded / 100) * 100;
  const ticks = Array.from({ length: count }, (_, i) => (yMax * i) / (count - 1));
  return { yMax, ticks };
};

/** Axis labels — plain numbers, no locale padding. */
HSCompare.formatChartAxisTick = function formatChartAxisTick(col, value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  if (!col) {
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1000) return `${Math.round(n / 1000)}k`;
    return HSCompare.formatRoundedNumber(n);
  }
  const fmt = HSCompare.chartValueFormat(col);
  if (fmt === "dollar") {
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1000) return `$${Math.round(n / 1000)}k`;
    return `$${Math.round(n)}`;
  }
  if (fmt === "percent") return `${HSCompare.formatRoundedNumber(n)}%`;
  if (fmt === "minutes") return `${Math.round(n)} min`;
  if (HSCompare.isCountColumn(col)) return HSCompare.formatRoundedNumber(n);
  if (fmt === "date") {
    const d = new Date(n);
    return Number.isFinite(d.getTime())
      ? d.toLocaleDateString("en-CA", { month: "short", year: "2-digit" })
      : String(Math.round(n));
  }
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return HSCompare.formatRoundedNumber(n);
};

/** Full-precision label for chart hover tooltips. */
HSCompare.formatChartTooltipValue = function formatChartTooltipValue(col, value) {
  if (value == null || !Number.isFinite(value)) return "—";
  const fmt = HSCompare.chartValueFormat(col);
  if (fmt === "dollar") {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    }).format(value);
  }
  if (fmt === "percent") return `${HSCompare.formatRoundedNumber(value)}%`;
  if (fmt === "minutes") return `${Math.round(value)} min`;
  if (HSCompare.isCountColumn(col)) return HSCompare.formatRoundedNumber(value);
  if (fmt === "date") {
    const d = new Date(value);
    return Number.isFinite(d.getTime())
      ? d.toLocaleDateString("en-CA", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : String(value);
  }
  if (Math.abs(value) >= 1000) return value.toLocaleString("en-CA");
  return String(Math.round(value * 100) / 100);
};

/** Column ids that have at least one numeric value in the given property keys. */
HSCompare.chartableColumnIds = function chartableColumnIds(
  columnIds,
  properties,
  keys
) {
  const ids = [];
  for (const col of columnIds || []) {
    if (HSCompare.NON_CHARTABLE_COLUMNS.has(col)) continue;
    for (const key of keys || []) {
      const row = properties?.[key];
      const n = HSCompare.numericValueForColumn(row, col);
      if (n != null && Number.isFinite(n)) {
        ids.push(col);
        break;
      }
    }
  }
  return ids;
};
