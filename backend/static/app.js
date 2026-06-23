/* ==========================================================================
   AuraCut JavaScript Controller
   Interactions, Timeline Rendering, API Integrations & Job Polling
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    // Initialise Lucide Icons
    lucide.createIcons();

    // App State
    let selectedImages = []; // Objects containing { file, id, duration: 3.5, filter: 'none', transition: 'crossfade' }
    let selectedAudio = null;
    let selectedAudioSettings = {
        volume: 1.0,
        offset: 0.0
    };
    let selectedElement = null; // Currently selected timeline element
    let audioDuration = 0; // in seconds
    let activeJobId = null;
    let pollInterval = null;

    // DOM Elements - Inputs & Uploads
    const imagesInput = document.getElementById("images-input");
    const imagesDropzone = document.getElementById("images-dropzone");
    const imagesPreviewGrid = document.getElementById("images-preview-grid");
    
    const audioInput = document.getElementById("audio-input");
    const audioDropzone = document.getElementById("audio-dropzone");
    const audioDropText = document.getElementById("audio-drop-text");
    const audioInfoCard = document.getElementById("audio-info-card");
    const audioName = document.getElementById("audio-name");
    const audioSize = document.getElementById("audio-size");
    const btnRemoveAudio = document.getElementById("btn-remove-audio");

    // DOM Elements - Settings
    const ratioCards = document.querySelectorAll(".ratio-card");
    const themeCards = document.querySelectorAll(".theme-card");
    const btnGenerate = document.getElementById("btn-generate");

    // DOM Elements - Player & Status
    const playerPlaceholder = document.getElementById("player-placeholder");
    const playerLoader = document.getElementById("player-loader");
    const videoPlayer = document.getElementById("video-player");
    const exportActions = document.getElementById("export-actions");
    const btnDownload = document.getElementById("btn-download");
    
    const loaderTitle = document.getElementById("loader-title");
    const loaderDesc = document.getElementById("loader-desc");
    const loaderProgress = document.getElementById("loader-progress");
    const loaderPercent = document.getElementById("loader-percent");
    const apiStatusText = document.querySelector("#api-status .status-text");
    const apiStatusContainer = document.getElementById("api-status");

    // DOM Elements - Timeline
    const timelineDurationLabel = document.getElementById("timeline-duration");
    const timelineTimeLabel = document.getElementById("timeline-time");
    const videoTrackClips = document.getElementById("video-track-clips");
    const transitionTrackMarkers = document.getElementById("transition-track-markers");
    const audioTrackClip = document.getElementById("audio-track-clip");
    const btnTimelinePlay = document.getElementById("timeline-btn-play");
    const timelineRuler = document.getElementById("timeline-ruler");

    // DOM Elements - Inspector Drawer
    const inspectorDrawer = document.getElementById("inspector-drawer");
    const drawerContent = document.getElementById("drawer-content");
    const btnCloseDrawer = document.getElementById("btn-close-drawer");

    // Help / Examples Modal
    const helpModal = document.getElementById("help-modal");
    const btnHelp = document.getElementById("btn-help");
    const btnCloseModal = document.getElementById("btn-close-modal");

    if (btnHelp) {
        btnHelp.addEventListener("click", () => {
            helpModal.classList.remove("hidden");
        });
    }
    if (btnCloseModal) {
        btnCloseModal.addEventListener("click", () => {
            helpModal.classList.add("hidden");
        });
    }
    if (helpModal) {
        helpModal.addEventListener("click", (e) => {
            if (e.target === helpModal) {
                helpModal.classList.add("hidden");
            }
        });
    }

    // Check Backend Connectivity
    checkBackendHealth();


    async function checkBackendHealth() {
        try {
            const res = await fetch("/api/health");
            if (res.ok) {
                apiStatusContainer.classList.add("connected");
                apiStatusContainer.classList.remove("error");
                apiStatusText.textContent = "Server Online";
            } else {
                throw new Error();
            }
        } catch (e) {
            apiStatusContainer.classList.add("error");
            apiStatusContainer.classList.remove("connected");
            apiStatusText.textContent = "Server Offline";
        }
    }


    // ==========================================================================
    // File Upload Handlers (Drag & Drop + Clicks)
    // ==========================================================================

    // Images Dropzone handlers
    setupDragAndDrop(imagesDropzone, (files) => {
        handleImages(files);
    });
    imagesInput.addEventListener("change", (e) => {
        handleImages(e.target.files);
    });

    // Audio Dropzone handlers
    setupDragAndDrop(audioDropzone, (files) => {
        if (files.length > 0) handleAudio(files[0]);
    });
    audioInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) handleAudio(e.target.files[0]);
    });

    btnRemoveAudio.addEventListener("click", () => {
        selectedAudio = null;
        audioDuration = 0;
        audioInput.value = "";
        updateUI();
    });

    function setupDragAndDrop(dropzone, onFilesDropped) {
        dropzone.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropzone.classList.add("dragover");
        });

        dropzone.addEventListener("dragleave", () => {
            dropzone.classList.remove("dragover");
        });

        dropzone.addEventListener("drop", (e) => {
            e.preventDefault();
            dropzone.classList.remove("dragover");
            if (e.dataTransfer.files) {
                onFilesDropped(e.dataTransfer.files);
            }
        });

        dropzone.addEventListener("click", () => {
            const input = dropzone.querySelector(".file-input");
            if (input) input.click();
        });
    }

    // Helper to assign a varied, high-quality mix of VFX motions, transitions, and color filters
    function getVariedVfxAndTransition(index) {
        const motions = ["zoom_in", "pan_left", "slow_spin", "zoom_out", "pan_right", "diagonal_pan", "tilt_up", "tilt_down"];
        const transitions = ["crossfade", "slide_left", "slide_diagonal", "crossfade", "slide_right", "fade_black", "slide_up", "slide_down"];
        const filters = ["none", "cinematic", "cool_pine", "none", "vintage", "polaroid", "none", "sunset", "vaporwave"];
        
        return {
            effect: motions[index % motions.length],
            transition: transitions[index % transitions.length],
            filter: filters[index % filters.length]
        };
    }

    function handleImages(files) {
        const validFiles = Array.from(files).filter(file => file.type.startsWith("image/"));
        const newImages = validFiles.map((file, idx) => {
            const globalIndex = selectedImages.length + idx;
            const style = getVariedVfxAndTransition(globalIndex);
            return {
                file: file,
                id: "img_" + Math.random().toString(36).substring(2, 9),
                duration: 3.5,
                filter: style.filter,
                effect: style.effect,
                transition: style.transition
            };
        });
        selectedImages = [...selectedImages, ...newImages];
        updateUI();
    }

    function handleAudio(file) {
        if (!file.type.startsWith("audio/")) {
            alert("Please upload a valid audio file.");
            return;
        }
        selectedAudio = file;
        selectedAudioSettings.volume = 1.0;
        selectedAudioSettings.offset = 0.0;
        
        // Calculate audio file size
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        audioName.textContent = file.name;
        audioSize.textContent = `${sizeMB} MB`;

        // Load metadata to get precise duration
        const audioUrl = URL.createObjectURL(file);
        const tempAudio = new Audio(audioUrl);
        tempAudio.addEventListener("loadedmetadata", () => {
            audioDuration = tempAudio.duration;
            updateUI();
        });
    }


    // ==========================================================================
    // Option Card Selection Handlers
    // ==========================================================================

    const ratioInputs = document.querySelectorAll('input[name="aspect-ratio"]');
    ratioInputs.forEach(input => {
        input.addEventListener("change", () => {
            ratioCards.forEach(c => c.classList.remove("active"));
            input.closest(".ratio-card").classList.add("active");
            
            // Sync with inspector drawer if open
            const drawerSelect = document.getElementById("inspect-aspect-ratio");
            if (drawerSelect) {
                drawerSelect.value = input.value;
            }
        });
    });

    const themeInputs = document.querySelectorAll('input[name="video-theme"]');
    themeInputs.forEach(input => {
        input.addEventListener("change", () => {
            themeCards.forEach(c => c.classList.remove("active"));
            input.closest(".theme-card").classList.add("active");
            
            // Sync with inspector drawer if open
            const drawerSelect = document.getElementById("inspect-theme");
            if (drawerSelect) {
                drawerSelect.value = input.value;
            }
        });
    });




    // ==========================================================================
    // UI Rendering Logic (Timeline, Thumbnails, Buttons)
    // ==========================================================================

    function updateUI() {
        // 1. Render photo thumbnails grid in Sidebar
        imagesPreviewGrid.innerHTML = "";
        selectedImages.forEach((img, idx) => {
            const thumb = document.createElement("div");
            thumb.className = "preview-thumb";
            thumb.style.backgroundImage = `url(${URL.createObjectURL(img.file)})`;
            
            const removeBtn = document.createElement("button");
            removeBtn.className = "remove-thumb-btn";
            removeBtn.innerHTML = `<i data-lucide="x"></i>`;
            removeBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                selectedImages.splice(idx, 1);
                if (selectedElement && selectedElement.type === "image" && selectedElement.index === idx) {
                    closeInspector();
                }
                updateUI();
            });

            thumb.appendChild(removeBtn);
            imagesPreviewGrid.appendChild(thumb);
        });
        
        // 2. Toggle audio upload state display
        if (selectedAudio) {
            audioDropzone.classList.add("hidden");
            audioInfoCard.classList.remove("hidden");
        } else {
            audioDropzone.classList.remove("hidden");
            audioInfoCard.classList.add("hidden");
        }

        // 3. Render Timeline content
        renderTimeline();

        // 4. Toggle Generate Button State
        if (selectedImages.length > 0 && selectedAudio) {
            btnGenerate.removeAttribute("disabled");
        } else {
            btnGenerate.setAttribute("disabled", "true");
        }

        lucide.createIcons();
    }

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function renderTimeline() {
        // Reset tracks
        videoTrackClips.innerHTML = "";
        transitionTrackMarkers.innerHTML = "";
        audioTrackClip.innerHTML = "";
        timelineRuler.innerHTML = "";
        
        if (selectedImages.length === 0 && !selectedAudio) {
            videoTrackClips.innerHTML = `<div class="timeline-empty-message">No clips uploaded. Drop photos above.</div>`;
            audioTrackClip.innerHTML = `<div class="timeline-empty-message">No audio track imported.</div>`;
            timelineDurationLabel.textContent = "00:00";
            timelineTimeLabel.textContent = "00:00 / 00:00";
            btnTimelinePlay.setAttribute("disabled", "true");
            return;
        }

        btnTimelinePlay.removeAttribute("disabled");

        // Calculate project durations dynamically based on individual slide times
        let projectDuration = selectedImages.reduce((sum, img) => sum + img.duration, 0);
        
        if (selectedAudio && audioDuration > 0) {
            // If there are no images yet, base timeline on audio
            if (projectDuration === 0) projectDuration = audioDuration;
        }

        timelineDurationLabel.textContent = formatTime(projectDuration);
        timelineTimeLabel.textContent = `00:00 / ${formatTime(projectDuration)}`;

        // Render Ruler Ticks (Every 5 seconds)
        const timelineWidth = Math.max(800, projectDuration * 25); // 25px per second scale
        timelineRuler.style.width = `${timelineWidth}px`;
        
        const tickInterval = 5; // seconds
        for (let i = 0; i <= projectDuration; i += tickInterval) {
            const leftPercent = (i / projectDuration) * 100;
            
            const tick = document.createElement("div");
            tick.className = "ruler-tick major";
            tick.style.left = `${leftPercent}%`;
            
            const label = document.createElement("div");
            label.className = "ruler-tick-label";
            label.style.left = `${leftPercent}%`;
            label.textContent = formatTime(i);
            
            timelineRuler.appendChild(tick);
            timelineRuler.appendChild(label);
        }

        // Render Video Track Clips
        if (selectedImages.length > 0) {
            const clipContainer = document.createElement("div");
            clipContainer.className = "timeline-clip-container";
            clipContainer.style.width = `${timelineWidth}px`;
            
            selectedImages.forEach((img, idx) => {
                const clipWidthPercent = (img.duration / projectDuration) * 100;
                const clip = document.createElement("div");
                clip.className = "timeline-image-clip";
                if (selectedElement && selectedElement.type === "image" && selectedElement.index === idx) {
                    clip.classList.add("selected");
                }
                clip.style.width = `calc(${clipWidthPercent}% - 4px)`;
                clip.style.backgroundImage = `url(${URL.createObjectURL(img.file)})`;
                clip.style.cursor = "pointer";
                
                const idxLabel = document.createElement("span");
                idxLabel.className = "timeline-image-clip-idx";
                idxLabel.textContent = idx + 1;
                
                clip.appendChild(idxLabel);
                
                // Clicking selects the image clip and opens inspector
                clip.addEventListener("click", (e) => {
                    e.stopPropagation();
                    openInspector({ type: "image", index: idx });
                });
                
                clipContainer.appendChild(clip);
            });
            videoTrackClips.appendChild(clipContainer);

            // Render Transition markers (at start, boundaries, and end)
            if (selectedImages.length > 0) {
                const transContainer = document.createElement("div");
                transContainer.className = "timeline-transition-container";
                transContainer.style.width = `${timelineWidth}px`;
                
                // 1. Starting transition marker (at 0%)
                const startTrans = document.createElement("div");
                startTrans.className = "timeline-trans-marker";
                startTrans.innerHTML = `<i data-lucide="plus"></i>`;
                startTrans.style.position = "absolute";
                startTrans.style.left = `calc(0% - 9px)`;
                startTrans.style.top = "3px";
                startTrans.addEventListener("click", (e) => {
                    e.stopPropagation();
                    openInspector({ type: "image", index: 0 });
                });
                transContainer.appendChild(startTrans);
                
                // 2. Intermediate transition markers (boundaries between clips)
                let accumulatedDuration = 0;
                for (let i = 0; i < selectedImages.length - 1; i++) {
                    accumulatedDuration += selectedImages[i].duration;
                    const leftPercent = (accumulatedDuration / projectDuration) * 100;
                    
                    const trans = document.createElement("div");
                    trans.className = "timeline-trans-marker";
                    trans.innerHTML = `<i data-lucide="plus"></i>`;
                    trans.style.position = "absolute";
                    trans.style.left = `calc(${leftPercent}% - 9px)`;
                    trans.style.top = "3px";
                    
                    const index = i;
                    trans.addEventListener("click", (e) => {
                        e.stopPropagation();
                        openInspector({ type: "image", index: index });
                    });
                    transContainer.appendChild(trans);
                }
                
                // 3. Ending transition marker (at 100%)
                const endTrans = document.createElement("div");
                endTrans.className = "timeline-trans-marker";
                endTrans.innerHTML = `<i data-lucide="plus"></i>`;
                endTrans.style.position = "absolute";
                endTrans.style.left = `calc(100% - 9px)`;
                endTrans.style.top = "3px";
                endTrans.addEventListener("click", (e) => {
                    e.stopPropagation();
                    openInspector({ type: "image", index: selectedImages.length - 1 });
                });
                transContainer.appendChild(endTrans);
                
                transitionTrackMarkers.appendChild(transContainer);
            }
        } else {
            videoTrackClips.innerHTML = `<div class="timeline-empty-message">No video clips.</div>`;
        }

        // Render Audio Track Block
        if (selectedAudio) {
            const audioClip = document.createElement("div");
            audioClip.className = "timeline-audio-clip";
            if (selectedElement && selectedElement.type === "audio") {
                audioClip.classList.add("selected");
            }
            audioClip.style.width = `${timelineWidth}px`;
            audioClip.style.cursor = "pointer";
            audioClip.innerHTML = `
                <i data-lucide="music-2"></i>
                <span class="timeline-audio-clip-name">${selectedAudio.name}</span>
            `;
            
            // Clicking selects audio clip and opens inspector
            audioClip.addEventListener("click", (e) => {
                e.stopPropagation();
                openInspector({ type: "audio" });
            });
            
            audioTrackClip.appendChild(audioClip);
        } else {
            audioTrackClip.innerHTML = `<div class="timeline-empty-message">No audio track.</div>`;
        }
        
        lucide.createIcons();
    }

    // ==========================================================================
    // Timeline Clip Selection Inspector Drawer
    // ==========================================================================

    btnCloseDrawer.addEventListener("click", () => {
        closeInspector();
    });

    // Global listener to close inspector when clicking empty workspace areas
    document.addEventListener("click", (e) => {
        // If the target element is detached from the document (like dropdown options in some browsers), ignore the click
        if (e.target && !document.body.contains(e.target)) {
            return;
        }
        if (inspectorDrawer && 
            !inspectorDrawer.contains(e.target) && 
            !e.target.closest(".timeline-image-clip") && 
            !e.target.closest(".timeline-audio-clip") &&
            !e.target.closest(".timeline-trans-marker")) {
            closeInspector();
        }
    });

    function closeInspector() {
        inspectorDrawer.classList.add("hidden");
        selectedElement = null;
        document.querySelectorAll(".timeline-image-clip, .timeline-audio-clip").forEach(c => {
            c.classList.remove("selected");
        });
    }

    function openInspector(element) {
        selectedElement = element;
        inspectorDrawer.classList.remove("hidden");
        renderInspector();
    }

    function renderInspector() {
        drawerContent.innerHTML = "";
        if (!selectedElement) return;

        // Fetch current aspect ratio and theme settings from the sidebar
        const checkedRatio = document.querySelector('input[name="aspect-ratio"]:checked').value;
        const checkedTheme = document.querySelector('input[name="video-theme"]:checked').value;

        if (selectedElement.type === "image") {
            const imgIdx = selectedElement.index;
            const img = selectedImages[imgIdx];
            if (!img) return;

            // Highlight timeline selection
            document.querySelectorAll(".timeline-image-clip").forEach((c, idx) => {
                if (idx === imgIdx) c.classList.add("selected");
                else c.classList.remove("selected");
            });
            document.querySelectorAll(".timeline-audio-clip").forEach(c => c.classList.remove("selected"));

            const imgUrl = URL.createObjectURL(img.file);
            drawerContent.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; border-bottom:1px solid rgba(255,255,255,0.03); padding-bottom:0.75rem;">
                    <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Clip Customization</span>
                    <button class="text-link-btn" id="btn-guide-link" style="background:none; border:none; color:var(--accent-blue); font-size:0.75rem; text-decoration:underline; cursor:pointer; display:flex; align-items:center; gap:0.25rem; padding:0;"><i data-lucide="help-circle" style="width:12px;height:12px;"></i> Examples Guide</button>
                </div>

                <div class="inspector-thumb-preview">
                    <div class="preview-motion-wrapper" id="inspect-preview-motion">
                        <div class="preview-image-content" id="inspect-preview-image" style="background-image: url(${imgUrl})"></div>
                    </div>
                </div>
                
                <!-- Duration Slider -->
                <div class="inspector-group">
                    <label class="inspector-label">Slide Duration (seconds)</label>
                    <div class="slider-container">
                        <input type="range" id="inspect-duration" min="1.0" max="8.0" step="0.5" value="${img.duration}" class="inspector-slider">
                        <span class="slider-value" id="inspect-duration-val">${img.duration}s</span>
                    </div>
                </div>

                <!-- Visual Filter Select -->
                <div class="inspector-group">
                    <label class="inspector-label">Color Filter</label>
                    <select id="inspect-filter" class="inspector-select">
                        <option value="none" ${img.filter === 'none' ? 'selected' : ''}>Original (No Filter)</option>
                        <option value="cinematic" ${img.filter === 'cinematic' ? 'selected' : ''}>Cinematic Cool (Teal/Orange shadows)</option>
                        <option value="cinematic_letterbox" ${img.filter === 'cinematic_letterbox' ? 'selected' : ''}>Cinematic Letterbox (Teal/Orange + widescreen bars)</option>
                        <option value="energetic" ${img.filter === 'energetic' ? 'selected' : ''}>Energetic Vivid (High contrast & saturation)</option>
                        <option value="vintage" ${img.filter === 'vintage' ? 'selected' : ''}>Vintage Warm (Nostalgic warm tones)</option>
                        <option value="vintage_grain" ${img.filter === 'vintage_grain' ? 'selected' : ''}>Vintage Grain (Warm tones + film noise)</option>
                        <option value="grayscale" ${img.filter === 'grayscale' ? 'selected' : ''}>Noir High-Contrast (Dramatic B&W)</option>
                        <option value="cyberpunk" ${img.filter === 'cyberpunk' ? 'selected' : ''}>Cyberpunk Neon (Futuristic purple/cyan)</option>
                        <option value="cyberpunk_frame" ${img.filter === 'cyberpunk_frame' ? 'selected' : ''}>Cyberpunk Border (Neon cyan frame border)</option>
                        <option value="dreamy" ${img.filter === 'dreamy' ? 'selected' : ''}>Dreamy Bloom (Soft focus lens glow)</option>
                        <option value="sunset" ${img.filter === 'sunset' ? 'selected' : ''}>Golden Sunset (Golden hour sepia)</option>
                        <option value="cool_pine" ${img.filter === 'cool_pine' ? 'selected' : ''}>Cool Pine (Moody green forest grade)</option>
                        <option value="polaroid" ${img.filter === 'polaroid' ? 'selected' : ''}>Retro Polaroid (Faded warm film + white paper border)</option>
                        <option value="vaporwave" ${img.filter === 'vaporwave' ? 'selected' : ''}>Vaporwave Dream (Hot pink/cyan neon tone)</option>
                    </select>
                </div>

                <!-- Motion Effect Select -->
                <div class="inspector-group">
                    <label class="inspector-label">Motion / VFX Effect</label>
                    <select id="inspect-effect" class="inspector-select">
                        <option value="zoom_in" ${img.effect === 'zoom_in' ? 'selected' : ''}>Slow Zoom In (Pulls camera forward)</option>
                        <option value="zoom_out" ${img.effect === 'zoom_out' ? 'selected' : ''}>Slow Zoom Out (Reveals context)</option>
                        <option value="pan_left" ${img.effect === 'pan_left' ? 'selected' : ''}>Pan Left-to-Right (Cinematic horizontal slide)</option>
                        <option value="pan_right" ${img.effect === 'pan_right' ? 'selected' : ''}>Pan Right-to-Left (Horizontal pull from right)</option>
                        <option value="tilt_up" ${img.effect === 'tilt_up' ? 'selected' : ''}>Tilt Upwards (Vertical scan upwards)</option>
                        <option value="tilt_down" ${img.effect === 'tilt_down' ? 'selected' : ''}>Tilt Downwards (Vertical scan downwards)</option>
                        <option value="slow_spin" ${img.effect === 'slow_spin' ? 'selected' : ''}>Slow Spin (Cinematic rotational pan)</option>
                        <option value="diagonal_pan" ${img.effect === 'diagonal_pan' ? 'selected' : ''}>Diagonal Pan (Ken Burns bottom-left to top-right)</option>
                        <option value="beat_shake" ${img.effect === 'beat_shake' ? 'selected' : ''}>Beat Shake (Vibrates viewport on beat drops)</option>
                        <option value="audio_pulse" ${img.effect === 'audio_pulse' ? 'selected' : ''}>Audio Pulse (Continuous zoom pulses with music amplitude)</option>
                        <option value="glitch_pulse" ${img.effect === 'glitch_pulse' ? 'selected' : ''}>Glitch Pulse (Jitters coordinates on beat peaks)</option>
                        <option value="none" ${img.effect === 'none' ? 'selected' : ''}>Static (Centered still display)</option>
                    </select>
                </div>

                <!-- Transition Select (to next clip) -->
                <div class="inspector-group">
                    <label class="inspector-label">Transition (To Next Clip)</label>
                    <select id="inspect-transition" class="inspector-select" ${imgIdx === selectedImages.length - 1 ? 'disabled' : ''}>
                        <option value="none" ${img.transition === 'none' ? 'selected' : ''}>Cut (None - hard cut)</option>
                        <option value="crossfade" ${img.transition === 'crossfade' ? 'selected' : ''}>Crossfade (Blend - smooth dissolve)</option>
                        <option value="zoom_blend" ${img.transition === 'zoom_blend' ? 'selected' : ''}>Zoom Blend (Cinematic zoom dissolve)</option>
                        <option value="spin_blend" ${img.transition === 'spin_blend' ? 'selected' : ''}>Spin Blend (Clockwise rotational wipe)</option>
                        <option value="white_flash" ${img.transition === 'white_flash' ? 'selected' : ''}>White Flash (Bright flash overlay on cut)</option>
                        <option value="glitch_cut" ${img.transition === 'glitch_cut' ? 'selected' : ''}>Glitch Cut (High-speed chromatic aberration jitter)</option>
                        <option value="slide_left" ${img.transition === 'slide_left' ? 'selected' : ''}>Slide Left (Swipe next from right)</option>
                        <option value="slide_right" ${img.transition === 'slide_right' ? 'selected' : ''}>Slide Right (Swipe next from left)</option>
                        <option value="slide_up" ${img.transition === 'slide_up' ? 'selected' : ''}>Slide Up (Swipe next from bottom)</option>
                        <option value="slide_down" ${img.transition === 'slide_down' ? 'selected' : ''}>Slide Down (Swipe next from top)</option>
                        <option value="slide_diagonal" ${img.transition === 'slide_diagonal' ? 'selected' : ''}>Slide Diagonal (Swipe next from bottom-right)</option>
                        <option value="fade_black" ${img.transition === 'fade_black' ? 'selected' : ''}>Fade to Black (Dip through black canvas)</option>
                    </select>
                    ${imgIdx === selectedImages.length - 1 ? '<p style="font-size:0.7rem;color:var(--text-muted);margin-top:0.25rem;">Last image clip has no outgoing transition.</p>' : ''}
                </div>

                <!-- Divider & Project settings -->
                <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 1.5rem 0;">
                <h4 style="font-family: var(--font-heading); font-size: 0.9rem; margin-bottom: 1rem; color: var(--text-secondary); display: flex; align-items: center; gap: 0.4rem;">
                    <i data-lucide="settings" style="width:14px;height:14px;"></i> Project Output Settings
                </h4>

                <!-- Project Aspect Ratio Select -->
                <div class="inspector-group">
                    <label class="inspector-label">Global Aspect Ratio</label>
                    <select id="inspect-aspect-ratio" class="inspector-select">
                        <option value="16:9" ${checkedRatio === '16:9' ? 'selected' : ''}>Landscape (16:9)</option>
                        <option value="9:16" ${checkedRatio === '9:16' ? 'selected' : ''}>Portrait (9:16)</option>
                    </select>
                </div>

                <!-- Project Theme Select -->
                <div class="inspector-group">
                    <label class="inspector-label">Global Style Theme</label>
                    <select id="inspect-theme" class="inspector-select">
                        <option value="cinematic" ${checkedTheme === 'cinematic' ? 'selected' : ''}>Cinematic Style</option>
                        <option value="energetic" ${checkedTheme === 'energetic' ? 'selected' : ''}>Energetic Style</option>
                        <option value="vintage" ${checkedTheme === 'vintage' ? 'selected' : ''}>Vintage Style</option>
                    </select>
                </div>

                <!-- Apply Changes Button -->
                <div class="inspector-apply-container" style="margin-top: 2rem;">
                    <button class="primary-btn" id="btn-apply-changes">
                        <span class="btn-content">
                            <i data-lucide="refresh-cw"></i> Apply & Re-Render Video
                        </span>
                    </button>
                </div>
            `;

            lucide.createIcons();

            // Bind examples guide trigger
            const guideLink = document.getElementById("btn-guide-link");
            if (guideLink) {
                guideLink.addEventListener("click", (e) => {
                    e.stopPropagation();
                    helpModal.classList.remove("hidden");
                });
            }

            // Bind slider and inputs
            const durationSlider = document.getElementById("inspect-duration");
            const durationVal = document.getElementById("inspect-duration-val");
            durationSlider.addEventListener("input", (e) => {
                const val = parseFloat(e.target.value);
                img.duration = val;
                durationVal.textContent = `${val}s`;
                renderTimeline(); // Live timeline clip size adjustment
            });

            // Set initial preview CSS filter, motion effect, and transition animations
            const previewImageEl = document.getElementById("inspect-preview-image");
            const previewMotionEl = document.getElementById("inspect-preview-motion");

            function updatePreviewDecorations(imgFilter) {
                if (!previewImageEl) return;
                previewImageEl.classList.remove("decor-letterbox", "decor-cyberpunk", "decor-polaroid");
                if (imgFilter === "cinematic_letterbox") {
                    previewImageEl.classList.add("decor-letterbox");
                } else if (imgFilter === "cyberpunk_frame") {
                    previewImageEl.classList.add("decor-cyberpunk");
                } else if (imgFilter === "polaroid") {
                    previewImageEl.classList.add("decor-polaroid");
                }
            }

            if (previewImageEl) {
                previewImageEl.style.filter = getCssFilterString(img.filter);
                previewImageEl.className = `preview-image-content trans-preview-${img.transition}`;
                updatePreviewDecorations(img.filter);
            }
            if (previewMotionEl) {
                previewMotionEl.className = `preview-motion-wrapper motion-preview-${img.effect || 'zoom_in'}`;
            }

            const filterSelect = document.getElementById("inspect-filter");
            filterSelect.addEventListener("change", (e) => {
                img.filter = e.target.value;
                if (previewImageEl) {
                    previewImageEl.style.filter = getCssFilterString(e.target.value);
                    updatePreviewDecorations(e.target.value);
                }
            });

            const effectSelect = document.getElementById("inspect-effect");
            effectSelect.addEventListener("change", (e) => {
                img.effect = e.target.value;
                if (previewMotionEl) {
                    previewMotionEl.className = `preview-motion-wrapper motion-preview-${e.target.value}`;
                }
            });

            const transSelect = document.getElementById("inspect-transition");
            if (transSelect) {
                transSelect.addEventListener("change", (e) => {
                    img.transition = e.target.value;
                    if (previewImageEl) {
                        previewImageEl.className = `preview-image-content trans-preview-${e.target.value}`;
                    }
                    renderTimeline();
                });
            }

            // Bind Project settings selects
            const aspectSelect = document.getElementById("inspect-aspect-ratio");
            aspectSelect.addEventListener("change", (e) => {
                const radio = document.querySelector(`input[name="aspect-ratio"][value="${e.target.value}"]`);
                if (radio) {
                    radio.checked = true;
                    radio.dispatchEvent(new Event('change'));
                }
            });

            const themeSelect = document.getElementById("inspect-theme");
            themeSelect.addEventListener("change", (e) => {
                const radio = document.querySelector(`input[name="video-theme"][value="${e.target.value}"]`);
                if (radio) {
                    radio.checked = true;
                    radio.dispatchEvent(new Event('change'));
                }
            });

            const applyBtn = document.getElementById("btn-apply-changes");
            applyBtn.addEventListener("click", () => {
                if (selectedImages.length > 0 && selectedAudio) {
                    submitRenderJob();
                } else {
                    alert("Please ensure images and audio are loaded.");
                }
            });

        } else if (selectedElement.type === "audio") {
            // Highlight audio selection
            document.querySelectorAll(".timeline-image-clip").forEach(c => c.classList.remove("selected"));
            const audioClipEl = document.querySelector(".timeline-audio-clip");
            if (audioClipEl) audioClipEl.classList.add("selected");

            drawerContent.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; border-bottom:1px solid rgba(255,255,255,0.03); padding-bottom:0.75rem;">
                    <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Audio Options</span>
                    <button class="text-link-btn" id="btn-guide-link" style="background:none; border:none; color:var(--accent-blue); font-size:0.75rem; text-decoration:underline; cursor:pointer; display:flex; align-items:center; gap:0.25rem; padding:0;"><i data-lucide="help-circle" style="width:12px;height:12px;"></i> Examples Guide</button>
                </div>

                <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:1.5rem;display:flex;align-items:center;gap:0.5rem;overflow:hidden;text-overflow:ellipsis;">
                    <i data-lucide="music-4" style="color:var(--success);flex-shrink:0;"></i>
                    <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${selectedAudio.name}</span>
                </div>
                
                <!-- Start Offset Slider -->
                <div class="inspector-group">
                    <label class="inspector-label">Song Start Offset (seconds)</label>
                    <div class="slider-container">
                        <input type="range" id="inspect-audio-offset" min="0" max="60" step="1" value="${selectedAudioSettings.offset}" class="inspector-slider">
                        <span class="slider-value" id="inspect-audio-offset-val">${selectedAudioSettings.offset}s</span>
                    </div>
                    <p style="font-size:0.7rem;color:var(--text-muted);margin-top:0.25rem;">Select where in the song the background audio starts playing.</p>
                </div>

                <!-- Volume Slider -->
                <div class="inspector-group">
                    <label class="inspector-label">Volume Level</label>
                    <div class="slider-container">
                        <input type="range" id="inspect-audio-volume" min="0" max="100" step="5" value="${Math.round(selectedAudioSettings.volume * 100)}" class="inspector-slider">
                        <span class="slider-value" id="inspect-audio-volume-val">${Math.round(selectedAudioSettings.volume * 100)}%</span>
                    </div>
                </div>

                <!-- Divider & Project settings -->
                <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 1.5rem 0;">
                <h4 style="font-family: var(--font-heading); font-size: 0.9rem; margin-bottom: 1rem; color: var(--text-secondary); display: flex; align-items: center; gap: 0.4rem;">
                    <i data-lucide="settings" style="width:14px;height:14px;"></i> Project Output Settings
                </h4>

                <!-- Project Aspect Ratio Select -->
                <div class="inspector-group">
                    <label class="inspector-label">Global Aspect Ratio</label>
                    <select id="inspect-aspect-ratio" class="inspector-select">
                        <option value="16:9" ${checkedRatio === '16:9' ? 'selected' : ''}>Landscape (16:9)</option>
                        <option value="9:16" ${checkedRatio === '9:16' ? 'selected' : ''}>Portrait (9:16)</option>
                    </select>
                </div>

                <!-- Project Theme Select -->
                <div class="inspector-group">
                    <label class="inspector-label">Global Style Theme</label>
                    <select id="inspect-theme" class="inspector-select">
                        <option value="cinematic" ${checkedTheme === 'cinematic' ? 'selected' : ''}>Cinematic Style</option>
                        <option value="energetic" ${checkedTheme === 'energetic' ? 'selected' : ''}>Energetic Style</option>
                        <option value="vintage" ${checkedTheme === 'vintage' ? 'selected' : ''}>Vintage Style</option>
                    </select>
                </div>

                <!-- Apply Changes Button -->
                <div class="inspector-apply-container" style="margin-top: 2rem;">
                    <button class="primary-btn" id="btn-apply-changes">
                        <span class="btn-content">
                            <i data-lucide="refresh-cw"></i> Apply & Re-Render Video
                        </span>
                    </button>
                </div>
            `;

            lucide.createIcons();

            // Bind examples guide trigger
            const guideLink = document.getElementById("btn-guide-link");
            if (guideLink) {
                guideLink.addEventListener("click", (e) => {
                    e.stopPropagation();
                    helpModal.classList.remove("hidden");
                });
            }

            // Bind sliders
            const offsetSlider = document.getElementById("inspect-audio-offset");
            const offsetVal = document.getElementById("inspect-audio-offset-val");
            offsetSlider.addEventListener("input", (e) => {
                const val = parseInt(e.target.value);
                selectedAudioSettings.offset = val;
                offsetVal.textContent = `${val}s`;
            });

            const volumeSlider = document.getElementById("inspect-audio-volume");
            const volumeVal = document.getElementById("inspect-audio-volume-val");
            volumeSlider.addEventListener("input", (e) => {
                const val = parseInt(e.target.value);
                selectedAudioSettings.volume = val / 100;
                volumeVal.textContent = `${val}%`;
            });

            // Bind Project settings selects
            const aspectSelect = document.getElementById("inspect-aspect-ratio");
            aspectSelect.addEventListener("change", (e) => {
                const radio = document.querySelector(`input[name="aspect-ratio"][value="${e.target.value}"]`);
                if (radio) {
                    radio.checked = true;
                    radio.dispatchEvent(new Event('change'));
                }
            });

            const themeSelect = document.getElementById("inspect-theme");
            themeSelect.addEventListener("change", (e) => {
                const radio = document.querySelector(`input[name="video-theme"][value="${e.target.value}"]`);
                if (radio) {
                    radio.checked = true;
                    radio.dispatchEvent(new Event('change'));
                }
            });

            const applyBtn = document.getElementById("btn-apply-changes");
            applyBtn.addEventListener("click", () => {
                if (selectedImages.length > 0 && selectedAudio) {
                    submitRenderJob();
                } else {
                    alert("Please ensure images and audio are loaded.");
                }
            });
        }
    }

    // ==========================================================================
    // API Video Generation & Polling
    // ==========================================================================

    btnGenerate.addEventListener("click", () => {
        if (selectedImages.length === 0 || !selectedAudio) return;
        submitRenderJob();
    });

    async function submitRenderJob() {
        // UI Visual states during upload
        playerPlaceholder.classList.add("hidden");
        videoPlayer.classList.add("hidden");
        exportActions.classList.add("hidden");
        playerLoader.classList.remove("hidden");

        setLoaderState("Uploading Assets...", "Uploading photos and background music to backend server.", 15);

        // Prep Multi-part form
        const formData = new FormData();
        selectedImages.forEach(img => {
            formData.append("images", img.file);
        });
        formData.append("audio", selectedAudio);

        const checkedRatio = document.querySelector('input[name="aspect-ratio"]:checked').value;
        const checkedTheme = document.querySelector('input[name="video-theme"]:checked').value;
        
        formData.append("aspect_ratio", checkedRatio);
        formData.append("theme", checkedTheme);

        // Package the dynamic timeline configuration
        const timelineData = {
            images: selectedImages.map((img, idx) => ({
                index: idx,
                duration: img.duration,
                filter: img.filter,
                effect: img.effect || "zoom_in",
                transition: img.transition
            })),
            audio: {
                volume: selectedAudioSettings.volume,
                offset: selectedAudioSettings.offset
            }
        };
        formData.append("timeline_data", JSON.stringify(timelineData));

        try {
            const response = await fetch("/api/generate", {
                method: "POST",
                body: formData
            });


            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Server failed to queue the video job.");
            }

            const data = await response.json();
            activeJobId = data.job_id;
            
            // Start Polling API for completion status
            setLoaderState("Processing Audio...", "Analyzing audio beat markers with AI agent.", 35);
            pollInterval = setInterval(pollJobProgress, 1800);

        } catch (error) {
            console.error("Submission error:", error);
            showRenderError(error.message);
        }
    }

    async function pollJobProgress() {
        if (!activeJobId) return;

        try {
            const res = await fetch(`/api/status/${activeJobId}`);
            if (!res.ok) throw new Error("Could not fetch rendering status.");

            const job = await res.json();

            if (job.status === "rendering") {
                setLoaderState("Applying VFX & Filters...", "Adding Ken Burns pan-zoom motion and transition overlays.", 60);
            } else if (job.status === "completed") {
                // Done! Clean interval and display
                clearInterval(pollInterval);
                activeJobId = null;
                showRenderedVideo(job.video_url);
            } else if (job.status === "failed") {
                clearInterval(pollInterval);
                activeJobId = null;
                showRenderError(job.error || "Video processing engine crashed.");
            }

        } catch (err) {
            console.error("Polling error:", err);
            // Don't clear interval immediately on minor fetch errors, allow retry.
        }
    }

    function setLoaderState(title, desc, percentage) {
        loaderTitle.textContent = title;
        loaderDesc.textContent = desc;
        loaderProgress.style.width = `${percentage}%`;
        loaderPercent.textContent = `${percentage}%`;
    }

    function showRenderedVideo(videoUrl) {
        playerLoader.classList.add("hidden");
        videoPlayer.classList.remove("hidden");
        exportActions.classList.remove("hidden");

        // Load new video URL
        videoPlayer.src = videoUrl;
        videoPlayer.load();
        videoPlayer.play().catch(e => {
            console.log("Auto-play blocked by browser. User must click play.", e);
        });

        // Set download button href
        btnDownload.href = videoUrl;
    }

    function showRenderError(message) {
        clearInterval(pollInterval);
        activeJobId = null;

        playerLoader.classList.add("hidden");
        playerPlaceholder.classList.remove("hidden");
        exportActions.classList.add("hidden");

        alert(`Render Failed: ${message}`);
    }

    // Playback sync with Timeline
    let isPlaying = false;
    btnTimelinePlay.addEventListener("click", () => {
        if (videoPlayer.src) {
            if (isPlaying) {
                videoPlayer.pause();
            } else {
                videoPlayer.play();
            }
        }
    });

    videoPlayer.addEventListener("play", () => {
        isPlaying = true;
        btnTimelinePlay.innerHTML = `<i data-lucide="pause"></i>`;
        lucide.createIcons();
    });

    videoPlayer.addEventListener("pause", () => {
        isPlaying = false;
        btnTimelinePlay.innerHTML = `<i data-lucide="play"></i>`;
        lucide.createIcons();
    });

    videoPlayer.addEventListener("timeupdate", () => {
        const current = videoPlayer.currentTime;
        const total = videoPlayer.duration || 0;
        timelineTimeLabel.textContent = `${formatTime(current)} / ${formatTime(total)}`;
    });

    // Helper function to map python backend filters to equivalent real-time CSS filters
    function getCssFilterString(filterType) {
        switch (filterType) {
            case "cinematic":
            case "cinematic_letterbox":
                return "contrast(1.15) saturate(1.1) hue-rotate(-12deg) sepia(0.12)";
            case "energetic":
                return "contrast(1.25) saturate(1.4)";
            case "vintage":
            case "vintage_grain":
                return "contrast(0.9) saturate(0.85) sepia(0.28) hue-rotate(6deg)";
            case "grayscale":
                return "grayscale(100%) contrast(1.35) brightness(0.95)";
            case "cyberpunk":
            case "cyberpunk_frame":
                return "contrast(1.2) saturate(1.55) hue-rotate(140deg)";
            case "dreamy":
                return "blur(1.5px) contrast(1.05) saturate(1.1) brightness(1.05)";
            case "sunset":
                return "sepia(0.38) saturate(1.35) contrast(1.1) hue-rotate(-6deg)";
            case "cool_pine":
                return "contrast(1.1) saturate(0.75) hue-rotate(25deg) sepia(0.08)";
            case "polaroid":
                return "contrast(1.15) saturate(0.9) sepia(0.25) brightness(1.08)";
            case "vaporwave":
                return "contrast(1.2) saturate(1.4) hue-rotate(280deg)";
            default:
                return "none";
        }
    }
});
