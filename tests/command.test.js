const assert = require("node:assert/strict");
const { classifyUrl, buildCommand, defaultDownloadPath } = require("../command.js");

assert.equal(classifyUrl("chrome://extensions").supported, false);
assert.equal(classifyUrl("https://open.spotify.com/").supported, false);
assert.equal(classifyUrl("https://open.spotify.com/track/abc").tool, "spotdl");
assert.equal(classifyUrl("https://www.youtube.com/watch?v=abc").tool, "yt-dlp");
assert.equal(defaultDownloadPath("win"), "%USERPROFILE%\\Downloads");
assert.equal(defaultDownloadPath("mac"), "~/Downloads");

const yt = buildCommand(
  classifyUrl("https://www.youtube.com/watch?v=abc"),
  { videoQuality: "1080", audioFormat: "m4a", downloadPath: "", filenameTemplate: "%(title)s.%(ext)s" },
  "linux"
);
assert.match(yt, /height<=1080/);
assert.match(yt, /ba\[ext=m4a\]/);
assert.ok(yt.includes("-P ~'/Downloads'"));

const spot = buildCommand(
  classifyUrl("https://open.spotify.com/track/abc"),
  { audioFormat: "m4a", downloadPath: "" },
  "win"
);
assert.match(spot, /^spotdl download/);
assert.match(spot, /--format m4a/);
assert.match(spot, /%USERPROFILE%\\Downloads/);

console.log("command tests passed");
