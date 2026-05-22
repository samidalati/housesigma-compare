/* global HSCompare */

const statusEl = document.getElementById("status");
const countEl = document.getElementById("count");
const hintEl = document.getElementById("hint");
const propertyBtn = document.getElementById("property-btn");
const propertyBtnLabel = document.getElementById("property-btn-label");
const openBtn = document.getElementById("open-compare-btn");

/** @type {string | null} */
let currentSavedKey = null;
let propertyBtnEnabled = false;

function isHouseSigmaUrl(url) {
  if (!url) return false;
  try {
    const { protocol, hostname } = new URL(url);
    return (
      protocol === "https:" &&
      (hostname === "housesigma.com" || hostname === "www.housesigma.com")
    );
  } catch (_) {
    return false;
  }
}

function setStatus(msg, isError) {
  statusEl.textContent = msg || "";
  statusEl.className = "status" + (msg ? (isError ? " err" : " ok") : "");
}

function setPropertyBtnLoading(loading) {
  propertyBtn.disabled = loading || !propertyBtnEnabled;
  propertyBtn.classList.toggle("is-loading", loading);
}

async function refreshCount() {
  const data = await HSCompare.loadAll();
  const n = data.urls.length;
  countEl.textContent = String(n);
  const badge = n > 0 ? String(n) : "";
  chrome.action.setBadgeText({ text: badge });
  chrome.action.setBadgeBackgroundColor({ color: "#0d6e6e" });
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToTab(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message);
}

function savedKeyForTabUrl(tabUrl, urls, properties) {
  if (!tabUrl || !isHouseSigmaUrl(tabUrl)) return null;
  const bare = tabUrl.split("#")[0];
  try {
    const norm = HSCompare.normalizeUrl(bare);
    if (urls.includes(norm)) return norm;
  } catch (_) {
    /* fall through */
  }
  return HSCompare.resolveStoredUrlKey(urls, bare);
}

async function updatePopupUi() {
  const data = await HSCompare.loadAll();
  const tab = await getActiveTab();
  const onHouseSigma = isHouseSigmaUrl(tab?.url);
  propertyBtnEnabled = onHouseSigma;
  propertyBtn.disabled = !onHouseSigma;
  currentSavedKey = savedKeyForTabUrl(tab?.url, data.urls, data.properties);

  if (!onHouseSigma) {
    hintEl.textContent = "Open a page on housesigma.com in this tab.";
    hintEl.className = "hint";
    propertyBtnLabel.textContent = "Add current property";
  } else if (currentSavedKey) {
    const row = data.properties[currentSavedKey] || {};
    hintEl.textContent = `In your list: ${row.address || "this property"}`;
    hintEl.className = "hint saved";
    propertyBtnLabel.textContent = "Refresh current property";
  } else {
    hintEl.textContent = "Not saved yet — click below to add.";
    hintEl.className = "hint";
    propertyBtnLabel.textContent = "Add current property";
  }
  propertyBtn.className = "btn btn-primary";
}

async function addCurrentProperty(tab) {
  const res = await sendToTab(tab.id, { action: "add" });
  if (res?.ok) {
    setStatus("Added to comparison.");
    await refreshCount();
    await updatePopupUi();
  } else {
    setStatus(res?.error || "Could not add property.", true);
  }
}

async function refreshCurrentProperty(tab, savedKey) {
  const extracted = await sendToTab(tab.id, { action: "extract" });
  if (!extracted?.ok) {
    setStatus(extracted?.error || "Could not read listing.", true);
    return;
  }
  const res = await HSCompare.refreshProperty(
    savedKey,
    extracted.row,
    extracted.fieldLabels
  );
  if (res?.ok) {
    setStatus(res.address ? `Refreshed: ${res.address}` : "Refreshed.");
    await refreshCount();
    await updatePopupUi();
  } else {
    setStatus(res?.error || "Refresh failed.", true);
  }
}

propertyBtn.addEventListener("click", async () => {
  setStatus("");
  const tab = await getActiveTab();
  if (!tab?.id || !propertyBtnEnabled) return;

  setPropertyBtnLoading(true);
  try {
    if (currentSavedKey) {
      await refreshCurrentProperty(tab, currentSavedKey);
    } else {
      await addCurrentProperty(tab);
    }
  } catch (e) {
    setStatus(
      "Reload the listing page, then try again. " + (e.message || e),
      true
    );
  } finally {
    setPropertyBtnLoading(false);
  }
});

openBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("compare.html") });
});

(async () => {
  await refreshCount();
  await updatePopupUi();
})();
