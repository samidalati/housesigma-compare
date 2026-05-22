# Publishing HouseSigma Compare to the Chrome Web Store

This guide covers public listing setup. Automated pieces are in `scripts/`; account registration and dashboard upload are manual steps only you can complete.

## Prerequisites checklist

- [ ] `extension/icons/icon16.png`, `icon48.png`, `icon128.png` exist
- [ ] `extension/vendor/Sortable.min.js` exists
- [ ] Load unpacked on `extension/` folder works in Chrome
- [ ] Privacy policy hosted at a public HTTPS URL (see [Privacy policy](#privacy-policy))
- [ ] Store listing text from [STORE_LISTING.md](STORE_LISTING.md)
- [ ] Screenshots captured (1280×800 or 640×400)

## 1. Developer account (manual)

1. Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Sign in with your Google account.
3. Pay the **one-time $5 USD** developer registration fee.
4. Complete your **publisher profile** (name and contact shown to users).

You cannot skip this step; publishing requires an verified developer account.

## 2. Package the extension

From the repository root:

```bash
./scripts/build-extension-zip.sh
```

This creates `dist/housesigma-compare.zip` with `manifest.json` at the root of the archive.

**Before each upload:** bump `version` in [extension/manifest.json](../extension/manifest.json) (e.g. `1.0.11` → `1.0.12`). Chrome rejects re-uploads with the same version.

**Smoke test the ZIP:**

1. Chrome → Extensions → Developer mode → **Load unpacked** → select `extension/` (folder, not ZIP).
2. Or unpack the ZIP to a temp folder and load that folder.
3. Test: add a listing, open comparison table, drag reorder, commute, export CSV.

## 3. Privacy policy

Host [privacy.html](privacy.html) over HTTPS.

**GitHub Pages (recommended if this repo is on GitHub):**

1. Repository **Settings** → **Pages**.
2. Source: **Deploy from a branch** → branch `main` → folder `/docs`.
3. Save. After deploy, your policy URL is:
   `https://<username>.github.io/housesigma-compare/privacy.html`
4. Paste that URL into the Chrome Web Store “Privacy policy” field.

Markdown copy for reference: [PRIVACY.md](PRIVACY.md).

## 4. Create the store listing (manual)

1. Dashboard → **New item** → upload `dist/housesigma-compare.zip`.
2. Copy name, descriptions, and permission text from [STORE_LISTING.md](STORE_LISTING.md).
3. Upload **128×128** icon (`extension/icons/icon128.png`) and at least one screenshot.
4. Set **Category** (Shopping or Productivity).
5. Complete **Privacy practices** / data use questionnaire honestly:
   - Data processed locally on device
   - Optional third-party APIs for commute (OSRM, Nominatim)
   - No sale of user data
6. Add the **privacy policy URL** from step 3.
7. **Submit for review**.

Review often takes a few days to two weeks for a first submission.

## 5. Common review issues

| Issue | Mitigation |
|-------|------------|
| Trademark | Keep “unofficial, not affiliated with HouseSigma” in the description. |
| MAIN world script | Explain in the dashboard that `page-extract.js` only reads HouseSigma page data the user already sees. |
| Missing assets in ZIP | Re-run `build-extension-zip.sh` after verifying icons and vendor files. |
| Permissions | Do not add broader host permissions than needed. |

## 6. After approval

1. Copy the **public store URL** from the dashboard (Share → copy link).
2. Add the link to [README.md](../README.md) if desired.
3. For updates: bump `version`, rebuild ZIP, upload as a new package version, submit for review.

Updates usually review faster than the first publish.

## Regenerating icons

Icons are generated from `extension/icons/house.svg` (Font Awesome house, CC BY 4.0):

```bash
./scripts/generate-icons.sh
```

## Regenerating vendor JS

Sortable.js is pinned from jsDelivr (SortableJS 1.15.2):

```bash
./scripts/fetch-vendor.sh
```
