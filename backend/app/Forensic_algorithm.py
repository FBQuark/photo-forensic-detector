import os
import math
import json
import shutil
import platform
import subprocess
from fractions import Fraction

import cv2
import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from PIL.ExifTags import TAGS
from torchvision.models import resnet18


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEIGHTS_PATH = os.path.join(BASE_DIR, "best_2.pth")
IMG_SIZE = 448
DEVICE = "mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu")
LOG2_100 = math.log2(100)


def parse_fraction_like(x):
    if x is None:
        return None
    try:
        return float(Fraction(str(x).strip()))
    except Exception:
        try:
            return float(x)
        except Exception:
            return None


def normalize_fraction(value):
    if value is None:
        return None
    try:
        if isinstance(value, tuple) and len(value) == 2 and value[1] != 0:
            return value[0] / value[1]
        if hasattr(value, "numerator") and hasattr(value, "denominator") and value.denominator != 0:
            return value.numerator / value.denominator
        if isinstance(value, str) and "/" in value:
            a, b = value.split("/")
            return float(a) / float(b)
        return float(value)
    except Exception:
        return None


def get_exiftool_command():
    possible_commands = []

    if platform.system() == "Windows":
        possible_commands.extend([
            r"C:\Windows\exiftool.exe",
            r"C:\Windows\System32\exiftool.exe",
            r"C:\Windows\exiftool(-k).exe",
            r"C:\exiftool.exe",
            r"C:\exiftool\exiftool.exe",
            r"C:\Program Files\ExifTool\exiftool.exe",
            "exiftool.exe",
            "exiftool",
        ])
    else:
        possible_commands.extend([
            "exiftool",
            "exiftool.exe",
        ])

    for cmd in possible_commands:
        try:
            result = subprocess.run(
                [cmd, "-ver"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                return cmd
        except Exception:
            pass

    found = shutil.which("exiftool") or shutil.which("exiftool.exe")
    if found:
        try:
            result = subprocess.run(
                [found, "-ver"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                return found
        except Exception:
            pass

    return None


def extract_exif_with_exiftool(img_path):
    exiftool_cmd = get_exiftool_command()
    if not exiftool_cmd:
        return {}

    cmd = [exiftool_cmd, "-j", "-n", img_path]

    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)

        if res.returncode != 0:
            return {}

        data = json.loads(res.stdout)
        if not data or not isinstance(data, list):
            return {}

        d = data[0]

        return {
            "Make": d.get("Make"),
            "Model": d.get("Model"),
            "ISO": parse_fraction_like(d.get("ISO")),
            "FNumber": parse_fraction_like(d.get("FNumber")),
            "ExposureTime": parse_fraction_like(d.get("ExposureTime")),
            "DateTimeOriginal": d.get("DateTimeOriginal"),
            "LensModel": d.get("LensModel"),
        }
    except Exception:
        return {}


def extract_exif_with_pillow(img_path):
    try:
        img = Image.open(img_path)
        exif_data = img.getexif()

        if not exif_data:
            return {}

        parsed = {}
        for tag_id, value in exif_data.items():
            tag = TAGS.get(tag_id, tag_id)
            parsed[tag] = value

        return {
            "Make": parsed.get("Make"),
            "Model": parsed.get("Model"),
            "ISO": parsed.get("ISOSpeedRatings") or parsed.get("PhotographicSensitivity"),
            "FNumber": parsed.get("FNumber"),
            "ExposureTime": parsed.get("ExposureTime"),
            "DateTimeOriginal": parsed.get("DateTimeOriginal"),
            "LensModel": parsed.get("LensModel"),
        }
    except Exception:
        return {}


def get_robust_exif(img_path):
    exif = extract_exif_with_exiftool(img_path)

    if not exif:
        exif = extract_exif_with_pillow(img_path)

    if not exif:
        return None

    iso = parse_fraction_like(exif.get("ISO"))
    fnum = normalize_fraction(exif.get("FNumber"))
    tsec = normalize_fraction(exif.get("ExposureTime"))

    result = {
        "ISO": iso,
        "F": fnum,
        "T": tsec,
        "EV": None,
        "Make": exif.get("Make", "Unknown"),
        "Model": exif.get("Model", "Unknown"),
        "DateTimeOriginal": exif.get("DateTimeOriginal"),
        "LensModel": exif.get("LensModel"),
    }

    if iso is None or fnum is None or tsec is None or tsec <= 0:
        return result

    lISO = math.log2(iso)
    lF = math.log2(fnum)
    lt = math.log2(tsec)
    ev_truth = (2 * lF - lt) - (lISO - LOG2_100)

    result["EV"] = ev_truth
    return result


def fmt_shutter(t):
    if t is None:
        return "N/A"
    if t <= 0:
        return "0s"
    if t >= 1.0:
        return f"{t:.1f}s"
    return f"1/{round(1 / t)}"


class Head(nn.Module):
    def __init__(self, in_dim=512):
        super().__init__()
        self.fc = nn.Linear(in_dim, 1)

    def forward(self, x):
        return self.fc(x).squeeze(1)


class TriadResNet18(nn.Module):
    def __init__(self, in_ch=13):
        super().__init__()
        base = resnet18(weights=None)
        base.conv1 = nn.Conv2d(in_ch, 64, kernel_size=7, stride=2, padding=3, bias=False)

        self.backbone = nn.Sequential(
            base.conv1,
            base.bn1,
            base.relu,
            base.maxpool,
            base.layer1,
            base.layer2,
            base.layer3,
            base.layer4,
            base.avgpool,
        )

        self.head_iso = Head(512)
        self.head_f = Head(512)
        self.head_ev = Head(512)

    def forward(self, x):
        f = torch.flatten(self.backbone(x), 1)
        return self.head_iso(f), self.head_f(f), self.head_ev(f)


def build_13ch_sync(img_rgb):
    img_lin = np.where(
        img_rgb <= 0.04045,
        img_rgb / 12.92,
        ((img_rgb + 0.055) / 1.055) ** 2.4
    )

    r, g, b = img_lin[..., 0], img_lin[..., 1], img_lin[..., 2]
    gray = 0.2989 * r + 0.5870 * g + 0.1140 * b

    sobelx = cv2.Sobel(gray, cv2.CV_32F, 1, 0)
    sobely = cv2.Sobel(gray, cv2.CV_32F, 0, 1)
    lap = cv2.Laplacian(gray, cv2.CV_32F)
    gradmag = np.hypot(sobelx, sobely)

    hp_small = gray - cv2.GaussianBlur(gray, (3, 3), 0.8)
    hp_large = gray - cv2.GaussianBlur(gray, (9, 9), 2.0)

    m = cv2.GaussianBlur(gray, (7, 7), 1.5)
    v = np.clip(cv2.GaussianBlur(gray * gray, (7, 7), 1.5) - m * m, 0, None)

    log = cv2.Laplacian(cv2.GaussianBlur(gray, (0, 0), 1.0), cv2.CV_32F)
    mixg = cv2.Scharr(gray, cv2.CV_32F, 1, 0) + cv2.Scharr(gray, cv2.CV_32F, 0, 1)

    ch = [r, g, b, gray, sobelx, sobely, lap, gradmag, hp_small, hp_large, v, log, mixg]
    x13 = np.stack(ch, axis=0).astype(np.float32)

    return (x13 - x13.mean()) / (x13.std() + 1e-6)


MODEL_LOAD_ERROR = None
model = None

try:
    model = TriadResNet18(in_ch=13).to(DEVICE)
    checkpoint = torch.load(WEIGHTS_PATH, map_location=DEVICE)

    if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
        checkpoint = checkpoint["model_state_dict"]

    model.load_state_dict(checkpoint)
    model.eval()
except Exception as e:
    MODEL_LOAD_ERROR = str(e)
    model = None


def analyze_image(image_path: str):
    if model is None:
        return {"error": f"Model failed to load: {MODEL_LOAD_ERROR}"}

    if not os.path.exists(image_path):
        return {"error": f"Image file not found: {image_path}"}

    img = cv2.imread(image_path)
    if img is None:
        return {"error": f"Could not read image: {image_path}"}

    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0

    h, w = img_rgb.shape[:2]
    scale = IMG_SIZE / min(h, w)

    new_w = max(IMG_SIZE, int(round(w * scale)))
    new_h = max(IMG_SIZE, int(round(h * scale)))
    img_rgb = cv2.resize(img_rgb, (new_w, new_h))

    h, w = img_rgb.shape[:2]
    top = max(0, (h - IMG_SIZE) // 2)
    left = max(0, (w - IMG_SIZE) // 2)
    img_rgb = img_rgb[top:top + IMG_SIZE, left:left + IMG_SIZE]

    if img_rgb.shape[:2] != (IMG_SIZE, IMG_SIZE):
        return {"error": "Failed to crop image to expected size"}

    x13 = build_13ch_sync(img_rgb)
    tensor = torch.from_numpy(x13).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        p_iso_log, p_f_log, p_ev = model(tensor)

        p_iso_log_val = p_iso_log.item()
        p_f_log_val = p_f_log.item()
        p_ev_val = p_ev.item()

        p_iso = 2 ** p_iso_log_val
        p_f = 2 ** p_f_log_val
        p_tsec = 2 ** ((2 * p_f_log_val) - (p_iso_log_val - LOG2_100) - p_ev_val)

    truth = get_robust_exif(image_path)

    has_full_exif = (
        truth is not None
        and truth.get("ISO") is not None
        and truth.get("F") is not None
        and truth.get("T") is not None
    )

    return {
        "predicted": {
            "iso": round(p_iso),
            "f_stop": round(p_f, 2),
            "shutter": fmt_shutter(p_tsec),
            "t_sec": round(p_tsec, 6),
            "ev": round(p_ev_val, 4),
        },
        "truth": truth if truth else {
            "ISO": None,
            "F": None,
            "T": None,
            "EV": None,
            "Make": "Unknown",
            "Model": "Unknown",
            "DateTimeOriginal": None,
            "LensModel": None,
        },
        "verdict": "DONE" if has_full_exif else ("PARTIAL_EXIF" if truth else "NO_EXIF"),
    }