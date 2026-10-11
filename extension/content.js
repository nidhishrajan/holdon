// Detects fake tech-support / virus-popup pages. Reports to the service worker,
// which handles debounce, alert POST and overlay.
(() => {
  if (window.top !== window) return;

  // Official sites that legitimately talk about support numbers.
  const SAFE_HOSTS = ["microsoft.com", "apple.com", "support.google.com", "windows.com"];
  const host = location.hostname.toLowerCase();
  if (SAFE_HOSTS.some((d) => host === d || host.endsWith("." + d))) return;

  const PHRASES = [
    "your computer is infected", "your pc is infected", "your computer has been infected",
    "call microsoft support", "call microsoft", "windows defender alert", "windows defender security",
    "do not shut down", "do not restart", "your pc is blocked", "your computer has been blocked",
    "computer is locked", "security alert", "virus detected", "trojan", "spyware detected",
    "call technical support", "contact microsoft", "call apple support",
  ];
  // US toll-free: 800/833/844/855/866/877/888, optional +1, any common separators.
  const TOLL_FREE = /(?:\+?1[\s.\-]?)?\(?8(?:00|33|44|55|66|77|88)\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/;

  let reported = false;
  async function scan() {
    if (reported || !document.body) return;
    const { enabled } = await chrome.storage.local.get("enabled");
    if (enabled === false) return;
    const text = (document.body.innerText || "").slice(0, 20000).toLowerCase();
    if (!TOLL_FREE.test(text)) return;
    const hits = PHRASES.filter((p) => text.includes(p));
    if (hits.length < 2) return; // need 2+ distinct scam phrases + a toll-free number
    reported = true;
    try {
      chrome.runtime.sendMessage({ type: "fake_popup", phrases: hits });
    } catch { /* extension reloaded; ignore */ }
  }

  scan();
  // Scam popups are often injected late; re-check on DOM changes for 30s.
  let timer = null;
  const obs = new MutationObserver(() => {
    if (timer) return;
    timer = setTimeout(() => { timer = null; scan(); if (reported) obs.disconnect(); }, 1000);
  });
  if (document.body) obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  setTimeout(() => obs.disconnect(), 30000);
})();
