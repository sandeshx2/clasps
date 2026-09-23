const api = globalThis.browser ?? globalThis.chrome;
const form = document.querySelector("#settings");
const status = document.querySelector("#status");
const fields = ["videoQuality", "audioFormat", "downloadPath", "filenameTemplate"];

function fill(settings) {
  fields.forEach((field) => {
    document.querySelector(`#${field}`).value = settings[field];
  });
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

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const settings = Object.fromEntries(fields.map((field) => [field, document.querySelector(`#${field}`).value.trim()]));
  await api.storage.sync.set(settings);
  flash("Settings saved");
});

document.querySelector("#reset").addEventListener("click", async () => {
  await api.storage.sync.set(DWX.DEFAULTS);
  fill(DWX.DEFAULTS);
  flash("Defaults restored");
});

load();
