/* ==========================================================================
   AuraCut JavaScript Controller
   Interactions, Timeline Rendering, API Integrations & Job Polling
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {

    // Initialise Lucide Icons
    lucide.createIcons();

    // ========================================================================
    // APP STATE
    // ========================================================================

    let selectedImages = [];
    let selectedAudio = null;

    let selectedAudioSettings = {
        volume: 1.0,
        offset: 0.0
    };

    let selectedElement = null;
    let audioDuration = 0;
    let activeJobId = null;
    let pollInterval = null;


    // ========================================================================
    // DOM ELEMENTS - INPUTS & UPLOADS
    // ========================================================================

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


    // ========================================================================
    // DOM ELEMENTS - SETTINGS
    // ========================================================================

    const ratioCards = document.querySelectorAll(".ratio-card");
    const themeCards = document.querySelectorAll(".theme-card");
    const btnGenerate = document.getElementById("btn-generate");


    // ========================================================================
    // DOM ELEMENTS - PLAYER & STATUS
    // ========================================================================

    const playerPlaceholder =
        document.getElementById("player-placeholder");

    const playerLoader =
        document.getElementById("player-loader");

    const videoPlayer =
        document.getElementById("video-player");

    const exportActions =
        document.getElementById("export-actions");

    const btnDownload =
        document.getElementById("btn-download");

    const loaderTitle =
        document.getElementById("loader-title");

    const loaderDesc =
        document.getElementById("loader-desc");

    const loaderProgress =
        document.getElementById("loader-progress");

    const loaderPercent =
        document.getElementById("loader-percent");

    const apiStatusText =
        document.querySelector("#api-status .status-text");

    const apiStatusContainer =
        document.getElementById("api-status");


    // ========================================================================
    // DOM ELEMENTS - TIMELINE
    // ========================================================================

    const timelineDurationLabel =
        document.getElementById("timeline-duration");

    const timelineTimeLabel =
        document.getElementById("timeline-time");

    const videoTrackClips =
        document.getElementById("video-track-clips");

    const transitionTrackMarkers =
        document.getElementById("transition-track-markers");

    const audioTrackClip =
        document.getElementById("audio-track-clip");

    const btnTimelinePlay =
        document.getElementById("timeline-btn-play");

    const timelineRuler =
        document.getElementById("timeline-ruler");


    // ========================================================================
    // DOM ELEMENTS - INSPECTOR
    // ========================================================================

    const inspectorDrawer =
        document.getElementById("inspector-drawer");

    const drawerContent =
        document.getElementById("drawer-content");

    const btnCloseDrawer =
        document.getElementById("btn-close-drawer");


    // ========================================================================
    // HELP MODAL
    // ========================================================================

    const helpModal =
        document.getElementById("help-modal");

    const btnHelp =
        document.getElementById("btn-help");

    const btnCloseModal =
        document.getElementById("btn-close-modal");


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


    // ========================================================================
    // BACKEND HEALTH
    // ========================================================================

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


    // ========================================================================
    // FILE UPLOAD HANDLERS
    // ========================================================================

    setupDragAndDrop(
        imagesDropzone,
        (files) => {
            handleImages(files);
        }
    );


    imagesInput.addEventListener("change", (e) => {
        handleImages(e.target.files);
    });


    setupDragAndDrop(
        audioDropzone,
        (files) => {

            if (files.length > 0) {
                handleAudio(files[0]);
            }

        }
    );


    audioInput.addEventListener("change", (e) => {

        if (e.target.files.length > 0) {
            handleAudio(e.target.files[0]);
        }

    });


    btnRemoveAudio.addEventListener("click", () => {

        selectedAudio = null;
        audioDuration = 0;

        audioInput.value = "";

        updateUI();
    });


    function setupDragAndDrop(
        dropzone,
        onFilesDropped
    ) {

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

            const input =
                dropzone.querySelector(".file-input");

            if (input) {
                input.click();
            }

        });
    }


    // ========================================================================
    // DEFAULT VFX
    // ========================================================================

    function getVariedVfxAndTransition(index) {

        const motions = [
            "zoom_in",
            "pan_left",
            "slow_spin",
            "zoom_out",
            "pan_right",
            "diagonal_pan",
            "tilt_up",
            "tilt_down"
        ];

        const transitions = [
            "crossfade",
            "slide_left",
            "slide_diagonal",
            "crossfade",
            "slide_right",
            "fade_black",
            "slide_up",
            "slide_down"
        ];

        const filters = [
            "none",
            "cinematic",
            "cool_pine",
            "none",
            "vintage",
            "polaroid",
            "none",
            "sunset",
            "vaporwave"
        ];

        return {
            effect: motions[index % motions.length],
            transition: transitions[index % transitions.length],
            filter: filters[index % filters.length]
        };
    }


    // ========================================================================
    // HANDLE IMAGES + VIDEOS
    // ========================================================================

    function handleImages(files) {

        const validFiles =
            Array.from(files).filter(
                file =>
                    file.type.startsWith("image/") ||
                    file.type.startsWith("video/")
            );


        if (validFiles.length === 0) {

            alert(
                "Please select image or video files."
            );

            return;
        }


        validFiles.forEach(file => {

            const isVideo =
                file.type.startsWith("video/");


            const vfx =
                getVariedVfxAndTransition(
                    selectedImages.length
                );


            const media = {

                file: file,

                id:
                    (isVideo ? "vid_" : "img_") +
                    Date.now() +
                    "_" +
                    Math.random()
                        .toString(36)
                        .substring(2, 8),

                type:
                    isVideo
                        ? "video"
                        : "image",

                duration:
                    isVideo
                        ? 5
                        : 3.5,

                filter:
                    isVideo
                        ? "none"
                        : vfx.filter,

                effect:
                    isVideo
                        ? "none"
                        : vfx.effect,

                transition:
                    vfx.transition
            };


            selectedImages.push(media);


            // ================================================================
            // VIDEO METADATA
            // ================================================================

            if (isVideo) {

                const video =
                    document.createElement("video");

                video.preload = "metadata";


                video.onloadedmetadata = () => {

                    if (
                        video.duration &&
                        isFinite(video.duration)
                    ) {

                        media.duration =
                            Math.min(
                                video.duration,
                                60
                            );

                        updateUI();
                    }


                    URL.revokeObjectURL(
                        video.src
                    );
                };


                video.src =
                    URL.createObjectURL(
                        file
                    );
            }

        });


        updateUI();
    }


    // ========================================================================
    // HANDLE AUDIO
    // ========================================================================

    function handleAudio(file) {

        if (!file.type.startsWith("audio/")) {

            alert(
                "Please upload a valid audio file."
            );

            return;
        }


        selectedAudio = file;


        selectedAudioSettings.volume = 1.0;
        selectedAudioSettings.offset = 0.0;


        const sizeMB =
            (
                file.size /
                (1024 * 1024)
            ).toFixed(1);


        audioName.textContent =
            file.name;

        audioSize.textContent =
            `${sizeMB} MB`;


        const audioUrl =
            URL.createObjectURL(file);

        const tempAudio =
            new Audio(audioUrl);


        tempAudio.addEventListener(
            "loadedmetadata",
            () => {

                audioDuration =
                    tempAudio.duration;

                updateUI();

            }
        );
    }


    // ========================================================================
    // OPTION CARD SELECTION
    // ========================================================================

    const ratioInputs =
        document.querySelectorAll(
            'input[name="aspect-ratio"]'
        );


    ratioInputs.forEach(input => {

        input.addEventListener(
            "change",
            () => {

                ratioCards.forEach(
                    c =>
                        c.classList.remove(
                            "active"
                        )
                );


                input
                    .closest(".ratio-card")
                    .classList.add(
                        "active"
                    );


                const drawerSelect =
                    document.getElementById(
                        "inspect-aspect-ratio"
                    );


                if (drawerSelect) {
                    drawerSelect.value =
                        input.value;
                }
            }
        );
    });


    const themeInputs =
        document.querySelectorAll(
            'input[name="video-theme"]'
        );


    themeInputs.forEach(input => {

        input.addEventListener(
            "change",
            () => {

                themeCards.forEach(
                    c =>
                        c.classList.remove(
                            "active"
                        )
                );


                input
                    .closest(".theme-card")
                    .classList.add(
                        "active"
                    );


                const drawerSelect =
                    document.getElementById(
                        "inspect-theme"
                    );


                if (drawerSelect) {
                    drawerSelect.value =
                        input.value;
                }
            }
        );
    });


    // ========================================================================
    // FORMAT TIME
    // ========================================================================

    function formatTime(seconds) {

        const mins =
            Math.floor(
                seconds / 60
            );

        const secs =
            Math.floor(
                seconds % 60
            );


        return (
            mins
                .toString()
                .padStart(2, "0") +
            ":" +
            secs
                .toString()
                .padStart(2, "0")
        );
    }


    // ========================================================================
    // RENDER TIMELINE
    // ========================================================================

    function renderTimeline() {

        videoTrackClips.innerHTML = "";
        transitionTrackMarkers.innerHTML = "";
        audioTrackClip.innerHTML = "";
        timelineRuler.innerHTML = "";


        if (
            selectedImages.length === 0 &&
            !selectedAudio
        ) {

            videoTrackClips.innerHTML =
                `<div class="timeline-empty-message">
                    No clips uploaded. Drop images or videos above.
                </div>`;


            audioTrackClip.innerHTML =
                `<div class="timeline-empty-message">
                    No audio track imported.
                </div>`;


            timelineDurationLabel.textContent =
                "00:00";

            timelineTimeLabel.textContent =
                "00:00 / 00:00";

            btnTimelinePlay.setAttribute(
                "disabled",
                "true"
            );

            return;
        }


        btnTimelinePlay.removeAttribute(
            "disabled"
        );


        // ================================================================
        // PROJECT DURATION
        // ================================================================

        let projectDuration =
            selectedImages.reduce(
                (sum, media) =>
                    sum +
                    Number(
                        media.duration || 0
                    ),
                0
            );


        if (
            selectedAudio &&
            audioDuration > 0 &&
            projectDuration === 0
        ) {

            projectDuration =
                audioDuration;
        }


        projectDuration =
            Math.max(
                projectDuration,
                0.1
            );


        timelineDurationLabel.textContent =
            formatTime(projectDuration);


        timelineTimeLabel.textContent =
            `00:00 / ${formatTime(projectDuration)}`;


        // ================================================================
        // RULER
        // ================================================================

        const timelineWidth =
            Math.max(
                800,
                projectDuration * 25
            );


        timelineRuler.style.width =
            `${timelineWidth}px`;


        const tickInterval = 5;


        for (
            let i = 0;
            i <= projectDuration;
            i += tickInterval
        ) {

            const leftPercent =
                (
                    i /
                    projectDuration
                ) * 100;


            const tick =
                document.createElement(
                    "div"
                );

            tick.className =
                "ruler-tick major";

            tick.style.left =
                `${leftPercent}%`;


            const label =
                document.createElement(
                    "div"
                );

            label.className =
                "ruler-tick-label";

            label.style.left =
                `${leftPercent}%`;

            label.textContent =
                formatTime(i);


            timelineRuler.appendChild(
                tick
            );

            timelineRuler.appendChild(
                label
            );
        }


        // ================================================================
        // MIXED MEDIA TRACK
        // ================================================================

        if (selectedImages.length > 0) {

            const clipContainer =
                document.createElement(
                    "div"
                );

            clipContainer.className =
                "timeline-clip-container";

            clipContainer.style.width =
                `${timelineWidth}px`;


            selectedImages.forEach(
                (media, idx) => {

                    const duration =
                        Number(
                            media.duration || 0
                        );


                    const clipWidthPercent =
                        (
                            duration /
                            projectDuration
                        ) * 100;


                    const clip =
                        document.createElement(
                            "div"
                        );


                    clip.className =
                        "timeline-image-clip";


                    if (
                        selectedElement &&
                        selectedElement.index === idx &&
                        (
                            selectedElement.type === "image" ||
                            selectedElement.type === "video"
                        )
                    ) {

                        clip.classList.add(
                            "selected"
                        );
                    }


                    clip.style.width =
                        `calc(${clipWidthPercent}% - 4px)`;

                    clip.style.cursor =
                        "pointer";

                    clip.style.position =
                        "relative";

                    clip.style.overflow =
                        "hidden";


                    const objectUrl =
                        URL.createObjectURL(
                            media.file
                        );


                    // ========================================================
                    // VIDEO THUMBNAIL
                    // ========================================================

                    if (
                        media.type === "video"
                    ) {

                        const video =
                            document.createElement(
                                "video"
                            );


                        video.src =
                            objectUrl;

                        video.muted = true;
                        video.playsInline = true;
                        video.preload = "metadata";


                        video.style.width =
                            "100%";

                        video.style.height =
                            "100%";

                        video.style.objectFit =
                            "cover";

                        video.style.pointerEvents =
                            "none";


                        clip.appendChild(
                            video
                        );


                        const badge =
                            document.createElement(
                                "div"
                            );


                        badge.className =
                            "media-type-badge";


                        badge.innerHTML =
                            `<i data-lucide="play"></i>`;


                        badge.style.position =
                            "absolute";

                        badge.style.left =
                            "6px";

                        badge.style.top =
                            "6px";

                        badge.style.zIndex =
                            "5";


                        clip.appendChild(
                            badge
                        );

                    }


                    // ========================================================
                    // IMAGE THUMBNAIL
                    // ========================================================

                    else {

                        clip.style.backgroundImage =
                            `url("${objectUrl}")`;

                        clip.style.backgroundSize =
                            "cover";

                        clip.style.backgroundPosition =
                            "center";


                        const badge =
                            document.createElement(
                                "div"
                            );


                        badge.className =
                            "media-type-badge";


                        badge.innerHTML =
                            `<i data-lucide="image"></i>`;


                        badge.style.position =
                            "absolute";

                        badge.style.left =
                            "6px";

                        badge.style.top =
                            "6px";

                        badge.style.zIndex =
                            "5";


                        clip.appendChild(
                            badge
                        );
                    }


                    // ========================================================
                    // CLIP NUMBER
                    // ========================================================

                    const idxLabel =
                        document.createElement(
                            "span"
                        );


                    idxLabel.className =
                        "timeline-image-clip-idx";

                    idxLabel.textContent =
                        idx + 1;


                    clip.appendChild(
                        idxLabel
                    );


                    // ========================================================
                    // TYPE LABEL
                    // ========================================================

                    const typeLabel =
                        document.createElement(
                            "span"
                        );


                    typeLabel.style.position =
                        "absolute";

                    typeLabel.style.left =
                        "6px";

                    typeLabel.style.bottom =
                        "5px";

                    typeLabel.style.zIndex =
                        "5";

                    typeLabel.style.fontSize =
                        "10px";

                    typeLabel.style.background =
                        "rgba(0,0,0,0.65)";

                    typeLabel.style.padding =
                        "2px 5px";

                    typeLabel.style.borderRadius =
                        "4px";

                    typeLabel.textContent =
                        media.type === "video"
                            ? "VIDEO"
                            : "IMAGE";


                    clip.appendChild(
                        typeLabel
                    );


                    // ========================================================
                    // DURATION
                    // ========================================================

                    const durationLabel =
                        document.createElement(
                            "span"
                        );


                    durationLabel.className =
                        "timeline-clip-duration";

                    durationLabel.textContent =
                        formatTime(duration);


                    durationLabel.style.position =
                        "absolute";

                    durationLabel.style.right =
                        "6px";

                    durationLabel.style.bottom =
                        "5px";

                    durationLabel.style.zIndex =
                        "5";


                    clip.appendChild(
                        durationLabel
                    );


                    // ========================================================
                    // SELECT CLIP
                    // ========================================================

                    clip.addEventListener(
                        "click",
                        (e) => {

                            e.stopPropagation();


                            openInspector({
                                type:
                                    media.type ||
                                    "image",

                                index:
                                    idx
                            });
                        }
                    );


                    clipContainer.appendChild(
                        clip
                    );


                    setTimeout(
                        () => {
                            URL.revokeObjectURL(
                                objectUrl
                            );
                        },
                        10000
                    );
                }
            );


            videoTrackClips.appendChild(
                clipContainer
            );


            // ================================================================
            // TRANSITION MARKERS
            // ================================================================

            const transContainer =
                document.createElement(
                    "div"
                );


            transContainer.className =
                "timeline-transition-container";


            transContainer.style.width =
                `${timelineWidth}px`;


            // Starting marker
            const startTrans =
                document.createElement(
                    "div"
                );


            startTrans.className =
                "timeline-trans-marker";


            startTrans.innerHTML =
                `<i data-lucide="plus"></i>`;


            startTrans.style.position =
                "absolute";

            startTrans.style.left =
                "calc(0% - 9px)";

            startTrans.style.top =
                "3px";


            startTrans.addEventListener(
                "click",
                (e) => {

                    e.stopPropagation();


                    openInspector({
                        type:
                            selectedImages[0].type ||
                            "image",

                        index: 0
                    });
                }
            );


            transContainer.appendChild(
                startTrans
            );


            // Intermediate markers
            let accumulatedDuration = 0;


            for (
                let i = 0;
                i < selectedImages.length - 1;
                i++
            ) {

                accumulatedDuration +=
                    Number(
                        selectedImages[i].duration ||
                        0
                    );


                const leftPercent =
                    (
                        accumulatedDuration /
                        projectDuration
                    ) * 100;


                const trans =
                    document.createElement(
                        "div"
                    );


                trans.className =
                    "timeline-trans-marker";


                trans.innerHTML =
                    `<i data-lucide="plus"></i>`;


                trans.style.position =
                    "absolute";


                trans.style.left =
                    `calc(${leftPercent}% - 9px)`;


                trans.style.top =
                    "3px";


                const index = i;


                trans.addEventListener(
                    "click",
                    (e) => {

                        e.stopPropagation();


                        openInspector({
                            type:
                                selectedImages[index].type ||
                                "image",

                            index:
                                index
                        });
                    }
                );


                transContainer.appendChild(
                    trans
                );
            }


            // Ending marker
            const lastIndex =
                selectedImages.length - 1;


            const endTrans =
                document.createElement(
                    "div"
                );


            endTrans.className =
                "timeline-trans-marker";


            endTrans.innerHTML =
                `<i data-lucide="plus"></i>`;


            endTrans.style.position =
                "absolute";


            endTrans.style.left =
                "calc(100% - 9px)";


            endTrans.style.top =
                "3px";


            endTrans.addEventListener(
                "click",
                (e) => {

                    e.stopPropagation();


                    openInspector({
                        type:
                            selectedImages[lastIndex].type ||
                            "image",

                        index:
                            lastIndex
                    });
                }
            );


            transContainer.appendChild(
                endTrans
            );


            transitionTrackMarkers.appendChild(
                transContainer
            );

        } else {

            videoTrackClips.innerHTML =
                `<div class="timeline-empty-message">
                    No video clips.
                </div>`;
        }


        // ================================================================
        // AUDIO TRACK
        // ================================================================

        if (selectedAudio) {

            const audioClip =
                document.createElement(
                    "div"
                );


            audioClip.className =
                "timeline-audio-clip";


            if (
                selectedElement &&
                selectedElement.type === "audio"
            ) {

                audioClip.classList.add(
                    "selected"
                );
            }


            audioClip.style.width =
                `${timelineWidth}px`;

            audioClip.style.cursor =
                "pointer";


            audioClip.innerHTML = `
                <i data-lucide="music-2"></i>
                <span class="timeline-audio-clip-name">
                    ${selectedAudio.name}
                </span>
            `;


            audioClip.addEventListener(
                "click",
                (e) => {

                    e.stopPropagation();


                    openInspector({
                        type: "audio"
                    });
                }
            );


            audioTrackClip.appendChild(
                audioClip
            );

        } else {

            audioTrackClip.innerHTML =
                `<div class="timeline-empty-message">
                    No audio track.
                </div>`;
        }


        if (
            typeof lucide !== "undefined"
        ) {

            lucide.createIcons();
        }
    }


    // ========================================================================
    // INSPECTOR
    // ========================================================================

    btnCloseDrawer.addEventListener(
        "click",
        () => {
            closeInspector();
        }
    );


    document.addEventListener(
        "click",
        (e) => {

            if (
                e.target &&
                !document.body.contains(
                    e.target
                )
            ) {
                return;
            }


            if (
                inspectorDrawer &&
                !inspectorDrawer.contains(
                    e.target
                ) &&
                !e.target.closest(
                    ".timeline-image-clip"
                ) &&
                !e.target.closest(
                    ".timeline-audio-clip"
                ) &&
                !e.target.closest(
                    ".timeline-trans-marker"
                )
            ) {

                closeInspector();
            }
        }
    );


    function closeInspector() {

        inspectorDrawer.classList.add(
            "hidden"
        );

        selectedElement = null;


        document
            .querySelectorAll(
                ".timeline-image-clip, .timeline-audio-clip"
            )
            .forEach(c => {
                c.classList.remove(
                    "selected"
                );
            });
    }


    function openInspector(element) {

        selectedElement = element;

        inspectorDrawer.classList.remove(
            "hidden"
        );

        renderInspector();
    }


    // ========================================================================
    // RENDER INSPECTOR
    // ========================================================================

    function renderInspector() {

        drawerContent.innerHTML = "";


        if (!selectedElement) {
            return;
        }


        const checkedRatio =
            document.querySelector(
                'input[name="aspect-ratio"]:checked'
            ).value;


        const checkedTheme =
            document.querySelector(
                'input[name="video-theme"]:checked'
            ).value;


        // ====================================================================
        // IMAGE INSPECTOR
        // ====================================================================

        if (
            selectedElement.type === "image"
        ) {

            const imgIdx =
                selectedElement.index;


            const img =
                selectedImages[imgIdx];


            if (!img) {
                return;
            }


            document
                .querySelectorAll(
                    ".timeline-image-clip"
                )
                .forEach(
                    (c, idx) => {

                        if (idx === imgIdx) {
                            c.classList.add(
                                "selected"
                            );
                        } else {
                            c.classList.remove(
                                "selected"
                            );
                        }
                    }
                );


            document
                .querySelectorAll(
                    ".timeline-audio-clip"
                )
                .forEach(
                    c =>
                        c.classList.remove(
                            "selected"
                        )
                );


            const imgUrl =
                URL.createObjectURL(
                    img.file
                );


            drawerContent.innerHTML = `

                <div style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    margin-bottom:1.25rem;
                    border-bottom:1px solid rgba(255,255,255,0.03);
                    padding-bottom:0.75rem;
                ">

                    <span style="
                        font-size:0.75rem;
                        color:var(--text-muted);
                        font-weight:600;
                        text-transform:uppercase;
                        letter-spacing:0.5px;
                    ">
                        Image Clip Customization
                    </span>

                    <button
                        class="text-link-btn"
                        id="btn-guide-link"
                        style="
                            background:none;
                            border:none;
                            color:var(--accent-blue);
                            font-size:0.75rem;
                            text-decoration:underline;
                            cursor:pointer;
                            display:flex;
                            align-items:center;
                            gap:0.25rem;
                            padding:0;
                        "
                    >
                        <i
                            data-lucide="help-circle"
                            style="width:12px;height:12px;"
                        ></i>
                        Examples Guide
                    </button>

                </div>


                <div class="inspector-thumb-preview">

                    <div
                        class="preview-motion-wrapper"
                        id="inspect-preview-motion"
                    >

                        <div
                            class="preview-image-content"
                            id="inspect-preview-image"
                            style="background-image:url('${imgUrl}')"
                        ></div>

                    </div>

                </div>


                <div class="inspector-group">

                    <label class="inspector-label">
                        Slide Duration (seconds)
                    </label>

                    <div class="slider-container">

                        <input
                            type="range"
                            id="inspect-duration"
                            min="1.0"
                            max="8.0"
                            step="0.5"
                            value="${img.duration}"
                            class="inspector-slider"
                        >

                        <span
                            class="slider-value"
                            id="inspect-duration-val"
                        >
                            ${img.duration}s
                        </span>

                    </div>

                </div>


                <div class="inspector-group">

                    <label class="inspector-label">
                        Color Filter
                    </label>

                    <select
                        id="inspect-filter"
                        class="inspector-select"
                    >

                        <option value="none"
                            ${img.filter === "none" ? "selected" : ""}>
                            Original (No Filter)
                        </option>

                        <option value="cinematic"
                            ${img.filter === "cinematic" ? "selected" : ""}>
                            Cinematic Cool
                        </option>

                        <option value="cinematic_letterbox"
                            ${img.filter === "cinematic_letterbox" ? "selected" : ""}>
                            Cinematic Letterbox
                        </option>

                        <option value="energetic"
                            ${img.filter === "energetic" ? "selected" : ""}>
                            Energetic Vivid
                        </option>

                        <option value="vintage"
                            ${img.filter === "vintage" ? "selected" : ""}>
                            Vintage Warm
                        </option>

                        <option value="vintage_grain"
                            ${img.filter === "vintage_grain" ? "selected" : ""}>
                            Vintage Grain
                        </option>

                        <option value="grayscale"
                            ${img.filter === "grayscale" ? "selected" : ""}>
                            Noir High-Contrast
                        </option>

                        <option value="cyberpunk"
                            ${img.filter === "cyberpunk" ? "selected" : ""}>
                            Cyberpunk Neon
                        </option>

                        <option value="cyberpunk_frame"
                            ${img.filter === "cyberpunk_frame" ? "selected" : ""}>
                            Cyberpunk Border
                        </option>

                        <option value="dreamy"
                            ${img.filter === "dreamy" ? "selected" : ""}>
                            Dreamy Bloom
                        </option>

                        <option value="sunset"
                            ${img.filter === "sunset" ? "selected" : ""}>
                            Golden Sunset
                        </option>

                        <option value="cool_pine"
                            ${img.filter === "cool_pine" ? "selected" : ""}>
                            Cool Pine
                        </option>

                        <option value="polaroid"
                            ${img.filter === "polaroid" ? "selected" : ""}>
                            Retro Polaroid
                        </option>

                        <option value="vaporwave"
                            ${img.filter === "vaporwave" ? "selected" : ""}>
                            Vaporwave Dream
                        </option>

                    </select>

                </div>


                <div class="inspector-group">

                    <label class="inspector-label">
                        Motion / VFX Effect
                    </label>

                    <select
                        id="inspect-effect"
                        class="inspector-select"
                    >

                        <option value="zoom_in"
                            ${img.effect === "zoom_in" ? "selected" : ""}>
                            Slow Zoom In
                        </option>

                        <option value="zoom_out"
                            ${img.effect === "zoom_out" ? "selected" : ""}>
                            Slow Zoom Out
                        </option>

                        <option value="pan_left"
                            ${img.effect === "pan_left" ? "selected" : ""}>
                            Pan Left-to-Right
                        </option>

                        <option value="pan_right"
                            ${img.effect === "pan_right" ? "selected" : ""}>
                            Pan Right-to-Left
                        </option>

                        <option value="tilt_up"
                            ${img.effect === "tilt_up" ? "selected" : ""}>
                            Tilt Upwards
                        </option>

                        <option value="tilt_down"
                            ${img.effect === "tilt_down" ? "selected" : ""}>
                            Tilt Downwards
                        </option>

                        <option value="slow_spin"
                            ${img.effect === "slow_spin" ? "selected" : ""}>
                            Slow Spin
                        </option>

                        <option value="diagonal_pan"
                            ${img.effect === "diagonal_pan" ? "selected" : ""}>
                            Diagonal Pan
                        </option>

                        <option value="beat_shake"
                            ${img.effect === "beat_shake" ? "selected" : ""}>
                            Beat Shake
                        </option>

                        <option value="audio_pulse"
                            ${img.effect === "audio_pulse" ? "selected" : ""}>
                            Audio Pulse
                        </option>

                        <option value="glitch_pulse"
                            ${img.effect === "glitch_pulse" ? "selected" : ""}>
                            Glitch Pulse
                        </option>

                        <option value="none"
                            ${img.effect === "none" ? "selected" : ""}>
                            Static
                        </option>

                    </select>

                </div>


                <div class="inspector-group">

                    <label class="inspector-label">
                        Transition (To Next Clip)
                    </label>

                    <select
                        id="inspect-transition"
                        class="inspector-select"
                        ${imgIdx === selectedImages.length - 1 ? "disabled" : ""}
                    >

                        <option value="none"
                            ${img.transition === "none" ? "selected" : ""}>
                            Cut
                        </option>

                        <option value="crossfade"
                            ${img.transition === "crossfade" ? "selected" : ""}>
                            Crossfade
                        </option>

                        <option value="zoom_blend"
                            ${img.transition === "zoom_blend" ? "selected" : ""}>
                            Zoom Blend
                        </option>

                        <option value="spin_blend"
                            ${img.transition === "spin_blend" ? "selected" : ""}>
                            Spin Blend
                        </option>

                        <option value="white_flash"
                            ${img.transition === "white_flash" ? "selected" : ""}>
                            White Flash
                        </option>

                        <option value="glitch_cut"
                            ${img.transition === "glitch_cut" ? "selected" : ""}>
                            Glitch Cut
                        </option>

                        <option value="slide_left"
                            ${img.transition === "slide_left" ? "selected" : ""}>
                            Slide Left
                        </option>

                        <option value="slide_right"
                            ${img.transition === "slide_right" ? "selected" : ""}>
                            Slide Right
                        </option>

                        <option value="slide_up"
                            ${img.transition === "slide_up" ? "selected" : ""}>
                            Slide Up
                        </option>

                        <option value="slide_down"
                            ${img.transition === "slide_down" ? "selected" : ""}>
                            Slide Down
                        </option>

                        <option value="slide_diagonal"
                            ${img.transition === "slide_diagonal" ? "selected" : ""}>
                            Slide Diagonal
                        </option>

                        <option value="fade_black"
                            ${img.transition === "fade_black" ? "selected" : ""}>
                            Fade to Black
                        </option>

                    </select>

                </div>


                <hr style="
                    border:0;
                    border-top:1px solid var(--border-color);
                    margin:1.5rem 0;
                ">


                <h4 style="
                    font-family:var(--font-heading);
                    font-size:0.9rem;
                    margin-bottom:1rem;
                    color:var(--text-secondary);
                    display:flex;
                    align-items:center;
                    gap:0.4rem;
                ">
                    <i
                        data-lucide="settings"
                        style="width:14px;height:14px;"
                    ></i>
                    Project Output Settings
                </h4>


                <div class="inspector-group">

                    <label class="inspector-label">
                        Global Aspect Ratio
                    </label>

                    <select
                        id="inspect-aspect-ratio"
                        class="inspector-select"
                    >

                        <option value="16:9"
                            ${checkedRatio === "16:9" ? "selected" : ""}>
                            Landscape (16:9)
                        </option>

                        <option value="9:16"
                            ${checkedRatio === "9:16" ? "selected" : ""}>
                            Portrait (9:16)
                        </option>

                        <option value="1:1"
                            ${checkedRatio === "1:1" ? "selected" : ""}>
                            Square (1:1)
                        </option>

                    </select>

                </div>


                <div class="inspector-group">

                    <label class="inspector-label">
                        Global Style Theme
                    </label>

                    <select
                        id="inspect-theme"
                        class="inspector-select"
                    >

                        <option value="cinematic"
                            ${checkedTheme === "cinematic" ? "selected" : ""}>
                            Cinematic Style
                        </option>

                        <option value="energetic"
                            ${checkedTheme === "energetic" ? "selected" : ""}>
                            Energetic Style
                        </option>

                        <option value="vintage"
                            ${checkedTheme === "vintage" ? "selected" : ""}>
                            Vintage Style
                        </option>

                    </select>

                </div>


                <div
                    class="inspector-apply-container"
                    style="margin-top:2rem;"
                >

                    <button
                        class="primary-btn"
                        id="btn-apply-changes"
                    >

                        <span class="btn-content">

                            <i data-lucide="refresh-cw"></i>

                            Apply & Re-Render Video

                        </span>

                    </button>

                </div>
            `;


            lucide.createIcons();


            const guideLink =
                document.getElementById(
                    "btn-guide-link"
                );


            if (guideLink) {

                guideLink.addEventListener(
                    "click",
                    (e) => {

                        e.stopPropagation();

                        helpModal.classList.remove(
                            "hidden"
                        );
                    }
                );
            }


            const durationSlider =
                document.getElementById(
                    "inspect-duration"
                );


            const durationVal =
                document.getElementById(
                    "inspect-duration-val"
                );


            durationSlider.addEventListener(
                "input",
                (e) => {

                    const val =
                        parseFloat(
                            e.target.value
                        );

                    img.duration =
                        val;

                    durationVal.textContent =
                        `${val}s`;

                    renderTimeline();
                }
            );


            const previewImageEl =
                document.getElementById(
                    "inspect-preview-image"
                );


            const previewMotionEl =
                document.getElementById(
                    "inspect-preview-motion"
                );


            function updatePreviewDecorations(
                imgFilter
            ) {

                if (!previewImageEl) {
                    return;
                }


                previewImageEl.classList.remove(
                    "decor-letterbox",
                    "decor-cyberpunk",
                    "decor-polaroid"
                );


                if (
                    imgFilter ===
                    "cinematic_letterbox"
                ) {

                    previewImageEl.classList.add(
                        "decor-letterbox"
                    );

                } else if (
                    imgFilter ===
                    "cyberpunk_frame"
                ) {

                    previewImageEl.classList.add(
                        "decor-cyberpunk"
                    );

                } else if (
                    imgFilter ===
                    "polaroid"
                ) {

                    previewImageEl.classList.add(
                        "decor-polaroid"
                    );
                }
            }


            if (previewImageEl) {

                previewImageEl.style.filter =
                    getCssFilterString(
                        img.filter
                    );

                previewImageEl.className =
                    `preview-image-content trans-preview-${img.transition}`;

                updatePreviewDecorations(
                    img.filter
                );
            }


            if (previewMotionEl) {

                previewMotionEl.className =
                    `preview-motion-wrapper motion-preview-${img.effect || "zoom_in"}`;
            }


            const filterSelect =
                document.getElementById(
                    "inspect-filter"
                );


            filterSelect.addEventListener(
                "change",
                (e) => {

                    img.filter =
                        e.target.value;

                    if (previewImageEl) {

                        previewImageEl.style.filter =
                            getCssFilterString(
                                e.target.value
                            );

                        updatePreviewDecorations(
                            e.target.value
                        );
                    }
                }
            );


            const effectSelect =
                document.getElementById(
                    "inspect-effect"
                );


            effectSelect.addEventListener(
                "change",
                (e) => {

                    img.effect =
                        e.target.value;

                    if (previewMotionEl) {

                        previewMotionEl.className =
                            `preview-motion-wrapper motion-preview-${e.target.value}`;
                    }
                }
            );


            const transSelect =
                document.getElementById(
                    "inspect-transition"
                );


            if (transSelect) {

                transSelect.addEventListener(
                    "change",
                    (e) => {

                        img.transition =
                            e.target.value;

                        if (previewImageEl) {

                            previewImageEl.className =
                                `preview-image-content trans-preview-${e.target.value}`;
                        }

                        renderTimeline();
                    }
                );
            }


            bindProjectSettings();


            const applyBtn =
                document.getElementById(
                    "btn-apply-changes"
                );


            applyBtn.addEventListener(
                "click",
                () => {

                    if (
                        selectedImages.length > 0 &&
                        selectedAudio
                    ) {

                        submitRenderJob();

                    } else {

                        alert(
                            "Please ensure images/videos and audio are loaded."
                        );
                    }
                }
            );
        }


        // ====================================================================
        // VIDEO INSPECTOR
        // ====================================================================

        else if (
            selectedElement.type === "video"
        ) {

            const videoIdx =
                selectedElement.index;


            const video =
                selectedImages[videoIdx];


            if (!video) {
                return;
            }


            document
                .querySelectorAll(
                    ".timeline-image-clip"
                )
                .forEach(
                    (c, idx) => {

                        if (idx === videoIdx) {

                            c.classList.add(
                                "selected"
                            );

                        } else {

                            c.classList.remove(
                                "selected"
                            );
                        }
                    }
                );


            const videoUrl =
                URL.createObjectURL(
                    video.file
                );


            drawerContent.innerHTML = `

                <div style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    margin-bottom:1.25rem;
                    border-bottom:1px solid rgba(255,255,255,0.03);
                    padding-bottom:0.75rem;
                ">

                    <span style="
                        font-size:0.75rem;
                        color:var(--text-muted);
                        font-weight:600;
                        text-transform:uppercase;
                        letter-spacing:0.5px;
                    ">
                        Video Clip Customization
                    </span>

                </div>


                <div class="inspector-thumb-preview">

                    <video
                        src="${videoUrl}"
                        muted
                        controls
                        playsinline
                        style="
                            width:100%;
                            height:100%;
                            object-fit:cover;
                            border-radius:8px;
                        "
                    ></video>

                </div>


                <div class="inspector-group">

                    <label class="inspector-label">
                        Video Duration (seconds)
                    </label>

                    <div class="slider-container">

                        <input
                            type="range"
                            id="inspect-duration"
                            min="1.0"
                            max="${Math.max(
                                1,
                                Math.min(
                                    60,
                                    Number(video.duration || 5)
                                )
                            )}"
                            step="0.5"
                            value="${Math.min(
                                60,
                                Number(video.duration || 5)
                            )}"
                            class="inspector-slider"
                        >

                        <span
                            class="slider-value"
                            id="inspect-duration-val"
                        >
                            ${Number(video.duration || 5).toFixed(1)}s
                        </span>

                    </div>

                </div>


                <div class="inspector-group">

                    <label class="inspector-label">
                        Color Filter
                    </label>

                    <select
                        id="inspect-filter"
                        class="inspector-select"
                    >

                        <option value="none"
                            ${video.filter === "none" ? "selected" : ""}>
                            Original
                        </option>

                        <option value="cinematic"
                            ${video.filter === "cinematic" ? "selected" : ""}>
                            Cinematic
                        </option>

                        <option value="cinematic_letterbox"
                            ${video.filter === "cinematic_letterbox" ? "selected" : ""}>
                            Cinematic Letterbox
                        </option>

                        <option value="energetic"
                            ${video.filter === "energetic" ? "selected" : ""}>
                            Energetic
                        </option>

                        <option value="vintage"
                            ${video.filter === "vintage" ? "selected" : ""}>
                            Vintage
                        </option>

                        <option value="vintage_grain"
                            ${video.filter === "vintage_grain" ? "selected" : ""}>
                            Vintage Grain
                        </option>

                        <option value="grayscale"
                            ${video.filter === "grayscale" ? "selected" : ""}>
                            Grayscale
                        </option>

                        <option value="cyberpunk"
                            ${video.filter === "cyberpunk" ? "selected" : ""}>
                            Cyberpunk
                        </option>

                        <option value="dreamy"
                            ${video.filter === "dreamy" ? "selected" : ""}>
                            Dreamy
                        </option>

                        <option value="sunset"
                            ${video.filter === "sunset" ? "selected" : ""}>
                            Sunset
                        </option>

                        <option value="polaroid"
                            ${video.filter === "polaroid" ? "selected" : ""}>
                            Polaroid
                        </option>

                        <option value="vaporwave"
                            ${video.filter === "vaporwave" ? "selected" : ""}>
                            Vaporwave
                        </option>

                    </select>

                </div>


                <div class="inspector-group">

                    <label class="inspector-label">
                        Motion / VFX Effect
                    </label>

                    <select
                        id="inspect-effect"
                        class="inspector-select"
                    >

                        <option value="none"
                            ${video.effect === "none" ? "selected" : ""}>
                            None
                        </option>

                        <option value="zoom_in"
                            ${video.effect === "zoom_in" ? "selected" : ""}>
                            Zoom In
                        </option>

                        <option value="zoom_out"
                            ${video.effect === "zoom_out" ? "selected" : ""}>
                            Zoom Out
                        </option>

                        <option value="pan_left"
                            ${video.effect === "pan_left" ? "selected" : ""}>
                            Pan Left
                        </option>

                        <option value="pan_right"
                            ${video.effect === "pan_right" ? "selected" : ""}>
                            Pan Right
                        </option>

                        <option value="tilt_up"
                            ${video.effect === "tilt_up" ? "selected" : ""}>
                            Tilt Up
                        </option>

                        <option value="tilt_down"
                            ${video.effect === "tilt_down" ? "selected" : ""}>
                            Tilt Down
                        </option>

                        <option value="none"
                            ${video.effect === "none" ? "selected" : ""}>
                            Static
                        </option>

                    </select>

                </div>


                <div class="inspector-group">

                    <label class="inspector-label">
                        Transition (To Next Clip)
                    </label>

                    <select
                        id="inspect-transition"
                        class="inspector-select"
                        ${videoIdx === selectedImages.length - 1 ? "disabled" : ""}
                    >

                        <option value="none"
                            ${video.transition === "none" ? "selected" : ""}>
                            Cut
                        </option>

                        <option value="crossfade"
                            ${video.transition === "crossfade" ? "selected" : ""}>
                            Crossfade
                        </option>

                        <option value="zoom_blend"
                            ${video.transition === "zoom_blend" ? "selected" : ""}>
                            Zoom Blend
                        </option>

                        <option value="spin_blend"
                            ${video.transition === "spin_blend" ? "selected" : ""}>
                            Spin Blend
                        </option>

                        <option value="white_flash"
                            ${video.transition === "white_flash" ? "selected" : ""}>
                            White Flash
                        </option>

                        <option value="glitch_cut"
                            ${video.transition === "glitch_cut" ? "selected" : ""}>
                            Glitch Cut
                        </option>

                        <option value="slide_left"
                            ${video.transition === "slide_left" ? "selected" : ""}>
                            Slide Left
                        </option>

                        <option value="slide_right"
                            ${video.transition === "slide_right" ? "selected" : ""}>
                            Slide Right
                        </option>

                        <option value="slide_up"
                            ${video.transition === "slide_up" ? "selected" : ""}>
                            Slide Up
                        </option>

                        <option value="slide_down"
                            ${video.transition === "slide_down" ? "selected" : ""}>
                            Slide Down
                        </option>

                        <option value="slide_diagonal"
                            ${video.transition === "slide_diagonal" ? "selected" : ""}>
                            Slide Diagonal
                        </option>

                        <option value="fade_black"
                            ${video.transition === "fade_black" ? "selected" : ""}>
                            Fade to Black
                        </option>

                    </select>

                </div>


                <hr style="
                    border:0;
                    border-top:1px solid var(--border-color);
                    margin:1.5rem 0;
                ">


                <h4 style="
                    font-family:var(--font-heading);
                    font-size:0.9rem;
                    margin-bottom:1rem;
                    color:var(--text-secondary);
                ">
                    Project Output Settings
                </h4>


                <div class="inspector-group">

                    <label class="inspector-label">
                        Global Aspect Ratio
                    </label>

                    <select
                        id="inspect-aspect-ratio"
                        class="inspector-select"
                    >

                        <option value="16:9"
                            ${checkedRatio === "16:9" ? "selected" : ""}>
                            Landscape (16:9)
                        </option>

                        <option value="9:16"
                            ${checkedRatio === "9:16" ? "selected" : ""}>
                            Portrait (9:16)
                        </option>

                        <option value="1:1"
                            ${checkedRatio === "1:1" ? "selected" : ""}>
                            Square (1:1)
                        </option>

                    </select>

                </div>


                <div class="inspector-group">

                    <label class="inspector-label">
                        Global Style Theme
                    </label>

                    <select
                        id="inspect-theme"
                        class="inspector-select"
                    >

                        <option value="cinematic"
                            ${checkedTheme === "cinematic" ? "selected" : ""}>
                            Cinematic
                        </option>

                        <option value="energetic"
                            ${checkedTheme === "energetic" ? "selected" : ""}>
                            Energetic
                        </option>

                        <option value="vintage"
                            ${checkedTheme === "vintage" ? "selected" : ""}>
                            Vintage
                        </option>

                    </select>

                </div>


                <div
                    class="inspector-apply-container"
                    style="margin-top:2rem;"
                >

                    <button
                        class="primary-btn"
                        id="btn-apply-changes"
                    >

                        <span class="btn-content">

                            <i data-lucide="refresh-cw"></i>

                            Apply & Re-Render Video

                        </span>

                    </button>

                </div>
            `;


            lucide.createIcons();


            const durationSlider =
                document.getElementById(
                    "inspect-duration"
                );


            const durationVal =
                document.getElementById(
                    "inspect-duration-val"
                );


            durationSlider.addEventListener(
                "input",
                (e) => {

                    let val =
                        parseFloat(
                            e.target.value
                        );

                    val =
                        Math.min(
                            Number(video.duration || 5),
                            val
                        );

                    video.duration =
                        val;

                    durationVal.textContent =
                        `${val.toFixed(1)}s`;

                    renderTimeline();
                }
            );


            const filterSelect =
                document.getElementById(
                    "inspect-filter"
                );


            filterSelect.addEventListener(
                "change",
                (e) => {

                    video.filter =
                        e.target.value;
                }
            );


            const effectSelect =
                document.getElementById(
                    "inspect-effect"
                );


            effectSelect.addEventListener(
                "change",
                (e) => {

                    video.effect =
                        e.target.value;
                }
            );


            const transSelect =
                document.getElementById(
                    "inspect-transition"
                );


            if (transSelect) {

                transSelect.addEventListener(
                    "change",
                    (e) => {

                        video.transition =
                            e.target.value;

                        renderTimeline();
                    }
                );
            }


            bindProjectSettings();


            const applyBtn =
                document.getElementById(
                    "btn-apply-changes"
                );


            applyBtn.addEventListener(
                "click",
                () => {

                    if (
                        selectedImages.length > 0 &&
                        selectedAudio
                    ) {

                        submitRenderJob();

                    } else {

                        alert(
                            "Please ensure images/videos and audio are loaded."
                        );
                    }
                }
            );
        }


        // ====================================================================
        // AUDIO INSPECTOR
        // ====================================================================

        else if (
            selectedElement.type === "audio"
        ) {

            document
                .querySelectorAll(
                    ".timeline-image-clip"
                )
                .forEach(
                    c =>
                        c.classList.remove(
                            "selected"
                        )
                );


            const audioClipEl =
                document.querySelector(
                    ".timeline-audio-clip"
                );


            if (audioClipEl) {

                audioClipEl.classList.add(
                    "selected"
                );
            }


            drawerContent.innerHTML = `

                <div style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    margin-bottom:1.25rem;
                    border-bottom:1px solid rgba(255,255,255,0.03);
                    padding-bottom:0.75rem;
                ">

                    <span style="
                        font-size:0.75rem;
                        color:var(--text-muted);
                        font-weight:600;
                        text-transform:uppercase;
                        letter-spacing:0.5px;
                    ">
                        Audio Options
                    </span>

                </div>


                <div style="
                    font-size:0.85rem;
                    color:var(--text-secondary);
                    margin-bottom:1.5rem;
                    display:flex;
                    align-items:center;
                    gap:0.5rem;
                    overflow:hidden;
                    text-overflow:ellipsis;
                ">

                    <i
                        data-lucide="music-4"
                        style="color:var(--success);flex-shrink:0;"
                    ></i>

                    <span style="
                        white-space:nowrap;
                        overflow:hidden;
                        text-overflow:ellipsis;
                    ">
                        ${selectedAudio.name}
                    </span>

                </div>


                <div class="inspector-group">

                    <label class="inspector-label">
                        Song Start Offset (seconds)
                    </label>

                    <div class="slider-container">

                        <input
                            type="range"
                            id="inspect-audio-offset"
                            min="0"
                            max="60"
                            step="1"
                            value="${selectedAudioSettings.offset}"
                            class="inspector-slider"
                        >

                        <span
                            class="slider-value"
                            id="inspect-audio-offset-val"
                        >
                            ${selectedAudioSettings.offset}s
                        </span>

                    </div>

                </div>


                <div class="inspector-group">

                    <label class="inspector-label">
                        Volume Level
                    </label>

                    <div class="slider-container">

                        <input
                            type="range"
                            id="inspect-audio-volume"
                            min="0"
                            max="100"
                            step="5"
                            value="${Math.round(
                                selectedAudioSettings.volume * 100
                            )}"
                            class="inspector-slider"
                        >

                        <span
                            class="slider-value"
                            id="inspect-audio-volume-val"
                        >
                            ${Math.round(
                                selectedAudioSettings.volume * 100
                            )}%
                        </span>

                    </div>

                </div>


                <hr style="
                    border:0;
                    border-top:1px solid var(--border-color);
                    margin:1.5rem 0;
                ">


                <h4 style="
                    font-family:var(--font-heading);
                    font-size:0.9rem;
                    margin-bottom:1rem;
                    color:var(--text-secondary);
                ">
                    Project Output Settings
                </h4>


                <div class="inspector-group">

                    <label class="inspector-label">
                        Global Aspect Ratio
                    </label>

                    <select
                        id="inspect-aspect-ratio"
                        class="inspector-select"
                    >

                        <option value="16:9"
                            ${checkedRatio === "16:9" ? "selected" : ""}>
                            Landscape (16:9)
                        </option>

                        <option value="9:16"
                            ${checkedRatio === "9:16" ? "selected" : ""}>
                            Portrait (9:16)
                        </option>

                        <option value="1:1"
                            ${checkedRatio === "1:1" ? "selected" : ""}>
                            Square (1:1)
                        </option>

                    </select>

                </div>


                <div class="inspector-group">

                    <label class="inspector-label">
                        Global Style Theme
                    </label>

                    <select
                        id="inspect-theme"
                        class="inspector-select"
                    >

                        <option value="cinematic"
                            ${checkedTheme === "cinematic" ? "selected" : ""}>
                            Cinematic
                        </option>

                        <option value="energetic"
                            ${checkedTheme === "energetic" ? "selected" : ""}>
                            Energetic
                        </option>

                        <option value="vintage"
                            ${checkedTheme === "vintage" ? "selected" : ""}>
                            Vintage
                        </option>

                    </select>

                </div>


                <div
                    class="inspector-apply-container"
                    style="margin-top:2rem;"
                >

                    <button
                        class="primary-btn"
                        id="btn-apply-changes"
                    >

                        <span class="btn-content">

                            <i data-lucide="refresh-cw"></i>

                            Apply & Re-Render Video

                        </span>

                    </button>

                </div>
            `;


            lucide.createIcons();


            const offsetSlider =
                document.getElementById(
                    "inspect-audio-offset"
                );


            const offsetVal =
                document.getElementById(
                    "inspect-audio-offset-val"
                );


            offsetSlider.addEventListener(
                "input",
                (e) => {

                    const val =
                        parseInt(
                            e.target.value
                        );

                    selectedAudioSettings.offset =
                        val;

                    offsetVal.textContent =
                        `${val}s`;
                }
            );


            const volumeSlider =
                document.getElementById(
                    "inspect-audio-volume"
                );


            const volumeVal =
                document.getElementById(
                    "inspect-audio-volume-val"
                );


            volumeSlider.addEventListener(
                "input",
                (e) => {

                    const val =
                        parseInt(
                            e.target.value
                        );

                    selectedAudioSettings.volume =
                        val / 100;

                    volumeVal.textContent =
                        `${val}%`;
                }
            );


            bindProjectSettings();


            const applyBtn =
                document.getElementById(
                    "btn-apply-changes"
                );


            applyBtn.addEventListener(
                "click",
                () => {

                    if (
                        selectedImages.length > 0 &&
                        selectedAudio
                    ) {

                        submitRenderJob();

                    } else {

                        alert(
                            "Please ensure images/videos and audio are loaded."
                        );
                    }
                }
            );
        }
    }


    // ========================================================================
    // PROJECT SETTINGS HELPER
    // ========================================================================

    function bindProjectSettings() {

        const aspectSelect =
            document.getElementById(
                "inspect-aspect-ratio"
            );


        if (aspectSelect) {

            aspectSelect.addEventListener(
                "change",
                (e) => {

                    const radio =
                        document.querySelector(
                            `input[name="aspect-ratio"][value="${e.target.value}"]`
                        );


                    if (radio) {

                        radio.checked = true;

                        radio.dispatchEvent(
                            new Event(
                                "change"
                            )
                        );
                    }
                }
            );
        }


        const themeSelect =
            document.getElementById(
                "inspect-theme"
            );


        if (themeSelect) {

            themeSelect.addEventListener(
                "change",
                (e) => {

                    const radio =
                        document.querySelector(
                            `input[name="video-theme"][value="${e.target.value}"]`
                        );


                    if (radio) {

                        radio.checked = true;

                        radio.dispatchEvent(
                            new Event(
                                "change"
                            )
                        );
                    }
                }
            );
        }
    }


    // ========================================================================
    // SUBMIT RENDER JOB
    // ========================================================================

    btnGenerate.addEventListener(
        "click",
        () => {

            if (
                selectedImages.length === 0 ||
                !selectedAudio
            ) {

                return;
            }


            submitRenderJob();
        }
    );


    async function submitRenderJob() {

        // ================================================================
        // UI LOADING STATE
        // ================================================================

        playerPlaceholder.classList.add(
            "hidden"
        );

        videoPlayer.classList.add(
            "hidden"
        );

        exportActions.classList.add(
            "hidden"
        );

        playerLoader.classList.remove(
            "hidden"
        );


        setLoaderState(
            "Uploading Assets...",
            "Uploading images, videos and background music to backend server.",
            15
        );


        // ================================================================
        // FORM DATA
        // ================================================================

        const formData =
            new FormData();


        // ================================================================
        // IMPORTANT:
        // Send images separately
        // ================================================================

        selectedImages.forEach(
            media => {

                if (
                    media.type === "image"
                ) {

                    formData.append(
                        "images",
                        media.file
                    );
                }
            }
        );


        // ================================================================
        // IMPORTANT:
        // Send videos separately
        // ================================================================

        selectedImages.forEach(
            media => {

                if (
                    media.type === "video"
                ) {

                    formData.append(
                        "videos",
                        media.file
                    );
                }
            }
        );


        // ================================================================
        // AUDIO
        // ================================================================

        formData.append(
            "audio",
            selectedAudio
        );


        // ================================================================
        // PROJECT SETTINGS
        // ================================================================

        const ratioInput =
            document.querySelector(
                'input[name="aspect-ratio"]:checked'
            );


        const themeInput =
            document.querySelector(
                'input[name="video-theme"]:checked'
            );


        const checkedRatio =
            ratioInput
                ? ratioInput.value
                : "16:9";


        const checkedTheme =
            themeInput
                ? themeInput.value
                : "cinematic";


        formData.append(
            "aspect_ratio",
            checkedRatio
        );


        formData.append(
            "theme",
            checkedTheme
        );


        // ================================================================
        // BUILD IMAGE/VISUAL SETTINGS
        // ================================================================

        const imageTimeline =
            [];


        const videoTimeline =
            [];


        // ================================================================
        // NEW:
        // MIXED MEDIA TIMELINE
        //
        // This preserves the exact order:
        //
        // image
        // video
        // image
        // video
        //
        // etc.
        // ================================================================

        const mediaTimeline =
            [];


        selectedImages.forEach(
            (media, idx) => {

                const item = {

                    type:
                        media.type,

                    index:
                        media.type === "image"
                            ? selectedImages
                                .slice(
                                    0,
                                    idx + 1
                                )
                                .filter(
                                    m =>
                                        m.type ===
                                        "image"
                                ).length - 1
                            : selectedImages
                                .slice(
                                    0,
                                    idx + 1
                                )
                                .filter(
                                    m =>
                                        m.type ===
                                        "video"
                                ).length - 1,

                    duration:
                        Number(
                            media.duration || 0
                        ),

                    filter:
                        media.filter ||
                        "none",

                    effect:
                        media.effect ||
                        (
                            media.type ===
                            "image"
                                ? "zoom_in"
                                : "none"
                        ),

                    transition:
                        media.transition ||
                        "crossfade"
                };


                // ============================================================
                // Add to mixed timeline
                // ============================================================

                mediaTimeline.push(
                    item
                );


                // ============================================================
                // Keep compatibility with backend image timeline
                // ============================================================

                if (
                    media.type === "image"
                ) {

                    imageTimeline.push(
                        item
                    );
                }


                // ============================================================
                // Keep compatibility with backend video timeline
                // ============================================================

                if (
                    media.type === "video"
                ) {

                    videoTimeline.push(
                        item
                    );
                }
            }
        );


        // ================================================================
        // FINAL TIMELINE DATA
        // ================================================================

        const timelineData = {

            // Old image format
            images:
                imageTimeline,

            // Old video format
            videos:
                videoTimeline,

            // NEW mixed format
            media:
                mediaTimeline,

            // Audio
            audio: {

                volume:
                    selectedAudioSettings.volume,

                offset:
                    selectedAudioSettings.offset
            }
        };


        // ================================================================
        // SEND TIMELINE TO BACKEND
        // ================================================================

        formData.append(
            "timeline_data",
            JSON.stringify(
                timelineData
            )
        );


        console.log(
            "Sending mixed timeline:",
            timelineData
        );


        // ================================================================
        // API REQUEST
        // ================================================================

        try {

            const response =
                await fetch(
                    "/api/generate",
                    {
                        method: "POST",
                        body: formData
                    }
                );


            if (!response.ok) {

                let errorMessage =
                    "Server failed to queue the video job.";


                try {

                    const errorData =
                        await response.json();

                    errorMessage =
                        errorData.detail ||
                        errorMessage;

                } catch (parseError) {

                    console.error(
                        "Could not parse server error:",
                        parseError
                    );
                }


                throw new Error(
                    errorMessage
                );
            }


            const data =
                await response.json();


            activeJobId =
                data.job_id;


            setLoaderState(
                "Processing Audio...",
                "Analyzing audio beat markers and preparing the mixed media timeline.",
                35
            );


            if (pollInterval) {
                clearInterval(
                    pollInterval
                );
            }


            pollInterval =
                setInterval(
                    pollJobProgress,
                    1800
                );


        } catch (error) {

            console.error(
                "Submission error:",
                error
            );


            showRenderError(
                error.message
            );
        }
    }


    // ========================================================================
    // POLL JOB
    // ========================================================================

    async function pollJobProgress() {

        if (!activeJobId) {
            return;
        }


        try {

            const res =
                await fetch(
                    `/api/status/${activeJobId}`
                );


            if (!res.ok) {

                throw new Error(
                    "Could not fetch rendering status."
                );
            }


            const job =
                await res.json();


            if (
                job.status ===
                "rendering"
            ) {

                setLoaderState(
                    "Applying VFX & Filters...",
                    "Combining images, videos, transitions and visual effects.",
                    60
                );


            } else if (
                job.status ===
                "completed"
            ) {

                clearInterval(
                    pollInterval
                );

                activeJobId =
                    null;


                setLoaderState(
                    "Rendering Complete",
                    "Your video is ready.",
                    100
                );


                showRenderedVideo(
                    job.video_url
                );


            } else if (
                job.status ===
                "failed"
            ) {

                clearInterval(
                    pollInterval
                );

                activeJobId =
                    null;


                showRenderError(
                    job.error ||
                    "Video processing engine crashed."
                );
            }


        } catch (err) {

            console.error(
                "Polling error:",
                err
            );

        }
    }


    // ========================================================================
    // LOADER
    // ========================================================================

    function setLoaderState(
        title,
        desc,
        percentage
    ) {

        loaderTitle.textContent =
            title;

        loaderDesc.textContent =
            desc;

        loaderProgress.style.width =
            `${percentage}%`;

        loaderPercent.textContent =
            `${percentage}%`;
    }


    // ========================================================================
    // SHOW RENDERED VIDEO
    // ========================================================================

    function showRenderedVideo(
        videoUrl
    ) {

        playerLoader.classList.add(
            "hidden"
        );

        videoPlayer.classList.remove(
            "hidden"
        );

        exportActions.classList.remove(
            "hidden"
        );


        videoPlayer.src =
            videoUrl;


        videoPlayer.load();


        videoPlayer.play().catch(
            e => {

                console.log(
                    "Auto-play blocked by browser.",
                    e
                );
            }
        );


        btnDownload.href =
            videoUrl;
    }


    // ========================================================================
    // ERROR
    // ========================================================================

    function showRenderError(
        message
    ) {

        if (pollInterval) {

            clearInterval(
                pollInterval
            );
        }


        activeJobId =
            null;


        playerLoader.classList.add(
            "hidden"
        );

        playerPlaceholder.classList.remove(
            "hidden"
        );

        exportActions.classList.add(
            "hidden"
        );


        alert(
            `Render Failed: ${message}`
        );
    }


    // ========================================================================
    // PLAYBACK SYNC
    // ========================================================================

    let isPlaying = false;


    btnTimelinePlay.addEventListener(
        "click",
        () => {

            if (!videoPlayer.src) {
                return;
            }


            if (isPlaying) {

                videoPlayer.pause();

            } else {

                videoPlayer.play();
            }
        }
    );


    videoPlayer.addEventListener(
        "play",
        () => {

            isPlaying = true;


            btnTimelinePlay.innerHTML =
                `<i data-lucide="pause"></i>`;


            lucide.createIcons();
        }
    );


    videoPlayer.addEventListener(
        "pause",
        () => {

            isPlaying = false;


            btnTimelinePlay.innerHTML =
                `<i data-lucide="play"></i>`;


            lucide.createIcons();
        }
    );


    videoPlayer.addEventListener(
        "timeupdate",
        () => {

            const current =
                videoPlayer.currentTime;


            const total =
                videoPlayer.duration ||
                0;


            timelineTimeLabel.textContent =
                `${formatTime(current)} / ${formatTime(total)}`;
        }
    );


    // ========================================================================
    // CSS FILTER HELPER
    // ========================================================================

    function getCssFilterString(
        filterType
    ) {

        switch (filterType) {

            case "cinematic":
            case "cinematic_letterbox":

                return (
                    "contrast(1.15) " +
                    "saturate(1.1) " +
                    "hue-rotate(-12deg) " +
                    "sepia(0.12)"
                );


            case "energetic":

                return (
                    "contrast(1.25) " +
                    "saturate(1.4)"
                );


            case "vintage":
            case "vintage_grain":

                return (
                    "contrast(0.9) " +
                    "saturate(0.85) " +
                    "sepia(0.28) " +
                    "hue-rotate(6deg)"
                );


            case "grayscale":

                return (
                    "grayscale(100%) " +
                    "contrast(1.35) " +
                    "brightness(0.95)"
                );


            case "cyberpunk":
            case "cyberpunk_frame":

                return (
                    "contrast(1.2) " +
                    "saturate(1.55) " +
                    "hue-rotate(140deg)"
                );


            case "dreamy":

                return (
                    "blur(1.5px) " +
                    "contrast(1.05) " +
                    "saturate(1.1) " +
                    "brightness(1.05)"
                );


            case "sunset":

                return (
                    "sepia(0.38) " +
                    "saturate(1.35) " +
                    "contrast(1.1) " +
                    "hue-rotate(-6deg)"
                );


            case "cool_pine":

                return (
                    "contrast(1.1) " +
                    "saturate(0.75) " +
                    "hue-rotate(25deg) " +
                    "sepia(0.08)"
                );


            case "polaroid":

                return (
                    "contrast(1.15) " +
                    "saturate(0.9) " +
                    "sepia(0.25) " +
                    "brightness(1.08)"
                );


            case "vaporwave":

                return (
                    "contrast(1.2) " +
                    "saturate(1.4) " +
                    "hue-rotate(280deg)"
                );


            default:

                return "none";
        }
    }


    // ========================================================================
    // INITIAL UI
    // ========================================================================

    function updateUI() {

        // ================================================================
        // PREVIEW GRID
        // ================================================================

        imagesPreviewGrid.innerHTML = "";


        selectedImages.forEach(
            (media, index) => {

                const preview =
                    document.createElement(
                        "div"
                    );


                preview.className =
                    "preview-thumb";


                const objectUrl =
                    URL.createObjectURL(
                        media.file
                    );


                // ============================================================
                // VIDEO PREVIEW
                // ============================================================

                if (
                    media.type ===
                    "video"
                ) {

                    preview.innerHTML = `

                        <video
                            src="${objectUrl}"
                            muted
                            preload="metadata"
                        ></video>

                        <div class="media-type-badge">
                            <i data-lucide="play"></i>
                        </div>

                        <div class="media-name">
                            ${media.file.name}
                        </div>

                        <button
                            class="remove-preview"
                            type="button"
                            title="Remove video"
                        >
                            <i data-lucide="x"></i>
                        </button>

                    `;

                }


                // ============================================================
                // IMAGE PREVIEW
                // ============================================================

                else {

                    preview.innerHTML = `

                        <img
                            src="${objectUrl}"
                            alt="${media.file.name}"
                        >

                        <div class="media-type-badge">
                            <i data-lucide="image"></i>
                        </div>

                        <div class="media-name">
                            ${media.file.name}
                        </div>

                        <button
                            class="remove-preview"
                            type="button"
                            title="Remove image"
                        >
                            <i data-lucide="x"></i>
                        </button>

                    `;
                }


                // ============================================================
                // REMOVE BUTTON
                // ============================================================

                const removeButton =
                    preview.querySelector(
                        ".remove-preview"
                    );


                removeButton.addEventListener(
                    "click",
                    (event) => {

                        event.stopPropagation();


                        selectedImages.splice(
                            index,
                            1
                        );


                        URL.revokeObjectURL(
                            objectUrl
                        );


                        if (
                            typeof lucide !==
                            "undefined"
                        ) {

                            lucide.createIcons();
                        }


                        updateUI();
                    }
                );


                imagesPreviewGrid.appendChild(
                    preview
                );
            }
        );


        // ================================================================
        // AUDIO UI
        // ================================================================

        if (selectedAudio) {

            if (audioInfoCard) {
                audioInfoCard.classList.remove(
                    "hidden"
                );
            }

            if (audioDropText) {
                audioDropText.textContent =
                    selectedAudio.name;
            }

        } else {

            if (audioInfoCard) {
                audioInfoCard.classList.add(
                    "hidden"
                );
            }

            if (audioDropText) {
                audioDropText.textContent =
                    "Drop audio here";
            }
        }


        // ================================================================
        // TIMELINE
        // ================================================================

        renderTimeline();


        if (
            typeof lucide !==
            "undefined"
        ) {

            lucide.createIcons();
        }
    }


    // Initial render
    updateUI();

});