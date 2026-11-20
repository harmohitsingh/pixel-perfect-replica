import { useCallback, useRef, useState } from "react";
import {
  ScanLine,
  Camera,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Check,
  LoaderCircle,
  FileUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeading, LedgerAside, useLedger } from "./workspace";
import { Scanner } from "./scanner";
import { resolvePayload, verifyReceipt, leafInput, type Receipt } from "@/lib/verimark/ledger";
export function VerifyPanel() {
  const { fresh } = useLedger();
  const [input, setInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Awaited<ReturnType<typeof verifyReceipt>> | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const imageBusy = useRef(false);
  const [readingImage, setReadingImage] = useState(false);
  async function scanImage(file: File | undefined) {
    if (!file || imageBusy.current) return;
    imageBusy.current = true;
    setReadingImage(true);
    setError("");
    setResult(null);
    let reader: import("html5-qrcode").Html5Qrcode | undefined;
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      reader = new Html5Qrcode("qr-image-reader", {
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        verbose: false,
      });
      const text = await reader.scanFile(file, false);
      setInput(text);
      await verify(text);
    } catch (e) {
      setError(
        `QR image could not be read. Choose a clear VeriMark QR PNG. ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      reader?.clear();
      imageBusy.current = false;
      setReadingImage(false);
    }
  }
  async function verify(text: string) {
    setWorking(true);
    setError("");
    setResult(null);
    try {
      if (!text.trim()) throw new Error("Enter a registration number or paste QR data.");
      const ledger = await fresh();
      let r: Receipt;
      if (text.trim().startsWith("{")) r = resolvePayload(text, ledger);
      else {
        const matches = ledger.records.filter((r) => r.reg_no === text.trim());
        if (!matches.length) throw new Error("Registration number not found in this ledger.");
        if (matches.length > 1)
          throw new Error(
            "Multiple subjects found. Paste the QR payload for the specific subject.",
          );
        const match = matches[0];
        if (!match) throw new Error("Result not found.");
        r = match;
      }
      setReceipt(r);
      setResult(await verifyReceipt(ledger, r));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification could not be completed.");
    } finally {
      setWorking(false);
    }
  }
  const onScan = useCallback(
    (text: string) => {
      setInput(text);
      setScanning(false);
      void verify(text);
    },
    [fresh],
  );
  return (
    <>
      <PageHeading
        eyebrow="PUBLIC VERIFICATION"
        title="Trust the proof, not the paper."
        description="Check a result against its original Merkle proof and the full ledger chain."
      />
      <div className="publish-layout">
        <section className="verification-main">
          <div className="section-title">
            <div>
              <h2>Verify a marksheet</h2>
              <p>Registration number or cryptographic QR payload</p>
            </div>
            <ScanLine size={24} />
          </div>
          <label className="field-label">
            Registration Number / QR Data
            <textarea
              aria-label="Registration Number or QR Data"
              rows={6}
              placeholder={
                "Enter registration number, e.g. 12204511\n\nor paste the complete QR JSON payload…"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </label>
          <div className="verify-actions">
            <Button
              variant="outline"
              disabled={readingImage || working}
              onClick={() => setScanning(!scanning)}
            >
              <Camera />
              Scan QR with Camera
            </Button>
            <Button
              variant="outline"
              disabled={readingImage || working || scanning}
              onClick={() => imageInput.current?.click()}
            >
              {readingImage ? <LoaderCircle className="spin" /> : <FileUp />}Upload QR Image
            </Button>
            <Button disabled={working || readingImage} onClick={() => void verify(input)}>
              {working ? <LoaderCircle className="spin" /> : <ShieldCheck />}Verify Marksheet
              <ArrowRight />
            </Button>
          </div>
          <input
            ref={imageInput}
            className="sr-only"
            type="file"
            accept="image/*"
            aria-label="Upload QR image file"
            onChange={(e) => {
              void scanImage(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <div id="qr-image-reader" className="qr-image-reader" />
          {scanning && <Scanner onScan={onScan} onClose={() => setScanning(false)} />}
          {error && (
            <div className="error-banner" role="alert">
              <ShieldAlert size={22} />
              {error}
            </div>
          )}
          {result && receipt && (
            <div className="verification-result">
              <div className={`result-banner ${result.authentic ? "authentic" : "tampered"}`}>
                {result.authentic ? <ShieldCheck size={42} /> : <ShieldAlert size={42} />}
                <div>
                  <h2>{result.authentic ? "AUTHENTIC & UNMODIFIED" : "TAMPERING DETECTED"}</h2>
                  <p>
                    {receipt.reg_no} · {receipt.subject_code} · {receipt.marks} marks · Grade{" "}
                    {receipt.grade}
                  </p>
                </div>
              </div>
              {result.historical && result.authentic && (
                <p className="safety-note">
                  Authentic historical result. A newer co-signed correction exists on the ledger.
                </p>
              )}
              {result.differences.length > 0 && (
                <ul className="difference-list">
                  {result.differences.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
              <h3 className="verification-heading">Cryptographic verification</h3>
              <div className="verification-step">
                <span>01</span>
                <div>
                  <strong>Recompute the salted result hash</strong>
                  <code>SHA256({leafInput(receipt)})</code>
                  <code>{result.hash}</code>
                </div>
                {result.hash === receipt.leaf_hash && <Check size={18} />}
              </div>
              <div className="verification-step">
                <span>02</span>
                <div>
                  <strong>Walk the binary Merkle proof</strong>
                  {result.steps.length ? (
                    result.steps.map((s, i) => <code key={i}>{s}</code>)
                  ) : (
                    <code>Single leaf: the leaf hash is the Merkle root.</code>
                  )}
                </div>
              </div>
              <div className="verification-step">
                <span>03</span>
                <div>
                  <strong>Match the published root & audit the hash chain</strong>
                  <code>Computed: {result.root}</code>
                  <code>Stored: {result.expectedRoot}</code>
                </div>
                {result.authentic && <Check size={18} />}
              </div>
            </div>
          )}
        </section>
        <LedgerAside />
      </div>
    </>
  );
}
