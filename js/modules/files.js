// js/modules/files.js

import { formatFileSize } from './core.js';

export class FileHandler {
    constructor() {
        this.audioContext = null;
        this.audioBuffer = null;
    }

    setupDropZone(dropZoneId, fileInputId, onFileLoaded) {
        const dropZone = document.getElementById(dropZoneId);
        const fileInput = document.getElementById(fileInputId);
        
        if (!dropZone || !fileInput) return;
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, this.preventDefaults, false);
        });
        
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('dragover');
            }, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('dragover');
            }, false);
        });
        
        dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFile(files[0], onFileLoaded);
            }
        }, false);
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFile(e.target.files[0], onFileLoaded);
            }
        });
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    async handleFile(file, callback) {
        if (!file.type.match('audio.*')) {
            console.error('No es un archivo de audio');
            return;
        }
        
        const fileInfo = {
            name: file.name,
            size: formatFileSize(file.size),
            type: file.type
        };
        
        const arrayBuffer = await file.arrayBuffer();
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        
        if (callback) {
            callback(fileInfo, this.audioBuffer);
        }
    }

    playAudio() {
        if (!this.audioBuffer || !this.audioContext) return;
        
        const source = this.audioContext.createBufferSource();
        source.buffer = this.audioBuffer;
        source.connect(this.audioContext.destination);
        source.start();
    }
}