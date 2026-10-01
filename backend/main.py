import os
import shutil
import uuid
import json
from typing import List

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    BackgroundTasks,
    HTTPException
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from video_generator import (
    create_video_from_assets,
    create_video_from_video_assets,
    create_video_from_mixed_assets
)


app = FastAPI(title="Automatic Video Editor API")


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# DIRECTORIES
# ============================================================

UPLOAD_DIR = "temp_uploads"
OUTPUT_DIR = "static_outputs"
STATIC_FRONTEND_DIR = "static"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(STATIC_FRONTEND_DIR, exist_ok=True)


# Serve generated videos
app.mount(
    "/outputs",
    StaticFiles(directory=OUTPUT_DIR),
    name="outputs"
)


# ============================================================
# JOB STORAGE
# ============================================================

jobs = {}


# ============================================================
# PROCESS VIDEO JOB
# ============================================================

def process_video_job(
    job_id: str,
    image_paths: List[str],
    audio_path: str,
    theme: str,
    aspect_ratio: str,
    timeline_data: dict = None,
    video_paths: List[str] = None
):
    output_filename = f"{job_id}.mp4"
    output_path = os.path.join(
        OUTPUT_DIR,
        output_filename
    )

    try:
        jobs[job_id]["status"] = "rendering"
        jobs[job_id]["progress"] = 40

        video_paths = video_paths or []
        image_paths = image_paths or []

        # ====================================================
        # NEW MIXED MEDIA PIPELINE
        # ====================================================
        #
        # If both images and videos are uploaded, OR if
        # timeline_data contains a mixed media timeline,
        # use the new mixed renderer.
        #
        # The media list preserves the timeline order.
        # ====================================================

        mixed_media = []

        if timeline_data:
            raw_media = timeline_data.get("media", [])

            if isinstance(raw_media, list) and raw_media:
                for item in raw_media:
                    if not isinstance(item, dict):
                        continue

                    media_type = str(
                        item.get("type", "")
                    ).lower()

                    index = item.get("index", 0)

                    try:
                        index = int(index)
                    except Exception:
                        index = 0

                    if media_type == "image":
                        if 0 <= index < len(image_paths):
                            mixed_media.append({
                                "type": "image",
                                "path": image_paths[index],
                                "duration": item.get(
                                    "duration",
                                    3.5
                                ),
                                "filter": item.get(
                                    "filter",
                                    "none"
                                ),
                                "effect": item.get(
                                    "effect",
                                    "zoom_in"
                                ),
                                "transition": item.get(
                                    "transition",
                                    "crossfade"
                                )
                            })

                    elif media_type == "video":
                        if 0 <= index < len(video_paths):
                            mixed_media.append({
                                "type": "video",
                                "path": video_paths[index],
                                "duration": item.get(
                                    "duration",
                                    10.0
                                ),
                                "filter": item.get(
                                    "filter",
                                    "none"
                                ),
                                "effect": item.get(
                                    "effect",
                                    "none"
                                ),
                                "transition": item.get(
                                    "transition",
                                    "crossfade"
                                )
                            })

        # ====================================================
        # FALLBACK MIXED MEDIA CREATION
        # ====================================================
        #
        # If frontend has not yet supplied a "media" timeline,
        # create one automatically.
        #
        # Images come first, followed by videos.
        #
        # Later the frontend timeline can determine the exact
        # order.
        # ====================================================

        if not mixed_media and image_paths and video_paths:

            print(
                "Starting MIXED IMAGE + VIDEO editing pipeline..."
            )

            image_settings = {}
            video_settings = {}

            if timeline_data:
                for item in timeline_data.get(
                    "images",
                    []
                ):
                    try:
                        image_settings[
                            int(item.get("index", 0))
                        ] = item
                    except Exception:
                        pass

                for item in timeline_data.get(
                    "videos",
                    []
                ):
                    try:
                        video_settings[
                            int(item.get("index", 0))
                        ] = item
                    except Exception:
                        pass

            # Add images
            for idx, image_path in enumerate(image_paths):

                settings = image_settings.get(
                    idx,
                    {}
                )

                mixed_media.append({
                    "type": "image",
                    "path": image_path,
                    "duration": settings.get(
                        "duration",
                        3.5
                    ),
                    "filter": settings.get(
                        "filter",
                        "none"
                    ),
                    "effect": settings.get(
                        "effect",
                        "zoom_in"
                    ),
                    "transition": settings.get(
                        "transition",
                        "crossfade"
                    )
                })

            # Add videos
            for idx, video_path in enumerate(video_paths):

                settings = video_settings.get(
                    idx,
                    {}
                )

                mixed_media.append({
                    "type": "video",
                    "path": video_path,
                    "duration": settings.get(
                        "duration",
                        10.0
                    ),
                    "filter": settings.get(
                        "filter",
                        "none"
                    ),
                    "effect": settings.get(
                        "effect",
                        "none"
                    ),
                    "transition": settings.get(
                        "transition",
                        "crossfade"
                    )
                })

        # ====================================================
        # RENDER MIXED MEDIA
        # ====================================================

        if mixed_media:

            print(
                "Starting MIXED MEDIA rendering pipeline..."
            )

            create_video_from_mixed_assets(
                media_items=mixed_media,
                audio_path=audio_path,
                output_path=output_path,
                theme=theme,
                aspect_ratio=aspect_ratio,
                timeline_data=timeline_data
            )

        # ====================================================
        # VIDEO ONLY
        # ====================================================

        elif video_paths:

            print(
                "Starting VIDEO editing pipeline..."
            )

            create_video_from_video_assets(
                video_paths=video_paths,
                audio_path=audio_path,
                output_path=output_path,
                theme=theme,
                aspect_ratio=aspect_ratio,
                timeline_data=timeline_data
            )

        # ====================================================
        # IMAGE ONLY
        # ====================================================

        elif image_paths:

            print(
                "Starting IMAGE to video pipeline..."
            )

            create_video_from_assets(
                image_paths=image_paths,
                audio_path=audio_path,
                output_path=output_path,
                theme=theme,
                aspect_ratio=aspect_ratio,
                timeline_data=timeline_data
            )

        else:
            raise ValueError(
                "No image or video files available for rendering."
            )

        # ====================================================
        # JOB COMPLETE
        # ====================================================

        jobs[job_id]["status"] = "completed"
        jobs[job_id]["progress"] = 100
        jobs[job_id]["video_url"] = (
            f"/outputs/{output_filename}"
        )

        print(
            f"Video generated successfully: {output_path}"
        )

    except Exception as e:

        print(
            f"Error generating video for job {job_id}: {e}"
        )

        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)

    finally:

        # ====================================================
        # CLEANUP UPLOADED FILES
        # ====================================================

        if audio_path:

            session_upload_dir = os.path.dirname(
                audio_path
            )

            try:
                if os.path.exists(
                    session_upload_dir
                ):
                    shutil.rmtree(
                        session_upload_dir
                    )

            except Exception as cleanup_err:

                print(
                    f"Failed to cleanup temp uploads: "
                    f"{cleanup_err}"
                )


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/api/health")
def health_check():

    return {
        "status": "ok",
        "message": "Video Editor API is running!"
    }


# ============================================================
# SECURITY VALIDATION
# ============================================================

ALLOWED_IMAGE_EXTS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp"
}

ALLOWED_VIDEO_EXTS = {
    ".mp4",
    ".mov",
    ".avi",
    ".mkv",
    ".webm"
}

ALLOWED_AUDIO_EXTS = {
    ".mp3",
    ".wav",
    ".aac",
    ".m4a",
    ".ogg"
}


# Maximum file sizes

MAX_IMAGE_SIZE = (
    15 * 1024 * 1024
)

MAX_AUDIO_SIZE = (
    50 * 1024 * 1024
)

MAX_VIDEO_SIZE = (
    500 * 1024 * 1024
)


# ============================================================
# ALLOWED VISUAL OPTIONS
# ============================================================

ALLOWED_THEMES = {
    "cinematic",
    "energetic",
    "vintage",
    "none"
}


ALLOWED_FILTERS = {
    "none",
    "cinematic",
    "cinematic_letterbox",
    "cyberpunk",
    "cyberpunk_frame",
    "vintage",
    "vintage_grain",
    "polaroid",
    "vaporwave",
    "dreamy",
    "sunset",
    "grayscale"
}


ALLOWED_EFFECTS = {
    "zoom_in",
    "zoom_out",
    "pan_left",
    "pan_right",
    "tilt_up",
    "tilt_down",
    "slow_spin",
    "diagonal_pan",
    "beat_shake",
    "audio_pulse",
    "glitch_pulse",
    "none"
}


ALLOWED_TRANSITIONS = {
    "none",
    "crossfade",
    "slide_left",
    "slide_right",
    "slide_up",
    "slide_down",
    "slide_diagonal",
    "fade_black",
    "zoom_blend",
    "spin_blend",
    "white_flash",
    "glitch_cut"
}


# ============================================================
# FILE SIZE
# ============================================================

def get_upload_file_size(
    upload_file: UploadFile
) -> int:

    # Newer FastAPI / Starlette
    if (
        hasattr(upload_file, "size")
        and upload_file.size is not None
    ):
        return upload_file.size

    # Fallback
    upload_file.file.seek(0, 2)

    size = upload_file.file.tell()

    upload_file.file.seek(0)

    return size


# ============================================================
# FILE VALIDATION
# ============================================================

def validate_file(
    upload_file: UploadFile,
    allowed_exts: set,
    max_size: int,
    file_type: str
):

    filename = upload_file.filename or ""

    ext = os.path.splitext(
        filename
    )[1].lower()

    if ext not in allowed_exts:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid file extension {ext} "
                f"for {file_type}. "
                f"Allowed extensions: "
                f"{', '.join(allowed_exts)}"
            )
        )

    content_type = (
        upload_file.content_type or ""
    )

    if (
        file_type == "image"
        and not content_type.startswith("image/")
    ):

        raise HTTPException(
            status_code=400,
            detail="File must be an image type."
        )

    if (
        file_type == "audio"
        and not content_type.startswith("audio/")
    ):

        raise HTTPException(
            status_code=400,
            detail="File must be an audio type."
        )

    if (
        file_type == "video"
        and not content_type.startswith("video/")
    ):

        raise HTTPException(
            status_code=400,
            detail="File must be a video type."
        )

    size = get_upload_file_size(
        upload_file
    )

    if size > max_size:

        raise HTTPException(
            status_code=413,
            detail=(
                f"File {filename} is too large "
                f"({size / (1024 * 1024):.2f}MB). "
                f"Max size is "
                f"{max_size / (1024 * 1024):.0f}MB."
            )
        )


# ============================================================
# GENERATE VIDEO
# ============================================================

@app.post("/api/generate")
async def generate_video(
    background_tasks: BackgroundTasks,

    images: List[UploadFile] = File(
        default=[]
    ),

    videos: List[UploadFile] = File(
        default=[]
    ),

    audio: UploadFile = File(...),

    theme: str = Form(
        "cinematic"
    ),

    aspect_ratio: str = Form(
        "16:9"
    ),

    timeline_data: str = Form(
        None
    )
):

    # ========================================================
    # CHECK INPUT
    # ========================================================

    if not images and not videos:

        raise HTTPException(
            status_code=400,
            detail=(
                "At least one image or video "
                "is required"
            )
        )

    # ========================================================
    # VALIDATE THEME
    # ========================================================

    if theme not in ALLOWED_THEMES:

        theme = "cinematic"

    # ========================================================
    # VALIDATE ASPECT RATIO
    # ========================================================

    if aspect_ratio not in {
        "16:9",
        "9:16",
        "1:1"
    }:

        aspect_ratio = "16:9"

    # ========================================================
    # VALIDATE AUDIO
    # ========================================================

    validate_file(
        audio,
        ALLOWED_AUDIO_EXTS,
        MAX_AUDIO_SIZE,
        "audio"
    )

    # ========================================================
    # VALIDATE IMAGES
    # ========================================================

    for img in images:

        validate_file(
            img,
            ALLOWED_IMAGE_EXTS,
            MAX_IMAGE_SIZE,
            "image"
        )

    # ========================================================
    # VALIDATE VIDEOS
    # ========================================================

    for video in videos:

        validate_file(
            video,
            ALLOWED_VIDEO_EXTS,
            MAX_VIDEO_SIZE,
            "video"
        )

    # ========================================================
    # CREATE JOB
    # ========================================================

    job_id = str(
        uuid.uuid4()
    )

    job_upload_dir = os.path.join(
        UPLOAD_DIR,
        job_id
    )

    os.makedirs(
        job_upload_dir,
        exist_ok=True
    )

    # ========================================================
    # SAVE AUDIO
    # ========================================================

    audio_ext = (
        os.path.splitext(
            audio.filename
        )[1].lower()
        or ".mp3"
    )

    audio_path = os.path.join(
        job_upload_dir,
        f"audio{audio_ext}"
    )

    with open(
        audio_path,
        "wb"
    ) as buffer:

        shutil.copyfileobj(
            audio.file,
            buffer
        )

    # ========================================================
    # SAVE IMAGES
    # ========================================================

    image_paths = []

    for idx, img in enumerate(images):

        img_ext = (
            os.path.splitext(
                img.filename
            )[1].lower()
            or ".jpg"
        )

        img_path = os.path.join(
            job_upload_dir,
            f"img_{idx}{img_ext}"
        )

        with open(
            img_path,
            "wb"
        ) as buffer:

            shutil.copyfileobj(
                img.file,
                buffer
            )

        image_paths.append(
            img_path
        )

    # ========================================================
    # SAVE VIDEOS
    # ========================================================

    video_paths = []

    for idx, video in enumerate(videos):

        video_ext = (
            os.path.splitext(
                video.filename
            )[1].lower()
            or ".mp4"
        )

        video_path = os.path.join(
            job_upload_dir,
            f"video_{idx}{video_ext}"
        )

        with open(
            video_path,
            "wb"
        ) as buffer:

            shutil.copyfileobj(
                video.file,
                buffer
            )

        video_paths.append(
            video_path
        )

    # ========================================================
    # REGISTER JOB
    # ========================================================

    jobs[job_id] = {
        "status": "queued",
        "progress": 10,
        "theme": theme,
        "aspect_ratio": aspect_ratio,
        "video_url": None,
        "error": None
    }

    # ========================================================
    # PARSE TIMELINE
    # ========================================================

    timeline = None

    if timeline_data:

        try:

            parsed = json.loads(
                timeline_data
            )

            timeline = {
                "images": [],
                "videos": [],
                "media": [],
                "audio": {}
            }

            # ==================================================
            # AUDIO SETTINGS
            # ==================================================

            audio_settings = parsed.get(
                "audio",
                {}
            )

            try:
                audio_volume = float(
                    audio_settings.get(
                        "volume",
                        1.0
                    )
                )
            except Exception:
                audio_volume = 1.0

            try:
                audio_offset = float(
                    audio_settings.get(
                        "offset",
                        0.0
                    )
                )
            except Exception:
                audio_offset = 0.0

            timeline["audio"] = {
                "volume": max(
                    0.0,
                    min(
                        2.0,
                        audio_volume
                    )
                ),
                "offset": max(
                    0.0,
                    min(
                        300.0,
                        audio_offset
                    )
                )
            }

            # ==================================================
            # IMAGE SETTINGS
            # ==================================================

            raw_images = parsed.get(
                "images",
                []
            )

            for idx, item in enumerate(
                raw_images
            ):

                if not isinstance(
                    item,
                    dict
                ):
                    continue

                try:
                    item_index = int(
                        item.get(
                            "index",
                            idx
                        )
                    )
                except Exception:
                    item_index = idx

                try:
                    duration = float(
                        item.get(
                            "duration",
                            3.5
                        )
                    )
                except Exception:
                    duration = 3.5

                image_settings = {
                    "index": item_index,
                    "duration": max(
                        0.5,
                        min(
                            15.0,
                            duration
                        )
                    ),
                    "filter": (
                        item.get(
                            "filter",
                            "none"
                        )
                        if item.get(
                            "filter"
                        ) in ALLOWED_FILTERS
                        else "none"
                    ),
                    "effect": (
                        item.get(
                            "effect",
                            "zoom_in"
                        )
                        if item.get(
                            "effect"
                        ) in ALLOWED_EFFECTS
                        else "zoom_in"
                    ),
                    "transition": (
                        item.get(
                            "transition",
                            "crossfade"
                        )
                        if item.get(
                            "transition"
                        ) in ALLOWED_TRANSITIONS
                        else "crossfade"
                    )
                }

                timeline["images"].append(
                    image_settings
                )

            # ==================================================
            # VIDEO SETTINGS
            # ==================================================

            raw_videos = parsed.get(
                "videos",
                []
            )

            for idx, item in enumerate(
                raw_videos
            ):

                if not isinstance(
                    item,
                    dict
                ):
                    continue

                try:
                    item_index = int(
                        item.get(
                            "index",
                            idx
                        )
                    )
                except Exception:
                    item_index = idx

                try:
                    duration = float(
                        item.get(
                            "duration",
                            10.0
                        )
                    )
                except Exception:
                    duration = 10.0

                video_settings = {
                    "index": item_index,
                    "duration": max(
                        0.5,
                        min(
                            60.0,
                            duration
                        )
                    ),
                    "filter": (
                        item.get(
                            "filter",
                            "none"
                        )
                        if item.get(
                            "filter"
                        ) in ALLOWED_FILTERS
                        else "none"
                    ),
                    "effect": (
                        item.get(
                            "effect",
                            "none"
                        )
                        if item.get(
                            "effect"
                        ) in ALLOWED_EFFECTS
                        else "none"
                    ),
                    "transition": (
                        item.get(
                            "transition",
                            "crossfade"
                        )
                        if item.get(
                            "transition"
                        ) in ALLOWED_TRANSITIONS
                        else "crossfade"
                    )
                }

                timeline["videos"].append(
                    video_settings
                )

            # ==================================================
            # NEW MIXED MEDIA TIMELINE
            # ==================================================
            #
            # Expected format:
            #
            # "media": [
            #   {
            #       "type": "image",
            #       "index": 0,
            #       "duration": 3,
            #       "filter": "cinematic",
            #       "effect": "zoom_in",
            #       "transition": "crossfade"
            #   },
            #   {
            #       "type": "video",
            #       "index": 0,
            #       "duration": 5,
            #       "filter": "none",
            #       "effect": "none",
            #       "transition": "fade_black"
            #   }
            # ]
            # ==================================================

            raw_media = parsed.get(
                "media",
                []
            )

            if isinstance(
                raw_media,
                list
            ):

                for idx, item in enumerate(
                    raw_media
                ):

                    if not isinstance(
                        item,
                        dict
                    ):
                        continue

                    media_type = str(
                        item.get(
                            "type",
                            ""
                        )
                    ).lower()

                    if media_type not in {
                        "image",
                        "video"
                    }:
                        continue

                    try:
                        media_index = int(
                            item.get(
                                "index",
                                idx
                            )
                        )
                    except Exception:
                        media_index = idx

                    if media_type == "image":

                        try:
                            duration = float(
                                item.get(
                                    "duration",
                                    3.5
                                )
                            )
                        except Exception:
                            duration = 3.5

                        default_effect = (
                            "zoom_in"
                        )

                    else:

                        try:
                            duration = float(
                                item.get(
                                    "duration",
                                    10.0
                                )
                            )
                        except Exception:
                            duration = 10.0

                        default_effect = (
                            "none"
                        )

                    media_item = {
                        "type": media_type,
                        "index": media_index,
                        "duration": max(
                            0.5,
                            min(
                                60.0,
                                duration
                            )
                        ),
                        "filter": (
                            item.get(
                                "filter",
                                "none"
                            )
                            if item.get(
                                "filter"
                            ) in ALLOWED_FILTERS
                            else "none"
                        ),
                        "effect": (
                            item.get(
                                "effect",
                                default_effect
                            )
                            if item.get(
                                "effect"
                            ) in ALLOWED_EFFECTS
                            else default_effect
                        ),
                        "transition": (
                            item.get(
                                "transition",
                                "crossfade"
                            )
                            if item.get(
                                "transition"
                            ) in ALLOWED_TRANSITIONS
                            else "crossfade"
                        )
                    }

                    timeline["media"].append(
                        media_item
                    )

        except Exception as json_err:

            print(
                f"Error parsing timeline JSON: "
                f"{json_err}"
            )

            timeline = None

    # ========================================================
    # START BACKGROUND JOB
    # ========================================================

    background_tasks.add_task(
        process_video_job,
        job_id=job_id,
        image_paths=image_paths,
        video_paths=video_paths,
        audio_path=audio_path,
        theme=theme,
        aspect_ratio=aspect_ratio,
        timeline_data=timeline
    )

    return {
        "job_id": job_id,
        "status": "queued"
    }


# ============================================================
# JOB STATUS
# ============================================================

@app.get(
    "/api/status/{job_id}"
)
async def get_status(
    job_id: str
):

    if job_id not in jobs:

        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    return jobs[job_id]


# ============================================================
# FRONTEND
# ============================================================

app.mount(
    "/",
    StaticFiles(
        directory=STATIC_FRONTEND_DIR,
        html=True
    ),
    name="frontend"
)