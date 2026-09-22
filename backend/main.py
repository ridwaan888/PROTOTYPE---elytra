from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from paddleocr import PaddleOCR
import os
import tempfile
import json

app = FastAPI(title="RuleScan OCR Backend")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
ocr = PaddleOCR(lang="en", use_doc_orientation_classify=False, use_doc_unwarping=False, use_textline_orientation=False, enable_mkldnn=False)
@app.get("/")
def home():
    return {"status":"online", "message":"RuleScan OCR Backend is running"}

@app.post("/ocr")
async def extract_text(file: UploadFile = File(...)):
    temp_path = None
    try:
        if not file.content_type or not file.content_type.startswith("image/"):
            return {"text":"", "error":"Please upload an image file."}
        contents = await file.read()
        if not contents:
            return {"text":"", "error":"Uploaded image is empty."}
        suffix = os.path.splitext(file.filename or ".jpg")[1] or ".jpg"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(contents); temp_path = temp_file.name
        result = ocr.predict(temp_path)
        extracted_text = []
        for page in result:
            try:
                data = page.json
                if isinstance(data, str): data = json.loads(data)
                if isinstance(data, dict):
                    for text in data.get("res", {}).get("rec_texts", []):
                        if text and str(text).strip(): extracted_text.append(str(text).strip())
            except Exception as page_error:
                print("Page processing error:", page_error)
        final_text = "\n".join(extracted_text)
        if not final_text.strip():
            return {"text":"", "error":"OCR could not read any text from the image. Try a clearer photo."}
        return {"text": final_text}
    except Exception as e:
        print("OCR ERROR:", str(e))
        return {"text":"", "error":str(e)}
    finally:
        if temp_path and os.path.exists(temp_path):
            try: os.remove(temp_path)
            except Exception: pass
