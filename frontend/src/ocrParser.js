const OCR_API_URL = "https://outing-enjoyment-motor.ngrok-free.dev/ocr";

export async function runOCR(file, onProgress) {
  const formData = new FormData();
  formData.append("file", file);
  onProgress?.(10);

  let response;
  try {
    response = await fetch(OCR_API_URL, { method: "POST", body: formData });
  } catch {
    throw new Error("Could not reach the OCR backend. Start it with: uvicorn main:app --reload --port 8000");
  }

  onProgress?.(70);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    throw new Error(data.error || `OCR backend error: ${response.status}`);
  }
  onProgress?.(100);
  return data.text || "";
}

const clean = (value) => value?.replace(/\s+/g, " ").trim() || null;

export function parseLabelText(rawText) {
  const text = rawText.replace(/\r/g, "");
  const lines = text.split("\n").map((l) => clean(l)).filter(Boolean);

  const result = {
    productName: null,
    barcode: null,
    mrp: null,
    netQuantity: null,
    manufacturer: null,
    address: null,
    consumerCare: null,
    manufactureDate: null,
    expiryDate: null,
  };

  const barcodeMatch = text.match(/(?:BAR\s*CODE|EAN|UPC|GTIN)\s*[:#-]?\s*(\d{8,14})/i) || text.match(/\b(\d{12,14})\b/);
  if (barcodeMatch) result.barcode = barcodeMatch[1];

  const mrpMatch = text.match(/(?:M\.?R\.?P\.?|MAX(?:IMUM)?\s*RETAIL\s*PRICE|PRICE)\s*[:\-]?\s*(?:RS\.?|INR|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (mrpMatch) result.mrp = `₹${mrpMatch[1]}`;

  const qtyMatch = text.match(/(?:NET\s*(?:QTY|QUANTITY|WT|WEIGHT|CONTENTS?)|CONTENTS)\s*[:\-]?\s*([\d.]+\s?(?:kg|g|gm|gms|mg|ml|l|litre|litres|liter|liters))/i);
  if (qtyMatch) result.netQuantity = qtyMatch[1].trim();

  const mfgMatch = text.match(/(?:MANUFACTURED\s*BY|MFG\.?\s*BY|MARKETED\s*BY|PACKED\s*BY)\s*[:\-]?\s*(.+)/i);
  if (mfgMatch) result.manufacturer = clean(mfgMatch[1].split(/\n/)[0]);

  const phoneMatch = text.match(/(?:CONSUMER\s*CARE|CUSTOMER\s*CARE|HELPLINE|TOLL[\s-]?FREE)\s*[:\-]?\s*([\d\-+()\s]{8,})/i) || text.match(/(1800[\-\s]?\d{2,3}[\-\s]?\d{4})/i);
  if (phoneMatch) result.consumerCare = clean(phoneMatch[1]);

  const addressLine = lines.find((l) => /\b\d{6}\b/.test(l));
  if (addressLine) result.address = addressLine;

  const datePatterns = [
    /(?:MFG|MFD|MANUFACTURED|PACKED|PKD|DATE\s*OF\s*(?:MFG|MANUFACTURE|PACKING))[^\n:]*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{1,2}[\/-]\d{2,4}|\d{2,4}[\/-]\d{1,2})/i,
    /(?:MFG|MFD|MANUFACTURED|PACKED|PKD)[^\n:]*[:\-]?\s*([A-Za-z]{3,9}\s*[-/]?\s*\d{2,4})/i,
  ];
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) { result.manufactureDate = clean(match[1]); break; }
  }

  const expiryPatterns = [
    /(?:EXP|EXPIRY|EXPIRES|BEST\s*BEFORE|USE\s*BY)[^\n:]*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{1,2}[\/-]\d{2,4}|\d{2,4}[\/-]\d{1,2})/i,
    /(?:EXP|EXPIRY|BEST\s*BEFORE|USE\s*BY)[^\n:]*[:\-]?\s*([A-Za-z]{3,9}\s*[-/]?\s*\d{2,4})/i,
  ];
  for (const pattern of expiryPatterns) {
    const match = text.match(pattern);
    if (match) { result.expiryDate = clean(match[1]); break; }
  }

  const skipPattern = /(MRP|NET\s*(QTY|QUANTITY|WT|WEIGHT)|MANUFACTURED|MARKETED|PACKED|CONSUMER|CUSTOMER|ADDRESS|BEST\s*BEFORE|BATCH|MFD|MFG|EXP|BAR\s*CODE|EAN|UPC|GTIN)/i;
  const nameCandidate = lines.find((l) => l.length > 2 && !skipPattern.test(l) && !/^\d+$/.test(l));
  if (nameCandidate) result.productName = nameCandidate;

  return result;
}

// The original PPT refers to 7 mandatory checks but does not enumerate all seven.
// The prototype therefore keeps the six original declaration checks and adds a
// separate date declaration check so the demo can visibly inspect the dates requested.
export const REQUIRED_FIELDS = [
  { key: "productName", label: "Product Name" },
  { key: "mrp", label: "MRP (Maximum Retail Price)" },
  { key: "netQuantity", label: "Net Quantity" },
  { key: "manufacturer", label: "Manufacturer / Packer / Marketer" },
  { key: "address", label: "Address" },
  { key: "consumerCare", label: "Consumer Care Details" },
  { key: "manufactureDate", label: "Manufacture / Packing Date" },
  { key: "expiryDate", label: "Expiry / Best-before Date" },
];

export function checkCompliance(fields) {
  const missing = REQUIRED_FIELDS.filter((f) => !fields[f.key]).map((f) => f.label);
  const found = REQUIRED_FIELDS.length - missing.length;
  const score = Math.round((found / REQUIRED_FIELDS.length) * 100);
  return { score, missing, compliant: missing.length === 0 };
}
