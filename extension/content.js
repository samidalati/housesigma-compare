/**
 * Content script on housesigma.com — bridges page extract to extension APIs.
 */
/* global HSCompare */

const EXT_SOURCE = "hs-compare-extension";
const PAGE_SOURCE = "hs-compare-page";

function waitForExtract(timeoutMs) {
  return new Promise((resolve, reject) => {
    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    }

    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          "Extraction timed out — reload the listing page, then click Add again."
        )
      );
    }, timeoutMs);

    function onMessage(ev) {
      if (ev.source !== window) return;
      if (ev.data?.source !== PAGE_SOURCE) return;
      cleanup();
      const payload = ev.data.payload;
      if (!payload || typeof payload !== "object") {
        resolve({
          ok: false,
          error:
            "Page script returned no data — reload the extension and refresh this tab.",
        });
        return;
      }
      resolve(payload);
    }

    window.addEventListener("message", onMessage);
    window.postMessage({ source: EXT_SOURCE, action: "extract" }, "*");
  });
}

async function getOfficeCoords() {
  const data = await HSCompare.loadAll();
  const settings = data.settings || HSCompare.defaultSettings();
  if (
    settings.officeCoords &&
    Array.isArray(settings.officeCoords) &&
    settings.officeCoords.length === 2
  ) {
    return settings.officeCoords;
  }
  const coords = await HSCompare.geocodeOffice(settings.officeAddress);
  if (coords) {
    settings.officeCoords = coords;
    await HSCompare.saveAll({ ...data, settings });
  }
  return coords;
}

async function extractProperty() {
  let raw;
  try {
    raw = await waitForExtract(25000);
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
  if (!raw.ok) {
    return {
      ok: false,
      error: raw.error || "Could not extract listing data.",
    };
  }
  if (!raw.resp?.house) {
    return {
      ok: false,
      error: "Listing data was empty after extract — reload the page and try again.",
    };
  }
  try {
    raw.officeCoords = await getOfficeCoords();
    const row = HSCompare.buildPropertyRow(raw, raw.pageUrl || location.href);
    delete row._coords;
    return { ok: true, row, coords: raw.resp?.house?.map };
  } catch (e) {
    return { ok: false, error: "Failed to build property row: " + (e.message || e) };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg.action === "ping") {
        sendResponse({
          ok: true,
          onListing:
            /housesigma\.com/i.test(location.hostname) &&
            (/\/home\//i.test(location.pathname) ||
              /[?&]id_listing=/i.test(location.search)),
        });
        return;
      }
      if (msg.action === "extract") {
        sendResponse(await extractProperty());
        return;
      }
      if (msg.action === "add") {
        const extracted = await extractProperty();
        if (!extracted.ok) {
          sendResponse(extracted);
          return;
        }
        const result = await HSCompare.addProperty(
          extracted.row.url,
          extracted.row
        );
        sendResponse(result);
        return;
      }
      sendResponse({ ok: false, error: "Unknown action" });
    } catch (e) {
      sendResponse({ ok: false, error: String(e.message || e) });
    }
  })();
  return true;
});
