/**
 * SceneForge AI — Preview Player Module
 * Plays scene sequences with transitions synced to audio in the browser.
 */
class PreviewPlayer {
    constructor() {
        this.isPlaying = false;
        this.currentSceneIndex = 0;
        this.animationFrameId = null;
        this.startTime = 0;
        this.onSceneChange = null;
    }

    /**
     * Play preview of all scenes
     */
    play(scenes, audioManager, canvas) {
        if (scenes.length === 0) return;

        this.isPlaying = true;
        this.currentSceneIndex = 0;
        this.startTime = performance.now();

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const transitionDuration = 500; // ms

        // Preload images
        const images = new Map();
        scenes.forEach(scene => {
            if (scene.imageSrc) {
                const img = new Image();
                img.src = scene.imageSrc;
                images.set(scene.id, img);
            }
        });

        // Start audio if available
        if (audioManager && audioManager.isLoaded()) {
            audioManager.seek(0);
            audioManager.audioElement.play();
        }

        // Calculate scene start times
        const sceneTimes = [];
        let cumulative = 0;
        scenes.forEach(scene => {
            sceneTimes.push({ start: cumulative * 1000, end: (cumulative + scene.duration) * 1000 });
            cumulative += scene.duration;
        });

        const totalDuration = cumulative * 1000;

        const animate = () => {
            if (!this.isPlaying) return;

            const elapsed = performance.now() - this.startTime;

            if (elapsed >= totalDuration) {
                this.stop(audioManager);
                return;
            }

            // Find current scene
            let currentIdx = 0;
            for (let i = 0; i < sceneTimes.length; i++) {
                if (elapsed >= sceneTimes[i].start && elapsed < sceneTimes[i].end) {
                    currentIdx = i;
                    break;
                }
            }

            if (currentIdx !== this.currentSceneIndex) {
                this.currentSceneIndex = currentIdx;
                if (this.onSceneChange) {
                    this.onSceneChange(currentIdx);
                }
            }

            const scene = scenes[currentIdx];
            const sceneElapsed = elapsed - sceneTimes[currentIdx].start;
            const sceneDuration = scene.duration * 1000;
            const progress = sceneElapsed / sceneDuration;

            // Clear
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);

            // Draw current scene
            const img = images.get(scene.id);
            if (img && img.complete) {
                this.drawKenBurns(ctx, img, width, height, progress, scene.kenBurns);
            }

            // Check for transition
            const timeToEnd = sceneDuration - sceneElapsed;
            if (timeToEnd < transitionDuration && currentIdx < scenes.length - 1) {
                const nextScene = scenes[currentIdx + 1];
                const nextImg = images.get(nextScene.id);
                const transProgress = 1 - (timeToEnd / transitionDuration);

                if (scene.transition === 'crossfade' && nextImg && nextImg.complete) {
                    ctx.globalAlpha = transProgress;
                    const imgScale = Math.max(width / nextImg.width, height / nextImg.height);
                    const w = nextImg.width * imgScale;
                    const h = nextImg.height * imgScale;
                    ctx.drawImage(nextImg, (width - w) / 2, (height - h) / 2, w, h);
                    ctx.globalAlpha = 1;
                } else if (scene.transition === 'fade-black') {
                    ctx.fillStyle = `rgba(0, 0, 0, ${transProgress})`;
                    ctx.fillRect(0, 0, width, height);
                }
            }

            // Draw subtitle
            if (scene.subtitle) {
                this.drawSubtitle(ctx, scene.subtitle, width, height);
            }

            this.animationFrameId = requestAnimationFrame(animate);
        };

        this.animationFrameId = requestAnimationFrame(animate);
    }

    /**
     * Stop preview
     */
    stop(audioManager) {
        this.isPlaying = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        if (audioManager && audioManager.audioElement) {
            audioManager.audioElement.pause();
        }
    }

    /**
     * Draw Ken Burns effect (simplified for preview)
     */
    drawKenBurns(ctx, img, canvasWidth, canvasHeight, progress, effect) {
        const maxZoom = 0.06;
        let scale = 1;

        switch (effect) {
            case 'zoom-in': scale = 1 + progress * maxZoom; break;
            case 'zoom-out': scale = 1 + maxZoom - progress * maxZoom; break;
            default: scale = 1 + maxZoom * 0.3; break;
        }

        const imgScale = Math.max(canvasWidth / img.width, canvasHeight / img.height) * scale;
        const w = img.width * imgScale;
        const h = img.height * imgScale;
        ctx.drawImage(img, (canvasWidth - w) / 2, (canvasHeight - h) / 2, w, h);
    }

    /**
     * Draw subtitle (simplified for preview)
     */
    drawSubtitle(ctx, text, canvasWidth, canvasHeight) {
        const fontSize = Math.round(canvasWidth * 0.025);
        const padding = 12;
        const maxWidth = canvasWidth * 0.8;

        ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        // Simple word wrap
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        words.forEach(word => {
            const testLine = currentLine ? currentLine + ' ' + word : word;
            if (ctx.measureText(testLine).width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });
        if (currentLine) lines.push(currentLine);

        const lineHeight = fontSize * 1.4;
        const totalHeight = lines.length * lineHeight;
        const baseY = canvasHeight - padding - 30;

        // Background
        let maxLineWidth = 0;
        lines.forEach(line => { maxLineWidth = Math.max(maxLineWidth, ctx.measureText(line).width); });

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.beginPath();
        ctx.roundRect(
            (canvasWidth - maxLineWidth - padding * 4) / 2,
            baseY - totalHeight - padding,
            maxLineWidth + padding * 4,
            totalHeight + padding * 2,
            8
        );
        ctx.fill();

        // Text
        ctx.fillStyle = '#ffffff';
        lines.forEach((line, i) => {
            ctx.fillText(line, canvasWidth / 2, baseY - totalHeight + (i + 1) * lineHeight);
        });
    }
}

// Export globally
window.PreviewPlayer = PreviewPlayer;
