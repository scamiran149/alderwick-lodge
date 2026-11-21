const guide = document.querySelector("#guide-dialog");
const placeDialog = document.querySelector("#place-dialog");
const stage = document.querySelector(".night");
const finalCopy = document.querySelector(".visitor-copy");
const hallCopy = document.querySelector(".hall-copy");
const stillButton = document.querySelector("#motion-option");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const shortLandscape = matchMedia("(max-height: 560px) and (orientation: landscape)");
const widePrint = matchMedia("(min-width: 761px)");
const secondPull = document.querySelector("#second-pull");
const exposure = document.querySelector(".emulsion");
const firstPrint = exposure.querySelector("img");
const filmMark = document.querySelector("#film-mark");
const switchboard = document.querySelector("#switchboard");
const tape = document.querySelector("#line-tape");
const voice = document.querySelector("#line-voice");
const carbon = document.querySelector("#carbon-copy");
const copyStage = carbon.querySelector(".copy-stage");
const copyWord = document.querySelector("#copy-word");
const copySentence = document.querySelector("#copy-sentence");
const printedTitle = document.querySelector("#printed-title");
const glassworks = document.querySelector("#glass");
const survey = document.querySelector("#glass-pane");
const pane = survey.querySelector(".measured-pane");
const paneWidth = document.querySelector("#pane-width");
const paneHeight = document.querySelector("#pane-height");
const knockReply = document.querySelector("#knock-reply");
const hallLine = document.querySelector("#hall-line");
const register = document.querySelector("#register-memory");
const receipt = document.querySelector("#key-receipt");
const sourceKey = document.querySelector("#source-key");
const landingKey = document.querySelector("#landing-key");
const keys = document.querySelectorAll(".cabin-key");
const guestbook = document.querySelector("#guestbook");
const blotter = document.querySelector("#blotter");
const tracingNote = document.querySelector(".tracing-note");
const daylightTitle = document.title;
const initial = {
  register: register.textContent,
  receipt: receipt.textContent,
  sourceKey: sourceKey.textContent,
  landingKey: landingKey.textContent,
  voice: voice.textContent,
  photograph: firstPrint.alt,
  knockReply: knockReply.textContent,
  hallLine: hallLine.textContent,
  blotter: blotter.textContent,
  tracing: tracingNote.textContent,
};
const impressions = [
  { word: "kind of quiet.", sentence: "Cedar cabins, still water, and miles of evergreen. You remember this sentence. It remembers you reading it.", title: daylightTitle },
  { word: "kind of guest.", sentence: "The first page has come through again. Someone on the back is pressing hard enough to bruise the letters.", title: "Alderwick Lodge · Second impression" },
  { word: copyWord.textContent, sentence: copySentence.textContent, title: printedTitle.textContent },
];
let manualStill = false;
let framePending = false;
let nightProgress = 0;
let sound = null;
let lastTapeY = null;
let tapeAnchor = 0;
let pauseTimer = 0;
let knockTimer = 0;
let impressionIndex = -1;
let registerPass = "unread";
let holdingPlace = false;

const descriptions = {
  cabin: "Every cabin has a wool blanket, a porch chair, and a brass key on a red wooden float. Leave the float on the hook by your door when you go down to the lake.",
  dock: "Canoes are moored at the little east dock. Paddle out before breakfast and the water will hold your reflection long after you’ve gone.",
  trail: "Follow the orange blazes through the hemlocks. It’s a short walk back from either fork. If you pass the crooked tree twice, take off your watch.",
};

document.querySelector("#guide-open").addEventListener("click", () => guide.showModal());

document.querySelectorAll("[data-place]").forEach(button => {
  button.addEventListener("click", () => {
    const source = button.querySelector("img");
    const image = document.querySelector("#place-img");
    image.src = source.src;
    image.alt = source.alt;
    document.querySelector("#place-title").textContent = button.querySelector(".place-name").firstChild.textContent.trim();
    document.querySelector("#place-description").textContent = descriptions[button.dataset.place];
    placeDialog.showModal();
  });
});

document.querySelectorAll("dialog").forEach(dialog => {
  dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
});
guide.querySelectorAll("a").forEach(link => link.addEventListener("click", () => guide.close()));

function takeKey(key) {
  keys.forEach(button => button.setAttribute("aria-pressed", String(button === key)));
  const cabin = key?.dataset.cabin;
  const room = key?.dataset.room;
  receipt.textContent = key ? `Room ${room} · ${cabin}. Lift the tag again to return it.` : initial.receipt;
  register.textContent = key ? `I heard the ${cabin} key come off its hook. It said ${room} then. Look at it now.` : initial.register;
  sourceKey.textContent = key ? `${cabin} / ${room}` : initial.sourceKey;
  landingKey.textContent = key ? `The ${cabin} key fits. When you let go, the brass has left a little 06 pressed into your thumb.` : initial.landingKey;
}
keys.forEach(button => button.addEventListener("click", () => {
  takeKey(button.getAttribute("aria-pressed") === "true" ? null : button);
}));

function clamp(value) {
  return Math.max(0, Math.min(1, value));
}

function measureWindow() {
  const width = document.documentElement.clientWidth;
  const height = document.documentElement.clientHeight;
  paneWidth.textContent = `${width} px`;
  paneHeight.textContent = `${height} px`;
  pane.style.setProperty("--window-ratio", width / Math.max(1, height));
}

function soundKnock(delay) {
  if (!sound) return;
  const { context, output } = sound;
  const start = context.currentTime + delay;
  const thump = context.createOscillator();
  const envelope = context.createGain();
  thump.frequency.setValueAtTime(155, start);
  thump.frequency.exponentialRampToValueAtTime(53, start + 0.12);
  envelope.gain.setValueAtTime(0.001, start);
  envelope.gain.exponentialRampToValueAtTime(0.19, start + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
  thump.connect(envelope).connect(output);
  thump.addEventListener("ended", () => { thump.disconnect(); envelope.disconnect(); });
  thump.start(start);
  thump.stop(start + 0.16);
}

survey.addEventListener("click", event => {
  if (knockTimer) return;
  const rect = pane.getBoundingClientRect();
  const onGlass = event.detail > 0 && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  const x = onGlass ? (event.clientX - rect.left) / rect.width : 0.5;
  const y = onGlass ? (event.clientY - rect.top) / rect.height : 0.5;
  pane.style.setProperty("--tap-x", `${x * 100}%`);
  pane.style.setProperty("--tap-y", `${y * 100}%`);
  survey.dataset.knock = "sent";
  knockReply.textContent = "One knock goes through. The putty shifts in the frame.";
  soundKnock(0);
  soundKnock(0.79);
  soundKnock(1.01);
  knockTimer = window.setTimeout(() => {
    knockTimer = 0;
    survey.dataset.knock = "answered";
    knockReply.textContent = "Two come back. A print settles on the inside of the glass.";
    hallLine.textContent = "The same beat you tapped on the glass. This time it comes from the wood against your ear.";
  }, 790);
});

function leaveLine() {
  clearTimeout(pauseTimer);
  lastTapeY = null;
}

function followPaper() {
  const rect = tape.getBoundingClientRect();
  if (document.hidden || rect.top >= innerHeight * 0.82 || rect.bottom <= innerHeight * 0.18) {
    if (lastTapeY !== null) leaveLine();
    return;
  }
  const y = Math.max(0, scrollY);
  if (lastTapeY === y) return;
  if (lastTapeY === null) {
    voice.textContent = initial.voice;
    tapeAnchor = y;
  } else if (Math.abs(y - tapeAnchor) >= 20) {
    const line = y < tapeAnchor
      ? "You’re winding it back. I can read the impression through the other side."
      : "A little farther down. There’s still paper under your hand.";
    if (voice.textContent !== line) voice.textContent = line;
    tapeAnchor = y;
  }
  lastTapeY = y;
  clearTimeout(pauseTimer);
  pauseTimer = window.setTimeout(() => {
    voice.textContent = "There. You stopped. The typebars have stopped on my side too.";
  }, 2300);
}

function developPrint(cinematic) {
  const progress = cinematic && widePrint.matches
    ? clamp((innerHeight * 0.83 - secondPull.getBoundingClientRect().top) / (innerHeight * 0.57))
    : 0;
  exposure.style.setProperty("--emulsion", progress.toFixed(3));
  const mark = progress > 0.55 ? "17 A / DUPLICATE" : "17 A";
  if (filmMark.textContent !== mark) {
    filmMark.textContent = mark;
    firstPrint.alt = progress > 0.55 ? "Four pale fingers grip the rim of the canoe in the developed print" : initial.photograph;
  }
}

function printCarbon(rect, cinematic) {
  const travel = Math.max(1, rect.height - copyStage.offsetHeight);
  const progress = cinematic ? clamp(-rect.top / travel) : 1;
  const index = progress < 0.27 ? 0 : progress < 0.69 ? 1 : 2;
  if (index !== impressionIndex) {
    impressionIndex = index;
    const print = impressions[index];
    copyWord.textContent = print.word;
    copySentence.textContent = print.sentence;
    printedTitle.textContent = print.title;
  }
  // Each pass of the paper drags two narrow strips out of register.
  if (cinematic && rect.bottom > 0 && rect.top < innerHeight) {
    const drag = progress * (0.55 + 0.45 * Math.sin(progress * Math.PI * 3));
    carbon.style.setProperty("--tear", `${(4 + drag * 69).toFixed(1)}px`);
    carbon.style.setProperty("--ink-drift", `${(0.5 + drag * 5).toFixed(1)}px`);
    carbon.style.setProperty("--ghost", (0.22 + progress * 0.7).toFixed(2));
  }
}

function turnRegister(bookRect, carbonRect) {
  const atLine = innerHeight * 0.55;
  if (registerPass === "read" && carbonRect.top < atLine) registerPass = "copied";
  if (bookRect.top > atLine || bookRect.bottom < atLine) return;
  if (registerPass === "unread") registerPass = "read";
  if (registerPass === "copied") {
    blotter.textContent = "You came back to see whether the ink had changed.";
    blotter.classList.add("rewritten");
    registerPass = "returned";
  }
}

function drawScene() {
  framePending = false;
  const rect = stage.getBoundingClientRect();
  const cinematic = document.documentElement.classList.contains("cinematic");
  const carbonRect = carbon.getBoundingClientRect();
  const bookRect = guestbook.getBoundingClientRect();
  turnRegister(bookRect, carbonRect);
  developPrint(cinematic);
  printCarbon(carbonRect, cinematic);
  followPaper();
  if (cinematic) {
    const travel = stage.offsetHeight - stage.firstElementChild.offsetHeight;
    nightProgress = clamp(-rect.top / Math.max(1, travel));
    const reveal = clamp((nightProgress - 0.14) / 0.67);
    const finalText = clamp((nightProgress - 0.57) / 0.26);
    stage.style.setProperty("--reveal", reveal.toFixed(3));
    stage.style.setProperty("--hall-text", clamp(1 - (nightProgress - 0.13) / 0.27).toFixed(3));
    stage.style.setProperty("--guest-text", finalText.toFixed(3));
    finalCopy.inert = finalText < 0.08;
    hallCopy.inert = nightProgress > 0.5;
  } else {
    nightProgress = clamp(-rect.top / Math.max(1, rect.height - innerHeight));
    finalCopy.inert = hallCopy.inert = false;
  }
  const readAt = innerHeight * 0.5;
  let title = daylightTitle;
  if (switchboard.getBoundingClientRect().top <= readAt) title = "Alderwick Lodge · Outside line";
  if (carbonRect.top <= readAt) title = printedTitle.textContent;
  if (glassworks.getBoundingClientRect().top <= readAt) title = "Alderwick Lodge · Cut to fit";
  if (rect.top <= readAt) title = "Alderwick Lodge · Room 06 occupied";
  if (!document.hidden && document.title !== title) document.title = title;
  if (sound) {
    const darkness = clamp((innerHeight * 0.75 - bookRect.top) / innerHeight);
    sound.depth.gain.setTargetAtTime(darkness * 0.085 + nightProgress * 0.055, sound.context.currentTime, 0.6);
    sound.filter.frequency.setTargetAtTime(1250 - darkness * 880, sound.context.currentTime, 0.8);
  }
}

function queueScene() {
  if (framePending) return;
  framePending = true;
  requestAnimationFrame(drawScene);
}

function configureMotion() {
  const still = manualStill || reduceMotion.matches;
  document.documentElement.classList.toggle("cinematic", !still && !shortLandscape.matches);
  if (still || shortLandscape.matches) {
    carbon.style.removeProperty("--tear");
    carbon.style.removeProperty("--ink-drift");
    carbon.style.removeProperty("--ghost");
  }
  stillButton.setAttribute("aria-pressed", String(still));
  stillButton.textContent = still ? "Still scenes enabled" : "Use still scenes";
  stillButton.disabled = reduceMotion.matches;
  drawScene();
}

stillButton.addEventListener("click", () => {
  manualStill = !manualStill;
  configureMotion();
});
reduceMotion.addEventListener("change", configureMotion);
shortLandscape.addEventListener("change", configureMotion);
window.addEventListener("scroll", queueScene, { passive: true });
window.addEventListener("resize", () => { measureWindow(); queueScene(); });
window.addEventListener("pageshow", queueScene);
measureWindow();
configureMotion();

// A slow oscillation swells the filtered water noise. A low tone follows the night scene.
function startLakeAudio(context) {
  const output = context.createGain();
  output.gain.value = 0.45;
  output.connect(context.destination);
  const buffer = context.createBuffer(1, context.sampleRate * 5, context.sampleRate);
  const samples = buffer.getChannelData(0);
  let previous = 0;
  for (let i = 0; i < samples.length; i++) {
    previous = (previous + (Math.random() * 2 - 1) * 0.035) / 1.035;
    const seam = Math.min(1, i / 1000, (samples.length - 1 - i) / 1000);
    samples[i] = previous * 4 * seam;
  }
  const water = context.createBufferSource();
  water.buffer = buffer;
  water.loop = true;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1250;
  const wash = context.createGain();
  wash.gain.value = 0.46;
  water.connect(filter).connect(wash).connect(output);
  const tide = context.createOscillator();
  tide.frequency.value = 0.16;
  const swell = context.createGain();
  swell.gain.value = 0.25;
  tide.connect(swell).connect(wash.gain);
  const tone = context.createOscillator();
  tone.frequency.value = 73;
  const depth = context.createGain();
  depth.gain.value = 0;
  tone.connect(depth).connect(output);
  water.start();
  tide.start();
  tone.start();
  return { context, depth, filter, output };
}

function displayAudio(on) {
  document.querySelectorAll("[data-audio]").forEach(button => button.setAttribute("aria-pressed", String(on)));
  document.querySelector("[data-sound-label]").textContent = on ? "Mute sounds" : "Lake sounds";
  document.querySelector(".mute").hidden = !on;
}

function stopAudio() {
  const active = sound;
  sound = null;
  displayAudio(false);
  if (active && active.context.state !== "closed") active.context.close().catch(() => {});
}

async function toggleAudio() {
  if (sound) {
    stopAudio();
    return;
  }
  const Audio = window.AudioContext || window.webkitAudioContext;
  let context;
  try {
    context = new Audio();
    sound = startLakeAudio(context);
    displayAudio(true);
    drawScene();
    await context.resume();
    if (sound?.context === context) document.querySelector("#audio-status").textContent = "Lake ambience playing.";
  } catch {
    if (sound?.context === context) stopAudio();
    else if (context && context.state !== "closed") context.close().catch(() => {});
    document.querySelector("#audio-status").textContent = "Audio could not start in this browser.";
  }
}

document.querySelectorAll("[data-audio]").forEach(button => button.addEventListener("click", toggleAudio));
document.querySelector(".daylight").addEventListener("click", () => {
  stopAudio();
  takeKey(null);
  clearTimeout(knockTimer);
  knockTimer = 0;
  delete survey.dataset.knock;
  knockReply.textContent = initial.knockReply;
  hallLine.textContent = initial.hallLine;
  document.querySelector(".carbon-source").open = false;
  registerPass = "unread";
  blotter.textContent = initial.blotter;
  blotter.classList.remove("rewritten");
  holdingPlace = false;
  tracingNote.textContent = initial.tracing;
  tracingNote.classList.remove("thumbed");
  leaveLine();
  voice.textContent = initial.voice;
});
window.addEventListener("pagehide", stopAudio);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopAudio();
    leaveLine();
    holdingPlace = carbon.getBoundingClientRect().top < innerHeight * 0.5;
    if (holdingPlace) document.title = "Alderwick Lodge · I’ll hold your place";
  } else {
    if (holdingPlace) {
      tracingNote.textContent = "I held the tracing flat while you were away. That thumbprint at the corner is mine.";
      tracingNote.classList.add("thumbed");
    }
    holdingPlace = false;
    queueScene();
  }
});
