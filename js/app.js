/**
 * SceneForge AI — Main App Controller
 * Orchestrates all modules and manages the step wizard.
 */
(function () {
    // Initialize modules
    const scriptParser = new ScriptParser();
    const audioManager = new AudioManager();
    const sceneEditor = new SceneEditor();
    const videoRenderer = new VideoRenderer();
    const previewPlayer = new PreviewPlayer();

    let currentStep = 1;
    let outputBlob = null;

    // ===== UTILITY: TOAST =====
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = { success: 'check_circle', error: 'error', info: 'info', warning: 'warning' };
        toast.innerHTML = `
            <span class="material-icons-round">${icons[type] || 'info'}</span>
            <span>${message}</span>
        `;

        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // ===== STEP NAVIGATION =====
    function goToStep(step) {
        if (step < 1 || step > 4) return;

        // Hide all panels
        document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));

        // Show target panel
        document.getElementById(`panel-step-${step}`).classList.add('active');

        // Update wizard
        document.querySelectorAll('.step-wizard .step').forEach((s, i) => {
            s.classList.remove('active', 'completed');
            if (i + 1 === step) s.classList.add('active');
            else if (i + 1 < step) s.classList.add('completed');
        });

        document.querySelectorAll('.step-connector').forEach((c, i) => {
            c.classList.toggle('completed', i + 1 < step);
        });

        currentStep = step;

        // Step-specific initialization
        if (step === 3) {
            sceneEditor.renderTimeline(scriptParser.scenes, document.getElementById('scene-timeline-list'));
            updatePreviewInfo();
        }
        if (step === 4) {
            updateExportSummary();
        }
    }

    // ===== STEP 1: SCRIPT =====
    const scriptTextarea = document.getElementById('script-textarea');

    scriptTextarea.addEventListener('input', () => {
        updateScriptStats();
    });

    function updateScriptStats() {
        const text = scriptTextarea.value;
        const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
        const minutes = Math.ceil((wordCount / 150));
        const sceneCount = scriptParser.scenes.length;

        document.getElementById('stat-words').textContent = `${wordCount} words`;
        document.getElementById('stat-duration').textContent = `~${minutes} min`;
        document.getElementById('stat-scenes').textContent = `${sceneCount} scenes`;
    }

    document.getElementById('btn-clear-script').addEventListener('click', () => {
        scriptTextarea.value = '';
        scriptParser.scenes = [];
        document.getElementById('scenes-preview').style.display = 'none';
        document.getElementById('btn-to-step2').disabled = true;
        updateScriptStats();
    });

    document.getElementById('btn-paste-script').addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            scriptTextarea.value = text;
            updateScriptStats();
            showToast('Pasted from clipboard', 'success');
        } catch {
            showToast('Could not access clipboard', 'error');
        }
    });

    document.getElementById('btn-auto-split').addEventListener('click', () => {
        const text = scriptTextarea.value.trim();
        if (!text) {
            showToast('Please enter a script first', 'warning');
            return;
        }

        scriptParser.parse(text);
        renderScenesPreview();
        document.getElementById('btn-to-step2').disabled = false;
        updateScriptStats();
        showToast(`Split into ${scriptParser.scenes.length} scenes`, 'success');
    });

    function renderScenesPreview() {
        const container = document.getElementById('scenes-list');
        const wrapper = document.getElementById('scenes-preview');
        container.innerHTML = '';
        wrapper.style.display = 'block';

        scriptParser.scenes.forEach((scene, index) => {
            const item = document.createElement('div');
            item.className = 'scene-item';
            item.innerHTML = `
                <div class="scene-item-number">${index + 1}</div>
                <div class="scene-item-content">
                    <div class="scene-item-text">${scene.text}</div>
                    <div class="scene-item-meta">
                        <span>${scene.wordCount} words</span>
                        <span>~${scene.duration}s</span>
                    </div>
                </div>
                <div class="scene-item-actions">
                    <button class="btn btn-icon btn-sm" data-action="delete" data-id="${scene.id}" title="Delete scene">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
            `;
            container.appendChild(item);
        });

        // Delete scene buttons
        container.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                scriptParser.removeScene(id);
                renderScenesPreview();
                updateScriptStats();
                showToast('Scene removed', 'info');
            });
        });
    }

    document.getElementById('btn-add-scene').addEventListener('click', () => {
        scriptParser.addScene();
        renderScenesPreview();
        updateScriptStats();
        showToast('Empty scene added', 'success');
    });

    document.getElementById('btn-to-step2').addEventListener('click', () => goToStep(2));

    // ===== STEP 2: AUDIO =====
    const audioDropZone = document.getElementById('audio-drop-zone');
    const audioFileInput = document.getElementById('audio-file-input');
    const audioPlayerContainer = document.getElementById('audio-player-container');
    const waveformCanvas = document.getElementById('waveform-canvas');

    audioDropZone.addEventListener('click', () => audioFileInput.click());

    audioDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        audioDropZone.classList.add('dragover');
    });

    audioDropZone.addEventListener('dragleave', () => {
        audioDropZone.classList.remove('dragover');
    });

    audioDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        audioDropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('audio/')) {
            loadAudioFile(file);
        }
    });

    audioFileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) loadAudioFile(e.target.files[0]);
    });

    async function loadAudioFile(file) {
        try {
            showToast('Loading audio...', 'info');
            const result = await audioManager.loadFile(file);

            document.getElementById('audio-filename').textContent = result.fileName;
            document.getElementById('audio-duration-badge').textContent = audioManager.formatTimeLong(result.duration);
            document.getElementById('audio-total-time').textContent = audioManager.formatTimeLong(result.duration);

            audioDropZone.style.display = 'none';
            audioPlayerContainer.style.display = 'block';

            // Draw waveform
            audioManager.drawWaveform(waveformCanvas, 0);

            // Auto-distribute scene timings
            scriptParser.distributeToAudioDuration(result.duration);

            document.getElementById('btn-to-step3').disabled = false;
            showToast(`Audio loaded: ${audioManager.formatTimeLong(result.duration)}`, 'success');

        } catch (err) {
            showToast('Failed to load audio file', 'error');
            console.error(err);
        }
    }

    // Audio playback controls
    audioManager.onTimeUpdate = (currentTime, duration) => {
        document.getElementById('audio-current-time').textContent = audioManager.formatTimeLong(currentTime);
        document.getElementById('audio-scrubber-input').value = (currentTime / duration) * 100;
        audioManager.drawWaveform(waveformCanvas, currentTime / duration);
    };

    document.getElementById('btn-audio-play').addEventListener('click', () => {
        const playing = audioManager.togglePlay();
        const icon = document.querySelector('#btn-audio-play .material-icons-round');
        icon.textContent = playing ? 'pause' : 'play_arrow';
    });

    document.getElementById('audio-scrubber-input').addEventListener('input', (e) => {
        audioManager.seekPercent(e.target.value / 100);
    });

    document.getElementById('btn-remove-audio').addEventListener('click', () => {
        audioManager.remove();
        audioDropZone.style.display = 'flex';
        audioPlayerContainer.style.display = 'none';
        document.getElementById('btn-to-step3').disabled = true;
        showToast('Audio removed', 'info');
    });

    document.getElementById('btn-back-to-step1').addEventListener('click', () => goToStep(1));
    document.getElementById('btn-to-step3').addEventListener('click', () => goToStep(3));

    // ===== STEP 3: SCENE EDITOR =====
    sceneEditor.onSceneSelect = (scene) => {
        sceneEditor.populateProperties(scene);
        updatePreviewInfo();
    };

    function updatePreviewInfo() {
        const scenes = scriptParser.scenes;
        document.getElementById('preview-total-scenes').textContent = scenes.length;

        const selected = sceneEditor.getSelectedScene(scenes);
        if (selected) {
            document.getElementById('preview-scene-num').textContent = selected.index + 1;
        }
    }

    // Property change handlers
    document.getElementById('prop-duration').addEventListener('change', (e) => {
        const scene = sceneEditor.getSelectedScene(scriptParser.scenes);
        if (scene) {
            scriptParser.updateScene(scene.id, { duration: parseInt(e.target.value) || 5 });
            sceneEditor.renderTimeline(scriptParser.scenes, document.getElementById('scene-timeline-list'));
        }
    });

    document.getElementById('prop-transition').addEventListener('change', (e) => {
        const scene = sceneEditor.getSelectedScene(scriptParser.scenes);
        if (scene) scriptParser.updateScene(scene.id, { transition: e.target.value });
    });

    document.getElementById('prop-kenburns').addEventListener('change', (e) => {
        const scene = sceneEditor.getSelectedScene(scriptParser.scenes);
        if (scene) {
            scriptParser.updateScene(scene.id, { kenBurns: e.target.value });
            sceneEditor.drawPreview(scene);
        }
    });

    document.getElementById('prop-subtitle').addEventListener('input', (e) => {
        const scene = sceneEditor.getSelectedScene(scriptParser.scenes);
        if (scene) {
            scriptParser.updateScene(scene.id, { subtitle: e.target.value });
            sceneEditor.drawPreview(scene);
        }
    });

    document.getElementById('prop-image-prompt').addEventListener('input', (e) => {
        const scene = sceneEditor.getSelectedScene(scriptParser.scenes);
        if (scene) scriptParser.updateScene(scene.id, { imagePrompt: e.target.value });
    });

    // Image upload for individual scene
    const sceneImageDrop = document.getElementById('scene-image-drop');
    const sceneImageInput = document.getElementById('scene-image-input');

    sceneImageDrop.addEventListener('click', () => sceneImageInput.click());
    sceneImageDrop.addEventListener('dragover', (e) => { e.preventDefault(); });
    sceneImageDrop.addEventListener('drop', (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            const scene = sceneEditor.getSelectedScene(scriptParser.scenes);
            if (scene) {
                sceneEditor.handleImageUpload(file, scene).then(() => {
                    sceneEditor.renderTimeline(scriptParser.scenes, document.getElementById('scene-timeline-list'));
                    showToast('Image assigned', 'success');
                });
            }
        }
    });

    sceneImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const scene = sceneEditor.getSelectedScene(scriptParser.scenes);
            if (scene) {
                sceneEditor.handleImageUpload(file, scene).then(() => {
                    sceneEditor.renderTimeline(scriptParser.scenes, document.getElementById('scene-timeline-list'));
                    showToast('Image assigned', 'success');
                });
            }
        }
        e.target.value = '';
    });

    // Bulk image upload
    const bulkImageInput = document.getElementById('bulk-image-input');
    document.getElementById('btn-bulk-upload').addEventListener('click', () => bulkImageInput.click());
    bulkImageInput.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            const count = await sceneEditor.handleBulkUpload(e.target.files, scriptParser.scenes);
            sceneEditor.renderTimeline(scriptParser.scenes, document.getElementById('scene-timeline-list'));
            showToast(`${count} images assigned`, 'success');
        }
        e.target.value = '';
    });

    // ===== FREE AI IMAGE GENERATION (POLLINATIONS.AI) =====
    
    // Pollinations URL builder
    function buildPollinationsUrl(prompt) {
        const ratio = document.querySelector('input[name="aspect-ratio"]:checked')?.value || '16:9';
        let width = 1920;
        let height = 1080;
        if (ratio === '9:16') { width = 1080; height = 1920; }
        else if (ratio === '1:1') { width = 1080; height = 1080; }
        else if (ratio === '4:5') { width = 1080; height = 1350; }
        
        const seed = Math.floor(Math.random() * 1000000);
        return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true`;
    }

    // Helper to fetch image to data URL so it can be saved in JSON and Canvas without CORS issues
    async function fetchImageAsDataUrl(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch image');
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // Single Scene Generation
    let currentGeneratedDataUrl = null;

    document.getElementById('btn-generate-scene-image').addEventListener('click', () => {
        const scene = sceneEditor.getSelectedScene(scriptParser.scenes);
        if (scene) {
            document.getElementById('modal-gen-prompt').value = scene.imagePrompt || '';
            document.getElementById('modal-gen-preview').style.display = 'none';
            document.getElementById('btn-apply-generated').style.display = 'none';
            document.getElementById('btn-do-generate').textContent = 'Generate';
            currentGeneratedDataUrl = null;
            document.getElementById('modal-generate').style.display = 'flex';
        }
    });

    document.getElementById('btn-do-generate').addEventListener('click', async () => {
        const prompt = document.getElementById('modal-gen-prompt').value.trim();
        if (!prompt) return showToast('Please enter a prompt', 'warning');
        
        const preview = document.getElementById('modal-gen-preview');
        const loading = document.getElementById('modal-gen-loading');
        const img = document.getElementById('modal-gen-img');
        const btnApply = document.getElementById('btn-apply-generated');
        
        preview.style.display = 'flex';
        loading.style.display = 'flex';
        img.style.display = 'none';
        btnApply.style.display = 'none';
        
        try {
            const url = buildPollinationsUrl(prompt);
            currentGeneratedDataUrl = await fetchImageAsDataUrl(url);
            
            img.src = currentGeneratedDataUrl;
            img.style.display = 'block';
            loading.style.display = 'none';
            btnApply.style.display = 'flex';
            document.getElementById('btn-do-generate').innerHTML = '<span class="material-icons-round">refresh</span> Regenerate';
        } catch (err) {
            loading.style.display = 'none';
            showToast('Failed to generate image', 'error');
        }
    });

    document.getElementById('btn-apply-generated').addEventListener('click', () => {
        if (!currentGeneratedDataUrl) return;
        const scene = sceneEditor.getSelectedScene(scriptParser.scenes);
        if (scene) {
            scene.imageSrc = currentGeneratedDataUrl;
            sceneEditor.populateProperties(scene);
            sceneEditor.renderTimeline(scriptParser.scenes, document.getElementById('scene-timeline-list'));
            document.getElementById('modal-generate').style.display = 'none';
            showToast('Image applied to scene', 'success');
        }
    });

    document.getElementById('modal-generate-close').addEventListener('click', () => {
        document.getElementById('modal-generate').style.display = 'none';
    });

    // Bulk Generation
    let isBulkGenerating = false;

    document.getElementById('btn-generate-all-images').addEventListener('click', () => {
        const scenes = scriptParser.scenes.filter(s => !s.imageSrc && s.imagePrompt);
        if (scenes.length === 0) {
            return showToast('All scenes already have images.', 'info');
        }
        
        document.getElementById('bulk-gen-count').textContent = scenes.length;
        document.getElementById('bulk-gen-progress').style.display = 'none';
        document.getElementById('btn-start-bulk-generate').style.display = 'flex';
        document.getElementById('modal-bulk-generate').style.display = 'flex';
    });

    document.getElementById('modal-bulk-generate-close').addEventListener('click', () => {
        if (isBulkGenerating) {
            return showToast('Please wait for generation to finish', 'warning');
        }
        document.getElementById('modal-bulk-generate').style.display = 'none';
    });

    document.getElementById('btn-start-bulk-generate').addEventListener('click', async () => {
        const scenesToGenerate = scriptParser.scenes.filter(s => !s.imageSrc && s.imagePrompt);
        if (scenesToGenerate.length === 0) return;

        isBulkGenerating = true;
        document.getElementById('btn-start-bulk-generate').style.display = 'none';
        
        const progressContainer = document.getElementById('bulk-gen-progress');
        const fill = document.getElementById('bulk-gen-progress-fill');
        const text = document.getElementById('bulk-gen-progress-text');
        const percentText = document.getElementById('bulk-gen-progress-percent');
        
        progressContainer.style.display = 'block';
        
        let successCount = 0;
        
        for (let i = 0; i < scenesToGenerate.length; i++) {
            const scene = scenesToGenerate[i];
            
            text.textContent = `Generating ${i + 1} of ${scenesToGenerate.length}...`;
            const percent = Math.round((i / scenesToGenerate.length) * 100);
            fill.style.width = `${percent}%`;
            percentText.textContent = `${percent}%`;
            
            try {
                const url = buildPollinationsUrl(scene.imagePrompt);
                const dataUrl = await fetchImageAsDataUrl(url);
                scene.imageSrc = dataUrl;
                successCount++;
                
                // Update UI slightly to show progress
                sceneEditor.renderTimeline(scriptParser.scenes, document.getElementById('scene-timeline-list'));
                
                if (i < scenesToGenerate.length - 1) {
                    text.textContent = `Cooling down (5s) to avoid server limits...`;
                    await new Promise(r => setTimeout(r, 5000));
                }
            } catch (err) {
                console.error(`Failed to generate for scene ${scene.index + 1}:`, err);
                text.textContent = `Rate limit hit, pausing 5s...`;
                await new Promise(r => setTimeout(r, 5000));
            }
        }
        
        fill.style.width = '100%';
        percentText.textContent = '100%';
        text.textContent = 'Complete!';
        
        isBulkGenerating = false;
        
        const selected = sceneEditor.getSelectedScene(scriptParser.scenes);
        if (selected) sceneEditor.populateProperties(selected);
        
        setTimeout(() => {
            document.getElementById('modal-bulk-generate').style.display = 'none';
            showToast(`Generated ${successCount} images successfully`, 'success');
        }, 1500);
    });

    // Delete scene
    document.getElementById('btn-delete-scene').addEventListener('click', () => {
        const scene = sceneEditor.getSelectedScene(scriptParser.scenes);
        if (scene) {
            scriptParser.removeScene(scene.id);
            sceneEditor.selectedSceneId = null;
            sceneEditor.populateProperties(null);
            sceneEditor.renderTimeline(scriptParser.scenes, document.getElementById('scene-timeline-list'));
            showToast('Scene deleted', 'info');
        }
    });

    // Preview controls
    document.getElementById('btn-preview-play').addEventListener('click', () => {
        const canvas = document.getElementById('preview-canvas');
        previewPlayer.play(scriptParser.scenes, audioManager, canvas);
        showToast('Preview playing...', 'info');
    });

    document.getElementById('btn-preview-stop').addEventListener('click', () => {
        previewPlayer.stop(audioManager);
    });

    previewPlayer.onSceneChange = (index) => {
        document.getElementById('preview-scene-num').textContent = index + 1;
    };

    document.getElementById('btn-back-to-step2').addEventListener('click', () => goToStep(2));
    document.getElementById('btn-to-step4').addEventListener('click', () => goToStep(4));

    // ===== STEP 4: EXPORT =====

    // Aspect ratio selection
    document.querySelectorAll('.ratio-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.ratio-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            option.querySelector('input').checked = true;
            updateExportSummary();
        });
    });

    // Resolution selection
    document.querySelectorAll('.resolution-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.resolution-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            option.querySelector('input').checked = true;
            updateExportSummary();
        });
    });

    function updateExportSummary() {
        const scenes = scriptParser.scenes;
        const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);
        const imagesAssigned = scenes.filter(s => s.imageSrc).length;

        document.getElementById('summary-scenes').textContent = scenes.length;
        document.getElementById('summary-duration').textContent = audioManager.formatTimeLong(totalDuration);
        document.getElementById('summary-images').textContent = imagesAssigned;
        document.getElementById('summary-images-total').textContent = scenes.length;

        const ratio = document.querySelector('input[name="aspect-ratio"]:checked')?.value || '16:9';
        const res = document.querySelector('input[name="resolution"]:checked')?.value || '1080';
        const [w, h] = videoRenderer.getResolution(ratio, res);
        document.getElementById('summary-format').textContent = `${w}×${h} (${ratio})`;
    }

    // Render button
    document.getElementById('btn-render').addEventListener('click', async () => {
        const scenes = scriptParser.scenes;
        if (scenes.length === 0) {
            showToast('No scenes to render', 'warning');
            return;
        }

        const ratio = document.querySelector('input[name="aspect-ratio"]:checked')?.value || '16:9';
        const res = document.querySelector('input[name="resolution"]:checked')?.value || '1080';
        const subtitlesEnabled = document.getElementById('toggle-subtitles').checked;
        const subtitleFontSize = document.getElementById('subtitle-font-size').value;
        const subtitlePosition = document.getElementById('subtitle-position').value;
        const subtitleStyle = document.getElementById('subtitle-style').value;

        // Show progress, hide button
        document.getElementById('btn-render').style.display = 'none';
        document.getElementById('render-progress').style.display = 'flex';
        document.getElementById('render-complete').style.display = 'none';

        videoRenderer.onProgress = (data) => {
            document.getElementById('render-status-text').textContent = data.message;
            document.getElementById('render-progress-fill').style.width = data.percent + '%';
            document.getElementById('render-progress-percent').textContent = data.percent + '%';
            document.getElementById('render-eta').textContent = data.eta ? `ETA: ${data.eta}` : '';
        };

        videoRenderer.onComplete = (blob) => {
            outputBlob = blob;
            document.getElementById('render-progress').style.display = 'none';
            document.getElementById('render-complete').style.display = 'flex';
            showToast('Video rendered successfully!', 'success');
        };

        videoRenderer.onError = (msg) => {
            document.getElementById('render-progress').style.display = 'none';
            document.getElementById('btn-render').style.display = 'inline-flex';
            showToast(msg, 'error');
        };

        await videoRenderer.render(scenes, audioManager, {
            aspectRatio: ratio,
            resolution: res,
            subtitlesEnabled,
            subtitleFontSize,
            subtitlePosition,
            subtitleStyle,
        });
    });

    // Download button
    document.getElementById('btn-download-video').addEventListener('click', () => {
        if (!outputBlob) return;

        const url = URL.createObjectURL(outputBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sceneforge_video_${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Download started!', 'success');
    });

    document.getElementById('btn-back-to-step3').addEventListener('click', () => goToStep(3));

    // ===== SAVE / LOAD =====
    document.getElementById('btn-save-project').addEventListener('click', () => {
        const project = {
            version: 1,
            scenes: scriptParser.toJSON(),
            script: scriptTextarea.value,
        };
        const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sceneforge_project_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Project saved', 'success');
    });

    document.getElementById('btn-load-project').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const project = JSON.parse(text);
                if (project.script) scriptTextarea.value = project.script;
                if (project.scenes) scriptParser.fromJSON(project.scenes);
                updateScriptStats();
                renderScenesPreview();
                document.getElementById('btn-to-step2').disabled = false;
                showToast('Project loaded', 'success');
            } catch {
                showToast('Invalid project file', 'error');
            }
        });
        input.click();
    });

    // ===== WIZARD STEP CLICKS =====
    document.querySelectorAll('.step-wizard .step').forEach(step => {
        step.addEventListener('click', () => {
            const stepNum = parseInt(step.dataset.step);
            if (stepNum <= currentStep || step.classList.contains('completed')) {
                goToStep(stepNum);
            }
        });
    });

    // ===== INIT =====
    console.log('🎬 SceneForge AI initialized');

})();
