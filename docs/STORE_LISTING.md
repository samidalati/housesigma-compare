# Chrome Web Store listing copy

Use this text in the [Developer Dashboard](https://chrome.google.com/webstore/devconsole). Adjust if your publisher name differs.

## Name

**HouseSigma Compare**

## Short description (max ~132 characters)

Save HouseSigma listings while you browse and compare them in one local table—no account or server required.

## Detailed description

**HouseSigma Compare** (unofficial—not affiliated with or endorsed by HouseSigma) helps you build a personal shortlist while browsing [HouseSigma](https://housesigma.com).

**Save listings**
- Open a property page on HouseSigma, then use the extension popup to add or refresh the listing.
- Everything stays on your computer in Chrome local storage.

**Comparison table**
- Open the comparison page to see all saved properties side by side.
- Sort columns, resize and reorder headers, drag rows to rank listings.
- Mark properties viewed, add scores (0–10), and notes.
- Export selected rows to CSV or back up / restore JSON.

**Commute**
- Set a work or home address once; get transit links and optional drive-time estimates per listing.

**Charts**
- Plot numeric fields across your shortlist to compare prices, demographics, and more.

**Privacy**
- No developer backend: your list is not uploaded to our servers.
- See the privacy policy URL in the store listing for details on local storage and optional calls to OpenStreetMap/OSRM for commute features.

**Requirements**
- You must use HouseSigma in Chrome as you normally would (including login where needed).
- Listing data comes from pages you visit; refresh a property after major site changes.

By using this extension you remain responsible for complying with HouseSigma’s terms of use.

## Category

**Shopping** or **Productivity**

## Privacy policy URL

After enabling GitHub Pages for this repo, use:

`https://<your-github-username>.github.io/housesigma-compare/privacy.html`

Or host `docs/privacy.html` elsewhere over HTTPS and paste that URL in the dashboard.

## Permission justifications (Private listing → Privacy practices)

| Permission / host | Justification |
|-------------------|---------------|
| `storage` | Persist saved properties, notes, scores, column settings, and commute destination locally. |
| `activeTab` | Read the current HouseSigma tab when you click the extension popup to add or refresh a listing. |
| `tabs` | Open the comparison table page and query the active tab URL. |
| `https://housesigma.com/*` | Read listing data from property pages you choose to visit while logged in on HouseSigma. |
| `https://router.project-osrm.org/*` | Optional driving-time estimate when you set a commute destination (public OSRM demo API). |
| `https://nominatim.openstreetmap.org/*` | Geocode your commute destination address to coordinates (one-time per saved address). |

**MAIN world script (`page-extract.js`):** Runs only on HouseSigma to read listing data already present in the page for the logged-in user. No remote code execution; network calls are JSON APIs declared above.

## Screenshot ideas

1. Extension popup on a HouseSigma listing (Add / Refresh button).
2. Comparison table with several properties and sticky header.
3. Charts panel with two series selected.
4. Commute destination modal (optional).

Recommended size: **1280×800** or **640×400** PNG.

## Store icon

Use `extension/icons/icon128.png` (128×128 PNG, teal background).

## Single purpose statement (if prompted)

Help users save and compare HouseSigma property listings locally in the browser.

## Trademark disclaimer (include in description)

*HouseSigma Compare is an independent tool and is not affiliated with, endorsed by, or sponsored by HouseSigma.*
