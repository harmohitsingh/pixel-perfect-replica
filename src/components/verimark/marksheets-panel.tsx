import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer, Copy, Search, ShieldCheck, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { PageHeading, EmptyState, useLedger } from "./workspace";
import { qrPayload, type Receipt } from "@/lib/verimark/ledger";
export function MarksheetsPanel() {
  const { ledger } = useLedger();
  const [query, setQuery] = useState("");
  const [printing, setPrinting] = useState<string | null>(null);
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
                      <QRCodeSVG value={qrPayload(r)} size={148} level="L" marginSize={2} />
                      <small>Cryptographic result proof</small>
                    </div>
                  </div>
                  <div className="sheet-actions">
                    <Button variant="outline" size="sm" onClick={() => print(r)}>
                      <Printer />
                      Download / Print Marksheet
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(qrPayload(r))
                          .then(() => toast.success("QR payload copied."))
                          .catch(() => toast.error("Clipboard unavailable."))
                      }
                    >
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
    </>
  );
}
