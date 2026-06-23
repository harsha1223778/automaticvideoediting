import os
import math
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw
# Monkeypatch PIL.Image.ANTIALIAS for MoviePy compatibility with Pillow 10+
import PIL.Image
if not hasattr(PIL.Image, "ANTIALIAS"):
    PIL.Image.ANTIALIAS = PIL.Image.Resampling.LANCZOS

import librosa
from moviepy.editor import ImageClip, AudioFileClip, CompositeVideoClip, concatenate_videoclips, ColorClip


def preprocess_image(image_path, target_width, target_height, style="blur_fit"):
    """
    Resizes and crops/pads the image to the target dimensions.
    Styles:
    - 'crop_fill': Resize to fill the dimensions, cropping excess.
    - 'blur_fit': Scale to fit, placing over a blurred, scaled-up background.
    """
    img = Image.open(image_path)
    img_w, img_h = img.size
    
    target_aspect = target_width / target_height
    img_aspect = img_w / img_h
    
    if style == "crop_fill":
        # Crop to fill
        if img_aspect > target_aspect:
            # Image is wider than target aspect
            new_h = target_height
            new_w = int(new_h * img_aspect)
            img_resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            left = (new_w - target_width) // 2
            img_cropped = img_resized.crop((left, 0, left + target_width, target_height))
        else:
            # Image is taller than target aspect
            new_w = target_width
            new_h = int(new_w / img_aspect)
            img_resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            top = (new_h - target_height) // 2
            img_cropped = img_resized.crop((0, top, target_width, top + target_height))
        return img_cropped
        
    elif style == "blur_fit":
        # Create blurred background
        if img_aspect > target_aspect:
            # Scale background to fill height, crop width
            bg_h = target_height
            bg_w = int(bg_h * img_aspect)
            bg = img.resize((bg_w, bg_h), Image.Resampling.LANCZOS)
            left = (bg_w - target_width) // 2
            bg = bg.crop((left, 0, left + target_width, target_height))
        else:
            # Scale background to fill width, crop height
            bg_w = target_width
            bg_h = int(bg_w / img_aspect)
            bg = img.resize((bg_w, bg_h), Image.Resampling.LANCZOS)
            top = (bg_h - target_height) // 2
            bg = bg.crop((0, top, target_width, top + target_height))
            
        # Apply strong blur to background
        bg = bg.filter(ImageFilter.GaussianBlur(30))
        
        # Scale foreground to fit inside target dimensions
        if img_aspect > target_aspect:
            fg_w = target_width
            fg_h = int(fg_w / img_aspect)
        else:
            fg_h = target_height
            fg_w = int(fg_h * img_aspect)
            
        fg = img.resize((fg_w, fg_h), Image.Resampling.LANCZOS)
        
        # Paste foreground onto blurred background
        offset_x = (target_width - fg_w) // 2
        offset_y = (target_height - fg_h) // 2
        bg.paste(fg, (offset_x, offset_y))
        return bg
    
    return img

def apply_color_filter(img, filter_type):
    """
    Applies color grading and filters to the PIL Image.
    """
    if filter_type == "vintage":
        # Warm tones, lower contrast, slightly desaturated
        r, g, b = img.split()
        r = r.point(lambda i: min(255, int(i * 1.05)))
        b = b.point(lambda i: int(i * 0.9))
        img = Image.merge("RGB", (r, g, b))
        img = ImageEnhance.Contrast(img).enhance(0.9)
        img = ImageEnhance.Color(img).enhance(0.8)
        
    elif filter_type == "cinematic":
        # Cool shadow tones, higher contrast
        r, g, b = img.split()
        b = b.point(lambda i: min(255, int(i * 1.02)))
        g = g.point(lambda i: min(255, int(i * 1.01)))
        img = Image.merge("RGB", (r, g, b))
        img = ImageEnhance.Contrast(img).enhance(1.15)
        img = ImageEnhance.Color(img).enhance(1.1)
        
    elif filter_type == "energetic":
        # High saturation, high contrast
        img = ImageEnhance.Contrast(img).enhance(1.25)
        img = ImageEnhance.Color(img).enhance(1.3)
        
    elif filter_type == "grayscale":
        # Noir: black and white, high contrast
        img = img.convert("L")
        img = Image.merge("RGB", (img, img, img))
        img = ImageEnhance.Contrast(img).enhance(1.35)
        
    elif filter_type == "cyberpunk":
        # Cyberpunk: neon purples/cyans, high contrast & saturation
        r, g, b = img.split()
        r = r.point(lambda i: min(255, int(i * 1.15)))
        g = g.point(lambda i: int(i * 0.85))
        b = b.point(lambda i: min(255, int(i * 1.25)))
        img = Image.merge("RGB", (r, g, b))
        img = ImageEnhance.Contrast(img).enhance(1.2)
        img = ImageEnhance.Color(img).enhance(1.35)
        
    elif filter_type == "dreamy":
        # Soft focus glow, slight warm bloom
        blurred = img.filter(ImageFilter.GaussianBlur(8))
        img = Image.blend(img, blurred, 0.25)
        img = ImageEnhance.Contrast(img).enhance(1.05)
        img = ImageEnhance.Color(img).enhance(1.1)
        
    elif filter_type == "sunset":
        # Warm orange/golden hour sepia tone
        r, g, b = img.split()
        r = r.point(lambda i: min(255, int(i * 1.2)))
        g = g.point(lambda i: min(255, int(i * 1.05)))
        b = b.point(lambda i: int(i * 0.75))
        img = Image.merge("RGB", (r, g, b))
        img = ImageEnhance.Contrast(img).enhance(1.1)
        
    elif filter_type == "cool_pine":
        # Moody cool green, desaturated reds/warm colors
        r, g, b = img.split()
        r = r.point(lambda i: int(i * 0.85))
        g = g.point(lambda i: min(255, int(i * 1.05)))
        b = b.point(lambda i: min(255, int(i * 1.02)))
        img = Image.merge("RGB", (r, g, b))
        img = ImageEnhance.Color(img).enhance(0.75)
        img = ImageEnhance.Contrast(img).enhance(1.1)
        
    elif filter_type == "cinematic_letterbox":
        # Cool shadow tones, higher contrast
        r, g, b = img.split()
        b = b.point(lambda i: min(255, int(i * 1.02)))
        g = g.point(lambda i: min(255, int(i * 1.01)))
        img = Image.merge("RGB", (r, g, b))
        img = ImageEnhance.Contrast(img).enhance(1.15)
        img = ImageEnhance.Color(img).enhance(1.1)
        # Draw cinematic letterbox bars
        draw = ImageDraw.Draw(img)
        h_bar = int(img.height * 0.08)
        draw.rectangle([0, 0, img.width, h_bar], fill=(0, 0, 0))
        draw.rectangle([0, img.height - h_bar, img.width, img.height], fill=(0, 0, 0))
        
    elif filter_type == "cyberpunk_frame":
        # Cyberpunk purple/cyan tone
        r, g, b = img.split()
        r = r.point(lambda i: min(255, int(i * 1.15)))
        g = g.point(lambda i: int(i * 0.85))
        b = b.point(lambda i: min(255, int(i * 1.25)))
        img = Image.merge("RGB", (r, g, b))
        img = ImageEnhance.Contrast(img).enhance(1.2)
        img = ImageEnhance.Color(img).enhance(1.35)
        # Glowing cyan border
        draw = ImageDraw.Draw(img)
        border_width = 8
        draw.rectangle([0, 0, img.width, img.height], outline=(0, 255, 255), width=border_width)
        
    elif filter_type == "vintage_grain":
        # Vintage warm nostalgic tone
        r, g, b = img.split()
        r = r.point(lambda i: min(255, int(i * 1.05)))
        b = b.point(lambda i: int(i * 0.9))
        img = Image.merge("RGB", (r, g, b))
        img = ImageEnhance.Contrast(img).enhance(0.9)
        img = ImageEnhance.Color(img).enhance(0.8)
        # Generate random noise for film grain
        noise = np.random.randint(-18, 18, (img.height, img.width, 3), dtype=np.int16)
        img_np = np.array(img, dtype=np.int16)
        img_np = np.clip(img_np + noise, 0, 255).astype(np.uint8)
        img = Image.fromarray(img_np)
        
    elif filter_type == "polaroid":
        # Faded blacks, high warmth, retro faded print
        img = ImageEnhance.Contrast(img).enhance(1.15)
        img = ImageEnhance.Color(img).enhance(0.9)
        r, g, b = img.split()
        r = r.point(lambda i: min(255, int(i * 0.95 + 12)))
        g = g.point(lambda i: min(255, int(i * 0.9 + 10)))
        b = b.point(lambda i: min(255, int(i * 0.85 + 8)))
        img = Image.merge("RGB", (r, g, b))
        
        # Warm white Polaroid paper frame overlay
        frame = Image.new("RGB", (img.width, img.height), (245, 245, 240))
        border_w = int(img.width * 0.06)
        border_h_top = int(img.height * 0.06)
        border_h_bot = int(img.height * 0.16)
        
        fg_w = img.width - 2 * border_w
        fg_h = img.height - border_h_top - border_h_bot
        
        fg = img.resize((fg_w, fg_h), Image.Resampling.LANCZOS)
        frame.paste(fg, (border_w, border_h_top))
        img = frame
        
    elif filter_type == "vaporwave":
        # Extreme hot pinks, cyan shadows, purples
        r, g, b = img.split()
        r = r.point(lambda i: min(255, int(i * 1.25)))
        g = g.point(lambda i: int(i * 0.7))
        b = b.point(lambda i: min(255, int(i * 1.35)))
        img = Image.merge("RGB", (r, g, b))
        img = ImageEnhance.Contrast(img).enhance(1.2)
        img = ImageEnhance.Color(img).enhance(1.4)
        
    return img

def analyze_audio_beats(audio_path, max_duration=60):
    """
    Detects beat timestamps in the audio file using Librosa.
    Also returns the normalized RMS amplitude envelope for audio-reactive VFX.
    """
    try:
        # Load audio (first 60s for speed and memory)
        y, sr = librosa.load(audio_path, duration=max_duration)
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        beat_times = librosa.frames_to_time(beat_frames, sr=sr)
        
        # Compute RMS energy envelope
        rms = librosa.feature.rms(y=y)[0]
        # Normalize RMS envelope to range 0.0 - 1.0
        if len(rms) > 0:
            rms_max = np.max(rms)
            if rms_max > 0:
                rms = rms / rms_max
        rms_times = librosa.times_like(rms, sr=sr)
        
        return list(beat_times), tempo, list(rms_times), list(rms)
    except Exception as e:
        print(f"Beat detection failed: {e}")
        return [], 120.0, [], []

def create_video_from_assets(image_paths, audio_path, output_path, theme="cinematic", aspect_ratio="16:9", timeline_data=None):
    """
    Main generator function to compile a video from images and background music.
    """
    # 1. Determine dimensions
    if aspect_ratio == "9:16":
        width, height = 720, 1280
    else:
        width, height = 1280, 720
        
    # 2. Get Beat Timestamps & Audio Envelope
    beat_times, tempo, rms_times, rms_vals = analyze_audio_beats(audio_path)
    # Ensure tempo is a scalar float (librosa 0.10+ can return a numpy array)
    tempo = float(np.mean(tempo))
    print(f"Detected tempo: {tempo:.2f} BPM. Found {len(beat_times)} beats.")

    # Audio duration
    audio_clip = AudioFileClip(audio_path)
    total_audio_duration = audio_clip.duration
    
    # Process audio settings
    audio_offset = 0.0
    audio_volume = 1.0
    if timeline_data and "audio" in timeline_data:
        audio_offset = float(timeline_data["audio"].get("offset", 0.0))
        audio_volume = float(timeline_data["audio"].get("volume", 1.0))
        
    if audio_offset > 0 and audio_offset < total_audio_duration:
        audio_clip = audio_clip.subclip(audio_offset)
        total_audio_duration -= audio_offset
        
    if audio_volume != 1.0:
        # MoviePy volumex adjusts volume
        audio_clip = audio_clip.volumex(audio_volume)

    # 3. Plan durations based on timeline_data or beats
    num_images = len(image_paths)
    durations = []
    
    if timeline_data and "images" in timeline_data and len(timeline_data["images"]) >= num_images:
        for idx in range(num_images):
            durations.append(float(timeline_data["images"][idx]["duration"]))
    else:
        if len(beat_times) >= num_images:
            # We want to change images on major beats (e.g., every 4 or 8 beats depending on tempo)
            beats_per_slide = 4 if tempo > 110 else 2
            
            last_time = 0.0
            for i in range(num_images):
                # Calculate corresponding beat index
                beat_idx = min((i + 1) * beats_per_slide, len(beat_times) - 1)
                next_time = beat_times[beat_idx]
                
                # Keep it reasonable: slide duration between 1.5s and 6s
                duration = next_time - last_time
                if duration < 1.5:
                    duration = 2.0
                elif duration > 6.0:
                    duration = 4.0
                    
                durations.append(duration)
                last_time += duration
        else:
            # Fallback to standard duration
            fallback_duration = min(4.0, total_audio_duration / num_images)
            durations = [fallback_duration] * num_images
        
    total_video_duration = sum(durations)
    
    # Trim audio clip to match the total video duration
    if total_video_duration > total_audio_duration:
        audio_clip = audio_clip.subclip(0, total_audio_duration)
    else:
        audio_clip = audio_clip.subclip(0, total_video_duration)
        
    # 4. Process Images & Create Video Clips
    temp_processed_images = []
    clips = []
    
    # Ensure a directory exists for processed temp assets
    os.makedirs("temp_processed", exist_ok=True)
    
    # Pre-calculate start times for each clip to support beat-synced pulses
    clip_starts = []
    temp_start = 0.0
    for idx in range(num_images):
        if idx == 0:
            c_start = 0.0
        else:
            prev_transition = "crossfade"
            if timeline_data and "images" in timeline_data and (idx - 1) < len(timeline_data["images"]):
                prev_transition = timeline_data["images"][idx - 1].get("transition", "crossfade")
            trans_dur = 0.6 if prev_transition != "none" else 0.0
            c_start = temp_start - trans_dur
        clip_starts.append(c_start)
        temp_start += durations[idx]

    # Helper function to get volume amplitude at any given time
    def get_audio_amplitude(t):
        if not rms_times or not rms_vals:
            return 0.0
        return float(np.interp(t, rms_times, rms_vals))

    # Helper function to add beat-synced scale pulses and transition zooms
    def make_zoom_pulse_fn(base_zoom_fn, local_beats, c_start_time, slide_dur, clip_dur, clip_trans, prev_trans, trans_dur, effect_type="none", idx_val=0):
        def zoom_fn(t):
            base_scale = base_zoom_fn(t)
            
            # Continuous audio reactive zoom
            if effect_type == "audio_pulse":
                base_scale += 0.08 * get_audio_amplitude(c_start_time + t)
            
            # Ease out beat decay (0.25 seconds duration)
            pulse = 0.0
            for beat_t in local_beats:
                diff = t - beat_t
                if 0 <= diff < 0.25:
                    pulse += 0.045 * (1.0 - diff / 0.25)
            scale = base_scale + pulse
            
            # Outgoing zoom_blend transition
            if idx_val < num_images - 1 and clip_trans == "zoom_blend" and trans_dur > 0:
                if t > slide_dur:
                    progress = (t - slide_dur) / trans_dur
                    scale *= (1.0 + 0.3 * progress)
            # Incoming zoom_blend transition
            if idx_val > 0 and prev_trans == "zoom_blend" and trans_dur > 0:
                if t < trans_dur:
                    progress = t / trans_dur
                    scale *= (1.3 - 0.3 * progress)
            return scale
        return zoom_fn

    # Helper function to calculate centering offsets, including beat shake and glitch pulses
    def make_centered_pos_fn(zoom_fn, local_beats, w, h, effect_type="none"):
        def pos_fn(t):
            scale = zoom_fn(t)
            x = int(w * (1.0 - scale) / 2.0)
            y = int(h * (1.0 - scale) / 2.0)
            
            # Beat shake camera vibration
            if effect_type == "beat_shake" and local_beats:
                for beat_t in local_beats:
                    diff = t - beat_t
                    if 0 <= diff < 0.3:
                        decay = (1.0 - diff / 0.3)
                        x += int(w * 0.035 * decay * math.sin(diff * 75.0))
                        y += int(h * 0.035 * decay * math.cos(diff * 65.0))
            # Glitch jitter on beats
            elif effect_type == "glitch_pulse" and local_beats:
                for beat_t in local_beats:
                    diff = t - beat_t
                    if 0 <= diff < 0.18:
                        if math.sin(diff * 140.0) > 0.2:
                            x += int(w * 0.025 * math.sin(diff * 220.0))
                            y += int(h * 0.02 * math.cos(diff * 280.0))
            return (x, y)
        return pos_fn

    # Helper function to calculate time-varying spin transition rotations
    def make_spin_rotate_fn(base_rotate_fn, idx_val, slide_dur, clip_dur, clip_trans, prev_trans, trans_dur):
        def rotate_fn(t):
            angle = base_rotate_fn(t) if callable(base_rotate_fn) else base_rotate_fn
            # Outgoing spin transition
            if idx_val < num_images - 1 and clip_trans == "spin_blend" and trans_dur > 0:
                if t > slide_dur:
                    progress = (t - slide_dur) / trans_dur
                    angle += 45.0 * progress
            # Incoming spin transition
            if idx_val > 0 and prev_trans == "spin_blend" and trans_dur > 0:
                if t < trans_dur:
                    progress = t / trans_dur
                    angle += -45.0 * (1.0 - progress)
            return angle
        return rotate_fn

    for idx, img_path in enumerate(image_paths):
        # Apply aspect fitting - always fit full image with blurred padding
        style = "blur_fit"
        processed_img = preprocess_image(img_path, width, height, style=style)
        
        # Retrieve individual filter/theme/effect
        clip_theme = theme
        clip_transition = "crossfade"
        clip_effect = "zoom_in"
        if timeline_data and "images" in timeline_data and idx < len(timeline_data["images"]):
            clip_theme = timeline_data["images"][idx].get("filter", theme)
            clip_transition = timeline_data["images"][idx].get("transition", "crossfade")
            clip_effect = timeline_data["images"][idx].get("effect", "zoom_in")
            
        # Retrieve transition before this clip
        prev_transition = "none"
        if idx > 0:
            if timeline_data and "images" in timeline_data and (idx - 1) < len(timeline_data["images"]):
                prev_transition = timeline_data["images"][idx - 1].get("transition", "crossfade")
            else:
                prev_transition = "crossfade"
        
        # Apply visual filter
        if clip_theme != "none":
            processed_img = apply_color_filter(processed_img, clip_theme)
        
        # Save temp image
        temp_path = f"temp_processed/img_{idx}.png"
        processed_img.save(temp_path)
        temp_processed_images.append(temp_path)
        
        slide_duration = durations[idx]
        trans_duration = 0.6 if clip_transition != "none" else 0.0
        # For transitions to work, each slide (except the last) needs to be slightly longer
        clip_duration = slide_duration + (trans_duration if (idx < num_images - 1 and trans_duration > 0) else 0)
        
        # Find beats falling within this clip's timeline window
        c_start = clip_starts[idx]
        local_beats = [b - c_start for b in beat_times if c_start <= b <= (c_start + clip_duration)]
        
        clip = ImageClip(temp_path).set_duration(clip_duration)
        
        # Determine zoom configuration based on effect
        if clip_effect == "zoom_out":
            base_zoom = lambda t: 1.06 - 0.06 * (t / clip_duration)
        elif clip_effect == "audio_pulse":
            base_zoom = lambda t: 1.0
        elif clip_effect == "none":
            base_zoom = lambda t: 1.0
        else: # zoom_in, beat_shake, glitch_pulse, or default
            base_zoom = lambda t: 1.0 + 0.06 * (t / clip_duration)
            
        # Determine transition duration
        prev_trans_dur = 0.6 if prev_transition != "none" else 0.0
        
        # Generate dynamic time-varying zoom scale function
        zoom_fn = make_zoom_pulse_fn(
            base_zoom, local_beats, c_start, slide_duration, clip_duration,
            clip_transition, prev_transition, prev_trans_dur, effect_type=clip_effect, idx_val=idx
        )
        
        # Add rotation wrapper for spin transitions or slow spin effect
        base_rotate = lambda t: 0
        if clip_effect == "slow_spin":
            base_rotate = lambda t: 6.0 * (t / clip_duration) - 3.0
            
        rotate_fn = make_spin_rotate_fn(
            base_rotate, idx, slide_duration, clip_duration,
            clip_transition, prev_transition, prev_trans_dur
        )
        
        # Apply scaling
        clip = clip.resize(zoom_fn)
        
        # Apply rotation if active
        if clip_transition == "spin_blend" or prev_transition == "spin_blend" or clip_effect == "slow_spin":
            clip = clip.rotate(rotate_fn)
            
        # Set positioning based on effect
        if clip_effect == "pan_left":
            clip = clip.set_position(lambda t: (int(-0.15 * width * (t / clip_duration)), 0))
        elif clip_effect == "pan_right":
            clip = clip.set_position(lambda t: (int(-0.15 * width * (1.0 - t / clip_duration)), 0))
        elif clip_effect == "tilt_up":
            clip = clip.set_position(lambda t: (0, int(-0.15 * height * (t / clip_duration))))
        elif clip_effect == "tilt_down":
            clip = clip.set_position(lambda t: (0, int(-0.15 * height * (1.0 - t / clip_duration))))
        elif clip_effect == "diagonal_pan":
            clip = clip.set_position(
                lambda t: (int(-0.08 * width * (1.0 - t / clip_duration)), int(-0.08 * height * (1.0 - t / clip_duration)))
            )
        else:
            # Custom centering position containing shakes and glitches
            pos_fn = make_centered_pos_fn(zoom_fn, local_beats, width, height, effect_type=clip_effect)
            clip = clip.set_position(pos_fn)
            
        clips.append(clip)

    # 6. Compose Video with Transitions
    positioned_clips = []
    current_start = 0.0
    
    for idx, clip in enumerate(clips):
        if idx == 0:
            positioned_clip = clip.set_start(0)
        else:
            # Overlap with previous clip depending on previous clip's transition setting
            prev_transition = "crossfade"
            if timeline_data and "images" in timeline_data and (idx - 1) < len(timeline_data["images"]):
                prev_transition = timeline_data["images"][idx - 1].get("transition", "crossfade")
            
            trans_dur = 0.6 if prev_transition != "none" else 0.0
            
            if trans_dur > 0:
                clip_start = current_start - trans_dur
                if prev_transition in ("crossfade", "zoom_blend", "spin_blend"):
                    positioned_clip = clip.set_start(clip_start).crossfadein(trans_dur)
                elif prev_transition == "slide_left":
                    positioned_clip = clip.set_start(clip_start).set_position(
                        lambda t: (int(width * (1.0 - t / trans_dur)), 0) if t < trans_dur else (0, 0)
                    )
                elif prev_transition == "slide_right":
                    positioned_clip = clip.set_start(clip_start).set_position(
                        lambda t: (int(-width * (1.0 - t / trans_dur)), 0) if t < trans_dur else (0, 0)
                    )
                elif prev_transition == "slide_up":
                    positioned_clip = clip.set_start(clip_start).set_position(
                        lambda t: (0, int(height * (1.0 - t / trans_dur))) if t < trans_dur else (0, 0)
                    )
                elif prev_transition == "slide_down":
                    positioned_clip = clip.set_start(clip_start).set_position(
                        lambda t: (0, int(-height * (1.0 - t / trans_dur))) if t < trans_dur else (0, 0)
                    )
                elif prev_transition == "slide_diagonal":
                    positioned_clip = clip.set_start(clip_start).set_position(
                        lambda t: (int(width * (1.0 - t / trans_dur)), int(height * (1.0 - t / trans_dur))) if t < trans_dur else (0, 0)
                    )
                elif prev_transition == "fade_black":
                    if len(positioned_clips) > 0:
                        positioned_clips[-1] = positioned_clips[-1].fadeout(trans_dur)
                    positioned_clip = clip.set_start(clip_start).fadein(trans_dur)
                elif prev_transition == "white_flash":
                    positioned_clip = clip.set_start(clip_start)
                    # Bright white transition flash clip
                    flash = ColorClip(size=(width, height), color=(255, 255, 255))\
                                .set_duration(0.35)\
                                .set_start(clip_start)\
                                .fadeout(0.35)\
                                .set_opacity(0.55)
                    positioned_clips.append(flash)
                elif prev_transition == "glitch_cut":
                    # Hard cut with chromatic jitter positioning offset
                    def glitch_cut_pos(t):
                        # Centered coordinates
                        x = int(width * (1.0 - 1.05) / 2.0)
                        y = int(height * (1.0 - 1.05) / 2.0)
                        if t < 0.15:
                            x += int(width * 0.04 * math.sin(t * 140.0))
                            y += int(height * 0.03 * math.cos(t * 160.0))
                        return (x, y)
                    positioned_clip = clip.set_start(clip_start).set_position(glitch_cut_pos)
                else: # Fallback to cut/none
                    positioned_clip = clip.set_start(current_start)
            else:
                positioned_clip = clip.set_start(current_start)
            
        positioned_clips.append(positioned_clip)
        current_start += durations[idx]

    # Add rhythmic soft white flashes on the beat
    for t_beat in beat_times:
        if t_beat < total_video_duration:
            flash = ColorClip(size=(width, height), color=(255, 255, 255))\
                        .set_duration(0.2)\
                        .set_start(t_beat)\
                        .fadeout(0.2)\
                        .set_opacity(0.12)
            positioned_clips.append(flash)
        
    final_video = CompositeVideoClip(positioned_clips, size=(width, height))
    final_video = final_video.set_audio(audio_clip)
    
    # 7. Render final MP4
    final_video.write_videofile(
        output_path, 
        fps=24, 
        codec="libx264", 
        audio_codec="aac",
        preset="medium",
        ffmpeg_params=["-pix_fmt", "yuv420p"]
    )
    
    # Close resources
    final_video.close()
    audio_clip.close()
    
    # 8. Cleanup temp files
    for temp_path in temp_processed_images:
        try:
            os.remove(temp_path)
        except OSError:
            pass
            
    print("Video generation completed successfully!")
    return output_path
