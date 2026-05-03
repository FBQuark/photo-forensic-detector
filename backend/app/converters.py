import io
from PIL import Image as PILImage, ImageOps
# Takes in the dictionary results from the frontend and reshapes it to be "flat" as it is easier for CSVs to be in this format 
def flatten_result_for_csv(data: dict) -> dict:
    analysis = data.get("analysis", {})
    predicted = analysis.get("predicted", {})
    truth = analysis.get("truth")
    details = analysis.get("details", {})

    return {
        "filename": data.get("filename"),

        "predicted_iso": predicted.get("iso"),
        "predicted_f_stop": predicted.get("f_stop"),
        "predicted_shutter_seconds": predicted.get("shutter_seconds"),
        "predicted_shutter_display": predicted.get("shutter_display"),
        "predicted_ev": predicted.get("ev"),

        "truth_iso": truth.get("iso") if truth else None,
        "truth_f_stop": truth.get("f_stop") if truth else None,
        "truth_shutter_seconds": truth.get("shutter_seconds") if truth else None,
        "truth_shutter_display": truth.get("shutter_display") if truth else None,
        "truth_ev": truth.get("ev") if truth else None,

        "delta_ev": analysis.get("delta_ev"),
        "verdict": analysis.get("verdict"),

        "device_used": details.get("device_used"),
        "model_input_size": details.get("model_input_size"),
        "explanation": details.get("explanation", ""),
    }

# Getting the results returned by the algorithm to reflect the shape of the columns for the database, this helper avoids having too much data transformation when adding entries to the database
def analysis_to_db_row(
    *,
    filename: str,
    analysis: dict,
    user_id: str,
    photo_id: str,
) -> dict:
    predicted = analysis.get("predicted")
    truth = analysis.get("truth") or {}
    details = analysis.get("details") or {}

    #throwing errors for any required fields such as predictions and missing IDs
    if not filename:
        raise ValueError("Missing filename")

    if not user_id:
        raise ValueError("Missing user_id")

    if not photo_id:
        raise ValueError("Missing photo_id")

    if not isinstance(predicted, dict):
        raise ValueError("Missing or invalid predicted block")

    # required predicted fields
    if predicted.get("iso") is None:
        raise ValueError("Missing predicted.iso")
    if predicted.get("f_stop") is None:
        raise ValueError("Missing predicted.f_stop")
    if predicted.get("shutter_seconds") is None:
        raise ValueError("Missing predicted.shutter_seconds")
    if predicted.get("shutter_display") is None:
        raise ValueError("Missing predicted.shutter_display")
    if predicted.get("ev") is None:
        raise ValueError("Missing predicted.ev")

    if analysis.get("verdict") is None:
        raise ValueError("Missing verdict")
    if details.get("device_used") is None:
        raise ValueError("Missing details.device_used")
    if details.get("model_input_size") is None:
        raise ValueError("Missing details.model_input_size")

    return {
        "userId": user_id,
        "photoId": photo_id,
        "fileName": filename,
        "verdict": str(analysis.get("verdict")),

        "p_ISO": int(predicted.get("iso")),
        "p_Fstop": float(predicted.get("f_stop")),
        "p_ShutterSeconds": float(predicted.get("shutter_seconds")),
        "p_ShutterDisplay": str(predicted.get("shutter_display")),
        "p_EV": float(predicted.get("ev")),

        "t_ISO": int(truth.get("iso")) if truth.get("iso") is not None else None,
        "t_Fstop": float(truth.get("f_stop")) if truth.get("f_stop") is not None else None,
        "t_ShutterSeconds": float(truth.get("shutter_seconds")) if truth.get("shutter_seconds") is not None else None,
        "t_ShutterDisplay": str(truth.get("shutter_display")) if truth.get("shutter_display") is not None else None,
        "t_EV": float(truth.get("ev")) if truth.get("ev") is not None else None,

        "deltaEV": float(analysis.get("delta_ev")) if analysis.get("delta_ev") is not None else None,
        "deviceUsed": str(details.get("device_used")),
        "modelInputSize": int(details.get("model_input_size")),
        "explanation": (
            str(details.get("explanation"))
            if details.get("explanation") is not None
            else None
        ),
    }


# Converts the fetched results from the backend to the shape expected by the frontend, this is simply another helper that makes it so we dont need to do 
# so much data transformation inline 
def db_row_to_analysis_result(row) -> dict:
    data = row.data

    return {
        "id": row.id,
        "photoId": data["photoId"],
        "filename": data["fileName"],
        "analysis": {
            "predicted": {
                "iso": data["p_ISO"],
                "f_stop": data["p_Fstop"],
                "shutter_seconds": data["p_ShutterSeconds"],
                "shutter_display": data["p_ShutterDisplay"],
                "ev": data["p_EV"],
            },
            "truth": (
                {
                    "iso": data["t_ISO"],
                    "f_stop": data["t_Fstop"],
                    "shutter_seconds": data["t_ShutterSeconds"],
                    "shutter_display": data["t_ShutterDisplay"],
                    "ev": data["t_EV"],
                }
                if any(
                    data[field] is not None
                    for field in [
                        "t_ISO",
                        "t_Fstop",
                        "t_ShutterSeconds",
                        "t_ShutterDisplay",
                        "t_EV",
                    ]
                )
                else None
            ),
            "delta_ev": data["deltaEV"],
            "verdict": data["verdict"],
            "details": {
                "device_used": data["deviceUsed"],
                "model_input_size": data["modelInputSize"],
                "explanation": data["explanation"],
            },
        },
    }



def create_preview_image(
    image_bytes: bytes,
    max_size: int = 700,
    quality: int = 75,
) -> bytes:
    """
    Create a smaller JPEG preview from the original image bytes.

    This applies EXIF orientation first so phone images do not appear sideways.
    The original image stored in Appwrite is not modified.
    """
    with PILImage.open(io.BytesIO(image_bytes)) as img:
        # Apply EXIF orientation before resizing.
        # Many phone images are stored sideways with an orientation tag.
        img = ImageOps.exif_transpose(img)

        # JPEG does not support transparency, so convert to RGB.
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")

        # Resize while preserving aspect ratio.
        img.thumbnail((max_size, max_size), PILImage.LANCZOS)

        output = io.BytesIO()
        img.save(output, format="JPEG", quality=quality, optimize=True)
        output.seek(0)

        return output.getvalue()

