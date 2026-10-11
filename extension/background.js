importScripts("config.js");

const REMOTE_HOSTS = [
  "anydesk.com", "ultraviewer.net", "teamviewer.com", "rustdesk.com", "screenconnect.com",
  "connectwise.com", "logmein.com", "gotoassist.com", "splashtop.com",
];
const DEBOUNCE_MS = 10 * 60 * 1000;
const MAX_RECENT = 5;

function isRemoteAccess(urlStr) {
  let u;
  try { u = new URL(urlStr); } catch { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  const hit = REMOTE_HOSTS.find((d) => host === d || host.endsWith("." + d));
  if (hit) return host;
  // zoho.com/assist (and assist.zoho.com)
  if (host === "assist.zoho.com") return host;
  if ((host === "zoho.com" || host.endsWith(".zoho.com")) && u.pathname.toLowerCase().startsWith("/assist")) {
    return "zoho.com/assist";
  }
  return null;
}

// --- badge + uninstall URL ---------------------------------------------------
async function setBadge() {
  const on = await isEnabled();
  chrome.action.setBadgeText({ text: on ? "ON" : "OFF" });
  chrome.action.setBadgeBackgroundColor({ color: on ? "#1a7f37" : "#6e7781" });
}

async function updateUninstallUrl() {
  const { parentName, childName } = await getNames();
  const url = `${HOLDON_SERVER}/api/tamper?parent=${encodeURIComponent(parentName)}&child=${encodeURIComponent(childName)}`;
  chrome.runtime.setUninstallURL(url);
}

setBadge();
chrome.runtime.onInstalled.addListener(() => { setBadge(); updateUninstallUrl(); });
chrome.runtime.onStartup.addListener(() => { setBadge(); updateUninstallUrl(); });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.parentName || changes.childName) updateUninstallUrl();
  if (changes.enabled) setBadge();
});

// --- recent tabs (persisted: service worker is ephemeral) ---------------------
async function recordTab(url, title) {
  if (!/^https?:/.test(url || "")) return [];
  const { recent = [] } = await chrome.storage.local.get("recent");
  const next = recent.filter((r) => r.url !== url);
  next.push({ url, title: title || "", ts: new Date().toISOString() });
  const trimmed = next.slice(-MAX_RECENT);
  await chrome.storage.local.set({ recent: trimmed });
  return trimmed;
}

// --- debounce: 1 alert per host per 10 min ------------------------------------
async function shouldAlert(host) {
  const { lastAlert = {} } = await chrome.storage.local.get("lastAlert");
  const now = Date.now();
  if (lastAlert[host] && now - lastAlert[host] < DEBOUNCE_MS) return false;
  lastAlert[host] = now; // claim before the await below so concurrent events don't double-send
  await chrome.storage.local.set({ lastAlert });
  return true;
}

async function releaseClaim(host) {
  const { lastAlert = {} } = await chrome.storage.local.get("lastAlert");
  delete lastAlert[host];
  await chrome.storage.local.set({ lastAlert });
}

// --- overlay (runs in page; must be self-contained) ---------------------------
function showOverlay(childName, kind) {
  if (window.__holdonDismissed || document.getElementById("holdon-overlay")) return;
  const el = document.createElement("div");
  el.id = "holdon-overlay";
  el.setAttribute("role", "alertdialog");
  el.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;background:#b00020;color:#fff;display:flex;" +
    "flex-direction:column;align-items:center;justify-content:center;gap:32px;padding:48px;" +
    "text-align:center;font-family:Arial,Helvetica,sans-serif;";
  const stop = document.createElement("div");
  stop.textContent = "STOP.";
  stop.style.cssText = "font-size:120px;font-weight:900;line-height:1;";
  const msg = document.createElement("div");
  msg.textContent = kind === "fake_virus_popup"
    ? "This warning is FAKE. Do NOT call this number. " + childName + " has been notified."
    : "Microsoft, Apple and your bank will NEVER ask you to install this. " +
      "Hang up the phone. " + childName + " has been notified and will call you.";
  msg.style.cssText = "font-size:48px;font-weight:700;line-height:1.3;max-width:1100px;";
  const btn = document.createElement("button");
  btn.textContent = "I understand";
  btn.style.cssText =
    "font-size:44px;font-weight:800;padding:28px 72px;border:0;border-radius:20px;" +
    "background:#fff;color:#b00020;cursor:pointer;";
  btn.addEventListener("click", () => {
    window.__holdonDismissed = true;
    el.remove();
    document.documentElement.style.overflow = "";
  });
  el.append(stop, msg, btn);
  document.documentElement.appendChild(el);
  document.documentElement.style.overflow = "hidden";
  btn.focus();
}

async function injectOverlay(tabId, childName, kind) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, func: showOverlay, args: [childName, kind] });
  } catch (e) {
    console.warn("[holdon] overlay inject failed:", e.message);
  }
}

// --- main ----------------------------------------------------------------------
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== "complete" && !changeInfo.title) return;
  if (!(await isEnabled())) return;
  const url = tab.url;
  if (!url) return;
  const recent = await recordTab(url, tab.title);
  const host = isRemoteAccess(url);
  if (!host) return;

  const { childName } = await getNames();
  await injectOverlay(tabId, childName, "remote_access_site");
  await alertOnce("remote_access_site", host, url, tab.title || "", recent);
});

// Debounced alert: 1 per (event type, host) per 10 min.
async function alertOnce(eventType, host, url, title, recent) {
  const key = `${eventType}:${host}`;
  if (!(await shouldAlert(key))) return;
  const { parentName, childName } = await getNames();
  try {
    await postAlert({
      event_type: eventType,
      url,
      page_title: title,
      recent_tabs: recent.map((r) => `${r.title || r.url} (${r.url}) @ ${r.ts}`),
      parent_name: parentName,
      child_name: childName,
    });
  } catch (e) {
    console.warn("[holdon] alert failed:", e.message);
    await releaseClaim(key); // let the next event retry
  }
}

// Content script reports a fake tech-support page.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type !== "fake_popup" || !sender.tab?.id) return;
  const tab = sender.tab;
  (async () => {
    if (!(await isEnabled())) return;
    let host;
    try { host = new URL(tab.url).hostname.toLowerCase(); } catch { return; }
    const { recent = [] } = await chrome.storage.local.get("recent");
    const { childName } = await getNames();
    await injectOverlay(tab.id, childName, "fake_virus_popup");
    await alertOnce("fake_virus_popup", host, tab.url, tab.title || "", recent);
  })();
});
