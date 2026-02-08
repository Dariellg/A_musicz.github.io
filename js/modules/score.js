// js/modules/score.js

// VexFlow debe estar cargado globalmente
export class ScoreGenerator {
    constructor(canvasId) {
        this.canvasId = canvasId;
        this.canvas = document.getElementById(canvasId);
        this.VF = null;
        this.renderer = null;
        this.context = null;

        if (typeof Vex !== 'undefined') {
            this.VF = Vex.Flow;
            this.initRenderer();
        }
    }

    initRenderer() {
        if (!this.VF || !this.canvas) return;

        // Ensure parent container width logic
        const parentWidth = this.canvas.parentElement ? this.canvas.parentElement.clientWidth : 800;

        // For SVG, we don't set canvas.width/height directly on the element the same way
        // But VexFlow's SVG backend will create an SVG element inside the div
        // We probably need to target a DIV instead of a CANVAS for SVG backend usually,
        // but let's see if VexFlow handles replacing the canvas or if we need to change the HTML.
        // Best practice: The container should be a DIV. 
        // PROPOSAL: We will create a div wrapper if not exists or replace using the ID.

        // However, to avoid changing HTML structure too much, let's stick to the current element 
        // but switch to SVG. VexFlow Renderer can take a DIV id or element.

        // Clean up previous context if any (especially for SVG)
        if (this.canvas.tagName === 'CANVAS') {
            // Replace canvas with div for SVG rendering
            const div = document.createElement('div');
            div.id = this.canvas.id;
            div.className = this.canvas.className;
            this.canvas.parentNode.replaceChild(div, this.canvas);
            this.canvas = div;
        }

        this.canvas.innerHTML = ''; // Clear previous SVG

        this.renderer = new this.VF.Renderer(this.canvas, this.VF.Renderer.Backends.SVG);
        this.context = this.renderer.getContext();
        this.context.setFont('Arial', 10);

        this.resize(parentWidth, 400);

        // Add interaction for editing
        this.canvas.addEventListener('dblclick', (e) => {
            if (this.onEditRequest) {
                this.onEditRequest();
            }
        });

        // Add tooltip/instruction
        this.canvas.title = "Haz doble clic para editar la partitura";
    }

    resize(width, height) {
        this.renderer.resize(width, height);
    }

    generateScore(notes, instruments = ['Piano']) {
        this.currentNotes = notes; // Guardar notas para exportación

        if (!this.VF) {
            console.error('VexFlow no está disponible');
            return;
        }

        // Clear previous score
        if (this.canvas.tagName === 'DIV' || this.canvas.tagName === 'CANVAS') {
            this.canvas.innerHTML = '';
        }

        if (!notes || notes.length === 0) {
            this.drawEmptyStaff();
            return;
        }

        const containerWidth = this.canvas.clientWidth || (this.canvas.parentElement ? this.canvas.parentElement.clientWidth : 800);
        const width = containerWidth > 0 ? containerWidth : 800;

        // Renderizamos usando la lógica centralizada
        this.renderToElement(this.canvas, notes, width);

        // Hydration... (Keeping the previous hydration logic for interactivity)
        if (this.VF.Renderer.Backends.SVG) {
            const svg = this.canvas.querySelector('svg');
            if (svg) {
                // VexFlow adds class 'vf-stavenote' to note groups
                const noteGroups = svg.querySelectorAll('.vf-stavenote');

                noteGroups.forEach((group, index) => {
                    // Add cursor pointer to indicate interactivity
                    group.style.cursor = 'pointer';
                    group.style.pointerEvents = 'bounding-box'; // Better hit testing

                    // Add hover effect
                    group.addEventListener('mouseover', () => {
                        group.style.fill = '#4CAF50';
                        group.style.stroke = '#4CAF50';
                    });

                    group.addEventListener('mouseout', () => {
                        group.style.fill = '';
                        group.style.stroke = '';
                    });

                    // Add click listener for hydration/editing
                    group.addEventListener('click', (e) => {
                        e.stopPropagation(); // Prevent canvas double-click
                        if (this.onNoteClick) {
                            this.onNoteClick(index, notes[index]);
                        }
                    });
                });
            }
        }
    }

    drawEmptyStaff() {
        if (!this.context || !this.VF) return;

        // DIVs don't have .width attribute, use clientWidth or fallback
        const containerWidth = this.canvas.clientWidth || (this.canvas.parentElement ? this.canvas.parentElement.clientWidth : 800);
        const validWidth = containerWidth > 0 ? containerWidth : 800;

        const staveWidth = Math.min(validWidth - 20, 800);
        const stave = new this.VF.Stave(10, 40, staveWidth);

        // Ensure context is ready
        this.context.clear();

        stave.addClef('treble');
        stave.addTimeSignature('4/4');
        stave.setContext(this.context).draw();

        this.context.save();
        this.context.setFont('Arial', 14);

        // Center text roughly
        const textX = Math.max(50, (validWidth / 2) - 200);
        this.context.fillText('No hay notas para mostrar. Inicia una grabación o carga un archivo.', textX, 130);
        this.context.restore();
    }

    async exportAsImage() {
        // Redirigir a la exportación segmentada si tenemos notas
        if (this.currentNotes && this.currentNotes.length > 0) {
            return this.exportSegmentedImages(this.currentNotes);
        } else {
            alert("No hay partitura generada para exportar.");
        }
    }

    // Método auxiliar para descargar
    downloadURI(uri, name) {
        const link = document.createElement("a");
        link.download = name;
        link.href = uri;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Exportación Inteligente por Segmentos
     * @param {Array} notes - Las notas actuales (deben pasarse o guardarse)
     */
    async exportSegmentedImages(notes) {
        if (!notes || notes.length === 0) {
            alert('No hay notas para exportar');
            return;
        }

        const notesPerLine = 8;
        const totalLines = Math.ceil(notes.length / notesPerLine);
        const linesPerImage = 4; // Máximo 4 sistemas por imagen para calidad HD

        const totalImages = Math.ceil(totalLines / linesPerImage);

        // Contenedor temporal invisible para renderizar
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.top = '-9999px';
        tempDiv.style.width = '800px'; // Ancho fijo HD
        document.body.appendChild(tempDiv);

        try {
            for (let i = 0; i < totalImages; i++) {
                // Calcular qué notas van en este segmento
                const startLine = i * linesPerImage;
                const endLine = startLine + linesPerImage;

                const startNoteIndex = startLine * notesPerLine;
                const endNoteIndex = Math.min(notes.length, endLine * notesPerLine);

                const segmentNotes = notes.slice(startNoteIndex, endNoteIndex);

                if (segmentNotes.length === 0) continue;

                // 2. Renderizar este segmento en el div temporal
                this.renderToElement(tempDiv, segmentNotes, 800);

                // Esperar un tick para que el SVG se construya
                await new Promise(r => setTimeout(r, 100));

                // 3. Convertir SVG a PNG
                const svg = tempDiv.querySelector('svg');
                if (svg) {
                    // Altura dinámica según contenido
                    const height = tempDiv.clientHeight || (Math.ceil(segmentNotes.length / 8) * 200 + 50);
                    const canvas = await this.svgToCanvas(svg, 800, height);
                    const parsedPart = i + 1;
                    const fileName = `partitura_parte_${parsedPart}_de_${totalImages}.png`;
                    this.downloadURI(canvas.toDataURL('image/png'), fileName);
                }

                // Limpiar para el siguiente
                tempDiv.innerHTML = '';
            }
            // showNotification(`Exportación completada: ${totalImages} imágenes descargadas.`, 'success');
            console.log(`Exportación completada: ${totalImages} imágenes.`);
        } catch (e) {
            console.error(e);
            alert('Error al exportar imágenes');
        } finally {
            document.body.removeChild(tempDiv);
        }
    }

    // Lógica de dibujo centralizada (agnóstica del contenedor)
    renderToElement(container, notes, width) {
        container.innerHTML = '';

        // Crear instancia temporal VexFlow para este contenedor
        const renderer = new this.VF.Renderer(container, this.VF.Renderer.Backends.SVG);
        const context = renderer.getContext();
        context.setFont('Arial', 10);

        // GRAND STAFF SETUP
        const createStaveNote = (noteObj, clef) => {
            let duration = noteObj.duration || 'q';

            const rawKeys = noteObj.allNotes && noteObj.allNotes.length > 0
                ? noteObj.allNotes.map(n => n.scientific)
                : [noteObj.scientific || 'c4'];

            const relevantKeys = rawKeys.filter(k => {
                const octave = parseInt(k.match(/\d+/)?.[0] || '4');
                if (clef === 'treble') return octave >= 4;
                if (clef === 'bass') return octave < 4;
                return false;
            });

            if (relevantKeys.length === 0) {
                // Return a REST for this clef
                return new this.VF.StaveNote({ keys: [clef === 'treble' ? 'b/4' : 'd/3'], duration: duration + 'r', clef: clef });
            }

            // Convert keys to VexFlow format
            const vfKeys = relevantKeys.map(k => {
                const octave = k.match(/\d+/)?.[0] || '4';
                const letter = k.charAt(0).toLowerCase();
                const acc = k.includes('#') ? '#' : '';
                return `${letter}${acc}/${octave}`;
            });

            const staveNote = new this.VF.StaveNote({ keys: vfKeys, duration: duration, clef: clef, auto_stem: true });

            // Add accidentals
            vfKeys.forEach((key, i) => {
                if (key.includes('#')) staveNote.addModifier(new this.VF.Accidental('#'), i);
            });

            return staveNote;
        };

        const trebleNotes = notes.map(n => createStaveNote(n, 'treble'));
        const bassNotes = notes.map(n => createStaveNote(n, 'bass'));

        // Organize into lines
        const notesPerLine = 8;
        const totalLines = Math.ceil(notes.length / notesPerLine);
        const lineHeight = 200; // More space for Grand Staff

        renderer.resize(width, totalLines * lineHeight + 50);

        for (let l = 0; l < totalLines; l++) {
            const start = l * notesPerLine;
            const end = Math.min(start + notesPerLine, notes.length);

            const lineTreble = trebleNotes.slice(start, end);
            const lineBass = bassNotes.slice(start, end);

            const yTop = 20 + (l * lineHeight);
            const yBot = yTop + 60; // Spacing between staves

            const staveTreble = new this.VF.Stave(10, yTop, width - 20);
            const staveBass = new this.VF.Stave(10, yBot, width - 20);

            // Add Clefs
            staveTreble.addClef('treble');
            staveBass.addClef('bass');
            if (l === 0) {
                staveTreble.addTimeSignature('4/4');
                staveBass.addTimeSignature('4/4');
            }

            // Add Brace/Connector
            const connector = new this.VF.StaveConnector(staveTreble, staveBass);
            connector.setType(this.VF.StaveConnector.type.BRACE);
            connector.setContext(context);

            const lineLeft = new this.VF.StaveConnector(staveTreble, staveBass);
            lineLeft.setType(this.VF.StaveConnector.type.SINGLE_LEFT);
            lineLeft.setContext(context);

            staveTreble.setContext(context).draw();
            staveBass.setContext(context).draw();
            connector.draw();
            lineLeft.draw();

            const voiceTreble = new this.VF.Voice({ num_beats: lineTreble.length, beat_value: 4 }).setStrict(false);
            const voiceBass = new this.VF.Voice({ num_beats: lineBass.length, beat_value: 4 }).setStrict(false);

            voiceTreble.addTickables(lineTreble);
            voiceBass.addTickables(lineBass);

            new this.VF.Formatter()
                .joinVoices([voiceTreble])
                .joinVoices([voiceBass])
                .format([voiceTreble, voiceBass], width - 70);

            voiceTreble.draw(context, staveTreble);
            voiceBass.draw(context, staveBass);
        }
    }

    // Helper SVG -> Canvas
    svgToCanvas(svg, width, height) {
        return new Promise((resolve, reject) => {
            const serializer = new XMLSerializer();
            const source = serializer.serializeToString(svg);
            const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(url);
                resolve(canvas);
            };
            img.onerror = reject;
            img.src = url;
        });
    }
}