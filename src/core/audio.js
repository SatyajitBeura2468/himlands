/**
 * Event-led soundscape. Real CC0 recordings carry the snow, water, ice and
 * wind texture; a few short Web Audio tones sit beneath them so the spells
 * retain a readable shape without becoming background music.
 */

import { S } from "./settings.js";

const ASSET = {
    footstepA: new URL("../assets/audio/snow-footstep-a.ogg", import.meta.url).href,
    footstepB: new URL("../assets/audio/snow-footstep-b.ogg", import.meta.url).href,
    surfWind: new URL("../assets/audio/snow-surf-wind.ogg", import.meta.url).href,
    ribbonWater: new URL("../assets/audio/ribbon-water-loop.ogg", import.meta.url).href,
    sweepWater: new URL("../assets/audio/sweep-water.ogg", import.meta.url).href,
    bloomSplash: new URL("../assets/audio/bloom-splash.ogg", import.meta.url).href,
    crystallizeIce: new URL("../assets/audio/crystallize-ice.wav", import.meta.url).href,
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

        this.footsteps = [makePool(ASSET.footstepA, 3), makePool(ASSET.footstepB, 3)];
        this.sweep = makePool(ASSET.sweepWater, 3);
        this.bloom = makePool(ASSET.bloomSplash, 3);
        this.ice = makePool(ASSET.crystallizeIce, 3);
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

        if (figure && character.surf < 0.5) {
            for (let foot = 0; foot < figure.touchdown.length; foot++) {
                if (!figure.touchdown[foot]) continue;
                this._play(this.footsteps[foot & 1], 0.22 + character.speed01 * 0.10, 0.94 + Math.random() * 0.12);
            }
        }

        const surfStrength = character.surf * (0.28 + character.speed01 * 0.72);
        this._loop(this.surfLoop, surfStrength * 0.32, 0.82 + character.speed01 * 0.34, dt);
        this._loop(this.ribbonLoop, this.ribbonHeld ? 0.20 : 0, 0.92, dt);
    }

    /** @param {number} key */
    spell(key) {
        if (!this.unlocked) return;
        if (key === 1) {
            this._play(this.sweep, 0.44, 0.90 + Math.random() * 0.10);
            this._tone(88, 46, 0.24, 0.09, "sine");
        } else if (key === 3) {
            this._play(this.bloom, 0.54, 0.86 + Math.random() * 0.10);
            this._tone(104, 40, 0.42, 0.12, "triangle");
        } else if (key === 4) {
            this._play(this.ice, 0.46, 0.92 + Math.random() * 0.12);
            this._tone(620, 1460, 0.48, 0.055, "sine");
        } else if (key === 5) {
            this._play(this.vortex, 0.26, 1.16);
            this._tone(172, 74, 0.62, 0.055, "sawtooth");
        }
    }

    /** @param {boolean} held */
    setRibbon(held) {
        this.ribbonHeld = held;
    }

    _play(pool, gain, rate) {
        if (S.sfxVolume <= 0.001) return;
        const voice = pool.voices[pool.cursor++ % pool.voices.length];
        voice.pause();
        try { voice.currentTime = 0; } catch {}
        voice.volume = Math.min(1, gain * S.sfxVolume);
        voice.playbackRate = rate;
        voice.play().catch(() => {});
    }

    _loop(voice, gain, rate, dt) {
        const target = Math.min(1, gain * S.sfxVolume);
        voice.volume += (target - voice.volume) * (1 - Math.exp(-dt * 9));
        voice.playbackRate = rate;
        if (target > 0.002 && voice.paused) voice.play().catch(() => {});
        if (target <= 0.002 && voice.volume < 0.003 && !voice.paused) voice.pause();
    }

    _tone(from, to, duration, gain, type) {
        const ctx = this.context;
        if (!ctx || S.sfxVolume <= 0.001) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const amp = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(from, now);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + duration);
        amp.gain.setValueAtTime(0.0001, now);
        amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * S.sfxVolume), now + 0.012);
        amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        osc.connect(amp).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration + 0.02);
    }

    dispose() {
        for (const voice of [this.surfLoop, this.ribbonLoop]) {
            voice.pause();
            voice.src = "";
        }
        this.context?.close().catch(() => {});
    }
}
