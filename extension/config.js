// Shared by service worker (importScripts) and popup (<script>).
const HOLDON_SERVER = "http://localhost:3000";
const DEFAULT_NAMES = { parentName: "Margaret", childName: "Sarah" };

async function getNames() {
  const s = await chrome.storage.local.get(["parentName", "childName"]);
  return {
    parentName: (s.parentName || "").trim() || DEFAULT_NAMES.parentName,
    childName: (s.childName || "").trim() || DEFAULT_NAMES.childName,
  };
}

async function isEnabled() {
  const { enabled } = await chrome.storage.local.get("enabled");
  return enabled !== false; // default ON
}

async function postAlert(payload) {
  const res = await fetch(`${HOLDON_SERVER}/api/alert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`server ${res.status}`);
  return res.json();
}
