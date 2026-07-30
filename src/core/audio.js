/**
 * Event-led soundscape. Real CC0 recordings carry the snow, water, ice and
 * wind texture. Each spell is a small foley composition, not a musical cue:
 * a physical impact, a secondary material layer, then a short air or grain
 * tail that matches what the effect is doing on screen.
 */

import { S } from "./settings.js";

const ASSET = {
    footstepA: new URL("../assets/audio/snow-footstep-a.flac", import.meta.url).href,
    footstepB: new URL("../assets/audio/snow-footstep-b.flac", import.meta.url).href,
    surfWind: new URL("../assets/audio/snow-surf-wind.ogg", import.meta.url).href,
    ribbonWater: new URL("../assets/audio/ribbon-water-loop.ogg", import.meta.url).href,
    sweepWater: new URL("../assets/audio/sweep-water.ogg", import.meta.url).href,
    sweepSpray: new URL("../assets/audio/sweep-snow-spray.ogg", import.meta.url).href,
    bloomSplash: new URL("../assets/audio/bloom-splash.ogg", import.meta.url).href,
    bloomImpact: new URL("../assets/audio/bloom-impact.ogg", import.meta.url).href,
    ribbonBubble: new URL("../assets/audio/ribbon-bubble.ogg", import.meta.url).href,
    crystallizeIce: new URL("../assets/audio/crystallize-ice.wav", import.meta.url).href,
    crystallizeColdsnap: new URL("../assets/audio/crystallize-coldsnap.wav", import.meta.url).href,
};

const AudioContextCtor = window.AudioContext || window.webkitAudioContext;

function makePool(url, size) {
    const voices = [];
    for (let i = 0; i < size; i++) {
        const voice = new Audio(url);
        voice.preload = "auto";
        voices.push(voice);
    }
    return { voices, cursor: 0 };
}

function makeLoop(url) {
    const voice = new Audio(url);
    voice.loop = true;
    voice.preload = "auto";
    voice.volume = 0;
    return voice;
}

export class Soundscape {
    /** @param {HTMLCanvasElement} canvas */
    constructor(canvas) {
        this.unlocked = false;
        this.context = null;
        this.ribbonHeld = false;
        this.elapsed = 0;
        this.nextRibbonBubble = 0;

        this.footsteps = [makePool(ASSET.footstepA, 3), makePool(ASSET.footstepB, 3)];
        this.sweep = makePool(ASSET.sweepWater, 3);
        this.sweepSpray = makePool(ASSET.sweepSpray, 3);
        this.bloom = makePool(ASSET.bloomSplash, 3);
        this.bloomImpact = makePool(ASSET.bloomImpact, 3);
        this.ribbonBubbles = makePool(ASSET.ribbonBubble, 3);
        this.ice = makePool(ASSET.crystallizeIce, 3);
        this.coldSnap = makePool(ASSET.crystallizeColdsnap, 3);
        this.vortex = makePool(ASSET.surfWind, 2);
        this.surfLoop = makeLoop(ASSET.surfWind);
        this.ribbonLoop = makeLoop(ASSET.ribbonWater);

        const unlock = () => this.unlock();
        canvas.addEventListener("pointerdown", unlock, { once: true });
        window.addEventListener("keydown", unlock, { once: true });
    }

    unlock() {
        this.unlocked = true;
        if (!this.context && AudioContextCtor) this.context = new AudioContextCtor();
        this.context?.resume().catch(() => {});
    }

    /** @param {number} dt @param {{surf:number, speed01:number}} character @param {{touchdown:boolean[]}|null} figure */
    update(dt, character, figure) {
        if (!this.unlocked) return;
        this.elapsed += dt;

        if (figure && character.surf < 0.5) {
            for (let foot = 0; foot < figure.touchdown.length; foot++) {
                if (!figure.touchdown[foot]) continue;
                // Dry, compacted snow is intentionally quiet: the texture should
                // sit beneath the visual footfall rather than read as grass.
                this._play(this.footsteps[foot & 1], 0.14 + character.speed01 * 0.06, 0.94 + Math.random() * 0.12);
            }
        }

        const surfStrength = character.surf * (0.28 + character.speed01 * 0.72);
        this._loop(this.surfLoop, surfStrength * 0.32, 0.82 + character.speed01 * 0.34, dt);
        this._loop(this.ribbonLoop, this.ribbonHeld ? 0.20 : 0, 0.92, dt);

        // A held ribbon has small, irregular water particles on top of its
        // continuous body, which keeps it from sounding like a static loop.
        if (this.ribbonHeld && this.elapsed >= this.nextRibbonBubble) {
            this._play(this.ribbonBubbles, 0.10 + Math.random() * 0.04, 0.88 + Math.random() * 0.22);
            this.nextRibbonBubble = this.elapsed + 0.48 + Math.random() * 0.58;
        }
    }

    /** @param {number} key */
    spell(key) {
        if (!this.unlocked) return;
        if (key === 1) {
            // Sweep: a rushing water edge cuts across loose snow.
            this._play(this.sweep, 0.44, 0.90 + Math.random() * 0.10);
            this._play(this.sweepSpray, 0.23, 0.93 + Math.random() * 0.14, 0.035);
            this._noise(0.26, 0.035, 1100, 1.4);
        } else if (key === 3) {
            // Bloom: a water eruption gets a second delayed surface collapse.
            this._play(this.bloom, 0.54, 0.86 + Math.random() * 0.10);
            this._play(this.bloomImpact, 0.28, 0.82 + Math.random() * 0.10, 0.075);
            this._noise(0.46, 0.05, 560, 0.9);
        } else if (key === 4) {
            // Crystallize: the main ice split is followed by a colder fracture.
            this._play(this.ice, 0.46, 0.92 + Math.random() * 0.12);
            this._play(this.coldSnap, 0.20, 1.05 + Math.random() * 0.08, 0.055);
            this._noise(0.34, 0.026, 3100, 2.6);
        } else if (key === 5) {
            // Vortex: a fast wind surge carries a layer of airborne snow grit.
            this._play(this.vortex, 0.26, 1.16);
            this._play(this.sweepSpray, 0.15, 0.72 + Math.random() * 0.10, 0.04);
            this._noise(0.64, 0.04, 780, 1.1);
        }
    }

    /** @param {boolean} held */
    setRibbon(held) {
        this.ribbonHeld = held;
        if (held) this.nextRibbonBubble = this.elapsed + 0.15;
    }

    _play(pool, gain, rate, delay = 0) {
        if (S.sfxVolume <= 0.001) return;
        const voice = pool.voices[pool.cursor++ % pool.voices.length];
        voice.volume = Math.min(1, gain * S.sfxVolume);
        voice.playbackRate = rate;
        const start = () => {
            voice.pause();
            try { voice.currentTime = 0; } catch {}
            voice.play().catch(() => {});
        };
        if (delay > 0) window.setTimeout(start, delay * 1000);
        else start();
    }

    _loop(voice, gain, rate, dt) {
        const target = Math.min(1, gain * S.sfxVolume);
        voice.volume += (target - voice.volume) * (1 - Math.exp(-dt * 9));
        voice.playbackRate = rate;
        if (target > 0.002 && voice.paused) voice.play().catch(() => {});
        if (target <= 0.002 && voice.volume < 0.003 && !voice.paused) voice.pause();
    }

    _noise(duration, gain, frequency, q) {
        const ctx = this.context;
        if (!ctx || S.sfxVolume <= 0.001) return;
        const now = ctx.currentTime;
        const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
        const samples = buffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = frequency;
        filter.Q.value = q;
        const amp = ctx.createGain();
        amp.gain.setValueAtTime(0.0001, now);
        amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * S.sfxVolume), now + 0.012);
        amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        source.connect(filter).connect(amp).connect(ctx.destination);
        source.start(now);
        source.stop(now + duration + 0.02);
    }

    dispose() {
        for (const voice of [this.surfLoop, this.ribbonLoop]) {
            voice.pause();
            voice.src = "";
        }
        this.context?.close().catch(() => {});
    }
}
