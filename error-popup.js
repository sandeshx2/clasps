const api = globalThis.browser ?? globalThis.chrome;
const params = new URLSearchParams(location.search);
const tabId = Number(params.get("tabId"));

document.querySelector("#title").textContent = params.get("title") || "DWX error";
document.querySelector("#message").textContent = params.get("message") || "This page cannot be used.";

if (Number.isInteger(tabId)) {
  api.action.setPopup({ tabId, popup: "" });
}
