const api = globalThis.browser ?? globalThis.chrome;
const form = document.querySelector("#settings");
const status = document.querySelector("#status");
const saveBtn = document.querySelector("#saveBtn");
const dirtyBadge = document.querySelector("#dirtyBadge");
const preview = document.querySelector("#commandPreview");
const fields = ["videoQuality", "audioFormat", "downloadPath", "filenameTemplate"];
const inputs = Object.fromEntries(fields.map((f) => [f, document.querySelector(`#${f}`)]));
const overlay = document.querySelector("#confirmOverlay");
const confirmCancel = document.querySelector("#confirmCancel");
const confirmReset = document.querySelector("#confirmReset");

let savedSnapshot = "";
let isSaving = false;

const snapshot = () => JSON.stringify(fields.map((f) => inputs[f].value));
const isDirty = () => snapshot() !== savedSnapshot;

function setDirty() {
  dirtyBadge.hidden = !isDirty();
}

function fill(settings) {
  fields.forEach((field) => {
    inputs[field].value = settings[field] ?? "";
  });
  syncCombos();
  clearErrors();
  savedSnapshot = snapshot();
  setDirty();
  renderPreview();
}

/* Custom dropdowns: smooth, keyboard-accessible listbox */
function optionLabel(combo, value) {
  const opt = combo.querySelector(`[role="option"][data-value="${CSS.escape(value)}"]`);
  return opt ? `${opt.querySelector(".opt-main").textContent} — ${opt.querySelector(".opt-sub").textContent}` : value;
}

function syncCombos() {
  document.querySelectorAll(".combo").forEach((combo) => {
    const field = combo.dataset.combo;
    const value = inputs[field].value || combo.querySelector('[role="option"]').dataset.value;
    inputs[field].value = value;
    combo.querySelectorAll('[role="option"]').forEach((opt) => {
      opt.setAttribute("aria-selected", String(opt.dataset.value === value));
    });
    combo.querySelector(".combo-label").textContent = optionLabel(combo, value);
  });
}

function closeAllCombos(except) {
  document.querySelectorAll(".combo.open").forEach((combo) => {
    if (combo === except) return;
    combo.classList.remove("open");
    combo.querySelector(".combo-btn").setAttribute("aria-expanded", "false");
  });
}

document.querySelectorAll(".combo").forEach((combo) => {
  const field = combo.dataset.combo;
  const btn = combo.querySelector(".combo-btn");
  const options = [...combo.querySelectorAll('[role="option"]')];
  let activeIndex = Math.max(0, options.findIndex((o) => o.getAttribute("aria-selected") === "true"));

  const open = () => {
    closeAllCombos(combo);
    combo.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
  };
  const close = (refocus) => {
    combo.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    if (refocus) btn.focus();
  };
  const isOpen = () => combo.classList.contains("open");

  const highlight = (index) => {
    activeIndex = (index + options.length) % options.length;
    options.forEach((o, i) => o.classList.toggle("active", i === activeIndex));
    options[activeIndex].scrollIntoView({ block: "nearest" });
  };

  const choose = (opt) => {
    inputs[field].value = opt.dataset.value;
    syncCombos();
    inputs[field].dispatchEvent(new Event("input", { bubbles: true }));
  };

  btn.addEventListener("click", () => (isOpen() ? close() : open()));

  btn.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen()) open();
      highlight(activeIndex + (e.key === "ArrowDown" ? 1 : -1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!isOpen()) open();
      else {
        choose(options[activeIndex]);
        close();
      }
    } else if (e.key === "Escape" && isOpen()) {
      e.preventDefault();
      close(true);
    }
  });

  options.forEach((opt, i) => {
    opt.tabIndex = -1;
    opt.addEventListener("click", () => {
      choose(opt);
      close(true);
    });
    opt.addEventListener("mousemove", () => highlight(i));
    opt.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        choose(opt);
        close(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        close(true);
      }
    });
  });

  combo.addEventListener("focusout", (e) => {
    if (!combo.contains(e.relatedTarget)) close();
  });
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".combo")) closeAllCombos();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeAllCombos();
});

function setError(field, message) {
  const input = inputs[field];
  const err = document.querySelector(`#${field}Error`);
  if (!message) {
    input.removeAttribute("aria-invalid");
    if (err) err.hidden = true;
    return;
  }
  input.setAttribute("aria-invalid", "true");
  if (err) {
    err.textContent = message;
    err.hidden = false;
  }
}

function clearErrors() {
  fields.forEach((f) => setError(f, ""));
}

function validate() {
  clearErrors();
  const template = inputs.filenameTemplate.value.trim();
  if (!template) {
    setError("filenameTemplate", "Enter a Filename Template, for Example %(title)s.%(ext)s.");
    inputs.filenameTemplate.focus();
    return false;
  }
  if (template.length > 500) {
    setError("filenameTemplate", "Shorten the Template to 500 Characters or Less.");
    inputs.filenameTemplate.focus();
    return false;
  }
  const path = inputs.downloadPath.value.trim();
  if (path.length > 500) {
    setError("downloadPath", "Shorten the Folder Path to 500 Characters or Less.");
    inputs.downloadPath.focus();
    return false;
  }
  return true;
}

function currentSettings() {
  return Object.fromEntries(fields.map((field) => [field, inputs[field].value.trim()]));
}

function renderPreview() {
  try {
    const fakeUrl = "https://example.com/watch?v=demo";
    const cmd = DWX.buildCommand({ supported: true, tool: "yt-dlp", url: fakeUrl }, currentSettings(), "linux");
    preview.textContent = cmd;
  } catch {
    preview.textContent = "Adjust Your Settings to Preview the Command…";
  }
}

function flash(message) {
  status.textContent = message;
  status.classList.remove("show");
  void status.offsetWidth;
  status.classList.add("show");
  clearTimeout(flash._timer);
  flash._timer = setTimeout(() => status.classList.remove("show"), 2200);
}

async function load() {
  fill(await api.storage.sync.get(DWX.DEFAULTS));
}

form.addEventListener("input", () => {
  setDirty();
  renderPreview();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isSaving || !validate()) return;
  isSaving = true;
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";
  try {
    const settings = currentSettings();
    await api.storage.sync.set(settings);
    savedSnapshot = snapshot();
    setDirty();
    flash("Settings Saved");
  } finally {
    isSaving = false;
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Settings";
  }
});

document.querySelector("#reset").addEventListener("click", () => {
  overlay.hidden = false;
  confirmCancel.focus();
});

function closeDialog() {
  overlay.hidden = true;
  document.querySelector("#reset").focus();
}

confirmCancel.addEventListener("click", closeDialog);
overlay.addEventListener("click", (e) => {
  if (e.target === overlay) closeDialog();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !overlay.hidden) closeDialog();
});

confirmReset.addEventListener("click", async () => {
  await api.storage.sync.set(DWX.DEFAULTS);
  fill(DWX.DEFAULTS);
  overlay.hidden = true;
  flash("Defaults Restored");
});

window.addEventListener("beforeunload", (e) => {
  if (isDirty()) e.preventDefault();
});

load();
