// Tiny Web Audio building blocks shared by the score and the sound effects.

export const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function createSynth(ctx) {
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) curve[i] = Math.tanh((i / 512 - 1) * 2.6);

  /** One oscillator with an optional drive, moving filter and vibrato, shaped by a trapezoid envelope. */
  function voice({ type = 'sine', f, f2, at, d, a = 0.005, r = 0.1, v = 0.2, det = 0, filt, shaper, vib, bus }) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, at);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, at + d * 0.9);
    if (det) o.detune.value = det;
    if (vib) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 5.5;
      depth.gain.setValueAtTime(0, at);
      depth.gain.linearRampToValueAtTime(f * vib, at + Math.min(0.4, d * 0.6));
      lfo.connect(depth).connect(o.frequency);
      lfo.start(at);
      lfo.stop(at + d + 0.05);
    }
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(v, at + a);
    g.gain.setValueAtTime(v, at + Math.max(a, d - r));
    g.gain.linearRampToValueAtTime(0, at + d);

    let node = o;
    if (shaper) {
      const ws = ctx.createWaveShaper();
      ws.curve = curve;
      node = node.connect(ws);
    }
    if (filt) {
      const fl = ctx.createBiquadFilter();
      fl.type = filt.type || 'lowpass';
      fl.Q.value = filt.q || 0.7;
      fl.frequency.setValueAtTime(filt.f, at);
      if (filt.f2) fl.frequency.linearRampToValueAtTime(filt.f2, at + (filt.t || d * 0.3));
      if (filt.f3) fl.frequency.linearRampToValueAtTime(filt.f3, at + d);
      node = node.connect(fl);
    }
    node.connect(g).connect(bus);
    o.start(at);
    o.stop(at + d + 0.05);
  }

  /** Filtered white noise burst. */
  function noise({ at, d = 0.2, v = 0.2, f = 1500, f2, q = 1, type = 'bandpass', bus }) {
    const s = ctx.createBufferSource();
    const fl = ctx.createBiquadFilter();
    const g = ctx.createGain();
    s.buffer = noiseBuf;
    fl.type = type;
    fl.frequency.setValueAtTime(f, at);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, at + d);
    fl.Q.value = q;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(v, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + d);
    s.connect(fl).connect(g).connect(bus);
    s.start(at, Math.random() * 0.5);
    s.stop(at + d + 0.05);
  }

  // Instruments built from the two primitives above.
  const kick = (at, v, bus) => {
    voice({ f: 160, f2: 42, at, d: 0.32, a: 0.002, r: 0.28, v, bus });
    noise({ at, d: 0.03, v: v * 0.25, f: 3000, type: 'highpass', bus });
  };
  const snare = (at, v, bus) => {
    noise({ at, d: 0.2, v, f: 1900, q: 0.7, bus });
    voice({ f: 200, f2: 150, at, d: 0.1, a: 0.002, r: 0.08, v: v * 0.5, bus });
  };
  const hat = (at, v, open, bus) => noise({ at, d: open ? 0.16 : 0.035, v, f: 8500, type: 'highpass', bus });
  const tom = (at, f, v, bus) => voice({ f, f2: f * 0.55, at, d: 0.3, a: 0.002, r: 0.25, v, bus });
  const crash = (at, v, bus) => noise({ at, d: 1.4, v, f: 5200, type: 'highpass', bus });
  const timpani = (at, f, v, bus) => {
    voice({ f, f2: f * 0.92, at, d: 0.9, a: 0.003, r: 0.8, v, bus });
    noise({ at, d: 0.08, v: v * 0.3, f: 300, type: 'lowpass', bus });
  };
  const brass = (notes, at, d, v, bus, swell = false) => {
    for (const m of notes)
      for (const det of [-6, 6])
        voice({
          type: 'sawtooth',
          f: midiToHz(m),
          at,
          d,
          a: swell ? 0.25 : 0.015,
          r: swell ? 0.5 : 0.2,
          v,
          det,
          filt: { f: 380, f2: swell ? 2600 : 2400, f3: 700, t: swell ? 0.5 : 0.06, q: 1.2 },
          bus,
        });
  };

  return { voice, noise, kick, snare, hat, tom, crash, timpani, brass };
}
