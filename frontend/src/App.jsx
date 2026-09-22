import { useEffect, useState } from "react";
import "./App.css";
import CameraScanner from "./CameraScanner";
import { runOCR, parseLabelText, checkCompliance, REQUIRED_FIELDS } from "./ocrParser";

const emptyFields = {
  productName: "", barcode: "", mrp: "", netQuantity: "", manufacturer: "", address: "", consumerCare: "", manufactureDate: "", expiryDate: "",
};

function App() {
  const [page, setPage] = useState("Dashboard");
  const [imageFile, setImageFile] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fields, setFields] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [ocrError, setOcrError] = useState("");
  const [barcodeStatus, setBarcodeStatus] = useState("");
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem("rulescan-history") || "[]"));

  useEffect(() => localStorage.setItem("rulescan-history", JSON.stringify(history)), [history]);

  const handleCapture = (file) => {
    setImageFile(file); setFields(null); setCompliance(null); setOcrError(""); setBarcodeStatus("");
  };

  const detectBarcode = async (file) => {
    if (!("BarcodeDetector" in window)) {
      setBarcodeStatus("Native barcode scanning is not available in this browser; OCR will still check the label.");
      return null;
    }
    try {
      const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "itf", "qr_code"] });
      const bitmap = await createImageBitmap(file);
      const codes = await detector.detect(bitmap);
      bitmap.close();
      const value = codes[0]?.rawValue || null;
      setBarcodeStatus(value ? `✓ Barcode detected: ${value}` : "No barcode detected. OCR will continue.");
      return value;
    } catch (err) {
      console.warn("Barcode detection failed", err);
      setBarcodeStatus("Barcode could not be read from this image. OCR will continue.");
      return null;
    }
  };

  const scanProduct = async () => {
    if (!imageFile) { alert("Please capture or upload a product image first."); return; }
    setScanning(true); setOcrError(""); setProgress(0);
    try {
      const [rawText, barcode] = await Promise.all([runOCR(imageFile, setProgress), detectBarcode(imageFile)]);
      const extracted = parseLabelText(rawText);
      if (barcode) extracted.barcode = barcode;
      const result = checkCompliance(extracted);
      setFields({ ...emptyFields, ...extracted }); setCompliance(result);
    } catch (err) {
      console.error(err); setOcrError(err.message || "OCR failed to read the image. Try a clearer photo.");
    } finally { setScanning(false); }
  };

  const updateField = (key, value) => {
    setFields((prev) => { const updated = { ...prev, [key]: value }; setCompliance(checkCompliance(updated)); return updated; });
  };

  const saveInspection = () => {
    if (!fields || !compliance) return;
    const record = { id: Date.now(), product: fields.productName || "Unknown product", date: new Date().toLocaleDateString("en-IN"), score: compliance.score, status: compliance.compliant ? "COMPLIANT" : "NEEDS REVIEW", fields: { ...fields } };
    setHistory((prev) => [record, ...prev].slice(0, 50));
    alert("Inspection saved to local history.");
  };

  const downloadReport = () => {
    if (!fields || !compliance) return;
    const lines = [
      "RULESCAN - PRELIMINARY LEGAL METROLOGY INSPECTION REPORT",
      `Inspection Date: ${new Date().toLocaleString("en-IN")}`,
      `Status: ${compliance.compliant ? "COMPLIANT" : "NEEDS REVIEW"}`,
      `Detection Score: ${compliance.score}%`,
      "",
      "EXTRACTED INFORMATION",
      ...Object.entries({
        "Product Name": fields.productName, "Barcode / GTIN": fields.barcode, MRP: fields.mrp, "Net Quantity": fields.netQuantity,
        "Manufacturer / Packer / Marketer": fields.manufacturer, Address: fields.address, "Consumer Care": fields.consumerCare,
        "Manufacture / Packing Date": fields.manufactureDate, "Expiry / Best-before Date": fields.expiryDate,
      }).map(([key, value]) => `${key}: ${value || "Not detected"}`),
      "",
      "MISSING / UNDETECTED FIELDS",
      ...(compliance.missing.length ? compliance.missing.map((x) => `- ${x}`) : ["None"]),
      "",
      "Note: This is a preliminary prototype result and must be verified against the physical package and applicable Legal Metrology requirements.",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `RuleScan_Report_${Date.now()}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const resetInspection = () => { setImageFile(null); setFields(null); setCompliance(null); setOcrError(""); setBarcodeStatus(""); setProgress(0); };
  const total = history.length;
  const compliantCount = history.filter((x) => x.status === "COMPLIANT").length;
  const reviewCount = history.filter((x) => x.status !== "COMPLIANT").length;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><h1>RuleScan</h1><p>Legal Metrology Inspection</p></div>
        {[['Dashboard','📊'],['Inspection','🔍'],['History','📋'],['Rules','⚙']].map(([name, icon]) => (
          <button key={name} className={page === name ? "active" : ""} onClick={() => setPage(name)}>{icon} {name === "Inspection" ? "New Inspection" : name === "Rules" ? "Compliance Rules" : name}</button>
        ))}
      </aside>

      <main className="main">
        <header><div><p className="eyebrow">PACKAGED COMMODITY INSPECTION</p><h2>{page}</h2></div><span>Preliminary digital compliance check</span></header>

        {page === "Dashboard" && <section>
          <div className="cards">
            <div className="card"><span>Total Inspections</span><strong>{total}</strong></div>
            <div className="card"><span>Compliant</span><strong>{compliantCount}</strong></div>
            <div className="card"><span>Needs Review</span><strong>{reviewCount}</strong></div>
            <div className="card"><span>Fields Checked</span><strong>{REQUIRED_FIELDS.length}</strong></div>
          </div>
          <div className="panel hero-panel"><div><p className="eyebrow">OCR + BARCODE + RULE CHECK</p><h3>Inspect a packaged product in seconds</h3><p>Capture or upload a label image. RuleScan extracts visible declarations, detects a barcode when the browser supports it, and generates a preliminary compliance report for inspector verification.</p><button className="primary" onClick={() => setPage("Inspection")}>🔍 Start New Inspection</button></div><div className="hero-icon">⚖️</div></div>
        </section>}

        {page === "Inspection" && <section>
          <div className="panel"><div className="section-title"><div><h3>Capture / Upload Product</h3><p>Use the package label as the image source.</p></div>{fields && <button className="secondary" onClick={resetInspection}>＋ New Scan</button>}</div>
            <CameraScanner onCapture={handleCapture} />
            {imageFile && <button className="primary scan-button" onClick={scanProduct} disabled={scanning}>{scanning ? `🔍 Reading label... ${progress}%` : "🔍 Scan Product & Check Compliance"}</button>}
            {barcodeStatus && <p className="info-message">{barcodeStatus}</p>}
            {ocrError && <p className="scanner-error">⚠️ {ocrError}</p>}
          </div>

          {fields && compliance && <div className="panel">
            <div className="section-title"><div><h3>Extracted Information</h3><p>OCR output is editable so an inspector can verify uncertain readings.</p></div><div className={compliance.compliant ? "status compliant" : "status review"}>{compliance.compliant ? "✓ COMPLIANT" : "⚠ NEEDS REVIEW"}<small>{compliance.score}% fields detected</small></div></div>
            <div className="fields">
              {[['productName','Product Name'],['barcode','Barcode / GTIN'],['mrp','MRP'],['netQuantity','Net Quantity'],['manufacturer','Manufacturer / Packer / Marketer'],['address','Address'],['consumerCare','Consumer Care'],['manufactureDate','Manufacture / Packing Date'],['expiryDate','Expiry / Best-before Date']].map(([key,label]) => <div key={key}><label>{label}</label><input value={fields[key] || ""} placeholder="Not detected" onChange={(e) => updateField(key,e.target.value)} /></div>)}
            </div>
            <div className={compliance.compliant ? "result-box good" : "result-box warning"}><strong>{compliance.compliant ? "All prototype checks passed" : "Review required fields"}</strong><p>{compliance.compliant ? "The visible declarations detected by the prototype are present. Verify against the physical package before taking any official action." : `The following fields were not detected: ${compliance.missing.join(", ")}.`}</p></div>
            <div className="report-actions"><button className="primary" onClick={saveInspection}>💾 Save Inspection Report</button><button className="secondary" onClick={downloadReport}>⬇ Download Report</button></div>
          </div>}
        </section>}

        {page === "History" && <section className="panel"><div className="section-title"><div><h3>Inspection History</h3><p>Saved locally in this browser for the prototype demo.</p></div><button className="secondary" onClick={() => { localStorage.removeItem("rulescan-history"); setHistory([]); }}>Clear History</button></div>{history.length === 0 ? <div className="empty">No saved inspections yet. Complete a scan and choose “Save Inspection Report”.</div> : <div className="table-wrap"><table><thead><tr><th>Product</th><th>Date</th><th>Score</th><th>Status</th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td>{item.product}</td><td>{item.date}</td><td>{item.score}%</td><td className={item.status === "COMPLIANT" ? "green" : "amber"}>{item.status}</td></tr>)}</tbody></table></div>}</section>}

        {page === "Rules" && <section className="panel"><div className="section-title"><div><h3>Prototype Rule Engine</h3><p>The original PPT lists mandatory declaration checking; this screen shows the fields implemented in the prototype.</p></div></div><div className="rule-grid">{REQUIRED_FIELDS.map((rule, i) => <div className="rule" key={rule.key}><span>{String(i + 1).padStart(2,"0")}</span><div><strong>{rule.label}</strong><p>Detected from OCR / barcode input</p></div></div>)}</div><div className="note">⚠ This is a preliminary prototype. A “COMPLIANT” result means the configured fields were detected; it is not a legal certification or substitute for an inspector’s verification.</div></section>}
      </main>
    </div>
  );
}

export default App;
