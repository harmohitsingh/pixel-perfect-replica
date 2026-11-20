import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CameraOff } from "lucide-react";
export function Scanner({
  onScan,
  onClose,
}: {
  onScan: (text: string) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const scanned = useRef(false);
  useEffect(() => {
    let disposed = false;
    let scanner: import("html5-qrcode").Html5Qrcode | undefined;
    void import("html5-qrcode")
      .then(async ({ Html5Qrcode }) => {
        if (disposed) return;
        scanner = new Html5Qrcode("qr-camera");
        try {
          await scanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 240, height: 240 } },
            (text) => {
              if (!scanned.current) {
                scanned.current = true;
                onScan(text);
              }
            },
            () => {},
          );
          if (disposed && scanner.isScanning) await scanner.stop();
        } catch (e) {
          if (!disposed)
            setError(
              `Camera unavailable: ${e instanceof Error ? e.message : String(e)}. Use pasted QR data instead.`,
            );
        }
      })
      .catch(() => setError("Camera scanner could not load. Use pasted QR data instead."));
    return () => {
      disposed = true;
      if (scanner?.isScanning) void scanner.stop().catch(() => {});
    };
  }, [onScan]);
  return (
    <div className="camera-panel">
      <div id="qr-camera" />
      {error && <p className="error-text">{error}</p>}
      <Button variant="outline" onClick={onClose}>
        <CameraOff /> Close camera
      </Button>
    </div>
  );
}
