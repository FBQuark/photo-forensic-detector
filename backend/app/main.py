import os
import shutil
import tempfile
import subprocess
import json

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

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


@app.get("/health") #health route to check for the api health and connectivity 
async def health_check():
    return {"status": "ok"}


def extract_exif_metadata(image_path: str) -> dict | None: # this was taken directly from her algorithm, it runs that command using exiftool(needs to be installed on ur system and on path)
    image_path = str(image_path)
    cmd = ["exiftool", "-json", "-n", "-a", "-u", "-U", "-g1", "-G1", image_path]
    res = subprocess.run(cmd, capture_output=True, text=True) #runs the command with the image path 

    if res.returncode != 0: #if it didnt work print why 
        print("=== EXIFTOOL ERROR ===")
        print(res.stderr)
        return None

    try:
        data = json.loads(res.stdout) #convert the data into a pretty python json 
        d = data[0] if isinstance(data, list) and data else data #chatGPT generated... honestly not too confident on its purpose. something to do with if its a list or not **look into more**
        return d if isinstance(d, dict) else None #return only if the output is a python dictionary(maybe not necessary for passing to the real algorithm)
    except Exception as e: #catch any exceptions and throw 
        print("=== JSON PARSE ERROR ===")
        print(str(e))
        return None
  

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

        metadata = extract_exif_metadata(temp_path) #call the metadata extraction function

        if metadata is None:
            raise HTTPException(
                status_code=500,
                detail="Failed to extract metadata with exiftool",
            )

        print("=== METADATA RECEIVED ===") #print a notice that the metadata was recieved 
        print(json.dumps(metadata, indent=2)[:3000])  # avoids dumping too much

        return { #returning information to the backend (whoever picks this up just needs to return the results of the algorithm to the frontend so this will be changed)
            "message": "message received",
            "filename": file.filename,
            "content_type": file.content_type,
            "size_bytes": file_size,
            "metadata_found": True,
            "metadata_keys": list(metadata.keys())[:20],  # quick proof
            "metadata": metadata,  # you can remove this later if too large
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)