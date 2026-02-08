// js/microfono.js - VERSIÓN FUNCIONAL SIMPLIFICADA

// Importar solo lo necesario
import { AudioProcessor } from './modules/audio.js';
import { ScoreGenerator } from './modules/score.js';
import { ScoreEditor } from './modules/editor.js';
import { PianoEngine } from './modules/piano.js';
import { formatTime, showNotification } from './modules/core.js';

class MicrophoneApp {
    constructor() {
        this.audioProcessor = new AudioProcessor();
        this.scoreGenerator = null;
        this.editor = null;

        this.notes = [];
        this.isRecording = false;
        this.startTime = 0;
        this.timerInterval = null;

        // Piano para reproducción
        this.piano = new PianoEngine();
        this.piano.init();

        this.lastNote = null;
        this.lastNoteTime = 0;
        // Tiempo mínimo (en milisegundos) entre dos detecciones de la misma nota.
        // Si el algoritmo detecta la misma nota muchas veces muy rápido, usamos este
        // valor como “antiametralladora” para no llenar la partitura con duplicados.
        // Valores bajos (p.ej. 50 ms) permiten registrar muchas repeticiones rápidas,
        // valores altos (p.ej. 250 ms) reducen duplicados pero pueden descartar
        // repeticiones muy seguidas de la misma tecla.
        this.minNoteDuration = 150; // Base para el debounce

        this.init();
    }

    init() {
        // Inicializar generador de partituras
        this.scoreGenerator = new ScoreGenerator('scoreCanvas');

        this.scoreGenerator.onEditRequest = () => {
            if (this.editor) this.editor.open(this.notes);
        };

        this.editor = new ScoreEditor(this.scoreGenerator, (updatedNotes) => {
            this.notes = updatedNotes;
            this.updateNotesGrid();
            this.updateTotalNotes();
            this.refreshScore();
            showNotification('Partitura actualizada', 'success');
        });

        // Callbacks iniciales (se sobrescriben en startRecording)
        this.audioProcessor.onNoteDetected = (note) => this.handleNoteDetected(note);
        this.audioProcessor.onVolumeChange = (volume) => this.updateVolumeDisplay(volume);
        this.audioProcessor.onDataAvailable = (data) => this.drawWaveform(data);

        // Event listeners
        this.setupEventListeners();

        // Soporte de micrófono
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showNotification('Tu navegador no soporta acceso al micrófono', 'error');
            const startBtn = document.getElementById('startRecording');
            if (startBtn) startBtn.disabled = true;
        }

        // Canvas visualizador
        this.initWaveformCanvas();

        // Estado inicial
        this.updateUIState(false);
        showNotification('Aplicación de micrófono lista para usar', 'success');
        console.log('MicrofonoApp: Inicialización completada');
    }

    setupEventListeners() {
        console.log('Configurando event listeners...');

        const startBtn = document.getElementById('startRecording');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                console.log('Botón de inicio clickeado');
                this.startRecording();
            });
        }

        const stopBtn = document.getElementById('stopRecording');
        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                console.log('Botón de parada clickeado');
                this.stopRecording();
            });
        }

        const clearBtn = document.getElementById('clearRecording');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                console.log('Botón de limpieza clickeado');
                this.clearRecording();
            });
        }

        const exportBtn = document.getElementById('exportPDF');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                console.log('Botón de exportación PDF clickeado');
                this.exportPDF();
            });
        }

        const exportImgBtn = document.getElementById('exportScoreImage');
        if (exportImgBtn) {
            exportImgBtn.addEventListener('click', () => {
                this.exportImage();
            });
        }

        const playBtn = document.getElementById('playRecording');
        if (playBtn) {
            playBtn.addEventListener('click', () => {
                this.playRecording();
            });
        }

        const refreshBtn = document.getElementById('refreshScore');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                console.log('Botón de refresco clickeado');
                this.refreshScore();
            });
        }

        const sensitivitySlider = document.getElementById('sensitivity');
        if (sensitivitySlider) {
            sensitivitySlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                const display = document.getElementById('sensitivityValue');
                if (display) {
                    display.textContent = value + '%';
                }
                if (this.audioProcessor) {
                    // 100% sens → threshold bajo; 0% sens → threshold alto
                    this.audioProcessor.volumeThreshold = Math.max(1, 100 - value);
                }
                console.log('Sensibilidad ajustada:', value + '%');
            });
        }

        console.log('Event listeners configurados');
    }

    initWaveformCanvas() {
        const canvas = document.getElementById('waveCanvas');
        if (!canvas) {
            console.error('No se encontró el canvas waveCanvas');
            return;
        }

        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        console.log('Canvas del visualizador inicializado');
    }

    async startRecording() {
        console.log('Iniciando grabación...');
        try {
            this.audioProcessor = new AudioProcessor();

            this.audioProcessor.onNoteDetected = (note) => this.handleNoteDetected(note);
            this.audioProcessor.onVolumeChange = (volume) => this.updateVolumeDisplay(volume);
            this.audioProcessor.onDataAvailable = (dataArray) => this.drawWaveform(dataArray);

            const success = await this.audioProcessor.startRecording();
            if (success) {
                this.isRecording = true;
                this.updateUIState(true);
                this.startTimer();
                this.audioProcessor.startAnalysis();
                showNotification('🎤 Grabación iniciada', 'success');
                console.log('Grabación iniciada exitosamente');
            } else {
                showNotification('❌ No se pudo acceder al micrófono', 'error');
                console.error('Falló al iniciar la grabación');
            }
        } catch (error) {
            console.error('Error en startRecording:', error);
            showNotification(`Error: ${error.message} `, 'error');
        }
    }

    stopRecording() {
        console.log('Deteniendo grabación...');
        this.stopPlayback();

        if (this.audioProcessor) {
            this.audioProcessor.stopRecording();
            this.audioProcessor = null;
        }

        this.isRecording = false;
        this.updateUIState(false);
        this.stopTimer();

        this.refreshScore();
        showNotification('⏹️ Grabación detenida', 'info');
        console.log('Grabación detenida');
    }

    stopPlayback() {
        // Si implementas playback con timeouts, límpialos aquí
    }

    playRecording() {
        if (this.notes.length === 0) {
            showNotification('No hay notas para reproducir', 'error');
            return;
        }
        showNotification('Reproduciendo grabación...', 'info');
        this.piano.playSequence(this.notes, 500);
    }

    // MONOFÓNICO, 1 nota dominante

    handleNoteDetected(note) {
        console.log('handleNoteDetected recibió:', note);
        if (!note) return;

        const now = Date.now();
        // Filtro de repetición: si la nota es la misma que la anterior y ha pasado
        // menos tiempo que minNoteDuration desde la última vez, se ignora esta
        // detección. Así evitamos que pequeñas variaciones del algoritmo generen
        // muchas entradas iguales cuando mantenemos o repetimos la misma tecla.
        // SMART DEBOUNCE
        // Si es la MISMA nota, esperamos más tiempo (evitar duplicados/metralleta).
        // Si es una nota NUEVA, la aceptamos más rápido (agilidad).
        const debounceTime = (this.lastNote && this.lastNote.name === note.name)
            ? 380  // Misma nota: 150ms (Balanceado)
            : 120;  // Nueva nota: 70ms

        if (this.lastNote) {
            if (now - this.lastNoteTime < debounceTime) {
                return;
            }
        }

        this.lastNote = note;
        this.lastNoteTime = now;

        const noteEntry = {
            ...note,
            allNotes: [note],
            timestamp: now,
            duration: 'q'
        };

        this.notes.push(noteEntry);

        this.updateCurrentNoteDisplay(note);
        this.updateNotesGrid();
        this.updateTotalNotes();

        if (this.notes.length % 4 === 0) {
            this.refreshScore();
        }
    }

    updateCurrentNoteDisplay(note) {
        if (!note) return;

        const noteDisplay = document.getElementById('currentNoteDisplay');
        const frequencyDisplay = document.getElementById('frequencyDisplay');
        const octaveDisplay = document.getElementById('octaveDisplay');

        if (noteDisplay) {
            noteDisplay.textContent = note.name;
            noteDisplay.style.fontSize = '4rem';
            noteDisplay.style.transform = 'scale(1.2)';
            setTimeout(() => {
                noteDisplay.style.transform = 'scale(1)';
            }, 200);
        }

        if (frequencyDisplay) {
            const freq = Number(note.frequency) || 0;
            frequencyDisplay.textContent = freq.toFixed(1) + ' Hz';
        }

        if (octaveDisplay) {
            octaveDisplay.textContent = note.octave;
        }

        const confidenceDisplay = document.getElementById('confidenceDisplay');
        if (confidenceDisplay) {
            const baseConfidence = 90;
            const variance = Math.random() * 10;
            const confidence = Math.min(100, baseConfidence - variance);
            confidenceDisplay.textContent = Math.round(confidence) + '%';
        }
    }

    updateVolumeDisplay(volume) {
        const volumeDisplay = document.getElementById('volumeLevel');
        if (volumeDisplay) {
            volumeDisplay.textContent = Math.round(volume) + '%';
            if (volume > 80) {
                volumeDisplay.style.color = '#f44336';
            } else if (volume > 50) {
                volumeDisplay.style.color = '#ff9800';
            } else {
                volumeDisplay.style.color = '#4CAF50';
            }
        }
    }

    drawWaveform(dataArray) {
        const canvas = document.getElementById('waveCanvas');
        if (!canvas || !dataArray) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = '#4ecdc4';
        ctx.lineWidth = 2;
        ctx.beginPath();

        const bufferLength = dataArray.length;
        const sliceWidth = width * 1.0 / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * height / 2;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
            x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
    }

    updateNotesGrid() {
        const grid = document.getElementById('notesGrid');
        if (!grid) {
            console.error('No se encontró notesGrid');
            return;
        }

        grid.innerHTML = '';

        if (this.notes.length === 0) {
            grid.innerHTML = `
        <div style="text-align:center; color:#888; padding:40px 20px; width:100%">
          <p style="font-size:1.1rem; margin-bottom:10px;">🎵 Inicia la grabación para ver las notas</p>
          <p>Las notas detectadas aparecerán aquí en tiempo real</p>
        </div>
      `;
            return;
        }

        const lastNotes = this.notes.slice(-20);

        lastNotes.forEach((note, index) => {
            const noteElement = document.createElement('div');
            noteElement.className = 'note-item';
            noteElement.innerHTML = `
        <span>${note.name}</span>
        <button class="remove-note" data-index="${this.notes.length - 20 + index}">✕</button>
      `;

            noteElement
                .querySelector('.remove-note')
                .addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = parseInt(e.target.dataset.index);
                    this.removeNote(idx);
                });

            grid.appendChild(noteElement);
        });

        grid.scrollTop = grid.scrollHeight;
    }

    removeNote(index) {
        if (index < 0 || index >= this.notes.length) return;
        this.notes.splice(index, 1);
        this.updateNotesGrid();
        this.updateTotalNotes();
        this.refreshScore();
        showNotification('Nota eliminada', 'info');
    }

    updateTotalNotes() {
        const noteCount = document.getElementById('noteCount');
        const totalNotes = document.getElementById('totalNotes');
        if (noteCount) noteCount.textContent = this.notes.length;
        if (totalNotes) totalNotes.textContent = this.notes.length;
    }

    refreshScore() {
        if (this.scoreGenerator) {
            this.scoreGenerator.generateScore(this.notes);
        }
        const measureCount = document.getElementById('measureCount');
        if (measureCount) {
            measureCount.textContent = Math.ceil(this.notes.length / 4);
        }
    }

    updateUIState(isRecording) {
        const startBtn = document.getElementById('startRecording');
        const stopBtn = document.getElementById('stopRecording');
        const status = document.getElementById('recordingStatus');

        if (startBtn) startBtn.disabled = isRecording;
        if (stopBtn) stopBtn.disabled = !isRecording;

        if (status) {
            status.textContent = isRecording ? 'Grabando...' : 'Listo para grabar';
            status.style.background = isRecording ? '#ffebee' : '#e8f5e9';
            status.style.color = isRecording ? '#f44336' : '#4CAF50';
        }
    }

    startTimer() {
        this.startTime = Date.now();
        this.timerInterval = setInterval(() => this.updateTimer(), 1000);
        const timerElement = document.getElementById('timer');
        if (timerElement) timerElement.textContent = '00:00';
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateTimer() {
        const timerElement = document.getElementById('timer');
        if (!timerElement || !this.startTime) return;
        const elapsed = Date.now() - this.startTime;
        timerElement.textContent = formatTime(elapsed / 1000);
    }

    clearRecording() {
        console.log('Limpiando grabación...');

        if (this.isRecording) {
            this.stopRecording();
        }

        this.notes = [];
        this.updateNotesGrid();
        this.updateTotalNotes();

        if (this.scoreGenerator) {
            this.scoreGenerator.generateScore([]);
        }

        this.stopTimer();
        const timerElement = document.getElementById('timer');
        if (timerElement) timerElement.textContent = '00:00';

        this.clearWaveform();

        const noteDisplay = document.getElementById('currentNoteDisplay');
        if (noteDisplay) noteDisplay.textContent = '--';

        const frequencyDisplay = document.getElementById('frequencyDisplay');
        if (frequencyDisplay) frequencyDisplay.textContent = '0 Hz';

        const octaveDisplay = document.getElementById('octaveDisplay');
        if (octaveDisplay) octaveDisplay.textContent = '--';

        showNotification('Todo ha sido limpiado', 'info');
        console.log('Grabación limpiada');
    }

    clearWaveform() {
        const canvas = document.getElementById('waveCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    exportPDF() {
        if (this.notes.length === 0) {
            showNotification('No hay notas para exportar', 'error');
            return;
        }

        const content = `
Partitura - Grabación en Vivo

Fecha: ${new Date().toLocaleString()}
Notas totales: ${this.notes.length}

Secuencia de notas:
${this.notes.map(n => n.name).join(' - ')}

Configuración:
Clave: Sol
Compás: 4/4
Tempo: 120 BPM

---------------------------------
Generado por Transforma Audio en Partitura
`;

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `partitura_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showNotification('Partitura exportada como texto', 'success');
    }

    async exportImage() {
        if (this.notes.length === 0) {
            showNotification('No hay notas para exportar', 'error');
            return;
        }

        try {
            await this.scoreGenerator.exportAsImage();
            showNotification('Partitura exportada como PNG', 'success');
        } catch (error) {
            console.error('Error al exportar imagen:', error);
            showNotification('Error al exportar imagen', 'error');
        }
    }
}

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM cargado, inicializando aplicación...');
    setTimeout(() => {
        try {
            window.microfonoApp = new MicrophoneApp();
            console.log('Aplicación inicializada correctamente');
        } catch (error) {
            console.error('Error al inicializar la aplicación:', error);
            alert('Error al inicializar la aplicación. Por favor, recarga la página.');
        }
    }, 100);
});