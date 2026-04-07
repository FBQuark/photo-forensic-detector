import torch
import torch.nn as nn
import cv2
import numpy as np
import os
import math
import subprocess
import json
from fractions import Fraction
from torchvision.models import resnet18


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEIGHTS_PATH = os.path.join(BASE_DIR, "best_2.pth")
IMG_SIZE = 448
DEVICE = "mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu")
LOG2_100 = math.log(100, 2)


def parse_fraction_like(x):
    if x is None: return None
    try:
        s = str(x).strip()
        return float(Fraction(s))
    except:
        try: return float(x)
        except: return None

def get_robust_exif(img_path):
    cmd = ["exiftool", "-json", "-n", img_path]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0: return None
    try:
        d = json.loads(res.stdout)[0]
        iso = d.get("ISO")
        fnum = parse_fraction_like(d.get("FNumber"))
        tsec = parse_fraction_like(d.get("ExposureTime"))
        
        if iso and fnum and tsec:
            lISO, lF, lt = math.log2(iso), math.log2(fnum), math.log2(tsec)
            ev_truth = (2 * lF - lt) - (lISO - LOG2_100)
            return {"ISO": iso, "F": fnum, "T": tsec, "EV": ev_truth, "Make": d.get("Make", "Unknown")}
    except: return None
    return None

def fmt_shutter(t):
    if t >= 1.0: return f"{t:.1f}s"
    return f"1/{int(round(1/t))}" if t > 0 else "0s"


class Head(nn.Module):
    def __init__(self, in_dim=512):
        super().__init__()
        self.fc = nn.Linear(in_dim, 1)
    def forward(self, x): return self.fc(x).squeeze(1)

class TriadResNet18(nn.Module):
    def __init__(self, in_ch=13):
        super().__init__()
        base = resnet18(weights=None)
        base.conv1 = nn.Conv2d(in_ch, 64, kernel_size=7, stride=2, padding=3, bias=False)
        self.backbone = nn.Sequential(
            base.conv1, base.bn1, base.relu, base.maxpool,
            base.layer1, base.layer2, base.layer3, base.layer4, base.avgpool
        )
        self.head_iso = Head(512)
        self.head_f = Head(512)
        self.head_ev = Head(512)

    def forward(self, x):
        f = torch.flatten(self.backbone(x), 1)
        return self.head_iso(f), self.head_f(f), self.head_ev(f)


def build_13ch_sync(img_rgb):

    img_lin = np.where(img_rgb <= 0.04045, img_rgb / 12.92, ((img_rgb + 0.055) / 1.055) ** 2.4)
    r, g, b = img_lin[..., 0], img_lin[..., 1], img_lin[..., 2]
    gray = 0.2989 * r + 0.5870 * g + 0.1140 * b

    sobelx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    sobely = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    lap = cv2.Laplacian(gray, cv2.CV_32F, ksize=3)
    gradmag = np.hypot(sobelx, sobely)
    hp_small = gray - cv2.GaussianBlur(gray, (3, 3), 0.8)
    hp_large = gray - cv2.GaussianBlur(gray, (9, 9), 2.0)
    m = cv2.GaussianBlur(gray, (7, 7), 1.5)
    v = np.clip(cv2.GaussianBlur(gray * gray, (7, 7), 1.5) - m * m, 0, None)
    log = cv2.Laplacian(cv2.GaussianBlur(gray, (0, 0), 1.0), cv2.CV_32F, ksize=3)
    mixg = cv2.Scharr(gray, cv2.CV_32F, 1, 0) + cv2.Scharr(gray, cv2.CV_32F, 0, 1)

    K = {"sobel": 8.0, "lap": 4.0, "grad": 8.0, "hp_s": 1.5, "hp_l": 1.5, "var": 0.2, "log": 4.0, "mixg": 16.0}
    ch = [
        r, g, b, gray,
        np.clip(0.5 + sobelx / K["sobel"], 0, 1),
        np.clip(0.5 + sobely / K["sobel"], 0, 1),
        np.clip(0.5 + lap / K["lap"], 0, 1),
        np.clip(gradmag / K["grad"], 0, 1),
        np.clip(0.5 + hp_small / K["hp_s"], 0, 1),
        np.clip(0.5 + hp_large / K["hp_l"], 0, 1),
        np.clip(v / K["var"], 0, 1),
        np.clip(0.5 + log / K["log"], 0, 1),
        np.clip(0.5 + mixg / K["mixg"], 0, 1),
    ]
    x13 = np.stack(ch, axis=0).astype(np.float32)
    return (x13 - x13.mean()) / (x13.std() + 1e-6)


model = TriadResNet18(in_ch=13).to(DEVICE)
model.load_state_dict(torch.load(WEIGHTS_PATH, map_location=DEVICE))
model.eval()

def analyze_image(image_path: str):
    if not os.path.exists(image_path):
        return {"error": f"Image file not found: {image_path}"}

    img = cv2.imread(image_path)
    if img is None:
        return {"error": f"Could not read image: {image_path}"}

    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0

    h, w = img_rgb.shape[:2]
    scale = IMG_SIZE / min(h, w)
    img_rgb = cv2.resize(img_rgb, (int(round(w * scale)), int(round(h * scale))))
    h, w = img_rgb.shape[:2]
    img_rgb = img_rgb[(h - IMG_SIZE)//2:(h + IMG_SIZE)//2,
                      (w - IMG_SIZE)//2:(w + IMG_SIZE)//2]

    x13 = build_13ch_sync(img_rgb)
    tensor = torch.from_numpy(x13).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        p_iso_log, p_f_log, p_ev = model(tensor)

        p_iso = 2 ** p_iso_log.item()
        p_f = 2 ** p_f_log.item()
        p_ev_val = p_ev.item()

        p_lt = (2 * p_f_log.item()) - (p_iso_log.item() - LOG2_100) - p_ev_val
        p_tsec = 2 ** p_lt

    truth = get_robust_exif(image_path)

    # --- build JSON response ---
    result = {
        "predicted": {
            "iso": round(p_iso),
            "f_stop": round(p_f, 2),
            "shutter_seconds": round(p_tsec, 6),
            "shutter_display": fmt_shutter(p_tsec),
            "ev": round(p_ev_val, 4)
        },

        "truth": None,
        "delta_ev": None,
        "verdict": None,

        "details": {
            "device_used": DEVICE,
            "model_input_size": IMG_SIZE,
        }
    }

    if truth:
        delta_ev = abs(p_ev_val - truth["EV"])
        verdict = "SUSPICIOUS" if delta_ev > 1.5 else "CONSISTENT"

        result["truth"] = {
            "iso": truth["ISO"],
            "f_stop": truth["F"],
            "shutter_seconds": truth["T"],
            "shutter_display": fmt_shutter(truth["T"]),
            "ev": round(truth["EV"], 4)
        }

        result["delta_ev"] = round(delta_ev, 4)
        result["verdict"] = verdict
    else:
        result["verdict"] = "NO_EXIF"
        result["details"]["explanation"] = "No usable EXIF data found."

    return result