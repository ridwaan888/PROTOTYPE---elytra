import { useEffect, useRef, useState } from "react";

function CameraScanner({ onCapture, onBarcode }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");

  const startCamera = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
    } catch (err) {
      console.error(err);
      setError("Camera permission denied or camera is unavailable.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  };

  const captureImage = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) { setError("Camera is not ready. Please wait."); return; }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) { setError("Failed to capture image."); return; }
      const file = new File([blob], "product-image.jpg", { type: "image/jpeg" });
      const imageUrl = URL.createObjectURL(blob);
      setPreview(imageUrl); onCapture?.(file); stopCamera();
    }, "image/jpeg", 0.92);
  };

  const handleUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please select an image file."); return; }
    setError(""); setPreview(URL.createObjectURL(file)); onCapture?.(file);
  };

  const retakeImage = () => { setPreview(null); setError(""); startCamera(); };

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  return (
    <div className="scanner-box">
      {!cameraOn && !preview && (
        <div className="scanner-actions">
          <button className="secondary" onClick={startCamera}>📷 Open Camera</button>
          <button className="secondary" onClick={() => fileInputRef.current?.click()}>📁 Upload Image</button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} hidden />
        </div>
      )}

      {error && <p className="scanner-error">⚠️ {error}</p>}

      {cameraOn && (
        <div>
          <div className="camera-frame"><video ref={videoRef} autoPlay playsInline muted /></div>
          <div className="scanner-actions">
            <button className="primary" onClick={captureImage}>📸 Capture Product</button>
            <button className="secondary" onClick={stopCamera}>❌ Stop Camera</button>
          </div>
          <p className="hint">Keep the package label flat, well lit and readable.</p>
        </div>
      )}

      {preview && (
        <div className="preview-card">
          <h4>Product Image</h4>
          <img src={preview} alt="Captured product label" />
          <div className="scanner-actions">
            <button className="secondary" onClick={retakeImage}>🔄 Retake</button>
            <button className="secondary" onClick={() => fileInputRef.current?.click()}>📁 Choose Another</button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} hidden />
          <p className="ready">✓ Image ready for OCR and compliance checking</p>
        </div>
      )}
    </div>
  );
}

export default CameraScanner;
