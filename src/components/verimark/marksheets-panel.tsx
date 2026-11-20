import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer, Copy, Search, ShieldCheck, ArrowUpRight, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Link } from "@tanstack/react-router";
import { PageHeading, EmptyState, useLedger } from "./workspace";
import { qrPayload, type Receipt } from "@/lib/verimark/ledger";
export function MarksheetsPanel() {
  const { ledger } = useLedger();
  const [query, setQuery] = useState("");
  const [printing, setPrinting] = useState<string | null>(null);
  const [selectedQR, setSelectedQR] = useState<Receipt | null>(null);
  const [downloading, setDownloading] = useState(false);
  const largeQR = useRef<SVGSVGElement>(null);
  function copyPayload(r: Receipt) {
    void navigator.clipboard
      .writeText(qrPayload(r))
      .then(() => toast.success("QR payload copied."))
      .catch(() => toast.error("Clipboard unavailable."));
  }
  async function downloadQR() {
    const svg = largeQR.current;
    if (!svg || !selectedQR || downloading) return;
    setDownloading(true);
    let imageURL: string | undefined;
    try {
      const clone = svg.cloneNode(true) as SVGSVGElement;
      const tokens = getComputedStyle(svg);
      for (const node of clone.querySelectorAll("[fill]")) {
        const fill = node.getAttribute("fill");
        if (fill === "var(--qr-ink)")
          node.setAttribute("fill", tokens.getPropertyValue("--qr-ink").trim());
        if (fill === "var(--qr-paper)")
          node.setAttribute("fill", tokens.getPropertyValue("--qr-paper").trim());
      }
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      imageURL = URL.createObjectURL(
        new Blob([new XMLSerializer().serializeToString(clone)], {
          type: "image/svg+xml;charset=utf-8",
        }),
      );
      const image = new Image();
      image.src = imageURL;
      await image.decode();
      const canvas = document.createElement("canvas");
      // Integer module sizing gives the exported PNG truly crisp module edges.
      const modules = svg.viewBox.baseVal.width;
      canvas.width = modules * 16;
      canvas.height = modules * 16;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("PNG export is not available in this browser.");
      context.imageSmoothingEnabled = false;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error("PNG export failed."))),
          "image/png",
        ),
      );
      const downloadURL = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadURL;
      link.download = `${selectedQR.reg_no}-qr.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(downloadURL), 1000);
      toast.success("QR PNG downloaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to download QR PNG.");
    } finally {
      if (imageURL) URL.revokeObjectURL(imageURL);
      setDownloading(false);
    }
  }
  const records = ledger.records.filter((r) =>
    `${r.name} ${r.reg_no} ${r.subject_code}`.toLowerCase().includes(query.toLowerCase()),
  );
  function print(r: Receipt) {
    setPrinting(`${r.reg_no}|${r.subject_code}`);
    setTimeout(() => {
      window.print();
      setPrinting(null);
    }, 100);
  }
  return (
    <>
      <PageHeading
        eyebrow="STUDENT RECORDS"
        title="Achievement, on the record."
        description="Verified marksheets with a cryptographic proof for every result."
      />
      {!ledger.records.length ? (
        <EmptyState
          title="Your marksheets will appear here"
          text="Publish your first batch to generate student marksheets and QR proofs."
        />
      ) : (
        <>
          <div className="list-toolbar">
            <span>{ledger.records.length} published results</span>
            <div className="search-field">
              <Search size={17} />
              <input
                aria-label="Search marksheets"
                placeholder="Search student or registration…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="marksheets-grid">
            {records.map((r) => {
              const root = ledger.blocks.find((b) => b.index === r.block_index)?.merkle_root ?? "";
              const key = `${r.reg_no}|${r.subject_code}`;
              return (
                <article
                  className={`marksheet ${printing === key ? "print-selected" : ""}`}
                  key={key}
                >
                  <header>
                    <span className="sheet-brand">
                      <ShieldCheck size={22} />
                      VeriMark
                    </span>
                    <span className="sheet-badge">VERIFIED RECORD</span>
                  </header>
                  <div className="sheet-university">LOVELY PROFESSIONAL UNIVERSITY</div>
                  <h2>Statement of Marks</h2>
                  <div className="sheet-identity">
                    <strong>{r.name}</strong>
                    <span>Registration No. {r.reg_no}</span>
                  </div>
                  <div className="sheet-result">
                    <div>
                      <small>{r.subject_code}</small>
                      <strong>{r.subject}</strong>
                    </div>
                    <div>
                      <strong>
                        {r.marks}
                        <small>/100</small>
                      </strong>
                      <span className="grade-pill">{r.grade}</span>
                    </div>
                  </div>
                  <div className="sheet-proof">
                    <div className="sheet-hashes">
                      <label>LEAF HASH</label>
                      <code>{r.leaf_hash}</code>
                      <label>MERKLE ROOT · BLOCK #{String(r.block_index).padStart(3, "0")}</label>
                      <code>{root}</code>
                    </div>
                    <div className="sheet-qr">
                      <Button
                        variant="ghost"
                        className="qr-enlarge-button"
                        aria-label={`Enlarge QR for ${r.name}, ${r.subject_code}`}
                        onClick={() => setSelectedQR(r)}
                      >
                        <QRCodeSVG
                          value={qrPayload(r)}
                          size={148}
                          level="L"
                          includeMargin={true}
                          marginSize={6}
                          fgColor="var(--qr-ink)"
                          bgColor="var(--qr-paper)"
                        />
                      </Button>
                      <small>Click to enlarge</small>
                    </div>
                  </div>
                  <div className="sheet-actions">
                    <Button variant="outline" size="sm" onClick={() => print(r)}>
                      <Printer />
                      Download / Print Marksheet
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => copyPayload(r)}>
                      <Copy />
                      Copy QR Payload
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
          {!records.length && <p className="no-results">No marksheets match your search.</p>}
          <Link to="/verify" className="text-link">
            Verify a marksheet
            <ArrowUpRight size={16} />
          </Link>
        </>
      )}
      <Dialog
        open={selectedQR !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedQR(null);
        }}
      >
        <DialogContent className="qr-dialog">
          <DialogTitle>Marksheet QR Code</DialogTitle>
          <DialogDescription>
            {selectedQR?.name} · Registration No. {selectedQR?.reg_no}
          </DialogDescription>
          {selectedQR && (
            <>
              <div className="qr-modal-code">
                <QRCodeSVG
                  ref={largeQR}
                  value={qrPayload(selectedQR)}
                  size={280}
                  level="L"
                  includeMargin={true}
                  marginSize={6}
                  fgColor="var(--qr-ink)"
                  bgColor="var(--qr-paper)"
                />
              </div>
              <div className="qr-modal-details">
                <strong>
                  {selectedQR.subject_code} · {selectedQR.subject}
                </strong>
                <span>
                  {selectedQR.marks} / 100 marks · Grade {selectedQR.grade}
                </span>
              </div>
              <div className="qr-modal-actions">
                <Button onClick={() => void downloadQR()} disabled={downloading}>
                  <Download />
                  {downloading ? "Downloading…" : "Download QR (PNG)"}
                </Button>
                <Button variant="outline" onClick={() => copyPayload(selectedQR)}>
                  <Copy />
                  Copy QR Payload
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
