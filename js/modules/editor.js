// js/modules/editor.js

import { ScoreGenerator } from './score.js';

export class ScoreEditor {
    constructor(scoreGenerator, updateCallback) {
        this.scoreGenerator = scoreGenerator;
        this.notes = [];
        this.updateCallback = updateCallback;
        this.isVisible = false;
        this.currentIndex = -1;

        // Hydration: Connect score clicks to editor
        this.scoreGenerator.onNoteClick = (index, note) => {
            this.open(this.notes, index);
        };

        this.initUI();
    }

    initUI() {
        // Create Floating Window HTML if it doesn't exist
        if (!document.getElementById('editorWindow')) {
            const windowHTML = `
            <div id="editorWindow" style="display:none; position:fixed; top:20px; right:20px; width:300px; background:white; border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,0.2); z-index:1000; overflow:hidden; border:1px solid #ccc;">
                <div id="editorHeader" style="background:#667eea; color:white; padding:10px 15px; cursor:move; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; font-size:1rem;">Editor de Notas</h3>
                    <button id="closeEditorBtn" style="background:none; border:none; color:white; font-size:1.2rem; cursor:pointer;">&times;</button>
                </div>
                
                <div style="padding:15px; display:flex; flex-direction:column; gap:15px;">
                    <!-- Navigation -->
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <button id="prevNoteBtn" style="background:#f0f0f0; border:none; padding:8px 12px; border-radius:4px; cursor:pointer;">&larr; Anterior</button>
                        <span id="noteIndexdDisplay" style="font-size:0.9rem; color:#666;">Nota 0/0</span>
                        <button id="nextNoteBtn" style="background:#f0f0f0; border:none; padding:8px 12px; border-radius:4px; cursor:pointer;">Siguiente &rarr;</button>
                    </div>

                    <!-- Note Controls -->
                    <div style="background:#f9f9f9; padding:10px; border-radius:5px; border:1px solid #eee;">
                        <label style="display:block; margin-bottom:5px; font-weight:bold; font-size:0.8rem;">Altura (Pitch)</label>
                        <select id="editNotePitch" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px; margin-bottom:10px;">
                             <!-- Octave 3 -->
                            <option value="C3">C3</option><option value="D3">D3</option><option value="E3">E3</option><option value="F3">F3</option><option value="G3">G3</option><option value="A3">A3</option><option value="B3">B3</option>
                            <!-- Octave 4 -->
                            <option value="C4">C4</option><option value="D4">D4</option><option value="E4">E4</option><option value="F4">F4</option><option value="G4">G4</option><option value="A4">A4</option><option value="B4">B4</option>
                            <!-- Octave 5 -->
                            <option value="C5">C5</option><option value="D5">D5</option><option value="E5">E5</option><option value="F5">F5</option><option value="G5">G5</option><option value="A5">A5</option><option value="B5">B5</option>
                        </select>

                        <label style="display:block; margin-bottom:5px; font-weight:bold; font-size:0.8rem;">Duración</label>
                        <select id="editNoteDuration" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                            <option value="w">Redonda (Whole)</option>
                            <option value="h">Blanca (Half)</option>
                            <option value="q">Negra (Quarter)</option>
                            <option value="8">Corchea (Eighth)</option>
                        </select>
                    </div>

                    <!-- Actions -->
                    <div style="display:flex; gap:10px;">
                         <button id="addNoteBtn" style="flex:1; background:#4CAF50; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer;">+ Añadir</button>
                         <button id="deleteNoteBtn" style="flex:1; background:#f44336; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer;">🗑 Borrar</button>
                    </div>
                </div>
            </div>
            `;
            document.body.insertAdjacentHTML('beforeend', windowHTML);

            this.makeDraggable(document.getElementById('editorWindow'));
        }

        // Bind Events
        document.getElementById('closeEditorBtn').addEventListener('click', () => this.close());

        document.getElementById('prevNoteBtn').addEventListener('click', () => this.navigate(-1));
        document.getElementById('nextNoteBtn').addEventListener('click', () => this.navigate(1));

        document.getElementById('addNoteBtn').addEventListener('click', () => this.addNote());
        document.getElementById('deleteNoteBtn').addEventListener('click', () => this.deleteNote());

        // Live Update Events
        document.getElementById('editNotePitch').addEventListener('change', (e) => this.updateCurrentNote('name', e.target.value));
        document.getElementById('editNoteDuration').addEventListener('change', (e) => this.updateCurrentNote('duration', e.target.value));
    }

    open(notes, initialIndex = 0) {
        // Sync with reference instead of copy to allow live internal updates, 
        // but we'll still call updateCallback to notify app of changes (repaint)
        this.notes = notes;

        if (this.notes.length === 0) {
            // Create a dummy note if empty so editor works
            // Or handle empty state. Let's start with empty state but allow adding.
        }

        this.currentIndex = initialIndex >= 0 && initialIndex < this.notes.length ? initialIndex : 0;
        this.isVisible = true;

        const win = document.getElementById('editorWindow');
        win.style.display = 'block';

        this.loadNoteToUI();
    }

    close() {
        this.isVisible = false;
        document.getElementById('editorWindow').style.display = 'none';
        // Deselect in score if possible
    }

    navigate(direction) {
        const newIndex = this.currentIndex + direction;
        if (newIndex >= 0 && newIndex < this.notes.length) {
            this.currentIndex = newIndex;
            this.loadNoteToUI();
            // Highlight in score?
        }
    }

    loadNoteToUI() {
        if (this.notes.length === 0 || this.currentIndex < 0) {
            document.getElementById('noteIndexdDisplay').textContent = "Sin notas";
            return;
        }

        const note = this.notes[this.currentIndex];
        document.getElementById('noteIndexdDisplay').textContent = `Nota ${this.currentIndex + 1} / ${this.notes.length}`;

        // Select logic
        const pitchSelect = document.getElementById('editNotePitch');
        const durSelect = document.getElementById('editNoteDuration');

        // Try to match pitch
        // If note has scientific name (e.g. C4), use it. else name
        const val = note.scientific || note.name;
        pitchSelect.value = val;
        durSelect.value = note.duration || 'q';
    }

    updateCurrentNote(field, value) {
        if (this.currentIndex < 0 || this.currentIndex >= this.notes.length) return;

        const note = this.notes[this.currentIndex];

        if (field === 'name') {
            note.name = value;
            note.scientific = value;
            // update frequency if needed? 
            // note.frequency = ... (optional for basic score)
        } else if (field === 'duration') {
            note.duration = value;
        }

        // Live update: trigger callback immediately
        if (this.updateCallback) {
            this.updateCallback(this.notes); // Pass the updated array
        }
    }

    addNote() {
        // Add after current
        const newNote = {
            name: 'C4',
            scientific: 'C4',
            duration: 'q',
            timestamp: Date.now()
        };

        if (this.currentIndex >= 0) {
            this.notes.splice(this.currentIndex + 1, 0, newNote);
            this.currentIndex++;
        } else {
            this.notes.push(newNote);
            this.currentIndex = 0;
        }

        this.loadNoteToUI();
        if (this.updateCallback) this.updateCallback(this.notes);
    }

    deleteNote() {
        if (this.currentIndex < 0 || this.notes.length === 0) return;

        this.notes.splice(this.currentIndex, 1);

        // Adjust index
        if (this.currentIndex >= this.notes.length) {
            this.currentIndex = Math.max(0, this.notes.length - 1);
        }

        this.loadNoteToUI();
        if (this.updateCallback) this.updateCallback(this.notes);
    }

    makeDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        const header = document.getElementById(element.id + 'Header');
        if (header) {
            header.onmousedown = dragMouseDown;
        }

        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }
}
