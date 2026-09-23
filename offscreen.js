const api = globalThis.browser ?? globalThis.chrome;

api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "copy") return false;

  const textarea = document.createElement("textarea");
  textarea.value = message.text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    const copied = document.execCommand("copy");
    textarea.remove();
    if (copied) {
      sendResponse({ ok: true });
      return false;
    }
  } catch {
    textarea.remove();
  }

  if (!navigator.clipboard?.writeText) {
    sendResponse({ ok: false, error: "Clipboard access failed." });
    return false;
  }

  navigator.clipboard.writeText(message.text)
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
