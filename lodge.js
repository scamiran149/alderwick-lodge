const guide = document.querySelector("#guide-dialog");
const placeDialog = document.querySelector("#place-dialog");
const stage = document.querySelector(".night");
const finalCopy = document.querySelector(".visitor-copy");
const hallCopy = document.querySelector(".hall-copy");
const stillButton = document.querySelector("#motion-option");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const shortLandscape = matchMedia("(max-height: 560px) and (orientation: landscape)");
let manualStill = false;
let framePending = false;
let nightProgress = 0;
let sound = null;

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

function clamp(value) {
  return Math.max(0, Math.min(1, value));
}

function drawScene() {
  framePending = false;
  const rect = stage.getBoundingClientRect();
  const cinematic = document.documentElement.classList.contains("cinematic");
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
  if (sound) {
    const darkness = clamp((innerHeight * 0.75 - document.querySelector(".guestbook").getBoundingClientRect().top) / innerHeight);
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
window.addEventListener("resize", queueScene);
window.addEventListener("pageshow", queueScene);
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
  return { context, depth, filter };
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
document.querySelector(".daylight").addEventListener("click", stopAudio);
window.addEventListener("pagehide", stopAudio);
document.addEventListener("visibilitychange", () => { if (document.hidden) stopAudio(); });
