// js/modules/core.js - VERSIÓN SIN DUPLICACIONES

// ========== CONSTANTES ==========
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function generateFrequencies() {
    const freqs = {};
    const a4 = 440;

    for (let octave = 0; octave <= 8; octave++) {
        NOTE_NAMES.forEach((noteName, noteIndex) => {
            // MIDI note number: C-1 = 0, C4 = 60, A4 = 69
            const midiNote = 12 + octave * 12 + noteIndex;

            // Limitar a rango piano A0 (21) -> C8 (108)
            if (midiNote < 21 || midiNote > 108) return;

            const frequency = a4 * Math.pow(2, (midiNote - 69) / 12);
            freqs[`${noteName}${octave}`] = parseFloat(frequency.toFixed(2));
        });
    }
    return freqs;
}

export const NOTE_FREQUENCIES = generateFrequencies();

// ========== FUNCIONES UTILITARIAS ==========
export function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${(secs % 60).toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Convierte frecuencia a nota cercana usando NOTE_FREQUENCIES
export function frequencyToNote(frequency) {
    if (!frequency || frequency === 0) return null;

    let closestNote = '--';
    let closestFreq = 0;
    let smallestDiff = Infinity;

    for (const [note, noteFreq] of Object.entries(NOTE_FREQUENCIES)) {
        const diff = Math.abs(frequency - noteFreq);
        if (diff < smallestDiff) {
            smallestDiff = diff;
            closestNote = note;
            closestFreq = noteFreq;
        }
    }

    // Tolerancia relativa reducida para mayor precisión (milimétrica).
    // 0.025 = 2.5% de diferencia máxima permitida.
    // Esto evita que ruidos intermedios se detecten como notas.
    const maxDiff = closestFreq * 0.025;

    if (smallestDiff < maxDiff) {
        return {
            name: closestNote.replace('#', '♯'),
            frequency: frequency,
            octave: closestNote.slice(-1),
            scientific: closestNote
        };
    }

    return null;
}

export function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        console.log(`Datos guardados en localStorage: ${key}`);
        return true;
    } catch (error) {
        console.error('Error al guardar en localStorage:', error);
        return false;
    }
}

export function loadFromLocalStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Error al cargar de localStorage:', error);
        return null;
    }
}

// ========== NOTIFICACIONES ==========
export function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    // Aquí podrías agregar UI de notificaciones si quieres
}

// ========== FUNCIONES DE INICIALIZACIÓN ==========
export function initVexFlow() {
    if (typeof Vex === 'undefined') {
        console.error('VexFlow no está cargado. Asegúrate de incluir el script en el HTML.');
        return null;
    }

    try {
        const VF = Vex.Flow;
        console.log('VexFlow inicializado correctamente');
        return VF;
    } catch (error) {
        console.error('Error al inicializar VexFlow:', error);
        return null;
    }
}

// ========== FUNCIONES DE VALIDACIÓN ==========
export function isValidFrequency(frequency) {
    return (
        typeof frequency === 'number' &&
        frequency > 0 &&
        frequency < 5000
    );
}

export function sanitizeNoteName(noteName) {
    if (!noteName || typeof noteName !== 'string') return '--';
    return noteName.replace('#', '♯').replace('b', '♭');
}

// ========== FUNCIONES DE ARRAYS ==========
export function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

export function getLastElements(array, count) {
    return array.slice(Math.max(array.length - count, 0));
}
