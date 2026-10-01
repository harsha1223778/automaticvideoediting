import os
import math
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw

# Monkeypatch PIL.Image.ANTIALIAS for MoviePy compatibility with Pillow 10+
import PIL.Image
if not hasattr(PIL.Image, "ANTIALIAS"):
    PIL.Image.ANTIALIAS = PIL.Image.Resampling.LANCZOS

import librosa
from moviepy.editor import (
    ImageClip,
    VideoFileClip,
    AudioFileClip,
    CompositeVideoClip,
    concatenate_videoclips,
    ColorClip
)


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
        if img_aspect > target_aspect:
            new_h = target_height
            new_w = int(new_h * img_aspect)
            img_resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            left = (new_w - target_width) // 2
            img_cropped = img_resized.crop(
                (left, 0, left + target_width, target_height)
            )
        else:
            new_w = target_width
            new_h = int(new_w / img_aspect)
            img_resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            top = (new_h - target_height) // 2
            img_cropped = img_resized.crop(
                (0, top, target_width, top + target_height)
            )

        return img_cropped

    elif style == "blur_fit":
        if img_aspect > target_aspect:
            bg_h = target_height
            bg_w = int(bg_h * img_aspect)
            bg = img.resize((bg_w, bg_h), Image.Resampling.LANCZOS)
            left = (bg_w - target_width) // 2
            bg = bg.crop((left, 0, left + target_width, target_height))
        else:
            bg_w = target_width
            bg_h = int(bg_w / img_aspect)
            bg = img.resize((bg_w, bg_h), Image.Resampling.LANCZOS)
            top = (bg_h - target_height) // 2
            bg = bg.crop((0, top, target_width, top + target_height))

        bg = bg.filter(ImageFilter.GaussianBlur(30))

        if img_aspect > target_aspect:
            fg_w = target_width
            fg_h = int(fg_w / img_aspect)
        else:
            fg_h = target_height
            fg_w = int(fg_h * img_aspect)

        fg = img.resize((fg_w, fg_h), Image.Resampling.LANCZOS)

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
        r, g, b = img.split()
        r = r.point(lambda i: min(255, int(i * 1.05)))
        b = b.point(lambda i: int(i * 0.9))
        img = Image.merge("RGB", (r, g, b))
        img = ImageEnhance.Contrast(img).enhance(0.9)
        img = ImageEnhance.Color(img).enhance(0.8)

    elif filter_type == "cinematic":
        r, g, b = img.split()
        b = b.point(lambda i: min(255, int(i * 1.02)))
        g = g.point(lambda i: min(255, int(i * 1.01)))
        img = Image.merge("RGB", (r, g, b))
        img = ImageEnhance.Contrast(img).enhance(1.15)
        img = ImageEnhance.Color(img).enhance(1.1)

    elif filter_type == "energetic":
        img = ImageEnhance.Contrast(img).enhance(1.25)
        img = ImageEnhance.Color(img).enhance(1.3)

    elif filter_type == "grayscale":
        img = img.convert("L")
        img = Image.merge("RGB", (img, img, img))
        img = ImageEnhance.Contrast(img).enhance(1.35)

    elif filter_type == "cyberpunk":
        r, g, b = img.split()
        r = r.point(lambda i: min(255, int(i * 1.15)))
        g = g.point(lambda i: int(i * 0.85))
        b = b.point(lambda i: min(255, int(i * 1.25)))
        img = Image.merge("RGB", (r, g, b))
        img = ImageEnhance.Contrast(img).enhance(1.2)
        img = ImageEnhance.Color(img).enhance(1.35)

    elif filter_type == "dreamy":
        blurred = img.filter(ImageFilter.GaussianBlur(8))
        img = Image.blend(img, blurred, 0.25)
        img = ImageEnhance.Contrast(img).enhance(1.05)
        img = ImageEnhance.Color(img).enhance(1.1)

    elif filter_type == "sunset":
        r, g, b = img.split()
        r = r.point(lambda i: min(255, int(i * 1.2)))
        g = g.point(lambda i: min(255, int(i * 1.05)))
        b = b.point(lambda i: int(i * 0.75))
        img = Image.merge("RGB", (r, g, b))
        img = ImageEnhance.Contrast(img).enhance(1.1)

    elif filter_type == "cool_pine":
        r, g, b = img.split()
        r = r.point(lambda i: int(i * 0.85))
        g = g.point(lambda i: min(255, int(i * 1.05)))
        b = b.point(lambda i: min(255, int(i * 1.02)))
        img = Image.merge("RGB", (r, g, b))
        img = ImageEnhance.Color(img).enhance(0.75)
        img = ImageEnhance.Contrast(img).enhance(1.1)

    elif filter_type == "cinematic_letterbox":
        r, g, b = img.split()
        b = b.point(lambda i: min(255, int(i * 1.02)))
        g = g.point(lambda i: min(255, int(i * 1.01)))
        img = Image.merge("RGB", (r, g, b))
        img = ImageEnhance.Contrast(img).enhance(1.15)
        img = ImageEnhance.Color(img).enhance(1.1)

        draw = ImageDraw.Draw(img)
        h_bar = int(img.height * 0.08)

        draw.rectangle(
            [0, 0, img.width, h_bar],
            fill=(0, 0, 0)
        )

        draw.rectangle(
            [0, img.height - h_bar, img.width, img.height],
            fill=(0, 0, 0)
        )

    elif filter_type == "cyberpunk_frame":
        r, g, b = img.split()
        r = r.point(lambda i: min(255, int(i * 1.15)))
        g = g.point(lambda i: int(i * 0.85))
        b = b.point(lambda i: min(255, int(i * 1.25)))
        img = Image.merge("RGB", (r, g, b))
        img = ImageEnhance.Contrast(img).enhance(1.2)
        img = ImageEnhance.Color(img).enhance(1.35)

        draw = ImageDraw.Draw(img)
        border_width = 8

        draw.rectangle(
            [0, 0, img.width, img.height],
            outline=(0, 255, 255),
            width=border_width
        )

    elif filter_type == "vintage_grain":
        r, g, b = img.split()
        r = r.point(lambda i: min(255, int(i * 1.05)))
        b = b.point(lambda i: int(i * 0.9))
        img = Image.merge("RGB", (r, g, b))
        img = ImageEnhance.Contrast(img).enhance(0.9)
        img = ImageEnhance.Color(img).enhance(0.8)

        noise = np.random.randint(
            -18,
            18,
            (img.height, img.width, 3),
            dtype=np.int16
        )

        img_np = np.array(img, dtype=np.int16)
        img_np = np.clip(
            img_np + noise,
            0,
            255
        ).astype(np.uint8)

        img = Image.fromarray(img_np)

    elif filter_type == "polaroid":
        img = ImageEnhance.Contrast(img).enhance(1.15)
        img = ImageEnhance.Color(img).enhance(0.9)

        r, g, b = img.split()

        r = r.point(
            lambda i: min(255, int(i * 0.95 + 12))
        )

        g = g.point(
            lambda i: min(255, int(i * 0.9 + 10))
        )

        b = b.point(
            lambda i: min(255, int(i * 0.85 + 8))
        )

        img = Image.merge("RGB", (r, g, b))

        frame = Image.new(
            "RGB",
            (img.width, img.height),
            (245, 245, 240)
        )

        border_w = int(img.width * 0.06)
        border_h_top = int(img.height * 0.06)
        border_h_bot = int(img.height * 0.16)

        fg_w = img.width - 2 * border_w
        fg_h = img.height - border_h_top - border_h_bot

        fg = img.resize(
            (fg_w, fg_h),
            Image.Resampling.LANCZOS
        )

        frame.paste(
            fg,
            (border_w, border_h_top)
        )

        img = frame

    elif filter_type == "vaporwave":
        r, g, b = img.split()
        r = r.point(lambda i: min(255, int(i * 1.25)))
        g = g.point(lambda i: int(i * 0.7))
        b = b.point(lambda i: min(255, int(i * 1.35)))
        img = Image.merge("RGB", (r, g, b))
        img = ImageEnhance.Contrast(img).enhance(1.2)
        img = ImageEnhance.Color(img).enhance(1.4)

    return img


def preprocess_video_clip(video_path, target_width, target_height):
    """
    Resize and center-crop a video to the requested output dimensions.
    """

    clip = VideoFileClip(video_path)

    target_aspect = target_width / target_height
    video_aspect = clip.w / clip.h

    if video_aspect > target_aspect:

        clip = clip.resize(
            height=target_height
        )

        x_center = clip.w / 2

        clip = clip.crop(
            x_center=x_center,
            width=target_width
        )

    else:

        clip = clip.resize(
            width=target_width
        )

        y_center = clip.h / 2

        clip = clip.crop(
            y_center=y_center,
            height=target_height
        )

    return clip


def analyze_audio_beats(audio_path, max_duration=60):
    """
    Detects beat timestamps in the audio file using Librosa.
    Also returns the normalized RMS amplitude envelope.
    """

    try:

        y, sr = librosa.load(
            audio_path,
            duration=max_duration
        )

        tempo, beat_frames = librosa.beat.beat_track(
            y=y,
            sr=sr
        )

        beat_times = librosa.frames_to_time(
            beat_frames,
            sr=sr
        )

        rms = librosa.feature.rms(y=y)[0]

        if len(rms) > 0:

            rms_max = np.max(rms)

            if rms_max > 0:
                rms = rms / rms_max

        rms_times = librosa.times_like(
            rms,
            sr=sr
        )

        return (
            list(beat_times),
            tempo,
            list(rms_times),
            list(rms)
        )

    except Exception as e:

        print(
            f"Beat detection failed: {e}"
        )

        return (
            [],
            120.0,
            [],
            []
        )


def create_video_from_video_assets(
    video_paths,
    audio_path,
    output_path,
    theme="cinematic",
    aspect_ratio="16:9",
    timeline_data=None
):
    """
    Create an edited video from uploaded video clips.

    Features:
    - Multiple video clips
    - Aspect-ratio conversion
    - Color filters
    - Clip trimming
    - Background music
    - Crossfade transitions
    """

    if aspect_ratio == "9:16":
        width, height = 720, 1280

    elif aspect_ratio == "1:1":
        width, height = 1080, 1080

    else:
        width, height = 1280, 720

    audio_clip = AudioFileClip(
        audio_path
    )

    audio_volume = 1.0
    audio_offset = 0.0

    if timeline_data and "audio" in timeline_data:

        audio_settings = timeline_data["audio"]

        audio_volume = float(
            audio_settings.get(
                "volume",
                1.0
            )
        )

        audio_offset = float(
            audio_settings.get(
                "offset",
                0.0
            )
        )

    if audio_offset > 0:

        audio_clip = audio_clip.subclip(
            audio_offset
        )

    if audio_volume != 1.0:

        audio_clip = audio_clip.volumex(
            audio_volume
        )

    clips = []

    for idx, video_path in enumerate(video_paths):

        print(
            f"Processing video {idx + 1}/{len(video_paths)}"
        )

        clip = preprocess_video_clip(
            video_path,
            width,
            height
        )

        clip = clip.without_audio()

        clip_filter = theme
        requested_duration = None

        if timeline_data and "videos" in timeline_data:

            if idx < len(
                timeline_data["videos"]
            ):

                video_settings = (
                    timeline_data["videos"][idx]
                )

                clip_filter = video_settings.get(
                    "filter",
                    theme
                )

                requested_duration = (
                    video_settings.get(
                        "duration"
                    )
                )

        if requested_duration is not None:

            requested_duration = float(
                requested_duration
            )

            requested_duration = max(
                0.5,
                requested_duration
            )

            if requested_duration < clip.duration:

                clip = clip.subclip(
                    0,
                    requested_duration
                )

        if clip_filter != "none":

            def apply_frame_filter(frame):

                pil_image = Image.fromarray(
                    frame
                )

                filtered = apply_color_filter(
                    pil_image,
                    clip_filter
                )

                return np.array(
                    filtered
                )

            clip = clip.fl_image(
                apply_frame_filter
            )

        clips.append(clip)

    if not clips:

        raise ValueError(
            "No video clips were provided."
        )

    final_video = concatenate_videoclips(
        clips,
        method="compose"
    )

    if final_video.duration > audio_clip.duration:

        final_video = final_video.subclip(
            0,
            audio_clip.duration
        )

    else:

        audio_clip = audio_clip.subclip(
            0,
            final_video.duration
        )

    final_video = final_video.set_audio(
        audio_clip
    )

    print(
        "Rendering edited video..."
    )

    final_video.write_videofile(
        output_path,
        fps=24,
        codec="libx264",
        audio_codec="aac",
        preset="medium",
        ffmpeg_params=[
            "-pix_fmt",
            "yuv420p"
        ]
    )

    final_video.close()
    audio_clip.close()

    for clip in clips:

        try:
            clip.close()
        except Exception:
            pass

    print(
        "Video editing completed successfully!"
    )

    return output_path


def create_video_from_assets(
    image_paths,
    audio_path,
    output_path,
    theme="cinematic",
    aspect_ratio="16:9",
    timeline_data=None
):
    """
    Main generator function to compile a video
    from images and background music.
    """

    if aspect_ratio == "9:16":

        width, height = 720, 1280

    else:

        width, height = 1280, 720

    beat_times, tempo, rms_times, rms_vals = (
        analyze_audio_beats(audio_path)
    )

    tempo = float(
        np.mean(tempo)
    )

    print(
        f"Detected tempo: {tempo:.2f} BPM. "
        f"Found {len(beat_times)} beats."
    )

    audio_clip = AudioFileClip(
        audio_path
    )

    total_audio_duration = (
        audio_clip.duration
    )

    audio_offset = 0.0
    audio_volume = 1.0

    if timeline_data and "audio" in timeline_data:

        audio_offset = float(
            timeline_data["audio"].get(
                "offset",
                0.0
            )
        )

        audio_volume = float(
            timeline_data["audio"].get(
                "volume",
                1.0
            )
        )

    if (
        audio_offset > 0
        and audio_offset < total_audio_duration
    ):

        audio_clip = audio_clip.subclip(
            audio_offset
        )

        total_audio_duration -= (
            audio_offset
        )

    if audio_volume != 1.0:

        audio_clip = audio_clip.volumex(
            audio_volume
        )

    num_images = len(
        image_paths
    )

    durations = []

    if (
        timeline_data
        and "images" in timeline_data
        and len(timeline_data["images"]) >= num_images
    ):

        for idx in range(num_images):

            durations.append(
                float(
                    timeline_data["images"][idx][
                        "duration"
                    ]
                )
            )

    else:

        if len(beat_times) >= num_images:

            beats_per_slide = (
                4
                if tempo > 110
                else 2
            )

            last_time = 0.0

            for i in range(num_images):

                beat_idx = min(
                    (i + 1) * beats_per_slide,
                    len(beat_times) - 1
                )

                next_time = (
                    beat_times[beat_idx]
                )

                duration = (
                    next_time -
                    last_time
                )

                if duration < 1.5:

                    duration = 2.0

                elif duration > 6.0:

                    duration = 4.0

                durations.append(
                    duration
                )

                last_time += duration

        else:

            fallback_duration = min(
                4.0,
                total_audio_duration / num_images
            )

            durations = [
                fallback_duration
            ] * num_images

    total_video_duration = sum(
        durations
    )

    if total_video_duration > total_audio_duration:

        audio_clip = audio_clip.subclip(
            0,
            total_audio_duration
        )

    else:

        audio_clip = audio_clip.subclip(
            0,
            total_video_duration
        )

    temp_processed_images = []
    clips = []

    os.makedirs(
        "temp_processed",
        exist_ok=True
    )

    clip_starts = []

    temp_start = 0.0

    for idx in range(num_images):

        if idx == 0:

            c_start = 0.0

        else:

            prev_transition = "crossfade"

            if (
                timeline_data
                and "images" in timeline_data
                and (idx - 1) <
                len(timeline_data["images"])
            ):

                prev_transition = (
                    timeline_data["images"][idx - 1]
                    .get(
                        "transition",
                        "crossfade"
                    )
                )

            trans_dur = (
                0.6
                if prev_transition != "none"
                else 0.0
            )

            c_start = (
                temp_start -
                trans_dur
            )

        clip_starts.append(
            c_start
        )

        temp_start += durations[idx]

    def get_audio_amplitude(t):

        if not rms_times or not rms_vals:
            return 0.0

        return float(
            np.interp(
                t,
                rms_times,
                rms_vals
            )
        )

    def make_zoom_pulse_fn(
        base_zoom_fn,
        local_beats,
        c_start_time,
        slide_dur,
        clip_dur,
        clip_trans,
        prev_trans,
        trans_dur,
        effect_type="none",
        idx_val=0
    ):

        def zoom_fn(t):

            base_scale = (
                base_zoom_fn(t)
            )

            if effect_type == "audio_pulse":

                base_scale += (
                    0.08 *
                    get_audio_amplitude(
                        c_start_time + t
                    )
                )

            pulse = 0.0

            for beat_t in local_beats:

                diff = (
                    t -
                    beat_t
                )

                if 0 <= diff < 0.25:

                    pulse += (
                        0.045 *
                        (
                            1.0 -
                            diff / 0.25
                        )
                    )

            scale = (
                base_scale +
                pulse
            )

            if (
                idx_val < num_images - 1
                and clip_trans == "zoom_blend"
                and trans_dur > 0
            ):

                if t > slide_dur:

                    progress = (
                        t -
                        slide_dur
                    ) / trans_dur

                    scale *= (
                        1.0 +
                        0.3 *
                        progress
                    )

            if (
                idx_val > 0
                and prev_trans == "zoom_blend"
                and trans_dur > 0
            ):

                if t < trans_dur:

                    progress = (
                        t /
                        trans_dur
                    )

                    scale *= (
                        1.3 -
                        0.3 *
                        progress
                    )

            return scale

        return zoom_fn

    def make_centered_pos_fn(
        zoom_fn,
        local_beats,
        w,
        h,
        effect_type="none"
    ):

        def pos_fn(t):

            scale = zoom_fn(t)

            x = int(
                w *
                (1.0 - scale) /
                2.0
            )

            y = int(
                h *
                (1.0 - scale) /
                2.0
            )

            if (
                effect_type == "beat_shake"
                and local_beats
            ):

                for beat_t in local_beats:

                    diff = (
                        t -
                        beat_t
                    )

                    if 0 <= diff < 0.3:

                        decay = (
                            1.0 -
                            diff / 0.3
                        )

                        x += int(
                            w *
                            0.035 *
                            decay *
                            math.sin(
                                diff * 75.0
                            )
                        )

                        y += int(
                            h *
                            0.035 *
                            decay *
                            math.cos(
                                diff * 65.0
                            )
                        )

            elif (
                effect_type == "glitch_pulse"
                and local_beats
            ):

                for beat_t in local_beats:

                    diff = (
                        t -
                        beat_t
                    )

                    if 0 <= diff < 0.18:

                        if math.sin(
                            diff * 140.0
                        ) > 0.2:

                            x += int(
                                w *
                                0.025 *
                                math.sin(
                                    diff * 220.0
                                )
                            )

                            y += int(
                                h *
                                0.02 *
                                math.cos(
                                    diff * 280.0
                                )
                            )

            return (
                x,
                y
            )

        return pos_fn

    def make_spin_rotate_fn(
        base_rotate_fn,
        idx_val,
        slide_dur,
        clip_dur,
        clip_trans,
        prev_trans,
        trans_dur
    ):

        def rotate_fn(t):

            angle = (
                base_rotate_fn(t)
                if callable(base_rotate_fn)
                else base_rotate_fn
            )

            if (
                idx_val < num_images - 1
                and clip_trans == "spin_blend"
                and trans_dur > 0
            ):

                if t > slide_dur:

                    progress = (
                        t -
                        slide_dur
                    ) / trans_dur

                    angle += (
                        45.0 *
                        progress
                    )

            if (
                idx_val > 0
                and prev_trans == "spin_blend"
                and trans_dur > 0
            ):

                if t < trans_dur:

                    progress = (
                        t /
                        trans_dur
                    )

                    angle += (
                        -45.0 *
                        (
                            1.0 -
                            progress
                        )
                    )

            return angle

        return rotate_fn

    for idx, img_path in enumerate(
        image_paths
    ):

        style = "blur_fit"

        processed_img = preprocess_image(
            img_path,
            width,
            height,
            style=style
        )

        clip_theme = theme
        clip_transition = "crossfade"
        clip_effect = "zoom_in"

        if (
            timeline_data
            and "images" in timeline_data
            and idx < len(
                timeline_data["images"]
            )
        ):

            clip_theme = (
                timeline_data["images"][idx]
                .get(
                    "filter",
                    theme
                )
            )

            clip_transition = (
                timeline_data["images"][idx]
                .get(
                    "transition",
                    "crossfade"
                )
            )

            clip_effect = (
                timeline_data["images"][idx]
                .get(
                    "effect",
                    "zoom_in"
                )
            )

        prev_transition = "none"

        if idx > 0:

            if (
                timeline_data
                and "images" in timeline_data
                and (idx - 1) <
                len(timeline_data["images"])
            ):

                prev_transition = (
                    timeline_data["images"][idx - 1]
                    .get(
                        "transition",
                        "crossfade"
                    )
                )

            else:

                prev_transition = "crossfade"

        if clip_theme != "none":

            processed_img = apply_color_filter(
                processed_img,
                clip_theme
            )

        temp_path = (
            f"temp_processed/img_{idx}.png"
        )

        processed_img.save(
            temp_path
        )

        temp_processed_images.append(
            temp_path
        )

        slide_duration = durations[idx]

        trans_duration = (
            0.6
            if clip_transition != "none"
            else 0.0
        )

        clip_duration = (
            slide_duration +
            (
                trans_duration
                if (
                    idx < num_images - 1
                    and trans_duration > 0
                )
                else 0
            )
        )

        c_start = clip_starts[idx]

        local_beats = [
            b - c_start
            for b in beat_times
            if c_start <= b <= (
                c_start +
                clip_duration
            )
        ]

        clip = (
            ImageClip(
                temp_path
            )
            .set_duration(
                clip_duration
            )
        )

        if clip_effect == "zoom_out":

            base_zoom = (
                lambda t:
                1.06 -
                0.06 *
                (
                    t /
                    clip_duration
                )
            )

        elif clip_effect == "audio_pulse":

            base_zoom = (
                lambda t: 1.0
            )

        elif clip_effect == "none":

            base_zoom = (
                lambda t: 1.0
            )

        else:

            base_zoom = (
                lambda t:
                1.0 +
                0.06 *
                (
                    t /
                    clip_duration
                )
            )

        prev_trans_dur = (
            0.6
            if prev_transition != "none"
            else 0.0
        )

        zoom_fn = make_zoom_pulse_fn(
            base_zoom,
            local_beats,
            c_start,
            slide_duration,
            clip_duration,
            clip_transition,
            prev_transition,
            prev_trans_dur,
            effect_type=clip_effect,
            idx_val=idx
        )

        base_rotate = (
            lambda t: 0
        )

        if clip_effect == "slow_spin":

            base_rotate = (
                lambda t:
                6.0 *
                (
                    t /
                    clip_duration
                ) -
                3.0
            )

        rotate_fn = make_spin_rotate_fn(
            base_rotate,
            idx,
            slide_duration,
            clip_duration,
            clip_transition,
            prev_transition,
            prev_trans_dur
        )

        clip = clip.resize(
            zoom_fn
        )

        if (
            clip_transition == "spin_blend"
            or prev_transition == "spin_blend"
            or clip_effect == "slow_spin"
        ):

            clip = clip.rotate(
                rotate_fn
            )

        if clip_effect == "pan_left":

            clip = clip.set_position(
                lambda t:
                (
                    int(
                        -0.15 *
                        width *
                        (
                            t /
                            clip_duration
                        )
                    ),
                    0
                )
            )

        elif clip_effect == "pan_right":

            clip = clip.set_position(
                lambda t:
                (
                    int(
                        -0.15 *
                        width *
                        (
                            1.0 -
                            t /
                            clip_duration
                        )
                    ),
                    0
                )
            )

        elif clip_effect == "tilt_up":

            clip = clip.set_position(
                lambda t:
                (
                    0,
                    int(
                        -0.15 *
                        height *
                        (
                            t /
                            clip_duration
                        )
                    )
                )
            )

        elif clip_effect == "tilt_down":

            clip = clip.set_position(
                lambda t:
                (
                    0,
                    int(
                        -0.15 *
                        height *
                        (
                            1.0 -
                            t /
                            clip_duration
                        )
                    )
                )
            )

        elif clip_effect == "diagonal_pan":

            clip = clip.set_position(
                lambda t:
                (
                    int(
                        -0.08 *
                        width *
                        (
                            1.0 -
                            t /
                            clip_duration
                        )
                    ),
                    int(
                        -0.08 *
                        height *
                        (
                            1.0 -
                            t /
                            clip_duration
                        )
                    )
                )
            )

        else:

            pos_fn = make_centered_pos_fn(
                zoom_fn,
                local_beats,
                width,
                height,
                effect_type=clip_effect
            )

            clip = clip.set_position(
                pos_fn
            )

        clips.append(
            clip
        )

    positioned_clips = []
    current_start = 0.0

    for idx, clip in enumerate(
        clips
    ):

        if idx == 0:

            positioned_clip = (
                clip.set_start(0)
            )

        else:

            prev_transition = "crossfade"

            if (
                timeline_data
                and "images" in timeline_data
                and (idx - 1) <
                len(timeline_data["images"])
            ):

                prev_transition = (
                    timeline_data["images"][idx - 1]
                    .get(
                        "transition",
                        "crossfade"
                    )
                )

            trans_dur = (
                0.6
                if prev_transition != "none"
                else 0.0
            )

            if trans_dur > 0:

                clip_start = (
                    current_start -
                    trans_dur
                )

                if prev_transition in (
                    "crossfade",
                    "zoom_blend",
                    "spin_blend"
                ):

                    positioned_clip = (
                        clip
                        .set_start(
                            clip_start
                        )
                        .crossfadein(
                            trans_dur
                        )
                    )

                elif prev_transition == "slide_left":

                    positioned_clip = (
                        clip
                        .set_start(
                            clip_start
                        )
                        .set_position(
                            lambda t:
                            (
                                int(
                                    width *
                                    (
                                        1.0 -
                                        t /
                                        trans_dur
                                    )
                                ),
                                0
                            )
                            if t < trans_dur
                            else (0, 0)
                        )
                    )

                elif prev_transition == "slide_right":

                    positioned_clip = (
                        clip
                        .set_start(
                            clip_start
                        )
                        .set_position(
                            lambda t:
                            (
                                int(
                                    -width *
                                    (
                                        1.0 -
                                        t /
                                        trans_dur
                                    )
                                ),
                                0
                            )
                            if t < trans_dur
                            else (0, 0)
                        )
                    )

                elif prev_transition == "slide_up":

                    positioned_clip = (
                        clip
                        .set_start(
                            clip_start
                        )
                        .set_position(
                            lambda t:
                            (
                                0,
                                int(
                                    height *
                                    (
                                        1.0 -
                                        t /
                                        trans_dur
                                    )
                                )
                            )
                            if t < trans_dur
                            else (0, 0)
                        )
                    )

                elif prev_transition == "slide_down":

                    positioned_clip = (
                        clip
                        .set_start(
                            clip_start
                        )
                        .set_position(
                            lambda t:
                            (
                                0,
                                int(
                                    -height *
                                    (
                                        1.0 -
                                        t /
                                        trans_dur
                                    )
                                )
                            )
                            if t < trans_dur
                            else (0, 0)
                        )
                    )

                elif prev_transition == "slide_diagonal":

                    positioned_clip = (
                        clip
                        .set_start(
                            clip_start
                        )
                        .set_position(
                            lambda t:
                            (
                                int(
                                    width *
                                    (
                                        1.0 -
                                        t /
                                        trans_dur
                                    )
                                ),
                                int(
                                    height *
                                    (
                                        1.0 -
                                        t /
                                        trans_dur
                                    )
                                )
                            )
                            if t < trans_dur
                            else (0, 0)
                        )
                    )

                elif prev_transition == "fade_black":

                    if len(positioned_clips) > 0:

                        positioned_clips[-1] = (
                            positioned_clips[-1]
                            .fadeout(
                                trans_dur
                            )
                        )

                    positioned_clip = (
                        clip
                        .set_start(
                            clip_start
                        )
                        .fadein(
                            trans_dur
                        )
                    )

                elif prev_transition == "white_flash":

                    positioned_clip = (
                        clip
                        .set_start(
                            clip_start
                        )
                    )

                    flash = (
                        ColorClip(
                            size=(
                                width,
                                height
                            ),
                            color=(
                                255,
                                255,
                                255
                            )
                        )
                        .set_duration(
                            0.35
                        )
                        .set_start(
                            clip_start
                        )
                        .fadeout(
                            0.35
                        )
                        .set_opacity(
                            0.55
                        )
                    )

                    positioned_clips.append(
                        flash
                    )

                elif prev_transition == "glitch_cut":

                    def glitch_cut_pos(t):

                        x = int(
                            width *
                            (
                                1.0 -
                                1.05
                            ) /
                            2.0
                        )

                        y = int(
                            height *
                            (
                                1.0 -
                                1.05
                            ) /
                            2.0
                        )

                        if t < 0.15:

                            x += int(
                                width *
                                0.04 *
                                math.sin(
                                    t * 140.0
                                )
                            )

                            y += int(
                                height *
                                0.03 *
                                math.cos(
                                    t * 160.0
                                )
                            )

                        return (
                            x,
                            y
                        )

                    positioned_clip = (
                        clip
                        .set_start(
                            clip_start
                        )
                        .set_position(
                            glitch_cut_pos
                        )
                    )

                else:

                    positioned_clip = (
                        clip.set_start(
                            current_start
                        )
                    )

            else:

                positioned_clip = (
                    clip.set_start(
                        current_start
                    )
                )

        positioned_clips.append(
            positioned_clip
        )

        current_start += durations[idx]

    for t_beat in beat_times:

        if t_beat < total_video_duration:

            flash = (
                ColorClip(
                    size=(
                        width,
                        height
                    ),
                    color=(
                        255,
                        255,
                        255
                    )
                )
                .set_duration(
                    0.2
                )
                .set_start(
                    t_beat
                )
                .fadeout(
                    0.2
                )
                .set_opacity(
                    0.12
                )
            )

            positioned_clips.append(
                flash
            )

    final_video = CompositeVideoClip(
        positioned_clips,
        size=(
            width,
            height
        )
    )

    final_video = final_video.set_audio(
        audio_clip
    )

    final_video.write_videofile(
        output_path,
        fps=24,
        codec="libx264",
        audio_codec="aac",
        preset="medium",
        ffmpeg_params=[
            "-pix_fmt",
            "yuv420p"
        ]
    )

    final_video.close()
    audio_clip.close()

    for temp_path in temp_processed_images:

        try:
            os.remove(
                temp_path
            )
        except OSError:
            pass

    print(
        "Video generation completed successfully!"
    )

    return output_path


# =============================================================
# NEW MIXED IMAGE + VIDEO GENERATOR
# =============================================================

def create_video_from_mixed_assets(
    media_items,
    audio_path,
    output_path,
    theme="cinematic",
    aspect_ratio="16:9",
    timeline_data=None
):
    """
    Create one video from a mixed timeline of images and videos.

    Example:

    [
        {"type": "image", "path": "image1.jpg"},
        {"type": "video", "path": "video1.mp4"},
        {"type": "image", "path": "image2.png"},
        {"type": "video", "path": "video2.mp4"}
    ]

    The exact order of media_items is preserved.
    """

    # ---------------------------------------------------------
    # 1. Output dimensions
    # ---------------------------------------------------------

    if aspect_ratio == "9:16":

        width, height = 720, 1280

    elif aspect_ratio == "1:1":

        width, height = 1080, 1080

    else:

        width, height = 1280, 720

    if not media_items:

        raise ValueError(
            "No image or video media was provided."
        )

    # ---------------------------------------------------------
    # 2. Load audio
    # ---------------------------------------------------------

    audio_clip = AudioFileClip(
        audio_path
    )

    audio_volume = 1.0
    audio_offset = 0.0

    if timeline_data and "audio" in timeline_data:

        audio_settings = (
            timeline_data["audio"]
        )

        audio_volume = float(
            audio_settings.get(
                "volume",
                1.0
            )
        )

        audio_offset = float(
            audio_settings.get(
                "offset",
                0.0
            )
        )

    if audio_offset > 0:

        if audio_offset >= audio_clip.duration:

            raise ValueError(
                "Audio offset is longer than the audio duration."
            )

        audio_clip = audio_clip.subclip(
            audio_offset
        )

    if audio_volume != 1.0:

        audio_clip = audio_clip.volumex(
            audio_volume
        )

    # ---------------------------------------------------------
    # 3. Prepare timeline settings
    # ---------------------------------------------------------

    timeline_media = []

    if timeline_data and "media" in timeline_data:

        timeline_media = (
            timeline_data["media"]
        )

    clips = []
    clip_durations = []

    temp_processed_images = []

    os.makedirs(
        "temp_processed",
        exist_ok=True
    )

    # ---------------------------------------------------------
    # 4. Process media in exact timeline order
    # ---------------------------------------------------------

    for idx, media in enumerate(
        media_items
    ):

        media_type = media.get(
            "type",
            "image"
        )

        media_path = media.get(
            "path"
        )

        if not media_path:

            print(
                f"Skipping media {idx + 1}: "
                f"missing path"
            )

            continue

        print(
            f"Processing media {idx + 1}/"
            f"{len(media_items)} "
            f"({media_type})"
        )

        settings = {}

        if idx < len(timeline_media):

            settings = (
                timeline_media[idx] or {}
            )

        clip_filter = settings.get(
            "filter",
            theme
        )

        clip_effect = settings.get(
            "effect",
            "none"
        )

        clip_transition = settings.get(
            "transition",
            "crossfade"
        )

        requested_duration = settings.get(
            "duration"
        )

        # -----------------------------------------------------
        # IMAGE
        # -----------------------------------------------------

        if media_type == "image":

            processed_img = preprocess_image(
                media_path,
                width,
                height,
                style="blur_fit"
            )

            if clip_filter != "none":

                processed_img = apply_color_filter(
                    processed_img,
                    clip_filter
                )

            temp_path = os.path.join(
                "temp_processed",
                f"mixed_img_{idx}.png"
            )

            processed_img.save(
                temp_path
            )

            temp_processed_images.append(
                temp_path
            )

            if requested_duration is not None:

                duration = max(
                    0.5,
                    float(
                        requested_duration
                    )
                )

            else:

                duration = 3.5

            clip = (
                ImageClip(
                    temp_path
                )
                .set_duration(
                    duration
                )
            )

            if clip_effect == "zoom_out":

                clip = clip.resize(
                    lambda t:
                    1.06 -
                    0.06 *
                    (
                        t /
                        max(
                            duration,
                            0.01
                        )
                    )
                )

            elif clip_effect == "zoom_in":

                clip = clip.resize(
                    lambda t:
                    1.0 +
                    0.06 *
                    (
                        t /
                        max(
                            duration,
                            0.01
                        )
                    )
                )

            elif clip_effect == "slow_spin":

                clip = clip.resize(
                    lambda t:
                    1.0 +
                    0.03 *
                    (
                        t /
                        max(
                            duration,
                            0.01
                        )
                    )
                )

                clip = clip.rotate(
                    lambda t:
                    6.0 *
                    (
                        t /
                        max(
                            duration,
                            0.01
                        )
                    ) -
                    3.0
                )

            clip = clip.set_position(
                "center"
            )

        # -----------------------------------------------------
        # VIDEO
        # -----------------------------------------------------

        elif media_type == "video":

            clip = preprocess_video_clip(
                media_path,
                width,
                height
            )

            clip = clip.without_audio()

            original_duration = (
                clip.duration
            )

            if requested_duration is not None:

                duration = max(
                    0.5,
                    float(
                        requested_duration
                    )
                )

                duration = min(
                    duration,
                    original_duration
                )

                clip = clip.subclip(
                    0,
                    duration
                )

            else:

                duration = original_duration

            if clip_filter != "none":

                def apply_video_filter(frame):

                    pil_image = Image.fromarray(
                        frame
                    )

                    filtered = apply_color_filter(
                        pil_image,
                        clip_filter
                    )

                    return np.array(
                        filtered
                    )

                clip = clip.fl_image(
                    apply_video_filter
                )

            if clip_effect == "zoom_in":

                clip = clip.resize(
                    lambda t:
                    1.0 +
                    0.04 *
                    (
                        t /
                        max(
                            duration,
                            0.01
                        )
                    )
                )

            elif clip_effect == "zoom_out":

                clip = clip.resize(
                    lambda t:
                    1.04 -
                    0.04 *
                    (
                        t /
                        max(
                            duration,
                            0.01
                        )
                    )
                )

            elif clip_effect == "slow_spin":

                clip = clip.rotate(
                    lambda t:
                    4.0 *
                    (
                        t /
                        max(
                            duration,
                            0.01
                        )
                    )
                )

            clip = clip.set_position(
                "center"
            )

        else:

            print(
                f"Unknown media type "
                f"'{media_type}'. "
                f"Skipping item {idx + 1}."
            )

            continue

        clips.append(
            clip
        )

        clip_durations.append(
            duration
        )

    # ---------------------------------------------------------
    # 5. Make sure clips exist
    # ---------------------------------------------------------

    if not clips:

        raise ValueError(
            "No valid image or video clips were provided."
        )

    # ---------------------------------------------------------
    # 6. Build timeline with transitions
    # ---------------------------------------------------------

    positioned_clips = []

    current_start = 0.0

    for idx, clip in enumerate(
        clips
    ):

        if idx == 0:

            positioned_clip = (
                clip.set_start(0)
            )

        else:

            previous_settings = {}

            if (
                idx - 1 <
                len(timeline_media)
            ):

                previous_settings = (
                    timeline_media[idx - 1]
                    or {}
                )

            previous_transition = (
                previous_settings.get(
                    "transition",
                    "crossfade"
                )
            )

            trans_duration = (
                0.6
                if previous_transition != "none"
                else 0.0
            )

            if trans_duration > 0:

                clip_start = (
                    current_start -
                    trans_duration
                )

                if previous_transition in (
                    "crossfade",
                    "zoom_blend",
                    "spin_blend"
                ):

                    positioned_clip = (
                        clip
                        .set_start(
                            clip_start
                        )
                        .crossfadein(
                            trans_duration
                        )
                    )

                elif previous_transition == "fade_black":

                    if positioned_clips:

                        positioned_clips[-1] = (
                            positioned_clips[-1]
                            .fadeout(
                                trans_duration
                            )
                        )

                    positioned_clip = (
                        clip
                        .set_start(
                            clip_start
                        )
                        .fadein(
                            trans_duration
                        )
                    )

                elif previous_transition == "white_flash":

                    positioned_clip = (
                        clip.set_start(
                            clip_start
                        )
                    )

                    flash = (
                        ColorClip(
                            size=(
                                width,
                                height
                            ),
                            color=(
                                255,
                                255,
                                255
                            )
                        )
                        .set_duration(
                            0.35
                        )
                        .set_start(
                            clip_start
                        )
                        .fadeout(
                            0.35
                        )
                        .set_opacity(
                            0.55
                        )
                    )

                    positioned_clips.append(
                        flash
                    )

                elif previous_transition == "slide_left":

                    positioned_clip = (
                        clip
                        .set_start(
                            clip_start
                        )
                        .set_position(
                            lambda t:
                            (
                                int(
                                    width *
                                    (
                                        1.0 -
                                        min(
                                            t /
                                            trans_duration,
                                            1.0
                                        )
                                    )
                                ),
                                0
                            )
                        )
                    )

                elif previous_transition == "slide_right":

                    positioned_clip = (
                        clip
                        .set_start(
                            clip_start
                        )
                        .set_position(
                            lambda t:
                            (
                                int(
                                    -width *
                                    (
                                        1.0 -
                                        min(
                                            t /
                                            trans_duration,
                                            1.0
                                        )
                                    )
                                ),
                                0
                            )
                        )
                    )

                elif previous_transition == "slide_up":

                    positioned_clip = (
                        clip
                        .set_start(
                            clip_start
                        )
                        .set_position(
                            lambda t:
                            (
                                0,
                                int(
                                    height *
                                    (
                                        1.0 -
                                        min(
                                            t /
                                            trans_duration,
                                            1.0
                                        )
                                    )
                                )
                            )
                        )
                    )

                elif previous_transition == "slide_down":

                    positioned_clip = (
                        clip
                        .set_start(
                            clip_start
                        )
                        .set_position(
                            lambda t:
                            (
                                0,
                                int(
                                    -height *
                                    (
                                        1.0 -
                                        min(
                                            t /
                                            trans_duration,
                                            1.0
                                        )
                                    )
                                )
                            )
                        )
                    )

                else:

                    positioned_clip = (
                        clip.set_start(
                            current_start
                        )
                    )

            else:

                positioned_clip = (
                    clip.set_start(
                        current_start
                    )
                )

        positioned_clips.append(
            positioned_clip
        )

        current_start += (
            clip_durations[idx]
        )

    # ---------------------------------------------------------
    # 7. Calculate final duration
    # ---------------------------------------------------------

    total_video_duration = sum(
        clip_durations
    )

    if total_video_duration <= 0:

        raise ValueError(
            "Generated video has zero duration."
        )

    # ---------------------------------------------------------
    # 8. Match audio duration
    # ---------------------------------------------------------

    if (
        total_video_duration >
        audio_clip.duration
    ):

        audio_clip = audio_clip.subclip(
            0,
            total_video_duration
            if total_video_duration <
            audio_clip.duration
            else audio_clip.duration
        )

        total_video_duration = min(
            total_video_duration,
            audio_clip.duration
        )

    else:

        audio_clip = audio_clip.subclip(
            0,
            total_video_duration
        )

    # ---------------------------------------------------------
    # 9. Compose final video
    # ---------------------------------------------------------

    final_video = CompositeVideoClip(
        positioned_clips,
        size=(
            width,
            height
        )
    )

    final_video = final_video.set_audio(
        audio_clip
    )

    # ---------------------------------------------------------
    # 10. Render
    # ---------------------------------------------------------

    print(
        "Rendering mixed image + video timeline..."
    )

    final_video.write_videofile(
        output_path,
        fps=24,
        codec="libx264",
        audio_codec="aac",
        preset="medium",
        ffmpeg_params=[
            "-pix_fmt",
            "yuv420p"
        ]
    )

    # ---------------------------------------------------------
    # 11. Cleanup
    # ---------------------------------------------------------

    final_video.close()
    audio_clip.close()

    for clip in clips:

        try:
            clip.close()

        except Exception:
            pass

    for temp_path in temp_processed_images:

        try:
            os.remove(
                temp_path
            )

        except OSError:
            pass

    print(
        "Mixed image + video rendering "
        "completed successfully!"
    )

    return output_path