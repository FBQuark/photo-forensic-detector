import os
import shutil
import tempfile
import subprocess
import json
import csv
import io


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