const $ = (id) => document.getElementById(id);

async function init() {
  const s = await chrome.storage.local.get(["parentName", "childName"]);
  $("parent").value = s.parentName || DEFAULT_NAMES.parentName;
  $("child").value = s.childName || DEFAULT_NAMES.childName;
  const on = await isEnabled();
  $("enabled").checked = on;
  renderEnabled(on);
  // persist defaults so the uninstall URL is built from real values
  await save();
  checkStatus();
}

function renderEnabled(on) {
  $("enabledLabel").textContent = on ? "Protection: ON" : "Protection: OFF";
}

$("enabled").addEventListener("change", async (e) => {
  const on = e.target.checked;
  await chrome.storage.local.set({ enabled: on });
  renderEnabled(on);
});

async function save() {
  await chrome.storage.local.set({
    parentName: $("parent").value.trim() || DEFAULT_NAMES.parentName,
    childName: $("child").value.trim() || DEFAULT_NAMES.childName,
  });
}

async function checkStatus() {
  const el = $("status");
  try {
    const res = await fetch(`${HOLDON_SERVER}/api/stats`);
    const data = await res.json();
    if (data.telegram_configured) {
      el.textContent = "Connected to Telegram ✅";
    } else {
      el.textContent = "Server up, Telegram not set up ⚠️";
    }
  } catch {
    el.textContent = "Can't reach HoldOn server ❌";
  }
}

$("parent").addEventListener("input", save);
$("child").addEventListener("input", save);

$("test").addEventListener("click", async () => {
  const btn = $("test");
  const out = $("result");
  btn.disabled = true;
  out.textContent = "Sending…";
  try {
    await save();
    const { parentName, childName } = await getNames();
    const r = await postAlert({
      event_type: "setup_test",
      url: "",
      page_title: "",
      recent_tabs: [],
      parent_name: parentName,
      child_name: childName,
    });
    out.textContent = r.telegram_sent ? `Sent! Check ${childName}'s Telegram.` : "Server got it, but Telegram send failed.";
  } catch (e) {
    out.textContent = "Failed: " + e.message;
  } finally {
    btn.disabled = false;
  }
});

$("clear").addEventListener("click", async () => {
  await chrome.storage.local.remove("lastAlert");
  $("result").textContent = "Debounce cleared. Next scam page will alert again.";
});

init();
