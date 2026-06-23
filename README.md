# AuraCut - AI Automated Video Editor 🎬✨

AuraCut is a premium, modern automated video editing web application. It analyzes your background music tracks using intelligent audio feature extraction, detects beat tempos and volume envelopes, and compiles uploaded photos into high-end beat-synced video compositions with custom motion transitions, visual filters, and stylized overlays.

---

## 🚀 Key Features

*   **Intelligent Audio beat-syncing**: Uses **Librosa** to analyze audio frames and extract beat onsets and RMS amplitude volume envelopes.
*   **Audio-Reactive VFX**: Video elements pulse, zoom, and shake dynamically in real-time sync with the music amplitude.
*   **CapCut/TikTok-Style Transitions**: High-end transition options (Zoom Blends, Spin Blends, White Flashes, and Glitch cuts).
*   **Professional Color Filters & Stylized Overlays**:
    *   *Cinematic Letterbox*: Teal-orange color grading combined with widescreen horizontal bars.
    *   *Vintage Grain*: Nostalgic warm film grading with randomized digital noise noise rendering.
    *   *Polaroid Frame*: Wraps photos inside a realistic warm-white instant camera print card.
    *   *Cyberpunk Border*: Draws glowing neon cyan outlines.
*   **Interactive Multi-track Timeline**: Modify individual slide durations, custom filters, motion transitions, and audio offsets on a visual track ruler.
*   **Live Preview (WYSIWYG)**: Interactive CSS keyframes and filters animate choices instantly inside the inspector drawer before rendering.
*   **Security Hardened**: Built-in backend safeguards whitelisting file types (blocking executable scripting uploads) and capping file sizes (max 15MB images, 50MB audio).

---

## 🛠️ Local Installation & Setup

Ensure you have **Python 3.9+** and **Git** installed on your system.

### 1. Clone & Navigate
```bash
git clone https://github.com/YOUR_USERNAME/automaticvideoediting.git
cd automaticvideoediting/backend
```

### 2. Set Up Virtual Environment
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment (Windows)
.\venv\Scripts\activate

# Activate virtual environment (macOS/Linux)
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Run the Server
```bash
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```
Open your browser and navigate to **[http://127.0.0.1:8000](http://127.0.0.1:8000)**!

---

## 🌐 Deploying Live to the Internet

You can deploy AuraCut online for free on **[Render.com](https://render.com)**:

1.  Create an account and click **New +** -> **Web Service**.
2.  Connect your GitHub repository.
3.  Fill in the configurations:
    *   **Root Directory**: `backend`
    *   **Runtime**: `Python`
    *   **Build Command**: `pip install -r requirements.txt`
    *   **Start Command**: `python -m uvicorn main:app --host 0.0.0.0 --port $PORT`
4.  Deploy and get your live website link!

---

## 📝 Technologies Used
*   **Backend**: FastAPI, Uvicorn, MoviePy, Librosa, NumPy, Pillow
*   **Frontend**: HTML5, Vanilla CSS3 (Custom Glassmorphism), JavaScript (ES6+), Lucide Icons
