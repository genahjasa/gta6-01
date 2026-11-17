// All sound is synthesised with WebAudio: no audio files, nothing loads over the network.
// Engine hum, gunshots, sirens, pickups and a small bass-driven music loop. Everything starts
// on the first user gesture (browsers block audio before one) and M toggles mute.
export function createAudio() {
  let ctx = null, master = null, muted = false, musicTimer = null;
  let engineOsc = null, engineGain = null, engineFilter = null;
  const NOTE = { C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.0, A2: 110.0, B2: 123.47, C3: 130.81, E3: 164.81, G3: 196.0, A3: 220.0 };

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Engine: a sawtooth through a low-pass, its pitch following speed.
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
      engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 320;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
      startMusic();
      return true;
    } catch { return false; }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, freq, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  // A slow two-chord bass loop with a hat tick, scheduled a bar ahead.
  const BASS = [NOTE.C2, NOTE.C2, NOTE.G2, NOTE.A2, NOTE.F2, NOTE.F2, NOTE.G2, NOTE.G2];
  let bar = 0;
  function startMusic() {
    if (musicTimer !== null) return;
    musicTimer = window.setInterval(() => {
      if (!ctx || muted) return;
      const step = 0.22;
      for (let i = 0; i < 8; i += 1) {
        tone(BASS[(bar * 8 + i) % BASS.length], step * 0.9, 'triangle', 0.10, i * step);
        if (i % 2 === 0) noise(0.03, 0.03, 6000, i * step);
      }
      bar += 1;
    }, 8 * 0.22 * 1000);
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; },
    isMuted() { return muted; },
    setEngine(speed01, on) {
      if (!ctx) return;
      const t = ctx.currentTime;
      engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.05 : 0, t, 0.1);
      engineOsc.frequency.setTargetAtTime(50 + speed01 * 130, t, 0.08);
      engineFilter.frequency.setTargetAtTime(280 + speed01 * 900, t, 0.1);
    },
    shoot() { noise(0.09, 0.5, 2400); tone(180, 0.08, 'square', 0.18, 0, 60); },
    enemyShoot() { noise(0.07, 0.22, 1800); },
    crash(strength) { noise(0.18, Math.min(0.6, 0.2 + strength), 900); },
    explosion() { noise(0.7, 0.8, 500); tone(60, 0.6, 'sine', 0.5, 0, 30); },
    siren() { tone(700, 0.32, 'sine', 0.10, 0, 950); tone(950, 0.32, 'sine', 0.10, 0.32, 700); },
    pickup() { tone(880, 0.09, 'sine', 0.22); tone(1318, 0.14, 'sine', 0.22, 0.08); },
    cash() { tone(1046, 0.1, 'triangle', 0.25); tone(1318, 0.1, 'triangle', 0.25, 0.09); tone(1568, 0.18, 'triangle', 0.25, 0.18); },
    mission() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'triangle', 0.22, i * 0.11)); },
    fail() { [392, 330, 262].forEach((f, i) => tone(f, 0.2, 'triangle', 0.2, i * 0.14)); },
    click() { tone(660, 0.05, 'square', 0.12); },
    reload() { tone(300, 0.05, 'square', 0.12); tone(420, 0.05, 'square', 0.12, 0.12); },
    door() { noise(0.08, 0.15, 1200); },
  };
}
