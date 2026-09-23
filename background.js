if (typeof importScripts === "function" && typeof DWX === "undefined") {
  importScripts("command.js");
}

const OFFSCREEN_DOCUMENT = "offscreen.html";
const api = globalThis.browser ?? globalThis.chrome;

async function ensureOffscreenDocument() {
  if (!api?.offscreen?.createDocument || !api.runtime.getContexts) return false;

  const offscreenUrl = api.runtime.getURL(OFFSCREEN_DOCUMENT);
  const contexts = await api.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [offscreenUrl]
  });
  if (contexts.length === 0) {
    await api.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT,
      reasons: ["CLIPBOARD"],
      justification: "Copy the generated download command after an extension icon click."
    });
  }
  return true;
}

async function copyTextInPage(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    } catch {
      // Fall back to execCommand for older pages and Firefox's restricted contexts.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied
      ? { ok: true }
      : { ok: false, error: "Clipboard access failed." };
  } catch (error) {
    textarea.remove();
    return { ok: false, error: error.message };
  }
}

async function copyText(text, tabId) {
  if (await ensureOffscreenDocument()) {
    const result = await api.runtime.sendMessage({ type: "copy", text });
    if (!result?.ok) throw new Error(result?.error || "Clipboard access failed.");
    return;
  }

  // Firefox runs Manifest V3 background scripts in a hidden extension page.
  // Use its privileged clipboard context instead of Chrome's offscreen API.
  if (typeof document !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  // This also covers browsers whose background context has no DOM.
  const [result] = await api.scripting.executeScript({
    target: { tabId },
    func: copyTextInPage,
    args: [text]
  });
  if (!result?.result?.ok) {
    throw new Error(result?.result?.error || "Clipboard access failed.");
  }
}

function renderToast({ title, message, color }) {
  document.querySelector("#dwx-command-toast")?.remove();
  if (!document.querySelector("#dwx-toast-styles")) {
    const style = document.createElement("style");
    style.id = "dwx-toast-styles";
    style.textContent = "@keyframes dwx-fade-in{from{opacity:0;transform:translateY(-10px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes dwx-fade-out{from{opacity:1;transform:translateY(0) scale(1)}to{opacity:0;transform:translateY(-8px) scale(.96)}}@media(prefers-reduced-motion:reduce){#dwx-command-toast{animation-duration:.01ms !important}}";
    document.documentElement.appendChild(style);
  }

  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const glassBg = `rgba(${r},${g},${b},.68)`;

  const toast = document.createElement("div");
  toast.id = "dwx-command-toast";
  toast.setAttribute("role", "status");
  toast.style.cssText = [
    "all:initial",
    "position:fixed",
    "top:18px",
    "right:18px",
    "z-index:2147483647",
    "display:flex",
    "align-items:center",
    "gap:11px",
    "width:min(340px,calc(100vw - 36px))",
    "padding:13px 15px",
    "box-sizing:border-box",
    "border:1px solid rgba(255,255,255,.18)",
    "border-radius:12px",
    `background:${glassBg}`,
    `background:linear-gradient(135deg, rgba(${r},${g},${b},.78), rgba(${r},${g},${b},.58))`,
    "color:#f8fafc",
    "box-shadow:0 8px 32px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.14)",
    "-webkit-backdrop-filter:blur(16px) saturate(1.25)",
    "backdrop-filter:blur(16px) saturate(1.25)",
    "font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    "will-change:opacity,transform,backdrop-filter",
    "animation:dwx-fade-in 280ms cubic-bezier(.16,1,.3,1) forwards"
  ].join(";");

  const mark = document.createElement("span");
  mark.textContent = "✓";
  mark.style.cssText = [
    "all:initial",
    "display:grid",
    "place-items:center",
    "flex:0 0 28px",
    "width:28px",
    "height:28px",
    "border-radius:8px",
    "background:rgba(255,255,255,.2)",
    "color:#ffffff",
    "font:700 15px Inter,system-ui,sans-serif"
  ].join(";");

  const copy = document.createElement("span");
  copy.style.cssText = "all:initial;display:grid;gap:2px;min-width:0;font-family:Inter,system-ui,sans-serif";
  const heading = document.createElement("strong");
  heading.textContent = title;
  heading.style.cssText = "all:initial;color:#f8fafc;font:650 13px Inter,system-ui,sans-serif";
  const detail = document.createElement("span");
  detail.textContent = message;
  detail.style.cssText = "all:initial;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#ffffff;font:400 12px Inter,system-ui,sans-serif";
  copy.append(heading, detail);
  toast.append(mark, copy);
  document.documentElement.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "dwx-fade-out 220ms ease forwards";
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 280);
  }, 2600);
}

async function showToast(tabId, title, message) {
  try {
    await api.scripting.executeScript({
      target: { tabId },
      func: renderToast,
      args: [{ title, message, color: "#5e0455" }]
    });
    return true;
  } catch {
    return false;
  }
}

async function showErrorToast(tabId, title, message) {
  try {
    await api.scripting.executeScript({
      target: { tabId },
      func: renderToast,
      args: [{ title, message, color: "#5e0455" }]
    });
    return true;
  } catch {
    const params = new URLSearchParams({ tabId: String(tabId), title, message });
    await api.action.setPopup({ tabId, popup: `error-popup.html?${params}` });
    try {
      await api.action.openPopup();
    } catch {
      await api.action.setPopup({ tabId, popup: "" });
    }
    return true;
  }
}

async function showBadge(tabId, color) {
  await api.action.setBadgeBackgroundColor({ tabId, color });
  // await chrome.action.setBadgeText({ tabId, text });
  setTimeout(() => api.action.setBadgeText({ tabId, text: "" }).catch(() => {}), 2200);
}

api.runtime.onInstalled.addListener(() => {
  api.contextMenus.create({
    id: "open-settings",
    title: "Clasps settings",
    contexts: ["action"]
  });
});

api.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "open-settings") api.runtime.openOptionsPage();
});

api.action.onClicked.addListener(async (tab) => {
  const tabId = tab.id;
  try {
    const classification = DWX.classifyUrl(tab.url);
    if (!classification.supported) {
      await showErrorToast(tabId, "Clasps can’t use this page", classification.reason);
      return;
    }

    const [settings, platformInfo] = await Promise.all([
      api.storage.sync.get(DWX.DEFAULTS),
      api.runtime.getPlatformInfo()
    ]);
    const command = DWX.buildCommand(classification, settings, platformInfo.os);
    await copyText(command, tabId);
    // await showBadge(tabId, "#22c55e");
    await showToast(
      tabId,
      "Command copied.",
      "Paste in your terminal to download"
    );
  } catch (error) {
    await showErrorToast(tabId, "Clasps could not copy the command", error.message);
  }
});
