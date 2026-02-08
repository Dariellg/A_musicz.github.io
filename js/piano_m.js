// js/piano_m.js - Piano completo con acordes usando PianoEngine (Web Audio)

import { PianoEngine } from './modules/piano.js';
import { ScoreGenerator } from './modules/score.js';
import { ScoreEditor } from './modules/editor.js';
import { showNotification } from './modules/core.js';

class PianoApp {
    constructor() {
        this.piano = new PianoEngine();
        this.scoreGenerator = null;
        this.editor = null;
        this.notes = [];
        this.currentChord = '';
        this.tempo = 120;
        this.currentOctave = 4;

        this.activeKeys = new Map();
        this.playbackTimeouts = [];

        this.init();
    }

    async init() {
        await this.piano.init();

        this.piano.onNotePlay = (note) => this.updateCurrentNotesDisplay(note);

        this.scoreGenerator = new ScoreGenerator('scoreCanvas');
        this.scoreGenerator.onEditRequest = () => {
            if (this.editor) this.editor.open(this.notes);
        };

        this.editor = new ScoreEditor(this.scoreGenerator, (updatedNotes) => {
            this.notes = updatedNotes;
            this.updateNotesList();
            this.updateTotalNotesCount();
            this.updateScore();
            showNotification('Partitura actualizada', 'success');
        });

        // 1) Crear teclado completo con el motor (A0–C8)
        this.piano.createFullKeyboard('pianoKeys');

        // 2) Conectar eventos de las teclas al motor
        this.setupKeyInteractions();

        // 3) Controles y UI
        this.setupEventListeners();
        this.updateUI();

        showNotification('Piano virtual listo. Haz doble clic en la partitura para editar.', 'success');
    }

    // Engancha eventos a las teclas ya creadas por PianoEngine.createFullKeyboard
    setupKeyInteractions() {
        const container = document.getElementById('pianoKeys');
        if (!container) return;

        const keys = container.querySelectorAll('.piano-key');
        keys.forEach(key => {
            const note = key.dataset.note;

            const startKey = (e) => {
                if (e.type === 'mousedown' && e.buttons !== 1) return;
                if (e.type === 'mouseenter' && e.buttons !== 1) return;

                e.preventDefault();
                if (this.activeKeys.has(note)) return;

                key.classList.add('key-playing');
                this.piano.startNote(note);
                this.activeKeys.set(note, Date.now());
                this.updateCurrentNotesDisplay({ name: note, octave: note.slice(-1) });
            };

            const stopKey = () => {
                if (!this.activeKeys.has(note)) return;

                key.classList.remove('key-playing');
                this.piano.stopNote(note);

                const startTime = this.activeKeys.get(note);
                const durationMs = Date.now() - startTime;
                this.activeKeys.delete(note);

                const durationSymbol = this.calculateDurationSymbol(durationMs);

                if (document.getElementById('autoAddNotes')?.checked) {
                    this.addNote({
                        name: note.replace('#', '♯'),
                        scientific: note,
                        octave: note.slice(-1),
                        duration: durationSymbol
                    });
                }
            };

            key.addEventListener('mousedown', startKey);
            key.addEventListener('mouseenter', startKey);
            key.addEventListener('mouseup', stopKey);
            key.addEventListener('mouseleave', stopKey);

            key.addEventListener('touchstart', (e) => {
                e.preventDefault();
                startKey(e);
            });
            key.addEventListener('touchend', (e) => {
                e.preventDefault();
                stopKey(e);
            });
        });
    }

    calculateDurationSymbol(ms) {
        const bpm = parseInt(this.tempo) || 120;
        const qShot = 60000 / bpm;

        if (ms >= qShot * 3) return 'w';
        if (ms >= qShot * 1.5) return 'h';
        if (ms >= qShot * 0.75) return 'q';
        return '8';
    }

    addNote(note) {
        const noteObj = {
            ...note,
            timestamp: Date.now(),
            duration: note.duration || 'q',
            chord: this.currentChord
        };

        this.notes.push(noteObj);
        this.updateNotesList();
        this.updateTotalNotesCount();
        this.updateScore();
    }

    playChord(chordName, notesArray) {
        this.currentChord = chordName;

        const chordSpan = document.getElementById('currentChord');
        if (chordSpan) chordSpan.textContent = chordName;

        notesArray.forEach((noteName, index) => {
            const id = setTimeout(() => {
                this.piano.playNote(noteName, 1.5);

                const autoAdd = document.getElementById('autoAddNotes')?.checked;
                if (autoAdd) {
                    const noteObj = {
                        name: noteName.replace('#', '♯'),
                        scientific: noteName,
                        octave: noteName.slice(-1),
                        duration: 'h',
                        chord: chordName
                    };
                    this.addNote(noteObj);
                }
            }, index * 100);
            this.playbackTimeouts.push(id);
        });

        setTimeout(() => {
            this.currentChord = '';
            if (chordSpan) chordSpan.textContent = '--';
        }, 2000);
    }

    playSequence() {
        if (this.notes.length === 0) {
            showNotification('No hay notas para reproducir', 'error');
            return;
        }

        const noteDuration = 60000 / this.tempo;

        this.stopPlayback();
        showNotification(`Reproduciendo melodía (${this.tempo} BPM)...`, 'info');

        this.notes.forEach((note, index) => {
            const id = setTimeout(() => {
                this.piano.playNote(note.scientific, 0.5);
                this.highlightCurrentNote(index);
            }, index * noteDuration);
            this.playbackTimeouts.push(id);
        });
    }

    highlightCurrentNote(index) {
        const noteItems = document.querySelectorAll('.note-item');
        noteItems.forEach(item => item.style.background = 'white');

        if (noteItems[index]) {
            noteItems[index].style.background = '#e3f2fd';
        }
    }

    updateCurrentNotesDisplay(note) {
        const display = document.getElementById('currentNotesDisplay');
        if (display) {
            display.textContent = note.name;
            display.style.fontSize = '2.5rem';
            display.style.color = '#4ecdc4';
            display.style.transform = 'scale(1.1)';
            setTimeout(() => {
                display.style.transform = 'scale(1)';
            }, 200);
        }

        const octaveSpan = document.getElementById('currentOctave');
        if (octaveSpan) octaveSpan.textContent = note.octave;
    }

    updateNotesList() {
        const container = document.getElementById('notesList');
        if (!container) return;

        container.innerHTML = '';

        if (this.notes.length === 0) {
            container.innerHTML = `
        <div style="text-align: center; color: #888; padding: 40px 20px; width: 100%;">
          <p style="font-size: 1.1rem; margin-bottom: 10px;">🎵 Aún no hay notas</p>
          <p>Toca el piano o selecciona acordes para comenzar</p>
        </div>
      `;
            return;
        }

        const lastNotes = this.notes.slice(-30).reverse();

        lastNotes.forEach((note, index) => {
            const noteIndex = this.notes.length - 30 + index;
            const noteElement = document.createElement('div');
            noteElement.className = 'note-item';
            noteElement.innerHTML = `
        <span style="font-size: 1.2rem;">${note.name}</span>
        ${note.chord ? `<small style="color: #9c27b0; background: #f3e5f5; padding: 2px 8px; border-radius: 10px;">${note.chord}</small>` : ''}
        <button class="remove-note" data-index="${noteIndex >= 0 ? noteIndex : index}">×</button>
      `;

            noteElement.querySelector('.remove-note').addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(e.target.dataset.index);
                this.removeNote(idx);
            });

            container.appendChild(noteElement);
        });
    }

    updateTotalNotesCount() {
        const c1 = document.getElementById('totalNotesCount');
        const c2 = document.getElementById('noteCount');
        if (c1) c1.textContent = this.notes.length;
        if (c2) c2.textContent = this.notes.length;
    }

    removeNote(index) {
        if (index >= 0 && index < this.notes.length) {
            this.notes.splice(index, 1);
            this.updateNotesList();
            this.updateTotalNotesCount();
            this.updateScore();
            showNotification('Nota eliminada', 'info');
        }
    }

    clearAll() {
        this.notes = [];
        this.updateNotesList();
        this.updateTotalNotesCount();
        this.scoreGenerator.generateScore([]);
        showNotification('Todas las notas han sido eliminadas', 'info');
    }

    updateScore() {
        if (this.scoreGenerator) {
            this.scoreGenerator.generateScore(this.notes);
            const mc = document.getElementById('measureCount');
            if (mc) mc.textContent = Math.ceil(this.notes.length / 4);
        }
    }

    stopPlayback() {
        if (this.playbackTimeouts) {
            this.playbackTimeouts.forEach(id => clearTimeout(id));
            this.playbackTimeouts = [];
        }

        if (this.piano && this.piano.stopAll) {
            this.piano.stopAll();
        }

        document.querySelectorAll('.note-item').forEach(i => i.style.background = '');
        document.querySelectorAll('.chord-btn').forEach(b => b.classList.remove('active'));

        showNotification('Reproducción detenida', 'info');
    }

    setupEventListeners() {
        document.getElementById('playSequence')?.addEventListener('click', () => this.playSequence());
        document.getElementById('stopPlayback')?.addEventListener('click', () => this.stopPlayback());
        document.getElementById('clearAll')?.addEventListener('click', () => this.clearAll());
        document.getElementById('undoLast')?.addEventListener('click', () => {
            if (this.notes.length > 0) {
                this.notes.pop();
                this.updateNotesList();
                this.updateTotalNotesCount();
                this.updateScore();
                showNotification('Última nota deshecha', 'info');
            }
        });
        document.getElementById('exportMelody')?.addEventListener('click', () => this.exportMelody());
        document.getElementById('refreshScore')?.addEventListener('click', () => this.updateScore());
        document.getElementById('exportPDF')?.addEventListener('click', () => this.exportPDF());
        document.getElementById('exportImage')?.addEventListener('click', () => this.exportImage());
        document.getElementById('addChordToScore')?.addEventListener('click', () => this.addCurrentChordToScore());
        document.getElementById('playAllChords')?.addEventListener('click', () => this.playAllChords());

        document.querySelectorAll('.chord-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const chordName = e.target.dataset.chord;
                const notesString = e.target.dataset.notes;
                const notesArray = notesString.split(',');

                document.querySelectorAll('.chord-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                e.target.classList.add('active');

                this.playChord(chordName, notesArray);
            });
        });

        document.getElementById('tempoSlider')?.addEventListener('input', (e) => {
            this.tempo = e.target.value;
            document.getElementById('tempoValue').textContent = `${this.tempo} BPM`;
            document.getElementById('scoreTempo').textContent = this.tempo;
        });

        document.getElementById('octaveSelect')?.addEventListener('change', (e) => {
            this.currentOctave = e.target.value;
            showNotification(`Octava cambiada a ${this.currentOctave}`, 'info');
        });

        document.getElementById('clefSelect')?.addEventListener('change', (e) => {
            showNotification(
                `Clave cambiada a ${e.target.value === 'treble'
                    ? 'Sol'
                    : e.target.value === 'bass'
                        ? 'Fa'
                        : 'Do'
                }`,
                'info'
            );
        });
    }

    exportMelody() {
        if (this.notes.length === 0) {
            showNotification('No hay notas para exportar', 'error');
            return;
        }

        const melodyData = {
            name: `Melodía_${new Date().toISOString().slice(0, 10)}`,
            tempo: this.tempo,
            notes: this.notes,
            totalNotes: this.notes.length,
            duration: (this.notes.length * 0.5).toFixed(1) + ' segundos'
        };

        const blob = new Blob([JSON.stringify(melodyData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `melodia_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        showNotification('Melodía exportada como JSON', 'success');
    }

    exportPDF() {
        if (this.notes.length === 0) {
            showNotification('No hay notas para exportar', 'error');
            return;
        }

        const scoreText = `
Partitura Generada
=================

Título: Melodía de Piano
Tempo: ${this.tempo} BPM
Notas totales: ${this.notes.length}

Secuencia de notas:
${this.notes.map(n => n.name).join(' - ')}

Fecha: ${new Date().toLocaleString()}

---
Exporta esta partitura como PDF
para poder editarla en software
como MuseScore o Finale.
`;

        const blob = new Blob([scoreText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `partitura_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        showNotification('Partitura exportada como texto (simulación PDF)', 'success');
    }

    exportImage() {
        if (this.notes.length === 0) {
            showNotification('No hay notas para exportar', 'error');
            return;
        }

        const link = this.scoreGenerator.exportAsImage();
        if (link) {
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showNotification('Partitura exportada como imagen', 'success');
        }
    }

    addCurrentChordToScore() {
        if (!this.currentChord) {
            showNotification('Primero selecciona un acorde', 'error');
            return;
        }

        const chordBtn = document.querySelector(`.chord-btn[data-chord="${this.currentChord}"]`);
        if (!chordBtn) return;

        const notesString = chordBtn.dataset.notes;
        const notesArray = notesString.split(',');

        notesArray.forEach(noteName => {
            const noteObj = {
                name: noteName.replace('#', '♯'),
                scientific: noteName,
                octave: noteName.slice(-1),
                duration: 'h',
                chord: this.currentChord
            };
            this.addNote(noteObj);
        });

        showNotification(`Acorde ${this.currentChord} agregado a la partitura`, 'success');
    }

    playAllChords() {
        const chordButtons = document.querySelectorAll('.chord-btn');
        const delay = 1000;

        this.stopPlayback();

        chordButtons.forEach((btn, index) => {
            const id = setTimeout(() => {
                const chordName = btn.dataset.chord;
                const notesString = btn.dataset.notes;
                const notesArray = notesString.split(',');

                chordButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                this.playChord(chordName, notesArray);

                const clearId = setTimeout(() => {
                    btn.classList.remove('active');
                }, delay - 200);
                this.playbackTimeouts.push(clearId);
            }, index * delay);
            this.playbackTimeouts.push(id);
        });

        showNotification(`Reproduciendo todos los acordes (${chordButtons.length} acordes)`, 'info');
    }

    updateUI() {
        this.updateTotalNotesCount();
        this.updateScore();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof Vex === 'undefined') {
        console.error('VexFlow no está cargado');
        return;
    }

    setTimeout(() => {
        window.pianoApp = new PianoApp();
    }, 500);
});
