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
3. Click the extension icon → **Add current property**.
4. Repeat for other listings.
5. Click **Open comparison table** to review, reorder, export CSV, or backup JSON.

### Refresh a property

1. Open the listing on HouseSigma (logged in, page fully loaded).
2. Click the extension icon.
3. If it says **In your list: …**, click **Refresh current property** (green button).
4. Data updates in place; **Viewed** stays checked.

If the property is not saved yet, use **Add current property** first.

### Comparison table

- **Viewed** checkbox — persisted in extension storage.
- **Drag** rows to reorder.
- **Delete** removes a property from the list.
- **Export selected CSV** — only checked rows.
- **Highlight rules** (red text): Low Income > 10%, Renters > 30%, Households With Children < 40%, Avg Household Income < $100k.
- **Drive to office** — if empty, click the refresh icon in that cell to calculate via OSRM (office default: 171 E Liberty St, Toronto).
- **Transit** column — Google Maps transit directions link (open in browser).

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
    normalize.js
    storage.js
    commute.js
  icons/              # PNGs from Font Awesome [house](https://fontawesome.com/icons/classic/solid/house) (CC BY 4.0)
```

## License

Personal use tool; HouseSigma data remains subject to HouseSigma terms.
