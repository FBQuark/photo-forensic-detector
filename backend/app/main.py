import os
import shutil
import tempfile
import json
import csv
import io
import tempfile
import zipfile


from .Forensic_algorithm import analyze_image
from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi import Form
from fpdf import FPDF
from PIL import Image as PILImage




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
def get_exiftool_command():
    import shutil
    return shutil.which("exiftool")

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


@app.post("/download-pdf")
async def download_pdf(files: list[UploadFile] = File(...), results: str = Form(...)): #get the already computed frontend results and convert them into a downloadable pdf
    temp_paths = [];
    try:
        #parses the JSON string back into a dictionary list
        results_data = json.loads(results)
        if not results_data:
            raise HTTPException(status_code=400, detail="No results were provided.")
        #loops through each file, gets the extension, saves it to a temp file, and stores that temp path in the list
        for file in files:
            _, ext = os.path.splitext(file.filename or "image.jpg")
            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                shutil.copyfileobj(file.file, tmp)
                temp_paths.append(tmp.name)

        pdf = FPDF() #creates a new pdf document
        pdf.set_auto_page_break(auto=True, margin=15) #creates a new page if the content gets too close to the bottom

        #standard dimensions for A4 paper
        PAGE_WIDTH = 190
        PAGE_HEIGHT = 277 #minus margins
        IMAGE_WIDTH = 90
        MARGIN = 10
        ROW_PADDING = 8 #space between rows

        current_y = MARGIN
        pdf.add_page()

        #loops through the results and image paths dictionaries and pulls out the relevant data for each image
        for i, (result, img_path) in enumerate(zip(results_data, temp_paths)):
            analysis = result.get("analysis", {})
            predicted = analysis.get("predicted", {})
            truth = analysis.get("truth")
            verdict = analysis.get("verdict", "N/A")
            delta_ev = analysis.get("delta_ev", "N/A")
            filename = result.get("filename", f"Image {i + 1}")

            text_lines = 6 #a line for each result being written
            if truth: text_lines += 4
            text_block_height = text_lines * 7 + 8 # 7px per line, 8px for file name title

            #get dimensions of the image and scale it proportionally
            with PILImage.open(img_path) as img:
                img_w, img_h = img.size
            image_height = IMAGE_WIDTH * img_h / img_w

            row_height = max(image_height, text_block_height)
            #if the image is too big for the page, goes to the next one
            if current_y + row_height > PAGE_HEIGHT:
                pdf.add_page()
                current_y = MARGIN

            pdf.image(img_path, x=MARGIN, y=current_y, w=IMAGE_WIDTH) #embeds the image into the page
            #writes text to the right
            pdf.set_xy(110,current_y)
            pdf.set_font("Arial", "B", size=12)
            pdf.cell(0,8, f"File: {filename}", ln=True)

            #writes all the results info to the cells
            pdf.set_font("Arial", size=10)
            pdf.set_x(110)
            pdf.cell(0, 7, f"Verdict: {verdict}", ln=True)
            pdf.set_x(110)
            pdf.cell(0, 7, f"Delta EV: {delta_ev}", ln=True)
            pdf.set_x(110)
            pdf.cell(0, 7, f"Predicted ISO: {predicted.get('iso', 'N/A')}", ln=True)
            pdf.set_x(110)
            pdf.cell(0, 7, f"Predicted F-Stop: {predicted.get('f_stop', 'N/A')}", ln=True)
            pdf.set_x(110)
            pdf.cell(0, 7, f"Predicted Shutter: {predicted.get('shutter_display', 'N/A')}", ln=True)
            pdf.set_x(110)
            pdf.cell(0, 7, f"Predicted EV: {predicted.get('ev', 'N/A')}", ln=True)
            if truth:
                pdf.set_x(110)
                pdf.cell(0, 7, f"True ISO: {truth.get('iso', 'N/A')}", ln=True)
                pdf.set_x(110)
                pdf.cell(0, 7, f"True F-Stop: {truth.get('f_stop', 'N/A')}", ln=True)
                pdf.set_x(110)
                pdf.cell(0, 7, f"True Shutter: {truth.get('shutter_display', 'N/A')}", ln=True)
                pdf.set_x(110)
                pdf.cell(0, 7, f"True EV: {truth.get('ev', 'N/A')}", ln=True)
            #advances y past this row
            current_y += ROW_PADDING + row_height

            #after each image, draws a gray line in between each image
            if i < len(results_data) - 1:
                pdf.ln(5)
                pdf.set_draw_color(180, 180, 180)
                pdf.line(MARGIN, current_y - ROW_PADDING /2, 200, current_y - ROW_PADDING /2)

        #converts the pdf into the bytes
        pdf_bytes = pdf.output()
        buffer = io.BytesIO(bytes(pdf_bytes))
        buffer.seek(0)

        #sends the pdf back to the frontend
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": "attachment; filename=analysis_results.pdf"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        #deletes all the temporary paths created
        for path in temp_paths:
            if os.path.exists(path):
                os.remove(path)