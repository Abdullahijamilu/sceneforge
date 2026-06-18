/**
 * SceneForge AI — Script Parser Module
 * Splits raw script text into scenes and generates AI image prompts.
 */
class ScriptParser {
    constructor() {
        this.scenes = [];
        this.wordsPerMinute = 150; // Average speaking rate
    }

    /**
     * Parse raw script text into scenes.
     * Splits on: blank lines, [Scene X] markers, numbered markers, or --- dividers.
     */
    parse(rawText) {
        if (!rawText || !rawText.trim()) {
            this.scenes = [];
            return this.scenes;
        }

        // Normalize line endings
        const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // Try to detect scene markers
        const hasSceneMarkers = /\[scene\s*\d*\]/i.test(text);
        const hasNumberedMarkers = /^\d+[\.\)]\s/m.test(text);
        const hasDividers = /^---+$/m.test(text);

        let rawScenes = [];

        if (hasSceneMarkers) {
            // Split by [Scene X] markers
            rawScenes = text.split(/\[scene\s*\d*\]\s*/i).filter(s => s.trim());
        } else if (hasDividers) {
            // Split by --- dividers
            rawScenes = text.split(/^---+$/m).filter(s => s.trim());
        } else if (hasNumberedMarkers) {
            // Split by numbered markers (1. or 1))
            rawScenes = text.split(/(?=^\d+[\.\)]\s)/m).filter(s => s.trim());
        } else {
            // Split by double blank lines
            rawScenes = text.split(/\n\s*\n/).filter(s => s.trim());
        }

        // If no splits found, treat entire text as one scene
        if (rawScenes.length === 0) {
            rawScenes = [text];
        }

        this.scenes = rawScenes.map((sceneText, index) => {
            const cleanText = sceneText.trim();
            const wordCount = this.countWords(cleanText);
            const duration = Math.max(3, Math.round((wordCount / this.wordsPerMinute) * 60));

            return {
                id: this.generateId(),
                index: index,
                text: cleanText,
                wordCount: wordCount,
                duration: duration, // seconds
                imagePrompt: this.generateImagePrompt(cleanText),
                imageSrc: null, // Will be set when user uploads or generates
                imageFile: null,
                transition: 'crossfade',
                kenBurns: 'zoom-in',
                subtitle: cleanText.length > 120 ? cleanText.substring(0, 120) + '...' : cleanText,
            };
        });

        return this.scenes;
    }

    /**
     * Generate a descriptive image prompt from scene text.
     * Extracts key concepts and creates a visual description.
     */
    generateImagePrompt(text) {
        // Clean the text - remove numbered prefixes
        let clean = text.replace(/^\d+[\.\)]\s*/, '').trim();

        // Take first 2 sentences or 100 words max for the prompt basis
        const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean];
        const promptBasis = sentences.slice(0, 2).join(' ').trim();

        // Build a visual prompt
        if (promptBasis.length < 15) {
            return `Professional illustration of ${promptBasis}, clean modern design, high quality, cinematic lighting`;
        }

        return `Visual representation of: ${promptBasis}. Professional illustration style, clean composition, cinematic lighting, high quality render`;
    }

    /**
     * Count words in text
     */
    countWords(text) {
        return text.split(/\s+/).filter(w => w.length > 0).length;
    }

    /**
     * Get total stats for the current script
     */
    getStats() {
        const totalWords = this.scenes.reduce((sum, s) => sum + s.wordCount, 0);
        const totalDuration = this.scenes.reduce((sum, s) => sum + s.duration, 0);
        return {
            wordCount: totalWords,
            sceneCount: this.scenes.length,
            estimatedDuration: totalDuration,
            estimatedMinutes: Math.ceil(totalDuration / 60)
        };
    }

    /**
     * Add a new empty scene
     */
    addScene(afterIndex = -1) {
        const newScene = {
            id: this.generateId(),
            index: afterIndex >= 0 ? afterIndex + 1 : this.scenes.length,
            text: '',
            wordCount: 0,
            duration: 5,
            imagePrompt: '',
            imageSrc: null,
            imageFile: null,
            transition: 'crossfade',
            kenBurns: 'zoom-in',
            subtitle: '',
        };

        if (afterIndex >= 0 && afterIndex < this.scenes.length) {
            this.scenes.splice(afterIndex + 1, 0, newScene);
        } else {
            this.scenes.push(newScene);
        }

        this.reindex();
        return newScene;
    }

    /**
     * Remove a scene by id
     */
    removeScene(sceneId) {
        this.scenes = this.scenes.filter(s => s.id !== sceneId);
        this.reindex();
    }

    /**
     * Update a scene property
     */
    updateScene(sceneId, updates) {
        const scene = this.scenes.find(s => s.id === sceneId);
        if (scene) {
            Object.assign(scene, updates);
            if (updates.text !== undefined) {
                scene.wordCount = this.countWords(updates.text);
            }
        }
        return scene;
    }

    /**
     * Reindex scenes after add/remove
     */
    reindex() {
        this.scenes.forEach((s, i) => s.index = i);
    }

    /**
     * Distribute scenes evenly across a given total duration (from audio)
     */
    distributeToAudioDuration(totalAudioDuration) {
        if (this.scenes.length === 0 || totalAudioDuration <= 0) return;

        const durationPerScene = totalAudioDuration / this.scenes.length;
        this.scenes.forEach(scene => {
            scene.duration = Math.round(durationPerScene);
        });

        // Adjust last scene to exactly match audio duration
        const currentTotal = this.scenes.reduce((sum, s) => sum + s.duration, 0);
        const diff = Math.round(totalAudioDuration) - currentTotal;
        if (this.scenes.length > 0) {
            this.scenes[this.scenes.length - 1].duration += diff;
        }
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return 'scene_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
    }

    /**
     * Export scenes as JSON
     */
    toJSON() {
        return JSON.parse(JSON.stringify(this.scenes));
    }

    /**
     * Import scenes from JSON
     */
    fromJSON(data) {
        this.scenes = data;
        this.reindex();
    }
}

// Export globally
window.ScriptParser = ScriptParser;
