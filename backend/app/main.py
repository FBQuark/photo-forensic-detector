import os, shutil, tempfile, json, csv, io, tempfile, zipfile
from Forensic_algorithm import analyze_image
from auth import get_current_user_from_auth_header
from fpdf import FPDF
from PIL import Image as PILImage

from config import (
    APPWRITE_DATABASE_ID,
    APPWRITE_COLLECTION_ID,
    APPWRITE_BUCKET_ID,
)

from converters import (
    flatten_result_for_csv,
    analysis_to_db_row,
    db_row_to_analysis_result,
    create_preview_image
)

#appwrite imports
from appwrite.services.databases import Databases
from appwrite.services.storage import Storage
from appwrite.id import ID
from appwrite.permission import Permission
from appwrite.role import Role
from appwrite.input_file import InputFile
from appwrite.services.tables_db import TablesDB
from appwrite.query import Query


#fastapi imports
from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi import Form, Header



#starting the server instance
app = FastAPI()

#Allowing what domains can access the paths being defined 
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

def process_and_save_image(image_path: str, filename: str, user, client):
    storage = Storage(client)
    databases = Databases(client)

    result = analyze_image(image_path)

    print("=== ALGORITHM RESULT ===")
    print(json.dumps(result, indent=2))

    uploaded_file = storage.create_file( #creating the file to store the image the user uploaded 
        bucket_id=APPWRITE_BUCKET_ID,
        file_id=ID.unique(),
        file=InputFile.from_path(image_path),
        permissions=[
            Permission.read(Role.user(user.id)),
            Permission.delete(Role.user(user.id)),
        ],
    )

    uploaded_photo_id = uploaded_file.id

    row_data = analysis_to_db_row( #flatten data in order to be inserted into database
        filename=filename,
        analysis=result,
        user_id=user.id,
        photo_id=uploaded_photo_id,
    )

    databases.create_document( # save the data from the algorithm to the appwrite database
        database_id=APPWRITE_DATABASE_ID,
        collection_id=APPWRITE_COLLECTION_ID,
        document_id=ID.unique(),
        data=row_data,
        permissions=[
            Permission.read(Role.user(user.id)),
            Permission.update(Role.user(user.id)),
            Permission.delete(Role.user(user.id)),
        ],
    )

    return { # Return the analysis, filename, and photoId to the frontend to be displayed
        "filename": filename,
        "analysis": result,
        "photoId": uploaded_photo_id,
    }


@app.get("/health") # health route to check for the api health and connectivity 
async def health_check():
    return {"status": "ok"}


@app.post("/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None),
):
    temp_path = None

    try:
        user, client = get_current_user_from_auth_header(authorization) #verifies the user using their JWT

        original_name = file.filename or "uploaded_file"
        _, ext = os.path.splitext(original_name)

        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            temp_path = tmp.name
            shutil.copyfileobj(file.file, tmp)

        file_size = os.path.getsize(temp_path)

        print("=== MESSAGE RECEIVED ===")
        print(f"filename: {file.filename}")
        print(f"content_type: {file.content_type}")
        print(f"temp_path: {temp_path}")
        print(f"size_bytes: {file_size}")

        return process_and_save_image(
            image_path=temp_path,
            filename=original_name,
            user=user,
            client=client,
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

# Fetch the authenticated users most recent analysis history
@app.get("/fetch-history")
async def fetch_history(
    authorization: str | None = Header(default=None),
):
    try:
        user, client = get_current_user_from_auth_header(authorization) # Verify User
        tables = TablesDB(client)

        response = tables.list_rows( # only fetch rows owned by this user, order by the date, and get the most recent 15 entries
            database_id=APPWRITE_DATABASE_ID,
            table_id=APPWRITE_COLLECTION_ID,
            queries=[
                Query.equal("userId", [user.id]),
                Query.order_desc("$createdAt"),
                Query.limit(15),
            ],
        )

        rows = response.rows if hasattr(response, "rows") else response["rows"] # Depending on the SDK the rows may be represented as different objects, this line allows us to handle more
        #variation in how the data is returned from the appwrite backend

        return [db_row_to_analysis_result(row) for row in rows] #return to the frontend

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# returns an image preview based on the photo_id
@app.get("/photo-preview/{photo_id}")
async def photo_preview(
    photo_id: str,
    authorization: str | None = Header(default=None),
):
    try:
        user, client = get_current_user_from_auth_header(authorization) #verify user

        # Confirm this photo belongs to the current user
        tables = TablesDB(client)
        
        # Check if the row belongs to the current user
        response = tables.list_rows(
            database_id=APPWRITE_DATABASE_ID,
            table_id=APPWRITE_COLLECTION_ID,
            queries=[
                Query.equal("userId", [user.id]),
                Query.equal("photoId", [photo_id]),
                Query.limit(1),
            ],
        )

        rows = response.rows if hasattr(response, "rows") else response["rows"] #covering multiple return types from the backend

        if not rows:
            raise HTTPException(status_code=403, detail="You do not have access to this photo")

        # Fetch the photo from Appwrite Storage after security check
        storage = Storage(client)

        file_bytes = storage.get_file_view(
            bucket_id=APPWRITE_BUCKET_ID,
            file_id=photo_id,
        )

        preview_bytes = create_preview_image(
            image_bytes=file_bytes,
            max_size=700,
            quality=75,
        )


        # Return image bytes to frontend for display
        return StreamingResponse(
            io.BytesIO(preview_bytes),
            media_type="image/jpeg",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
      
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
async def upload_zip(
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None),
): #get the zip file from the frontend, extract it, and process top-level images only
    zip_path = None
    extract_dir = None

    try:
        user, client = get_current_user_from_auth_header(authorization) #verifies the user using their JWT

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

        supported_extensions = {".jpg", ".jpeg", ".png"} #define supported image extentions
        all_results = []

        # check top-level contents
        top_level_items = os.listdir(extract_dir)
        working_dir = extract_dir

        # if the zip contains one wrapping folder, step into it
        if len(top_level_items) == 1:
            possible_folder = os.path.join(extract_dir, top_level_items[0])
            if os.path.isdir(possible_folder):
                print(f"FOUND TOP LEVEL FOLDER: {top_level_items[0]}")
                working_dir = possible_folder

        image_count = 0
        max_zip_images = 10

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

            if image_count >= max_zip_images:
                print(f"ZIP IMAGE LIMIT REACHED: {max_zip_images}")
                break

            file_size = os.path.getsize(full_path)

            print("=== EXTRACTED IMAGE FOUND ===")
            print(f"filename: {name}")
            print(f"path: {full_path}")
            print(f"size_bytes: {file_size}")

            saved_result = process_and_save_image(
                image_path=full_path,
                filename=name,
                user=user,
                client=client,
            )

            all_results.append(saved_result)
            image_count += 1

        if not all_results:
            raise HTTPException(
                status_code=400,
                detail="No supported top-level images were found in the zip file.",
            )

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
    temp_paths = []
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

            #resize the image for display so the file size stays small
            IMAGE_WIDTH_PX = 340
            thumb_path = None
            try:
                with PILImage.open(img_path) as img:
                    img_w, img_h = img.size
                    scale = IMAGE_WIDTH_PX / img_w #calculates how much to scale the image down
                    new_h = int(img_h * scale) #keeps proportions the same
                    #algorithm to actually resize the image down
                    resized = img.resize((IMAGE_WIDTH_PX, new_h), PILImage.LANCZOS)

                    #ensures the color palette is in a format that JPEG can use
                    if resized.mode in ("RGBA", "P"):
                        resized = resized.convert("RGB")
                    #creates a temporary file of the thumbnail to be referenced later when embedding
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
                        resized.save(tmp.name, "JPEG", quality = 75)
                        thumb_path = tmp.name

                #ensures there is enough room for the image/text to be displayed on the page
                image_height = IMAGE_WIDTH * img_h / img_w
                row_height = max(image_height, text_block_height)
                if current_y + row_height > PAGE_HEIGHT: #if there isn't enough room, add a new page
                    pdf.add_page()
                    current_y = MARGIN
                #embeds the thumbnail in the PDF
                pdf.image(thumb_path, x=MARGIN, y=current_y, w=IMAGE_WIDTH)
            finally:
                #deletes the thumbnail file even if the embedding process failed
                if thumb_path and os.path.exists(thumb_path):
                    os.remove(thumb_path)

            #writes text to the right
            TEXT_MARGIN = 110
            pdf.set_xy(TEXT_MARGIN,current_y)
            pdf.set_font("Arial", "B", size=12)
            pdf.cell(0,8, f"File: {filename}", ln=True)

            #writes all the results info to the cells
            pdf.set_font("Arial", size=10)
            pdf.set_x(TEXT_MARGIN)
            pdf.cell(0, 7, f"Verdict: {verdict}", ln=True)
            pdf.set_x(TEXT_MARGIN)
            pdf.cell(0, 7, f"Delta EV: {delta_ev}", ln=True)
            pdf.set_x(TEXT_MARGIN)
            pdf.cell(0, 7, f"Predicted ISO: {predicted.get('iso', 'N/A')}", ln=True)
            pdf.set_x(TEXT_MARGIN)
            pdf.cell(0, 7, f"Predicted F-Stop: {predicted.get('f_stop', 'N/A')}", ln=True)
            pdf.set_x(TEXT_MARGIN)
            pdf.cell(0, 7, f"Predicted Shutter: {predicted.get('shutter_display', 'N/A')}", ln=True)
            pdf.set_x(TEXT_MARGIN)
            pdf.cell(0, 7, f"Predicted EV: {predicted.get('ev', 'N/A')}", ln=True)
            if truth:
                pdf.set_x(TEXT_MARGIN)
                pdf.cell(0, 7, f"True ISO: {truth.get('iso', 'N/A')}", ln=True)
                pdf.set_x(TEXT_MARGIN)
                pdf.cell(0, 7, f"True F-Stop: {truth.get('f_stop', 'N/A')}", ln=True)
                pdf.set_x(TEXT_MARGIN)
                pdf.cell(0, 7, f"True Shutter: {truth.get('shutter_display', 'N/A')}", ln=True)
                pdf.set_x(TEXT_MARGIN)
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