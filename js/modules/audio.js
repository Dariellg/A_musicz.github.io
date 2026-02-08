// js/modules/audio.js
import { frequencyToNote, isValidFrequency } from './core.js';

export class AudioProcessor {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.pitchDetect = null; // Instancia ml5
        this.timeDomainBuffer = null;
        this.animationId = null;

        this.onNoteDetected = null;
        this.onVolumeChange = null;
        this.onDataAvailable = null;

        this.volumeThreshold = 3;
        this.volumeThreshold = 6;
        this.isDetecting = false;

        // Estabilidad IA
        this.noteStabilityCounter = 0;
        this.pendingNote = null;

        // Estabilidad Math
        this.mathStabilityCounter = 0;
        this.pendingMathNote = null;

        // URL del modelo CREPE (usamos CDN pública de ml5 para no descargar 30MB)
        this.modelUrl = 'https://cdn.jsdelivr.net/gh/ml5js/ml5-data-and-models/models/pitch-detection/crepe/';
    }

    async startRecording() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.microphone = this.audioContext.createMediaStreamSource(stream);

            // 1. Analizador para Visualizaciones (Onda/Volumen)
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.timeDomainBuffer = new Float32Array(this.analyser.fftSize);
            // this.microphone.connect(this.analyser); // This connection will be replaced

            // 1. Cadena de Procesamiento de Audio (Mic -> Gain -> Filter -> Destiny)
            // Esto es crucial para detectar notas agudas (G6-C8) que suelen tener poca energía.

            // A. Ganancia de entrada (Boost general)
            const inputGain = this.audioContext.createGain();
            inputGain.gain.value = 2.0; // Doble de volumen para captar señales débiles

            // B. Filtro High-Shelf (Boost de agudos)
            const highShelf = this.audioContext.createBiquadFilter();
            highShelf.type = "highshelf";
            highShelf.frequency.value = 2000; // A partir de 2kHz
            highShelf.gain.value = 10;        // +10dB de boost a los agudos

            // C. Destino para la IA
            const processedDestination = this.audioContext.createMediaStreamDestination();

            // Conexiones
            this.microphone.connect(inputGain);
            inputGain.connect(highShelf);
            highShelf.connect(processedDestination);

            // También conectamos al analizador visual (opcional: ver la señal procesada o la original)
            // Conectamos la señal procesada para ver lo que "escucha" la IA
            highShelf.connect(this.analyser);

            // 2. Inicializar IA con la señal PROCESADA (Super-oído)
            console.log('Cargando modelo de IA (CREPE) con High-Shelf Boost...');

            // Promesa para esperar a que cargue el modelo
            await new Promise((resolve, reject) => {
                this.pitchDetect = ml5.pitchDetection(
                    this.modelUrl,
                    this.audioContext,
                    processedDestination.stream, // <--- Úsamos el stream procesado, no el mic crudo
                    () => {
                        console.log('Modelo IA cargado correctamente');
                        resolve();
                    }
                );
            });

            return true;
        } catch (error) {
            console.error('Error al inicializar audio/IA:', error);
            return false;
        }
    }

    stopRecording() {
        this.isDetecting = false;

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        if (this.microphone && this.microphone.mediaStream) {
            this.microphone.mediaStream.getTracks().forEach(t => t.stop());
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.pitchDetect = null;
    }

    startAnalysis() {
        this.isDetecting = true;

        // Loop 1: Visualizaciones y Volumen (Fast loop)
        const analyseVisuals = () => {
            if (!this.analyser || !this.isDetecting) return;

            // Waveform
            this.analyser.getFloatTimeDomainData(this.timeDomainBuffer);

            if (this.onDataAvailable) {
                const u8 = new Uint8Array(this.timeDomainBuffer.length);
                for (let i = 0; i < this.timeDomainBuffer.length; i++) {
                    u8[i] = (this.timeDomainBuffer[i] + 1) * 128; // Normalize -1..1 to 0..255
                }
                this.onDataAvailable(u8);
            }

            // Volumen (RMS)
            let sum = 0;
            for (let i = 0; i < this.timeDomainBuffer.length; i++) {
                sum += this.timeDomainBuffer[i] * this.timeDomainBuffer[i];
            }
            let rms = Math.sqrt(sum / this.timeDomainBuffer.length);
            const volume = rms * 100;

            if (this.onVolumeChange) {
                this.onVolumeChange(volume);
            }

            // --- MOTOR HÍBRIDO: Parte Matemática (AutoCorrelación) ---
            // Usamos esto para detectar notas MUY AGUDAS (C7-C8, >2000Hz)
            // donde la IA suele fallar, pero la onda es muy limpia y fácil para matemáticas.
            if (volume > this.volumeThreshold) {
                const mathFreq = this.autoCorrelate(this.timeDomainBuffer, this.audioContext.sampleRate);

                // Si detectamos una frecuencia alta válida (> 1500Hz, aprox G6 para arriba)
                // confiamos en las matemáticas e ignoramos a la IA (que probablemente dé null o error).
                if (isValidFrequency(mathFreq) && mathFreq > 1500) {
                    const note = frequencyToNote(mathFreq);
                    if (note) {
                        // Filtro de Estabilidad para Matemáticas (Nuevo)
                        // Evita que un "chirrido" random dispare una nota.
                        if (this.pendingMathNote && this.pendingMathNote.name === note.name && this.pendingMathNote.octave === note.octave) {
                            this.mathStabilityCounter++;
                        } else {
                            this.pendingMathNote = note;
                            this.mathStabilityCounter = 1;
                        }

                        // Requerimos 3 frames de confirmación (aprox 50ms) - Balanceado
                        if (this.mathStabilityCounter >= 8) {
                            if (this.onNoteDetected) {
                                this.onNoteDetected(note);
                            }
                        }
                    }
                } else {
                    this.mathStabilityCounter = 0;
                    this.pendingMathNote = null;
                }
            }

            this.animationId = requestAnimationFrame(analyseVisuals);
        };

        // Loop 2: Detección de Pitch con IA (Gamas Media/Baja)
        const detectPitchLoop = () => {
            if (!this.pitchDetect || !this.isDetecting) return;

            this.pitchDetect.getPitch((err, frequency) => {
                if (this.isDetecting) {
                    if (frequency && frequency > 0) {
                        // Si la frecuencia es < 2000Hz, confiamos en la IA.
                        // Si es mayor, dejamos que el loop matemático se encargue (para evitar conflictos).
                        // SUBIMOS EL CORTE A 2100 para dar margen
                        if (frequency < 2100) {
                            // Filtro básico de volumen
                            let sum = 0;
                            if (this.timeDomainBuffer) {
                                for (let i = 0; i < this.timeDomainBuffer.length; i++) {
                                    sum += this.timeDomainBuffer[i] * this.timeDomainBuffer[i];
                                }
                                let rms = Math.sqrt(sum / this.timeDomainBuffer.length);

                                if (rms * 100 > this.volumeThreshold) {
                                    const note = frequencyToNote(frequency);

                                    // Filtro de Estabilidad (AJUSTE: Aumentado para evitar confusión)
                                    // Subimos a 3 frames para que la IA esté "segura" antes de disparar.
                                    // Esto elimina las notas "locas" que aparecen antes de la real.
                                    if (note) {
                                        if (this.pendingNote && this.pendingNote.name === note.name && this.pendingNote.octave === note.octave) {
                                            this.noteStabilityCounter++;
                                        } else {
                                            this.pendingNote = note;
                                            this.noteStabilityCounter = 1;
                                        }

                                        if (this.noteStabilityCounter >= 3) {
                                            if (this.onNoteDetected) {
                                                this.onNoteDetected(note);
                                            }
                                        }
                                    } else {
                                        this.noteStabilityCounter = 0;
                                        this.pendingNote = null;
                                    }
                                } else {
                                    this.noteStabilityCounter = 0;
                                    this.pendingNote = null;
                                }
                            }
                        }
                    } else {
                        // Reset si no hay frecuencia
                        this.noteStabilityCounter = 0;
                        this.pendingNote = null;
                    }
                    // Loop recursivo de IA
                    detectPitchLoop();
                }
            });
        };

        // Iniciar ambos loops
        analyseVisuals();
        detectPitchLoop();
    }

    /**
     * Autocorrelación (Rescatada para el Motor Híbrido)
     * Detecta frecuencias fundamentales basándose en periodicidad de onda.
     * Ideal para ondas agudas limpias (sin armónicos complejos).
     */
    autoCorrelate(buffer, sampleRate) {
        const SIZE = buffer.length;
        const MAX_SAMPLES = Math.floor(SIZE / 2);
        let bestOffset = -1;
        let bestCorrelation = 0;
        let rms = 0;

        for (let i = 0; i < SIZE; i++) {
            const val = buffer[i];
            rms += val * val;
        }
        rms = Math.sqrt(rms / SIZE);
        if (rms < 0.002) return 0;

        let lastCorrelation = 1;

        // Optimización: Para agudos (>1500Hz), el periodo es corto (< 30 samples a 44.1k).
        // No necesitamos buscar offsets muy grandes.
        for (let offset = 1; offset < MAX_SAMPLES; offset++) {
            let correlation = 0;

            for (let i = 0; i < MAX_SAMPLES; i++) {
                correlation += Math.abs(buffer[i] - buffer[i + offset]);
            }

            correlation = 1 - (correlation / MAX_SAMPLES);

            if (correlation > 0.9 && correlation > lastCorrelation) {
                bestCorrelation = correlation;
                bestOffset = offset;
            } else if (bestCorrelation > 0.9 && correlation < lastCorrelation) {
                const shift = (1 / 2) * (1 / Math.abs((2 * lastCorrelation) - correlation - 1)); // Interpolación simple
                return sampleRate / bestOffset;
            }
            lastCorrelation = correlation;
        }
        if (bestCorrelation > 0.01 && bestOffset > 0) {
            return sampleRate / bestOffset;
        }
        return 0;
    }
}
