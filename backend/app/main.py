import os
import shutil
import tempfile
import json
import csv
import io
import zipfile


from Forensic_algorithm import analyze_image
from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse




app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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



@app.get("/health") #health route to check for the api health and connectivity 
async def health_check():
    return {"status": "ok"}


@app.post("/upload-image")
async def upload_image(file: UploadFile = File(...)): #get the file from the frontent
    temp_path = None
    try:
        original_name = file.filename or "uploaded_file"
        _, ext = os.path.splitext(original_name) #getting only the extension from the filename (.png etc)

        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp: #chatGPT generated. since the algorithm expects a file path this function will essentially create a temp file in 
            #memory, we then save this temp path to use for the path passing later 
            temp_path = tmp.name
            shutil.copyfileobj(file.file, tmp) #copying the data from the photo passed in to the temp file 

        file_size = os.path.getsize(temp_path) #getting the size of the file 


        #for debugging purposes print basic file information
        print("=== MESSAGE RECEIVED ===")
        print(f"filename: {file.filename}")
        print(f"content_type: {file.content_type}")
        print(f"temp_path: {temp_path}")
        print(f"size_bytes: {file_size}")


        result = analyze_image(temp_path) #call to algorithm to analyze image

        print("=== ALGORITHM RESULT ===")
        print(json.dumps(result, indent=2))


        return { #return the results of the algorithm as well as the filename for display purposes (could maybe be done on the backend we will see)
            "filename": file.filename,
            "analysis": result
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)



      
      
@app.post("/download-csv")
async def download_csv(results: list[dict] = Body(...)): #get the already computed frontend results and convert them into a downloadable csv
    try:
        if not results:
            raise HTTPException(status_code=400, detail="No results were provided.")

        rows = [flatten_result_for_csv(result) for result in results]

        if not rows:
            raise HTTPException(status_code=400, detail="No valid rows could be created.")

        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
        output.seek(0)

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=analysis_results.csv"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.post("/upload-zip")
async def upload_zip(file: UploadFile = File(...)): #get the zip file from the frontend, extract it, and process top-level images only
    zip_path = None
    extract_dir = None

    try:
        original_name = file.filename or "uploaded_zip"
        _, ext = os.path.splitext(original_name)

        if ext.lower() != ".zip":
            raise HTTPException(status_code=400, detail="Only .zip files are supported.")

        with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as tmp_zip:
            zip_path = tmp_zip.name
            shutil.copyfileobj(file.file, tmp_zip)

        zip_size = os.path.getsize(zip_path)

        #for debugging purposes print basic zip information
        print("=== ZIP MESSAGE RECEIVED ===")
        print(f"filename: {file.filename}")
        print(f"content_type: {file.content_type}")
        print(f"zip_path: {zip_path}")
        print(f"size_bytes: {zip_size}")

        extract_dir = tempfile.mkdtemp()

        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            zip_ref.extractall(extract_dir)

        supported_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".webp"}
        all_results = []

        # check top-level contents
        top_level_items = os.listdir(extract_dir)
        working_dir = extract_dir

        # if the zip contains one wrapping folder, step into it
        if len(top_level_items) == 1:
            possible_folder = os.path.join(extract_dir, top_level_items[0])
            if os.path.isdir(possible_folder):
                print(f"FOUND WRAPPER FOLDER: {top_level_items[0]}")
                working_dir = possible_folder

        # process only one level deep, ignore any subfolders
        for name in os.listdir(working_dir):
            full_path = os.path.join(working_dir, name)

            if os.path.isdir(full_path):
                print(f"IGNORING SUBFOLDER: {name}")
                continue

            _, file_ext = os.path.splitext(name)
            if file_ext.lower() not in supported_extensions:
                print(f"IGNORING NON-IMAGE FILE: {name}")
                continue

            file_size = os.path.getsize(full_path)

            print("=== EXTRACTED IMAGE FOUND ===")
            print(f"filename: {name}")
            print(f"path: {full_path}")
            print(f"size_bytes: {file_size}")

            result = analyze_image(full_path)

            print("=== ALGORITHM RESULT ===")
            print(json.dumps(result, indent=2))

            all_results.append({
                "filename": name,
                "analysis": result
            })

        return all_results  # return same shape as multi-image frontend expects

    except HTTPException:
        raise
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid or corrupted zip file.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if zip_path and os.path.exists(zip_path):
            os.remove(zip_path)

        if extract_dir and os.path.exists(extract_dir):
            shutil.rmtree(extract_dir)