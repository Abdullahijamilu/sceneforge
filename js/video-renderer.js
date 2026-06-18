/**
 * SceneForge AI — Video Renderer Module
 * Uses Canvas API for frame rendering and FFmpeg.wasm for video encoding.
 */
class VideoRenderer {
    constructor() {
        this.ffmpeg = null;
        this.isLoaded = false;
        this.isRendering = false;
        this.onProgress = null;
        this.onComplete = null;
        this.onError = null;
        this.cancelRequested = false;
    }

    /**
     * Get resolution dimensions based on aspect ratio and quality
     */
    getResolution(aspectRatio, quality) {
        const resolutions = {
            '16:9': { '720': [1280, 720], '1080': [1920, 1080], '2160': [3840, 2160] },
            '9:16': { '720': [720, 1280], '1080': [1080, 1920], '2160': [2160, 3840] },
            '1:1':  { '720': [720, 720],  '1080': [1080, 1080], '2160': [2160, 2160] },
            '4:5':  { '720': [720, 900],  '1080': [1080, 1350], '2160': [2160, 2700] },
        };
        return resolutions[aspectRatio]?.[quality] || [1920, 1080];
    }

    /**
     * Render video from scenes + audio using native MediaRecorder
     */
    async render(scenes, audioManager, options = {}) {
        const {
            aspectRatio = '16:9',
            resolution = '1080',
            subtitlesEnabled = true,
            subtitleFontSize = 'medium',
            subtitlePosition = 'bottom',
            subtitleStyle = 'box',
            fps = 30,
        } = options;

        this.isRendering = true;
        this.cancelRequested = false;

        try {
            const [width, height] = this.getResolution(aspectRatio, resolution);
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);

            if (this.onProgress) {
                this.onProgress({ phase: 'rendering', percent: 0, message: `Preparing to record...` });
            }

            // Load all scene images
            const loadedImages = await this.preloadImages(scenes);
            const transitionDuration = 0.5; // seconds

            // Setup MediaStream
            const stream = canvas.captureStream(fps);
            let audioCtx, source;

            if (audioManager && audioManager.isLoaded()) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const dest = audioCtx.createMediaStreamDestination();
                source = audioCtx.createBufferSource();
                source.buffer = audioManager.audioBuffer;
                source.connect(dest);
                // Note: Not connecting to audioCtx.destination so it renders silently in the background
                
                const audioTrack = dest.stream.getAudioTracks()[0];
                if (audioTrack) {
                    stream.addTrack(audioTrack);
                }
            }

            let mimeType = 'video/webm; codecs=vp9';
            if (MediaRecorder.isTypeSupported('video/mp4')) {
                mimeType = 'video/mp4';
            } else if (MediaRecorder.isTypeSupported('video/webm; codecs=vp8')) {
                mimeType = 'video/webm; codecs=vp8';
            } else if (MediaRecorder.isTypeSupported('video/webm')) {
                mimeType = 'video/webm';
            }

            const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000 });
            const chunks = [];

            recorder.ondataavailable = e => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            return new Promise((resolve, reject) => {
                recorder.onstop = () => {
                    if (this.cancelRequested) {
                        return resolve(null);
                    }
                    
                    const blob = new Blob(chunks, { type: mimeType });
                    if (this.onProgress) {
                        this.onProgress({ phase: 'complete', percent: 100, message: 'Video ready!' });
                    }
                    if (this.onComplete) this.onComplete(blob);
                    
                    this.isRendering = false;
                    resolve(blob);
                };

                recorder.onerror = e => {
                    this.isRendering = false;
                    if (this.onError) this.onError('Recording failed: ' + e.error);
                    reject(e.error);
                };

                recorder.start();
                if (source) source.start(0);

                const startTime = Date.now();
                let lastTime = 0;

                const drawFrame = () => {
                    if (this.cancelRequested) {
                        recorder.stop();
                        if (source) source.stop();
                        this.isRendering = false;
                        return;
                    }

                    const currentTime = (Date.now() - startTime) / 1000;
                    
                    if (currentTime >= totalDuration) {
                        recorder.stop();
                        if (source) source.stop();
                        return;
                    }

                    // Find current scene
                    let elapsed = 0;
                    let currentScene = null;
                    let nextScene = null;
                    let sceneProgress = 0;
                    let transitionProgress = -1;

                    for (let i = 0; i < scenes.length; i++) {
                        const sceneEnd = elapsed + scenes[i].duration;
                        if (currentTime < sceneEnd) {
                            currentScene = scenes[i];
                            sceneProgress = (currentTime - elapsed) / scenes[i].duration;

                            // Check transition
                            const timeInScene = currentTime - elapsed;
                            const timeToEnd = scenes[i].duration - timeInScene;
                            if (timeToEnd < transitionDuration && i < scenes.length - 1) {
                                nextScene = scenes[i + 1];
                                transitionProgress = 1 - (timeToEnd / transitionDuration);
                            }
                            break;
                        }
                        elapsed += scenes[i].duration;
                    }

                    if (!currentScene) currentScene = scenes[scenes.length - 1];

                    // Draw
                    ctx.fillStyle = '#000000';
                    ctx.fillRect(0, 0, width, height);

                    const img = loadedImages.get(currentScene.id);
                    if (img) {
                        this.drawKenBurns(ctx, img, width, height, sceneProgress, currentScene.kenBurns);
                    }

                    if (nextScene && transitionProgress >= 0) {
                        const nextImg = loadedImages.get(nextScene.id);
                        this.drawTransition(ctx, nextImg, width, height, transitionProgress, currentScene.transition);
                    }

                    if (subtitlesEnabled && currentScene.subtitle) {
                        this.drawSubtitle(ctx, currentScene.subtitle, width, height, subtitleFontSize, subtitlePosition, subtitleStyle);
                    }

                    // Throttle UI updates to not spam the DOM
                    if (currentTime - lastTime > 0.1) {
                        if (this.onProgress) {
                            const percent = Math.min(99, Math.round((currentTime / totalDuration) * 100));
                            this.onProgress({
                                phase: 'rendering',
                                percent,
                                message: `Recording video in real-time... ${percent}%`,
                                eta: `~${Math.ceil(totalDuration - currentTime)}s`
                            });
                        }
                        lastTime = currentTime;
                    }

                    requestAnimationFrame(drawFrame);
                };

                // Start drawing loop
                requestAnimationFrame(drawFrame);
            });

        } catch (error) {
            this.isRendering = false;
            console.error('Render error:', error);
            if (this.onError) {
                this.onError(`Rendering failed: ${error.message}`);
            }
            return null;
        }
    }

    /**
     * Preload all scene images
     */
    async preloadImages(scenes) {
        const imageMap = new Map();

        const loadPromises = scenes.map(scene => {
            if (!scene.imageSrc) return Promise.resolve();

            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    imageMap.set(scene.id, img);
                    resolve();
                };
                img.onerror = () => resolve();
                img.src = scene.imageSrc;
            });
        });

        await Promise.all(loadPromises);
        return imageMap;
    }

    /**
     * Draw image with Ken Burns effect
     */
    drawKenBurns(ctx, img, canvasWidth, canvasHeight, progress, effect) {
        const maxZoom = 0.08; // 8% zoom range
        let scale, offsetX, offsetY;

        switch (effect) {
            case 'zoom-in':
                scale = 1 + progress * maxZoom;
                offsetX = 0;
                offsetY = 0;
                break;
            case 'zoom-out':
                scale = 1 + maxZoom - progress * maxZoom;
                offsetX = 0;
                offsetY = 0;
                break;
            case 'pan-left':
                scale = 1 + maxZoom * 0.5;
                offsetX = progress * canvasWidth * 0.05;
                offsetY = 0;
                break;
            case 'pan-right':
                scale = 1 + maxZoom * 0.5;
                offsetX = -progress * canvasWidth * 0.05;
                offsetY = 0;
                break;
            case 'pan-up':
                scale = 1 + maxZoom * 0.5;
                offsetX = 0;
                offsetY = progress * canvasHeight * 0.05;
                break;
            case 'pan-down':
                scale = 1 + maxZoom * 0.5;
                offsetX = 0;
                offsetY = -progress * canvasHeight * 0.05;
                break;
            default:
                scale = 1;
                offsetX = 0;
                offsetY = 0;
        }

        // Cover-fit the image
        const imgScale = Math.max(canvasWidth / img.width, canvasHeight / img.height) * scale;
        const w = img.width * imgScale;
        const h = img.height * imgScale;
        const x = (canvasWidth - w) / 2 + offsetX;
        const y = (canvasHeight - h) / 2 + offsetY;

        ctx.drawImage(img, x, y, w, h);
    }

    /**
     * Draw transition effect
     */
    drawTransition(ctx, nextImg, canvasWidth, canvasHeight, progress, transition) {
        switch (transition) {
            case 'crossfade':
                if (nextImg) {
                    ctx.globalAlpha = progress;
                    const imgScale = Math.max(canvasWidth / nextImg.width, canvasHeight / nextImg.height);
                    const w = nextImg.width * imgScale;
                    const h = nextImg.height * imgScale;
                    ctx.drawImage(nextImg, (canvasWidth - w) / 2, (canvasHeight - h) / 2, w, h);
                    ctx.globalAlpha = 1;
                }
                break;

            case 'fade-black':
                ctx.fillStyle = `rgba(0, 0, 0, ${progress})`;
                ctx.fillRect(0, 0, canvasWidth, canvasHeight);
                break;

            case 'slide-left':
                if (nextImg) {
                    const offset = canvasWidth * (1 - progress);
                    const imgScale = Math.max(canvasWidth / nextImg.width, canvasHeight / nextImg.height);
                    const w = nextImg.width * imgScale;
                    const h = nextImg.height * imgScale;
                    ctx.drawImage(nextImg, offset + (canvasWidth - w) / 2, (canvasHeight - h) / 2, w, h);
                }
                break;

            case 'slide-right':
                if (nextImg) {
                    const offset = -canvasWidth * (1 - progress);
                    const imgScale = Math.max(canvasWidth / nextImg.width, canvasHeight / nextImg.height);
                    const w = nextImg.width * imgScale;
                    const h = nextImg.height * imgScale;
                    ctx.drawImage(nextImg, offset + (canvasWidth - w) / 2, (canvasHeight - h) / 2, w, h);
                }
                break;

            case 'zoom':
                if (nextImg) {
                    ctx.globalAlpha = progress;
                    const zoomScale = 0.5 + progress * 0.5;
                    const imgScale = Math.max(canvasWidth / nextImg.width, canvasHeight / nextImg.height) * zoomScale;
                    const w = nextImg.width * imgScale;
                    const h = nextImg.height * imgScale;
                    ctx.drawImage(nextImg, (canvasWidth - w) / 2, (canvasHeight - h) / 2, w, h);
                    ctx.globalAlpha = 1;
                }
                break;

            default:
                break;
        }
    }

    /**
     * Draw subtitle on frame
     */
    drawSubtitle(ctx, text, canvasWidth, canvasHeight, fontSize, position, style) {
        const fontSizes = { small: 0.02, medium: 0.028, large: 0.035 };
        const size = Math.round(canvasWidth * (fontSizes[fontSize] || 0.028));
        const padding = size * 0.6;
        const maxWidth = canvasWidth * 0.85;

        ctx.font = `700 ${size}px "Plus Jakarta Sans", Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        // Word wrap
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

        const lineHeight = size * 1.4;
        const totalHeight = lines.length * lineHeight;

        // Position
        let baseY;
        switch (position) {
            case 'top': baseY = padding + totalHeight + 20; break;
            case 'center': baseY = (canvasHeight + totalHeight) / 2; break;
            default: baseY = canvasHeight - padding - 20; break;
        }

        // Background style
        if (style === 'box') {
            let maxLineWidth = 0;
            lines.forEach(line => {
                maxLineWidth = Math.max(maxLineWidth, ctx.measureText(line).width);
            });
            const boxW = maxLineWidth + padding * 3;
            const boxH = totalHeight + padding * 2;
            const boxX = (canvasWidth - boxW) / 2;
            const boxY = baseY - totalHeight - padding;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxW, boxH, 8);
            ctx.fill();
        }

        // Draw text
        lines.forEach((line, i) => {
            const y = baseY - totalHeight + (i + 1) * lineHeight;

            if (style === 'outline') {
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
                ctx.lineWidth = size * 0.15;
                ctx.lineJoin = 'round';
                ctx.strokeText(line, canvasWidth / 2, y);
            } else if (style === 'shadow') {
                ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                ctx.shadowBlur = size * 0.3;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
            }

            ctx.fillStyle = '#ffffff';
            ctx.fillText(line, canvasWidth / 2, y);

            // Reset shadow
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        });
    }

    /**
     * Estimate remaining time
     */
    estimateETA(currentFrame, totalFrames, startTime) {
        if (currentFrame === 0) return 'calculating...';
        if (!this._renderStartTime) this._renderStartTime = startTime;

        const elapsed = (Date.now() - this._renderStartTime) / 1000;
        const framesPerSec = currentFrame / elapsed;
        const remaining = (totalFrames - currentFrame) / framesPerSec;

        if (remaining < 60) return `~${Math.ceil(remaining)}s`;
        if (remaining < 3600) return `~${Math.ceil(remaining / 60)}min`;
        return `~${Math.floor(remaining / 3600)}h ${Math.ceil((remaining % 3600) / 60)}min`;
    }

    /**
     * Cancel rendering
     */
    cancel() {
        this.cancelRequested = true;
    }
}

// Export globally
window.VideoRenderer = VideoRenderer;
