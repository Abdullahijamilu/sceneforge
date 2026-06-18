/**
 * SceneForge AI — Audio Manager Module
 * Handles audio upload, decoding, waveform visualization, and playback.
 */
class AudioManager {
    constructor() {
        this.audioContext = null;
        this.audioBuffer = null;
        this.audioElement = null;
        this.sourceNode = null;
        this.fileName = '';
        this.duration = 0;
        this.isPlaying = false;
        this.waveformData = [];
        this.onTimeUpdate = null;
    }

    /**
     * Initialize audio context
     */
    init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    /**
     * Load audio file
     */
    async loadFile(file) {
        this.init();
        this.fileName = file.name;

        // Create object URL for HTML5 audio playback
        if (this.audioElement) {
            this.audioElement.pause();
            URL.revokeObjectURL(this.audioElement.src);
        }

        this.audioElement = new Audio();
        this.audioElement.src = URL.createObjectURL(file);
        this.audioElement.preload = 'auto';

        // Decode for waveform
        const arrayBuffer = await file.arrayBuffer();
        this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        this.duration = this.audioBuffer.duration;

        // Generate waveform data
        this.waveformData = this.generateWaveformData(this.audioBuffer, 400);

        // Set up time update
        this.audioElement.addEventListener('timeupdate', () => {
            if (this.onTimeUpdate) {
                this.onTimeUpdate(this.audioElement.currentTime, this.duration);
            }
        });

        this.audioElement.addEventListener('ended', () => {
            this.isPlaying = false;
        });

        return {
            fileName: this.fileName,
            duration: this.duration,
            waveformData: this.waveformData
        };
    }

    /**
     * Generate waveform visualization data
     */
    generateWaveformData(buffer, numSamples) {
        const channelData = buffer.getChannelData(0); // Use first channel
        const blockSize = Math.floor(channelData.length / numSamples);
        const waveform = [];

        for (let i = 0; i < numSamples; i++) {
            let sum = 0;
            const start = i * blockSize;
            for (let j = 0; j < blockSize; j++) {
                sum += Math.abs(channelData[start + j] || 0);
            }
            waveform.push(sum / blockSize);
        }

        // Normalize to 0-1
        const max = Math.max(...waveform, 0.01);
        return waveform.map(v => v / max);
    }

    /**
     * Draw waveform on canvas
     */
    drawWaveform(canvas, highlightProgress = 0) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;
        const barWidth = width / this.waveformData.length;
        const gap = 1;

        ctx.clearRect(0, 0, width, height);

        this.waveformData.forEach((value, i) => {
            const barHeight = Math.max(2, value * (height * 0.8));
            const x = i * barWidth;
            const y = (height - barHeight) / 2;

            const progress = i / this.waveformData.length;
            if (progress <= highlightProgress) {
                ctx.fillStyle = '#6c5ce7';
            } else {
                ctx.fillStyle = '#ddd';
            }

            ctx.beginPath();
            ctx.roundRect(x, y, Math.max(1, barWidth - gap), barHeight, 1);
            ctx.fill();
        });
    }

    /**
     * Play/Pause toggle
     */
    togglePlay() {
        if (!this.audioElement) return;

        if (this.isPlaying) {
            this.audioElement.pause();
            this.isPlaying = false;
        } else {
            this.audioElement.play();
            this.isPlaying = true;
        }
        return this.isPlaying;
    }

    /**
     * Seek to a specific time
     */
    seek(time) {
        if (this.audioElement) {
            this.audioElement.currentTime = Math.max(0, Math.min(time, this.duration));
        }
    }

    /**
     * Seek by percentage (0-1)
     */
    seekPercent(percent) {
        this.seek(percent * this.duration);
    }

    /**
     * Get current playback time
     */
    getCurrentTime() {
        return this.audioElement ? this.audioElement.currentTime : 0;
    }

    /**
     * Format seconds to MM:SS
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Format seconds to HH:MM:SS for longer durations
     */
    formatTimeLong(seconds) {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Get the raw audio file as a Blob for FFmpeg
     */
    async getAudioBlob() {
        if (!this.audioElement) return null;
        const response = await fetch(this.audioElement.src);
        return await response.blob();
    }

    /**
     * Remove loaded audio
     */
    remove() {
        if (this.audioElement) {
            this.audioElement.pause();
            URL.revokeObjectURL(this.audioElement.src);
            this.audioElement = null;
        }
        this.audioBuffer = null;
        this.fileName = '';
        this.duration = 0;
        this.isPlaying = false;
        this.waveformData = [];
    }

    /**
     * Check if audio is loaded
     */
    isLoaded() {
        return this.audioElement !== null && this.duration > 0;
    }
}

// Export globally
window.AudioManager = AudioManager;
