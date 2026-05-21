/**
 * Runs in the page MAIN world — reads Pinia listing data and HouseSigma APIs.
 * Talks to content.js via window.postMessage (CustomEvent detail does not cross worlds).
 */
(function () {
  const EXT_SOURCE = "hs-compare-extension";
  const PAGE_SOURCE = "hs-compare-page";

  function plainJson(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return null;
    }
  }

  function publishResult(payload) {
    window.postMessage(
      { source: PAGE_SOURCE, payload: plainJson(payload) || payload },
      "*"
    );
  }

  function getListingStore() {
    const app = document.querySelector("#app");
    if (!app || !app.__vue_app__) return null;
    const pinia = app.__vue_app__.config.globalProperties.$pinia;
    if (!pinia || !pinia._s) return null;
    return pinia._s.get("listing") || null;
  }

  /** Same path as Python scraper: store.$state.listing.resp */
  function getPiniaListingResp() {
    const store = getListingStore();
    if (!store) return null;
    const state = store.$state || {};
    const candidates = [
      state.listing?.resp,
      state.resp,
      store.resp,
    ];
    for (const resp of candidates) {
      if (resp && typeof resp === "object" && resp.house) {
        return plainJson(resp) || resp;
      }
    }
    const fallback = state.listing?.resp || state.resp;
    return fallback && typeof fallback === "object"
      ? plainJson(fallback) || fallback
      : null;
  }

  function listingDiagnostics() {
    const store = getListingStore();
    if (!store) {
      return { view: null, idListing: null, hasStore: false, url: location.href };
    }
    const state = store.$state || {};
    return {
      hasStore: true,
      view: state.view,
      idListing: state.idListing,
      hasResp: !!getPiniaListingResp(),
      url: location.href,
    };
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function waitForListing(maxMs) {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      const store = getListingStore();
      const state = store?.$state;
      if (state?.view === "NOT_FOUND") {
        return { ok: false, error: "Listing not found on HouseSigma (check the URL)." };
      }
      const resp = getPiniaListingResp();
      if (resp?.house) return { ok: true };
      await sleep(250);
    }
    const diag = listingDiagnostics();
    if (!diag.hasStore) {
      return {
        ok: false,
        error:
          "HouseSigma app not ready — wait for the page to finish loading, then try again.",
      };
    }
    if (diag.view === "NOT_FOUND") {
      return { ok: false, error: "Listing not found on HouseSigma (check the URL)." };
    }
    const onDetail =
      /\/home\//i.test(location.pathname) || !!diag.idListing;
    if (!onDetail) {
      return {
        ok: false,
        error:
          "Open a single property page (URL should include /home/…), not search or map view.",
      };
    }
    return {
      ok: false,
      error:
        "Listing still loading — wait a few seconds and click Add again. " +
        `(view=${diag.view || "?"}, hasResp=${diag.hasResp})`,
    };
  }

  async function fetchDemographic(lat, lon) {
    const token = localStorage.getItem("access_token") || "";
    const headers = {
      "Content-Type": "application/json",
      "HS-Client-Type": "desktop_v7",
      "HS-Client-Version": "7.22.7",
    };
    if (token) headers.Authorization = "Bearer " + token;
    const r = await fetch("/bkv2/api/stats/demographic", {
      method: "POST",
      headers,
      body: JSON.stringify({
        lang: "en_US",
        province: "ON",
        lat,
        lon,
      }),
    });
    const j = await r.json();
    return j?.data?.demographic?.summary || {};
  }

  function scrollBuySellHistory() {
    try {
      const listing = [...document.querySelectorAll("*")].find(
        (el) =>
          el.textContent &&
          /listing history/i.test(el.textContent) &&
          el.children.length < 8
      );
      if (listing) listing.click();
    } catch (_) {}
    const headings = [...document.querySelectorAll("h2,h3,h4,div,span")];
    for (const el of headings) {
      const t = (el.textContent || "").trim();
      if (/buy\/sell history/i.test(t)) {
        el.scrollIntoView({ block: "center", behavior: "instant" });
        break;
      }
    }
  }

  function lastSoldFromDom() {
    scrollBuySellHistory();
    const soldRows = [];
    for (const table of document.querySelectorAll("table.table")) {
      const headers = [...table.querySelectorAll("thead th")].map((th) =>
        (th.innerText || "").trim()
      );
      const iStart = headers.indexOf("Date Start");
      const iEnd = headers.indexOf("Date End");
      const iPrice = headers.indexOf("Price");
      const iEvent = headers.indexOf("Event");
      if (iEvent < 0 || iPrice < 0) continue;
      for (const tr of table.querySelectorAll("tbody tr")) {
        const tds = [...tr.querySelectorAll("td")];
        if (tds.length <= iEvent) continue;
        const event = (tds[iEvent].innerText || "").trim();
        if (event.toLowerCase() !== "sold") continue;
        const price = (tds[iPrice].innerText || "").replace(/\s+/g, " ").trim();
        const dateEnd = iEnd >= 0 ? (tds[iEnd].innerText || "").trim() : "";
        const dateStart = iStart >= 0 ? (tds[iStart].innerText || "").trim() : "";
        if (/sign-in|agreement required/i.test(price)) continue;
        if (!/\$/.test(price)) continue;
        soldRows.push({ price, date: dateEnd || dateStart });
      }
    }
    if (!soldRows.length) return { price: "", date: "" };
    soldRows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return soldRows[0];
  }

  async function extractListing() {
    const ready = await waitForListing(20000);
    if (!ready.ok) {
      return { ok: false, error: ready.error };
    }
    const resp = getPiniaListingResp();
    if (!resp?.house) {
      const diag = listingDiagnostics();
      return {
        ok: false,
        error:
          "Could not read listing from page. Reload the tab and try again. " +
          `(view=${diag.view || "?"})`,
      };
    }
    const house = resp.house || {};
    const lat = house.map?.lat;
    const lon = house.map?.lon;
    let demographic = {};
    if (lat != null && lon != null) {
      try {
        demographic = await fetchDemographic(Number(lat), Number(lon));
      } catch (_) {
        demographic = {};
      }
    }
    const domSold = lastSoldFromDom();
    return {
      ok: true,
      resp,
      demographic: plainJson(demographic) || demographic,
      domSold,
      pageUrl: location.href.split("#")[0],
    };
  }

  window.addEventListener("message", async (ev) => {
    if (ev.source !== window) return;
    if (ev.data?.source !== EXT_SOURCE || ev.data?.action !== "extract") return;
    try {
      publishResult(await extractListing());
    } catch (e) {
      publishResult({ ok: false, error: String(e.message || e) });
    }
  });
})();
