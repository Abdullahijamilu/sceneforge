/**
 * SceneForge AI — Scene Editor Module
 * Manages the scene timeline, image assignments, and property editing.
 */
class SceneEditor {
    constructor() {
        this.selectedSceneId = null;
        this.onSceneSelect = null;
        this.onSceneUpdate = null;
    }

    /**
     * Render the scene timeline list in the sidebar
     */
    renderTimeline(scenes, container) {
        container.innerHTML = '';

        if (scenes.length === 0) {
            container.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
                    <span class="material-icons-round" style="font-size: 2rem; display: block; margin-bottom: 0.5rem; opacity: 0.3;">view_carousel</span>
                    No scenes yet. Go to Step 1 to add your script.
                </div>`;
            return;
        }

        scenes.forEach((scene, index) => {
            const item = document.createElement('div');
            item.className = `timeline-item${scene.id === this.selectedSceneId ? ' active' : ''}`;
            item.dataset.sceneId = scene.id;

            const hasImage = !!scene.imageSrc;
            const thumbHTML = hasImage
                ? `<img src="${scene.imageSrc}" alt="Scene ${index + 1}">`
                : `<span class="material-icons-round">image</span>`;

            const previewText = scene.text
                ? (scene.text.length > 40 ? scene.text.substring(0, 40) + '...' : scene.text)
                : 'Empty scene';

            item.innerHTML = `
                <div class="timeline-thumb">${thumbHTML}</div>
                <div class="timeline-info">
                    <div class="timeline-title">Scene ${index + 1}</div>
                    <div class="timeline-duration">${scene.duration}s · ${previewText}</div>
                </div>
            `;

            item.addEventListener('click', () => {
                this.selectScene(scene.id, scenes);
                this.renderTimeline(scenes, container);
            });

            container.appendChild(item);
        });
    }

    /**
     * Select a scene and populate properties panel
     */
    selectScene(sceneId, scenes) {
        this.selectedSceneId = sceneId;
        const scene = scenes.find(s => s.id === sceneId);

        if (scene && this.onSceneSelect) {
            this.onSceneSelect(scene);
        }

        return scene;
    }

    /**
     * Populate the properties panel with scene data
     */
    populateProperties(scene) {
        const emptyState = document.getElementById('properties-empty');
        const content = document.getElementById('properties-content');
        const previewEmpty = document.getElementById('preview-empty-state');

        if (!scene) {
            emptyState.style.display = 'flex';
            content.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';
        content.style.display = 'flex';

        // Fill in fields
        document.getElementById('prop-image-prompt').value = scene.imagePrompt || '';
        document.getElementById('prop-duration').value = scene.duration;
        document.getElementById('prop-transition').value = scene.transition || 'crossfade';
        document.getElementById('prop-kenburns').value = scene.kenBurns || 'zoom-in';
        document.getElementById('prop-subtitle').value = scene.subtitle || '';

        // Image drop zone
        const dropZone = document.getElementById('scene-image-drop');
        if (scene.imageSrc) {
            dropZone.className = 'image-drop-zone has-image';
            dropZone.innerHTML = `<img src="${scene.imageSrc}" alt="Scene image">`;
        } else {
            dropZone.className = 'image-drop-zone';
            dropZone.innerHTML = `
                <span class="material-icons-round">add_photo_alternate</span>
                <span>Drop image or click</span>
            `;
        }

        // Hide preview empty state
        if (previewEmpty) previewEmpty.style.display = scene.imageSrc ? 'none' : 'flex';

        // Draw preview
        this.drawPreview(scene);
    }

    /**
     * Draw scene preview on canvas
     */
    drawPreview(scene) {
        const canvas = document.getElementById('preview-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Clear
        ctx.fillStyle = '#1a1d2e';
        ctx.fillRect(0, 0, width, height);

        if (scene.imageSrc) {
            const img = new Image();
            img.onload = () => {
                // Draw image covering canvas (object-fit: cover)
                const scale = Math.max(width / img.width, height / img.height);
                const w = img.width * scale;
                const h = img.height * scale;
                const x = (width - w) / 2;
                const y = (height - h) / 2;
                ctx.drawImage(img, x, y, w, h);

                // Draw subtitle
                if (scene.subtitle) {
                    this.drawSubtitle(ctx, scene.subtitle, width, height);
                }
            };
            img.src = scene.imageSrc;
        } else {
            // Draw placeholder
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.font = '48px "Material Icons Round"';
            ctx.textAlign = 'center';
            ctx.fillText('image', width / 2, height / 2);

            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = '600 16px "Plus Jakarta Sans"';
            ctx.fillText('No image assigned', width / 2, height / 2 + 40);

            if (scene.subtitle) {
                this.drawSubtitle(ctx, scene.subtitle, width, height);
            }
        }
    }

    /**
     * Draw subtitle text on canvas
     */
    drawSubtitle(ctx, text, canvasWidth, canvasHeight) {
        const fontSize = Math.round(canvasWidth * 0.025);
        const padding = 16;
        const maxWidth = canvasWidth * 0.8;

        ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        // Word wrap
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        words.forEach(word => {
            const testLine = currentLine ? currentLine + ' ' + word : word;
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });
        if (currentLine) lines.push(currentLine);

        // Draw background box
        const lineHeight = fontSize * 1.5;
        const totalHeight = lines.length * lineHeight + padding * 2;
        let maxLineWidth = 0;
        lines.forEach(line => {
            const w = ctx.measureText(line).width;
            if (w > maxLineWidth) maxLineWidth = w;
        });

        const boxWidth = maxLineWidth + padding * 4;
        const boxX = (canvasWidth - boxWidth) / 2;
        const boxY = canvasHeight - totalHeight - 40;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxWidth, totalHeight, 8);
        ctx.fill();

        // Draw text
        ctx.fillStyle = '#ffffff';
        lines.forEach((line, i) => {
            const y = boxY + padding + (i + 1) * lineHeight - (lineHeight - fontSize) / 2;
            ctx.fillText(line, canvasWidth / 2, y);
        });
    }

    /**
     * Handle image upload for current scene
     */
    handleImageUpload(file, scene) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                scene.imageSrc = e.target.result;
                scene.imageFile = file;
                this.populateProperties(scene);
                resolve(scene);
            };
            reader.readAsDataURL(file);
        });
    }

    /**
     * Handle bulk image upload — assigns images to scenes in order
     */
    async handleBulkUpload(files, scenes) {
        const sortedFiles = Array.from(files).sort((a, b) => a.name.localeCompare(b.name));

        for (let i = 0; i < sortedFiles.length && i < scenes.length; i++) {
            await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    scenes[i].imageSrc = e.target.result;
                    scenes[i].imageFile = sortedFiles[i];
                    resolve();
                };
                reader.readAsDataURL(sortedFiles[i]);
            });
        }

        return Math.min(sortedFiles.length, scenes.length);
    }

    /**
     * Get the currently selected scene
     */
    getSelectedScene(scenes) {
        return scenes.find(s => s.id === this.selectedSceneId) || null;
    }
}

// Export globally
window.SceneEditor = SceneEditor;
