import os
import shutil
import uuid
from typing import List
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from video_generator import create_video_from_assets

app = FastAPI(title="Automatic Video Editor API")

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories for temporary files and generated outputs
UPLOAD_DIR = "temp_uploads"
OUTPUT_DIR = "static_outputs"
STATIC_FRONTEND_DIR = "static"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(STATIC_FRONTEND_DIR, exist_ok=True)

# Serve generated videos
app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")

# Keep track of active jobs
jobs = {}

def process_video_job(job_id: str, image_paths: List[str], audio_path: str, theme: str, aspect_ratio: str, timeline_data: dict = None):
    output_filename = f"{job_id}.mp4"
    output_path = os.path.join(OUTPUT_DIR, output_filename)
    
    try:
        jobs[job_id]["status"] = "rendering"
        jobs[job_id]["progress"] = 40
        
        # Run generator
        create_video_from_assets(
            image_paths=image_paths,
            audio_path=audio_path,
            output_path=output_path,
            theme=theme,
            aspect_ratio=aspect_ratio,
            timeline_data=timeline_data
        )

        
        jobs[job_id]["status"] = "completed"
        jobs[job_id]["progress"] = 100
        jobs[job_id]["video_url"] = f"/outputs/{output_filename}"

        
    except Exception as e:
        print(f"Error generating video for job {job_id}: {e}")
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)
    finally:
        # Cleanup uploaded images/audio
        session_upload_dir = os.path.dirname(audio_path)
        try:
            shutil.rmtree(session_upload_dir)
        except Exception as cleanup_err:
            print(f"Failed to cleanup temp uploads: {cleanup_err}")

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "Video Editor API is running!"}


# Security validation constants
ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_AUDIO_EXTS = {".mp3", ".wav", ".aac", ".m4a", ".ogg"}

# Max sizes
MAX_IMAGE_SIZE = 15 * 1024 * 1024  # 15 MB
MAX_AUDIO_SIZE = 50 * 1024 * 1024  # 50 MB

# Whitelists of allowed values for visual options
ALLOWED_THEMES = {"cinematic", "energetic", "vintage", "none"}
ALLOWED_FILTERS = {
    "none", "cinematic", "cinematic_letterbox", "cyberpunk", "cyberpunk_frame",
    "vintage", "vintage_grain", "polaroid", "vaporwave", "dreamy", "sunset", "grayscale"
}
ALLOWED_EFFECTS = {
    "zoom_in", "zoom_out", "pan_left", "pan_right", "tilt_up", "tilt_down",
    "slow_spin", "diagonal_pan", "beat_shake", "audio_pulse", "glitch_pulse", "none"
}
ALLOWED_TRANSITIONS = {
    "none", "crossfade", "slide_left", "slide_right", "slide_up", "slide_down",
    "slide_diagonal", "fade_black", "zoom_blend", "spin_blend", "white_flash", "glitch_cut"
}

def get_upload_file_size(upload_file: UploadFile) -> int:
    # In newer FastAPI / Starlette, upload_file.size is directly populated
    if hasattr(upload_file, "size") and upload_file.size is not None:
        return upload_file.size
    # Fallback using seek
    upload_file.file.seek(0, 2)
    size = upload_file.file.tell()
    upload_file.file.seek(0)
    return size

def validate_file(upload_file: UploadFile, allowed_exts: set, max_size: int, file_type: str):
    filename = upload_file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file extension {ext} for {file_type}. Allowed extensions: {', '.join(allowed_exts)}"
        )
    
    # Check content type prefix
    content_type = upload_file.content_type or ""
    if file_type == "image" and not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image type.")
    if file_type == "audio" and not content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be an audio type.")
        
    size = get_upload_file_size(upload_file)
    if size > max_size:
        raise HTTPException(
            status_code=413,
            detail=f"File {filename} is too large ({size / (1024 * 1024):.2f}MB). Max size is {max_size / (1024 * 1024):.0f}MB."
        )

@app.post("/api/generate")
async def generate_video(
    background_tasks: BackgroundTasks,
    images: List[UploadFile] = File(...),
    audio: UploadFile = File(...),
    theme: str = Form("cinematic"),
    aspect_ratio: str = Form("16:9"),
    timeline_data: str = Form(None)
):

    if not images:
        raise HTTPException(status_code=400, detail="At least one image is required")
        
    # Validate theme and aspect_ratio
    if theme not in ALLOWED_THEMES:
        theme = "cinematic"
    if aspect_ratio not in {"16:9", "9:16"}:
        aspect_ratio = "16:9"

    # Validate uploaded files for security
    validate_file(audio, ALLOWED_AUDIO_EXTS, MAX_AUDIO_SIZE, "audio")
    for img in images:
        validate_file(img, ALLOWED_IMAGE_EXTS, MAX_IMAGE_SIZE, "image")
        
    job_id = str(uuid.uuid4())
    job_upload_dir = os.path.join(UPLOAD_DIR, job_id)
    os.makedirs(job_upload_dir, exist_ok=True)
    
    # Save audio file
    audio_ext = os.path.splitext(audio.filename)[1].lower() or ".mp3"
    audio_path = os.path.join(job_upload_dir, f"audio{audio_ext}")
    with open(audio_path, "wb") as buffer:
        shutil.copyfileobj(audio.file, buffer)
        
    # Save image files
    image_paths = []
    for idx, img in enumerate(images):
        img_ext = os.path.splitext(img.filename)[1].lower() or ".jpg"
        img_path = os.path.join(job_upload_dir, f"img_{idx}{img_ext}")
        with open(img_path, "wb") as buffer:
            shutil.copyfileobj(img.file, buffer)
        image_paths.append(img_path)
        
    # Register job status
    jobs[job_id] = {
        "status": "queued",
        "progress": 10,
        "theme": theme,
        "aspect_ratio": aspect_ratio,
        "video_url": None,
        "error": None
    }
    
    # Parse and sanitize timeline JSON data if present
    timeline = None
    if timeline_data:
        import json
        try:
            parsed = json.loads(timeline_data)
            timeline = {"images": [], "audio": {}}
            
            # Sanitize audio settings
            audio_settings = parsed.get("audio", {})
            timeline["audio"] = {
                "volume": max(0.0, min(2.0, float(audio_settings.get("volume", 1.0)))),
                "offset": max(0.0, min(300.0, float(audio_settings.get("offset", 0.0))))
            }
            
            # Sanitize image timeline settings
            raw_images = parsed.get("images", [])
            for idx, item in enumerate(raw_images):
                img_item = {
                    "index": int(item.get("index", idx)),
                    "duration": max(0.5, min(15.0, float(item.get("duration", 3.5)))),
                    "filter": item.get("filter", "none") if item.get("filter") in ALLOWED_FILTERS else "none",
                    "effect": item.get("effect", "zoom_in") if item.get("effect") in ALLOWED_EFFECTS else "zoom_in",
                    "transition": item.get("transition", "crossfade") if item.get("transition") in ALLOWED_TRANSITIONS else "crossfade"
                }
                timeline["images"].append(img_item)
                
        except Exception as json_err:
            print(f"Error parsing/sanitizing timeline JSON: {json_err}")
            timeline = None

    # Queue the background render task
    background_tasks.add_task(
        process_video_job,
        job_id=job_id,
        image_paths=image_paths,
        audio_path=audio_path,
        theme=theme,
        aspect_ratio=aspect_ratio,
        timeline_data=timeline
    )

    return {"job_id": job_id, "status": "queued"}

@app.get("/api/status/{job_id}")
async def get_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]

# Serve frontend static files at /
app.mount("/", StaticFiles(directory=STATIC_FRONTEND_DIR, html=True), name="frontend")

