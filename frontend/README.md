# RuleScan — Legal Metrology Prototype

Prototype based on the team's SIH 2026 concept: scan/upload a packaged commodity label, extract visible declarations with OCR, check configured declaration fields, and produce a preliminary compliance report.

## Project flow

1. Open the React web app.
2. Choose **New Inspection**.
3. Open the camera or upload a product-label image.
4. Click **Scan Product & Check Compliance**.
5. PaddleOCR reads the image through the FastAPI backend.
6. The frontend extracts Product Name, Barcode/GTIN, MRP, Net Quantity, Manufacturer/Packer/Marketer, Address, Consumer Care, Manufacture/Packing Date and Expiry/Best-before Date.
7. If the browser supports `BarcodeDetector`, the app also attempts direct barcode reading.
8. Review/edit the extracted fields.
9. Save the inspection to browser-local history.

## Run on Windows

### Terminal 1 — OCR backend

```powershell
cd frontend\backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Keep this terminal running.

### Terminal 2 — frontend

```powershell
cd frontend
npm install
npm run dev
```

Open the localhost URL printed by Vite.

## Important

- Camera access normally requires localhost or HTTPS.
- The OCR backend must be running before scanning.
- The prototype stores inspection history in the browser's localStorage; it does not use a database yet.
- A compliant result is only a preliminary software check of the configured fields. It is not a legal certification.
- The original PPT says there are 7 mandatory rules but does not enumerate all seven. This prototype therefore keeps the six declaration checks explicitly present in the PPT and separately adds manufacture/packing and expiry/best-before date checks because those dates are part of the requested prototype workflow. The final rule set should be validated against the applicable Legal Metrology rules before production use.
