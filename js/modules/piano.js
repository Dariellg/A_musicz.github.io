// js/modules/piano.js
// Piano completo (A0–C8) usando Web Audio API, sin librerías externas.

import { NOTE_FREQUENCIES } from './core.js';

export class PianoEngine {
    constructor() {
        this.audioContext = null;
        this.onNotePlay = null;
        this.activeNotes = {};
    }

    async init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        console.log('PianoEngine inicializado con Web Audio API');
    }

    playNote(noteName, duration = 1) {
        this.startNote(noteName);
        setTimeout(() => this.stopNote(noteName), duration * 1000);
    }

    startNote(noteName) {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        const freq = NOTE_FREQUENCIES[noteName];
        if (!freq) {
            console.warn('Frecuencia no encontrada para', noteName);
            return;
        }

        this.stopNote(noteName);

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'triangle';
        osc.frequency.value = freq;

        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        const now = this.audioContext.currentTime;

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.9, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2);

        osc.start(now);

        this.activeNotes[noteName] = { osc, gain };

        if (this.onNotePlay) {
            this.onNotePlay({
                name: noteName.replace('#', '♯'),
                scientific: noteName,
                frequency: freq,
                octave: noteName.slice(-1)
            });
        }
    }

    stopNote(noteName) {
        const active = this.activeNotes[noteName];
        if (!active) return;

        const { osc, gain } = active;
        const now = this.audioContext.currentTime;

        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        try {
            osc.stop(now + 0.15);
        } catch (e) {
            console.warn('Error al detener oscilador', noteName, e);
        }

        delete this.activeNotes[noteName];
    }

    stopAll() {
        Object.keys(this.activeNotes).forEach(n => this.stopNote(n));
    }

    // === GENERAR TECLADO COMPLETO A0–C8 ===
    createFullKeyboard(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const notes = [];
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        // MIDI 21 (A0) a 108 (C8)
        for (let octave = 0; octave <= 8; octave++) {
            noteNames.forEach((name, index) => {
                const midiNote = 12 + (octave * 12) + index;
                if (midiNote < 21 || midiNote > 108) return; // A0–C8
                notes.push(`${name}${octave}`);
            });
        }

        container.innerHTML = '';

        notes.forEach((note) => {
            const isBlack = note.includes('#');
            const key = document.createElement('div');
            key.className = `piano-key ${isBlack ? 'black-key' : 'white-key'}`;
            key.dataset.note = note;

            const label = document.createElement('div');
            label.className = 'key-label';
            label.textContent = note.replace('#', '♯');
            key.appendChild(label);

            container.appendChild(key);
        });
    }

    playSequence(notes, tempo = 500) {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        notes.forEach((note, index) => {
            const name = note.scientific || note;
            const freq = NOTE_FREQUENCIES[name];
            if (!freq) return;

            const when = this.audioContext.currentTime + (index * tempo) / 1000;

            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'triangle';
            osc.frequency.value = freq;

            osc.connect(gain);
            gain.connect(this.audioContext.destination);

            gain.gain.setValueAtTime(0, when);
            gain.gain.linearRampToValueAtTime(0.9, when + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, when + 0.8);

            osc.start(when);
            osc.stop(when + 0.8);
        });
    }
}
