import os
import shutil
import tempfile
import subprocess
import json
from fractions import Fraction

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from app.Forensic_algorithm import analyze_image, get_exiftool_command

app = FastAPI()

# Enable CORS so frontend apps can call this backend API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Robust parser for EXIF values:
# Handles fractions, strings, numeric values, and list-based metadata safely
def parse_fraction_like(x):
    if x is None:
        return None
    try:
        if isinstance(x, list) and len(x) > 0:
            x = x[0]
        return float(Fraction(str(x).strip()))
    except Exception:
        try:
            return float(x)
        except Exception:
            return None


# Convert shutter speed into readable format like 1/200 or 0.5s
def fmt_shutter_value(t):
    if t is None:
        return None
    if t >= 1.0:
        return f"{t:.1f}s"
    if t > 0:
        return f"1/{int(round(1 / t))}"
    return "0s"


# Health route:
# Checks if backend is running and whether exiftool is installed correctly
@app.get("/health")
async def health():
    exiftool_cmd = get_exiftool_command()
    exiftool_available = exiftool_cmd is not None
    exiftool_version = None

    if exiftool_cmd:
        try:
            result = subprocess.run(
                [exiftool_cmd, "-ver"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0:
                exiftool_version = result.stdout.strip()
            else:
                exiftool_available = False
        except Exception:
            exiftool_available = False

    return {
        "status": "ok",
        "exiftool_command": exiftool_cmd,
        "exiftool_available": exiftool_available,
        "exiftool_version": exiftool_version,
    }


# Extract raw EXIF metadata from image using exiftool
def extract_exif(image_path: str):
    exiftool_cmd = get_exiftool_command()

    try:
        cmd = [exiftool_cmd, "-json", "-n", image_path]

        res = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=10,
        )

        if res.returncode != 0:
            return {}

        data = json.loads(res.stdout)

        if not data:
            return {}

        return data[0]

    except Exception:
        return {}


# Extract important camera exposure values from metadata
# These are later compared against model predictions
def extract_actual(metadata: dict):
    exposure_time = parse_fraction_like(metadata.get("ExposureTime"))

    iso_value = metadata.get("ISO")
    if iso_value is None:
        iso_value = metadata.get("ISOSpeedRatings")

    return {
        "ISO": parse_fraction_like(iso_value),
        "F": parse_fraction_like(metadata.get("FNumber")),
        "T": exposure_time,
        "shutter_display": fmt_shutter_value(exposure_time),
    }


# Compare AI-predicted camera settings with actual EXIF values
# Then generate authenticity verdict, confidence, and forgery score
def compute_authenticity(predicted, actual, metadata):
    if not metadata:
        return {
            "verdict": "NO_EXIF",
            "confidence": "LOW",
            "forgery_score": 0.2,
            "reason": "No metadata found. Image may be a screenshot, edited export, or metadata-stripped file.",
        }

    # Check whether useful camera metadata is available
    useful_camera_fields = [
        metadata.get("ISO"),
        metadata.get("ISOSpeedRatings"),
        metadata.get("FNumber"),
        metadata.get("ExposureTime"),
        metadata.get("Model"),
        metadata.get("Make"),
    ]

    if not any(v is not None for v in useful_camera_fields):
        return {
            "verdict": "NO_EXIF",
            "confidence": "LOW",
            "forgery_score": 0.2,
            "reason": "No useful camera metadata found.",
        }

    # Metadata exists, but exposure fields needed for comparison are missing
    if not actual or not any(
        [
            actual.get("ISO") is not None,
            actual.get("F") is not None,
            actual.get("T") is not None,
        ]
    ):
        return {
            "verdict": "SUSPICIOUS",
            "confidence": "LOW",
            "forgery_score": 0.4,
            "reason": "Metadata exists, but camera exposure parameters are missing.",
        }

    # If model prediction fails, authenticity cannot be judged reliably
    if not predicted:
        return {
            "verdict": "UNKNOWN",
            "confidence": "LOW",
            "forgery_score": 0.5,
            "reason": "Model prediction unavailable.",
        }

    score = 0

    try:
        # Compare predicted ISO with actual ISO
        if predicted.get("iso") is not None and actual.get("ISO") is not None:
            if abs(predicted["iso"] - actual["ISO"]) > 100:
                score += 1

        # Compare predicted aperture with actual aperture
        if predicted.get("f_stop") is not None and actual.get("F") is not None:
            if abs(predicted["f_stop"] - actual["F"]) > 1.5:
                score += 1

        # Compare predicted shutter speed with actual shutter speed
        if predicted.get("t_sec") is not None and actual.get("T") is not None:
            if abs(predicted["t_sec"] - actual["T"]) > 0.02:
                score += 1

    except Exception:
        return {
            "verdict": "UNKNOWN",
            "confidence": "LOW",
            "forgery_score": 0.5,
            "reason": "Comparison error",
        }

    # Final decision based on total mismatch score
    if score == 0:
        return {
            "verdict": "REAL",
            "confidence": "HIGH",
            "forgery_score": 0.1,
            "reason": "EXIF camera values are consistent with AI prediction.",
        }

    if score == 1:
        return {
            "verdict": "SUSPICIOUS",
            "confidence": "MEDIUM",
            "forgery_score": 0.6,
            "reason": "Partial mismatch between EXIF and AI prediction.",
        }

    return {
        "verdict": "FAKE",
        "confidence": "HIGH",
        "forgery_score": 0.9,
        "reason": "Strong mismatch detected between EXIF and AI prediction.",
    }


# Upload route:
# Saves uploaded image temporarily, extracts EXIF metadata,
# runs forensic model, compares results, and returns final JSON response
@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    temp_path = None

    try:
        if not file:
            return {"success": False, "error": "No file uploaded"}

        _, ext = os.path.splitext(file.filename or ".jpg")

        # Save uploaded file to a temporary location
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            temp_path = tmp.name
            shutil.copyfileobj(file.file, tmp)

        file_size = os.path.getsize(temp_path)

        # Extract metadata and actual camera settings
        metadata = extract_exif(temp_path)
        actual = extract_actual(metadata)

        # Run the forensic model to get predicted exposure values
        try:
            model_output = analyze_image(temp_path)
            predicted = model_output.get("predicted", {}) if model_output else {}
        except Exception:
            predicted = {}

        # Compute authenticity verdict from metadata vs prediction
        decision = compute_authenticity(predicted, actual, metadata)

        return {
            "success": True,
            "filename": file.filename,
            "size_bytes": file_size,
            "verdict": decision["verdict"],
            "confidence": decision["confidence"],
            "forgery_score": decision["forgery_score"],
            "reason": decision["reason"],
            "predicted": predicted,
            "truth": {
                "ISO": actual.get("ISO"),
                "F": actual.get("F"),
                "T": actual.get("shutter_display") or actual.get("T"),
            },
            "exif": metadata,
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }

    finally:
        # Always delete temporary uploaded file after processing
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)