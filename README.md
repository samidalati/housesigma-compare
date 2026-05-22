# HouseSigma Compare (Chrome Extension)

Save HouseSigma listings while you browse (logged in normally), then open a comparison table with demographics, schools, sold history, and highlights — **no Python server, Playwright, or session import**.

## Install (Load unpacked)

1. Clone or download this repo.
2. Open Chrome → **Extensions** → enable **Developer mode**.
3. Click **Load unpacked** and select the `extension/` folder inside this repo:
   ```
   housesigma-compare/extension/
   ```
4. Pin **HouseSigma Compare** on the toolbar if you like.

## Use

1. Log into [HouseSigma](https://housesigma.com) in Chrome as usual.
2. Open a **property listing** page (URL contains `/home/`).
3. Click the extension icon → **Add current property** (or **Refresh current property** if it is already saved).
4. Repeat for other listings.
5. Click **Open comparison table** to review, reorder, export CSV, or backup JSON.

### Refresh a property

1. Open the listing on HouseSigma (logged in, page fully loaded).
2. Click the extension icon.
3. If it says **In your list: …**, the main button reads **Refresh current property** — click it to update data in place (**Viewed** stays checked).
4. If the listing is not saved yet, the same button reads **Add current property**.

### Fields from HouseSigma

When you **add** or **refresh** a property, the extension pulls all listing fields it can read from HouseSigma. Click the **sliders** button above the table to choose which columns to show, then **Save**. Use **Select with data**, **Select all**, or **Reset to defaults** as shortcuts. **Viewed**, **Score**, and **Notes** are always in the table.

Re-**refresh** existing saved properties once to backfill extra fields if they were added before this behavior.

### Comparison table

- **Drag** handle (first column) — reorder rows manually (clears column sort).
- **Select** — check rows to export CSV.
- **Viewed** — persisted checkbox per listing.
- **Score** — your rating (0–10 dropdown), persisted per listing.
- **Photo** — fixed-size thumbnail; click to open the HouseSigma listing.
- **Property** / **Address** — listing link and address.
- **Map** — Google Maps link.
- **Description** — from HouseSigma; collapsed with expand control.
- **Notes** — your notes (up to 1000 characters), saved on blur.
- **Sort** — click a column header to sort; click again to reverse.
- **Column width** — drag the right edge of a header to resize; double-click the edge to fit content (within min/max limits). Widths are saved.
- **Column order** — drag a header (hold briefly, then drag) to reorder columns; order is saved.
- **Sticky header** — column headers stay visible at the top while you scroll down the page.
- **Delete** — removes selected properties from the list.
- **Export** — CSV for selected rows only.
- **Charts** — pick numeric columns below the table to compare values across properties (all rows or **Selected properties only**). Multiple columns plot as series on one chart. Choices are saved.
- **Highlight rules** (red text): Low Income > 10%, Renters > 30%, Households With Children < 40%, Avg Household Income < $100k.
- **Commute destination** — set work/home address; **Transit** and **Drive** update for all rows (~1 s per property for drive). Use the refresh icon in **Drive** to recalculate one row.

### Backup

- **Export backup JSON** — full `urls`, `properties`, and `settings`.
- **Import backup JSON** — replaces current data.
- **Import (merge)** — adds properties from file without removing existing ones.

## Permissions

- `housesigma.com` — read listing data from pages you visit while logged in.
- `router.project-osrm.org` — optional drive-time estimates.
- `nominatim.openstreetmap.org` — geocode office address once.

## Data storage

Everything is stored locally in `chrome.storage.local` on your machine. Nothing is sent to a custom backend.

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| “Open a HouseSigma listing page first” | Navigate to a single property detail page, wait for it to load, then add. |
| “Reload the listing page” | Refresh the tab after installing/updating the extension. |
| Sold history empty | Confirm MLS/board login on the listing in HouseSigma (same as the website). |
| Duplicate address | Same street address already saved — delete the old row or use a different listing. |

## Development

This extension ports logic from the older Python tool at `serversetup/tools/housesigma_compare/` (reference only). The extension repo is the product going forward.

### Layout

```
extension/
  manifest.json
  popup.html / popup.js
  compare.html / compare.js / compare.css
  content.js          # isolated world — messaging
  page-extract.js     # page world — Pinia + API
  lib/
    fields.js
    discover-fields.js
    chart-value.js
    normalize.js
    storage.js
    commute.js
  icons/              # PNGs from Font Awesome [house](https://fontawesome.com/icons/classic/solid/house) (CC BY 4.0)
```

## License

Personal use tool; HouseSigma data remains subject to HouseSigma terms.
