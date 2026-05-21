/* global HSCompare */

const statusEl = document.getElementById("status");
const countEl = document.getElementById("count");
const hintEl = document.getElementById("hint");
const actionsEl = document.getElementById("actions");
const addBtn = document.getElementById("add-btn");
const refreshBtn = document.getElementById("refresh-btn");
const openBtn = document.getElementById("open-compare-btn");

function setStatus(msg, isError) {
  statusEl.textContent = msg || "";
  statusEl.className = "status" + (msg ? (isError ? " err" : " ok") : "");
}

function setBtnLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.classList.toggle("is-loading", loading);
}

function setActionsLoading(loading) {
  setBtnLoading(addBtn, loading);
  setBtnLoading(refreshBtn, loading);
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
  if (!tabUrl || !/housesigma\.com/i.test(tabUrl)) return null;
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
  const savedKey = savedKeyForTabUrl(tab?.url, data.urls, data.properties);

  if (savedKey) {
    const row = data.properties[savedKey] || {};
    hintEl.textContent = `In your list: ${row.address || "this property"}`;
    hintEl.className = "hint saved";
    refreshBtn.className = "btn btn-primary";
    addBtn.className = "btn btn-secondary";
    actionsEl.insertBefore(refreshBtn, addBtn);
  } else if (tab?.url && /housesigma\.com/i.test(tab.url)) {
    hintEl.textContent = "Not saved yet — use Add, or open another listing.";
    hintEl.className = "hint";
    addBtn.className = "btn btn-primary";
    refreshBtn.className = "btn btn-secondary";
    actionsEl.insertBefore(addBtn, refreshBtn);
  } else {
    hintEl.textContent = "Open a HouseSigma listing page in this tab.";
    hintEl.className = "hint";
    addBtn.className = "btn btn-primary";
    refreshBtn.className = "btn btn-secondary";
    actionsEl.insertBefore(addBtn, refreshBtn);
  }
}

addBtn.addEventListener("click", async () => {
  setStatus("");
  const tab = await getActiveTab();
  if (!tab?.id || !/housesigma\.com/i.test(tab.url || "")) {
    setStatus("Open a HouseSigma listing page in this tab first.", true);
    return;
  }
  setActionsLoading(true);
  try {
    const res = await sendToTab(tab.id, { action: "add" });
    if (res?.ok) {
      setStatus("Added to comparison.");
      await refreshCount();
      await updatePopupUi();
    } else {
      setStatus(res?.error || "Could not add property.", true);
    }
  } catch (e) {
    setStatus(
      "Reload the listing page, then try again. " + (e.message || e),
      true
    );
  } finally {
    setActionsLoading(false);
  }
});

refreshBtn.addEventListener("click", async () => {
  setStatus("");
  const tab = await getActiveTab();
  if (!tab?.id || !/housesigma\.com/i.test(tab.url || "")) {
    setStatus("Open the property listing tab on HouseSigma first.", true);
    return;
  }
  const data = await HSCompare.loadAll();
  const savedKey = savedKeyForTabUrl(tab.url, data.urls, data.properties);
  if (!savedKey) {
    setStatus("Not in your list yet — use Add current property first.", true);
    return;
  }
  setActionsLoading(true);
  try {
    const extracted = await sendToTab(tab.id, { action: "extract" });
    if (!extracted?.ok) {
      setStatus(extracted?.error || "Could not read listing.", true);
      return;
    }
    const res = await HSCompare.refreshProperty(savedKey, extracted.row);
    if (res?.ok) {
      setStatus(res.address ? `Refreshed: ${res.address}` : "Refreshed.");
      await refreshCount();
      await updatePopupUi();
    } else {
      setStatus(res?.error || "Refresh failed.", true);
    }
  } catch (e) {
    setStatus(
      "Reload the listing page, then try again. " + (e.message || e),
      true
    );
  } finally {
    setActionsLoading(false);
  }
});

openBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("compare.html") });
});

(async () => {
  await refreshCount();
  await updatePopupUi();
})();
