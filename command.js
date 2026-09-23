(function (root) {
  "use strict";

  const DEFAULTS = Object.freeze({
    videoQuality: "1080",
    audioFormat: "m4a",
    downloadPath: "",
    filenameTemplate: "%(title)s.%(ext)s"
  });

  const BLOCKED_HOSTS = new Set([
    "chrome.google.com",
    "chromewebstore.google.com",
    "addons.mozilla.org",
    "microsoftedge.microsoft.com"
  ]);

  function classifyUrl(rawUrl) {
    let url;
    try {
      url = new URL(rawUrl);
    } catch {
      return { supported: false, reason: "This tab does not contain a valid web address." };
    }

    if (!["http:", "https:"].includes(url.protocol)) {
      return { supported: false, reason: "Browser and local pages cannot be downloaded." };
    }

    const host = url.hostname.toLowerCase();
    if (!host || BLOCKED_HOSTS.has(host)) {
      return { supported: false, reason: "This website does not expose downloadable media." };
    }

    if (host === "open.spotify.com" || host.endsWith(".spotify.com")) {
      const spotifyType = url.pathname.split("/").filter(Boolean)[0];
      const validTypes = new Set(["track", "album", "playlist", "artist", "show", "episode"]);
      if (!validTypes.has(spotifyType)) {
        return { supported: false, reason: "Open a Spotify track, album, playlist, artist, show, or episode." };
      }
      return { supported: true, tool: "spotdl", url: url.href };
    }

    return { supported: true, tool: "yt-dlp", url: url.href };
  }

  function quote(value, platform) {
    const text = String(value);
    if (platform === "win") {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return `'${text.replace(/'/g, `'\\''`)}'`;
  }

  function defaultDownloadPath(platform) {
    return platform === "win" ? "%USERPROFILE%\\Downloads" : "~/Downloads";
  }

  function quotePath(value, platform) {
    const text = String(value);
    if (platform !== "win" && text.startsWith("~/")) {
      return `~${quote(text.slice(1), platform)}`;
    }
    return quote(text, platform);
  }

  function buildCommand(classification, settings, platform) {
    const config = { ...DEFAULTS, ...settings };
    const outputPath = config.downloadPath.trim() || defaultDownloadPath(platform);
    const url = quote(classification.url, platform);

    if (classification.tool === "spotdl") {
      const file = "{artists} - {title}.{output-ext}";
      const output = outputPath.replace(/[\\/]$/, "") + (platform === "win" ? "\\" : "/") + file;
      return `spotdl download ${url} --format ${config.audioFormat} --output ${quotePath(output, platform)}`;
    }

    const height = Number.parseInt(config.videoQuality, 10);
    const format = `bv*[height<=${height}]+ba[ext=${config.audioFormat}]/bv*[height<=${height}]+ba/b[height<=${height}]`;
    return `yt-dlp -f ${quote(format, platform)} --merge-output-format mp4 -P ${quotePath(outputPath, platform)} -o ${quote(config.filenameTemplate, platform)} ${url}`;
  }

  const api = { DEFAULTS, classifyUrl, buildCommand, defaultDownloadPath };
  root.DWX = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
