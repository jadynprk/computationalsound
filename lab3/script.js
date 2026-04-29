const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let running = false;
let brownNoiseNode, brownGain;
let brookNoise;

// ── show/hide video based on selection ──
function updateVideoVisibility() {
  const selected = document.getElementById("soundSelect").value;
  document.getElementById("birdVideoWrapper").style.display  = selected === "birds" ? "block" : "none";
  document.getElementById("brookVideoWrapper").style.display = selected === "brook" ? "block" : "none";
}

// initialise on load
updateVideoVisibility();

// ========================================
// ========================================
// ========================================
// ========================================
// ========================================
// ========================================

// ── Keep a reference set so nodes aren't GC'd before they finish playing ──
const activeNodes = new Set();

function trackNode(src, stopTime) {
  activeNodes.add(src);
  src.onended = () => activeNodes.delete(src);
  // safety cleanup
  setTimeout(() => activeNodes.delete(src), (stopTime - audioCtx.currentTime + 0.5) * 1000);
}

// ── Microwave hum (replaces startBrownNoise / stopBrownNoise) ──
let micNodes = [];

function startMicrowave() {
  micNodes = [];

  // 1. Magnetron drone — mains frequency harmonics
  const freqs = [60, 120, 180, 300];  // use 50, 100, 150, 250 if EU
  const gains  = [0.18, 0.10, 0.06, 0.03];
  freqs.forEach((f, i) => {
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f + (Math.random() * 0.4 - 0.2);
    const g = audioCtx.createGain();
    g.gain.value = gains[i];
    osc.connect(g).connect(audioCtx.destination);
    osc.start();
    micNodes.push(osc, g);
  });

  // slight beating between two 60 Hz oscillators
  const osc2 = audioCtx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = 60.5;
  const g2 = audioCtx.createGain();
  g2.gain.value = 0.10;
  osc2.connect(g2).connect(audioCtx.destination);
  osc2.start();
  micNodes.push(osc2, g2);

  // 2. Transformer buzz — narrow bandpass noise at 120 Hz
  const bufLen = 4 * audioCtx.sampleRate;
  const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
  const noiseSrc = audioCtx.createBufferSource();
  noiseSrc.buffer = buf;
  noiseSrc.loop = true;
  const bp = audioCtx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 120;
  bp.Q.value = 8;
  const ng = audioCtx.createGain();
  ng.gain.value = 0.15;
  noiseSrc.connect(bp).connect(ng).connect(audioCtx.destination);
  noiseSrc.start();
  micNodes.push(noiseSrc, bp, ng);

  // 3. Fan / electronics hiss
  const hissSrc = audioCtx.createBufferSource();
  const hBuf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
  const hd = hBuf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) hd[i] = Math.random() * 2 - 1;
  hissSrc.buffer = hBuf;
  hissSrc.loop = true;
  const hp = audioCtx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2000;
  const hg = audioCtx.createGain();
  hg.gain.value = 0.02;
  hissSrc.connect(hp).connect(hg).connect(audioCtx.destination);
  hissSrc.start();
  micNodes.push(hissSrc, hp, hg);
}

function stopMicrowave() {
  micNodes.forEach(n => { try { if (n.stop) n.stop(); n.disconnect(); } catch(e){} });
  micNodes = [];
}

// ── Shared: fill a buffer with white noise ──
function makeNoiseBuffer(durationSec) {
  const len = Math.max(Math.ceil(audioCtx.sampleRate * durationSec), 256);
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

// ── Small crackle layer ──
function createSmallCrackle(time) {
  const dur = 0.04 + Math.random() * 0.08;

  const src = audioCtx.createBufferSource();
  src.buffer = makeNoiseBuffer(dur + 0.1);

  const bp = audioCtx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 300 + Math.random() * 800;
  bp.Q.value = 0.5 + Math.random() * 1.2;

  const gain = audioCtx.createGain();
  const peak = 0.8 + Math.random() * 0.6;   // much louder
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(peak, time + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

  const pan = audioCtx.createStereoPanner();
  pan.pan.value = (Math.random() * 2 - 1) * 0.6;

  src.connect(bp).connect(gain).connect(pan).connect(audioCtx.destination);
  src.start(time);
  const stopAt = time + dur + 0.12;
  src.stop(stopAt);
  trackNode(src, stopAt);
}

let smallCrackleTimers = [];

function scheduleSmallCrackle() {
  if (!running || document.getElementById("soundSelect").value !== "popcorn") return;
  const now = audioCtx.currentTime;
  const burst = 1 + Math.floor(Math.random() * 4);
  for (let i = 0; i < burst; i++) {
    createSmallCrackle(now + i * (0.015 + Math.random() * 0.05));
  }
  const timer = setTimeout(scheduleSmallCrackle, 100 + Math.random() * 350);
  smallCrackleTimers.push(timer);
}

function startSmallCrackles() {
  smallCrackleTimers = [];
  for (let i = 0; i < 3; i++) {
    smallCrackleTimers.push(setTimeout(scheduleSmallCrackle, i * 150));
  }
}

function stopSmallCrackles() {
  smallCrackleTimers.forEach(t => clearTimeout(t));
  smallCrackleTimers = [];
}

// ── Big pop layer ──
function createBigPop(time) {
  // Low thump body
  const thumpSrc = audioCtx.createBufferSource();
  thumpSrc.buffer = makeNoiseBuffer(0.4);

  const bp = audioCtx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 100 + Math.random() * 250;
  bp.Q.value = 2 + Math.random() * 4;

  const thumpGain = audioCtx.createGain();
  const thumpPeak = 1.2 + Math.random() * 0.6;
  thumpGain.gain.setValueAtTime(0, time);
  thumpGain.gain.linearRampToValueAtTime(thumpPeak, time + 0.004);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, time + 0.18 + Math.random() * 0.15);

  // High crack transient
  const crackSrc = audioCtx.createBufferSource();
  crackSrc.buffer = makeNoiseBuffer(0.06);

  const hp = audioCtx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1200 + Math.random() * 1000;

  const crackGain = audioCtx.createGain();
  const crackPeak = 0.9 + Math.random() * 0.4;
  crackGain.gain.setValueAtTime(0, time);
  crackGain.gain.linearRampToValueAtTime(crackPeak, time + 0.002);
  crackGain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

  const pan = audioCtx.createStereoPanner();
  pan.pan.value = (Math.random() * 2 - 1) * 0.4;

  thumpSrc.connect(bp).connect(thumpGain).connect(pan).connect(audioCtx.destination);
  crackSrc.connect(hp).connect(crackGain).connect(pan).connect(audioCtx.destination);

  thumpSrc.start(time);  const thumpStop = time + 0.45;  thumpSrc.stop(thumpStop);
  crackSrc.start(time);  const crackStop = time + 0.12;  crackSrc.stop(crackStop);

  trackNode(thumpSrc, thumpStop);
  trackNode(crackSrc, crackStop);
}

let bigPopTimers = [];

function scheduleBigPop() {
  if (!running || document.getElementById("soundSelect").value !== "popcorn") return;
  createBigPop(audioCtx.currentTime);

  if (Math.random() < 0.3) {
    const offset = 0.1 + Math.random() * 0.3;
    bigPopTimers.push(setTimeout(() => {
      if (!running) return;
      createBigPop(audioCtx.currentTime);
    }, offset * 1000));
  }

  const delay = Math.random() < 0.15
    ? 300  + Math.random() * 700
    : 1000 + Math.random() * 4000;

  bigPopTimers.push(setTimeout(scheduleBigPop, delay));
}

function startBigPops() {
  bigPopTimers = [];
  bigPopTimers.push(setTimeout(scheduleBigPop, 400));
}

function stopBigPops() {
  bigPopTimers.forEach(t => clearTimeout(t));
  bigPopTimers = [];
}

function startPopcorn() {
  startSmallCrackles();
  startBigPops();
}

function stopPopcorn() {
  stopSmallCrackles();
  stopBigPops();
}

// ========================================
// ========================================
// ========================================
// ========================================
// ========================================
// ========================================


// ── brook ──
function startBrook() {
  const bufferSize = 10 * audioCtx.sampleRate;
  const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  let lastOut = 0;
  for (let i = 0; i < bufferSize; i++) {
    const brown = Math.random() * 2 - 1;
    output[i] = (lastOut + (0.02 * brown)) / 1.02;
    lastOut = output[i];
    output[i] *= 3.5;
  }
  brookNoise = audioCtx.createBufferSource();
  brookNoise.buffer = noiseBuffer;
  brookNoise.loop = true;
  const audio_lpf = audioCtx.createBiquadFilter();
  audio_lpf.type = "lowpass";
  audio_lpf.frequency.value = 400;
  const hpf = audioCtx.createBiquadFilter();
  hpf.type = "highpass";
  hpf.Q.value = 1 / 0.03;
  const outputGain = audioCtx.createGain();
  outputGain.gain.value = 0.15;
  brookNoise.connect(audio_lpf).connect(hpf).connect(outputGain).connect(audioCtx.destination);
  const modulate_noise = audioCtx.createBufferSource();
  const mod_buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const mod_out = mod_buffer.getChannelData(0);
  lastOut = 0;
  for (let i = 0; i < bufferSize; i++) {
    const brown = Math.random() * 2 - 1;
    mod_out[i] = (lastOut + (0.02 * brown)) / 1.02;
    lastOut = mod_out[i];
    mod_out[i] *= 3.5;
  }
  modulate_noise.buffer = mod_buffer;
  modulate_noise.loop = true;
  const filter_lpf = audioCtx.createBiquadFilter();
  filter_lpf.type = "lowpass";
  filter_lpf.frequency.value = 14;
  const gainNode = audioCtx.createGain();
  gainNode.gain.value = 1500;
  const offset = audioCtx.createConstantSource();
  offset.offset.value = 150;
  modulate_noise.connect(filter_lpf).connect(gainNode).connect(hpf.frequency);
  offset.connect(hpf.frequency);
  offset.start(); modulate_noise.start(); brookNoise.start();
}

function stopBrook() {
  if (brookNoise) { brookNoise.stop(); brookNoise.disconnect(); brookNoise = null; }
}

// ── tab switching ──
function handleSelectChange() {
  const selected = document.getElementById("soundSelect").value;
  const blogView  = document.getElementById("blogView");
  const soundView = document.getElementById("soundView");
  const btn = document.getElementById("playBtn");

  updateVideoVisibility();

  if (selected === "blog") {
    blogView.style.display  = "flex";
    soundView.style.display = "none";
    btn.style.display = "none";
    if (running) {
      audioCtx.suspend();
      running = false;
      stopPopcorn(); stopMicrowave(); stopBrook();
    }
  } else {
    blogView.style.display  = "none";
    soundView.style.display = "flex";
    btn.style.display = "";
    btn.textContent = "▶ play sound";
  }
}

// ── play/pause ──
function togglePlay() {
  const selected = document.getElementById("soundSelect").value;
  const btn = document.getElementById("playBtn");
  if (!running) {
    audioCtx.resume().then(() => {
      running = true;
      btn.textContent = "⏸ pause sound";
      if (selected === "popcorn") { startMicrowave(); startPopcorn(); }
      if (selected === "brook") startBrook();
    });
  } else {
    audioCtx.suspend().then(() => {
      running = false;
      btn.textContent = "▶ play sound";
      stopPopcorn(); stopMicrowave(); stopBrook();
    });
  }
}
