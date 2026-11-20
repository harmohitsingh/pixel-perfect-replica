import { useRef, useState } from "react";
import {
  Upload,
  FileUp,
  ArrowRight,
  Check,
  Users,
  FileSpreadsheet,
  X,
  LoaderCircle,
  LockKeyhole,
  Download,
  Fingerprint,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeading, Stats, LedgerAside, useLedger } from "./workspace";
import { samples, publish, parseCSV, type Student } from "@/lib/verimark/ledger";
export function PublishPanel() {
  const { ledger, busy, mutate } = useLedger();
  const [rows, setRows] = useState<Student[]>([]);
  const [source, setSource] = useState("");
  const [drag, setDrag] = useState(false);
  const [csvError, setCsvError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  async function importFile(f: File | undefined) {
    if (!f) return;
    try {
      const parsed = parseCSV(await f.text());
      setRows(parsed);
      setSource(f.name);
      setCsvError("");
      toast.success(`${parsed.length} valid student records imported.`);
    } catch (e) {
      const error = e instanceof Error ? e.message : "CSV import failed.";
      setCsvError(error);
      toast.error(error);
    }
  }
  function downloadTemplate() {
    const blob = new Blob(
      [
        "reg_no,name,subject_code,subject,marks,grade\n12204511,Aarav Sharma,CSE310,Programming in Java,92,O\n",
      ],
      { type: "text/csv" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "verimark-students-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <PageHeading
        eyebrow="EXAM CONTROLLER WORKSPACE"
        title="Publish results. Preserve trust."
        description="A permanent, verifiable record for every student's achievement."
      >
        <span className="workspace-role">
          <span className="role-icon">
            <Users size={16} />
          </span>
          Exam Controller
          <Chevron />
        </span>
      </PageHeading>
      <Stats />
      <div className="publish-layout">
        <section className="publish-main">
          <div className="section-title">
            <div>
              <h2>Publish a new batch</h2>
              <p>Prepare student results for the immutable ledger.</p>
            </div>
            <span className="step-chip">STEP 01 OF 02</span>
          </div>
          <div className="import-actions">
            <Button
              variant="outline"
              onClick={() => {
                setRows(samples.map((r) => ({ ...r })));
                setSource("LPU sample students");
                setCsvError("");
              }}
              disabled={busy}
            >
              <Users />
              Load 8 Sample LPU Students
            </Button>
            <span className="or-divider">or</span>
            <Button variant="outline" onClick={() => file.current?.click()} disabled={busy}>
              <FileUp />
              Upload CSV
            </Button>
          </div>
          <input
            ref={file}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-label="Upload student CSV"
            onChange={(e) => {
              void importFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <div
            className={`upload-zone ${drag ? "dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              void importFile(e.dataTransfer.files[0]);
            }}
          >
            <span className="upload-icon">
              <FileSpreadsheet size={24} />
            </span>
            <div>
              <strong>{source || "Drop your student results here"}</strong>
              <p>
                {rows.length
                  ? `${rows.length} records validated and ready to review`
                  : "CSV format · Registration, name, subject, marks & grade"}
              </p>
            </div>
            {rows.length ? (
              <span className="validated-icon">
                <Check size={18} />
              </span>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => file.current?.click()}>
                Browse files
                <ArrowRight />
              </Button>
            )}
          </div>
          <div className="template-line">
            <span>One row per student and subject.</span>
            <Button variant="link" size="sm" onClick={downloadTemplate}>
              <Download />
              Download CSV template
            </Button>
          </div>
          {csvError && (
            <p role="alert" className="error-banner">
              {csvError}
            </p>
          )}
          <div className="preview-heading">
            <h3>
              Result preview <span>{rows.length} records</span>
            </h3>
            {rows.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRows([]);
                  setSource("");
                }}
              >
                <X />
                Clear batch
              </Button>
            )}
          </div>
          <div className="table-scroll">
            <table className="results-table">
              <thead>
                <tr>
                  <th className="row-number">#</th>
                  <th>STUDENT</th>
                  <th>SUBJECT</th>
                  <th>MARKS</th>
                  <th>GRADE</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.reg_no}-${r.subject_code}`}>
                    <td className="row-number">{String(i + 1).padStart(2, "0")}</td>
                    <td>
                      <div className="student-cell">
                        <span className={`student-avatar avatar-${i % 4}`}>
                          {r.name
                            .split(" ")
                            .map((s) => s[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <div>
                          <strong>{r.name}</strong>
                          <small>{r.reg_no}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong className="subject-code">{r.subject_code}</strong>
                      <small className="subject-name">{r.subject}</small>
                    </td>
                    <td className="marks-value">
                      {r.marks}
                      <span> / 100</span>
                    </td>
                    <td>
                      <span className={`grade-pill ${r.grade === "O" ? "outstanding" : ""}`}>
                        {r.grade}
                      </span>
                    </td>
                    <td>
                      <span className="ready-label">
                        <span className="status-dot" />
                        Ready
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <div className="table-empty">
                <Users size={30} />
                <strong>No student results loaded</strong>
                <p>Load the LPU sample batch or import your CSV.</p>
              </div>
            )}
          </div>
          <div className="publish-footer">
            <span>
              <LockKeyhole size={16} />
              {rows.length
                ? `${rows.length} results will create one new block`
                : "Results are sealed only after publication"}
            </span>
            <Button
              size="lg"
              disabled={!rows.length || busy}
              onClick={() =>
                void mutate(
                  (l) => publish(l, rows),
                  `${rows.length} results published to the ledger.`,
                ).then((ok) => {
                  if (ok) {
                    setRows([]);
                    setSource("");
                  }
                })
              }
            >
              {busy ? <LoaderCircle className="spin" /> : <Upload />}Publish to Immutable Ledger
              <ArrowRight />
            </Button>
          </div>
          {ledger.blocks.length > 0 && (
            <div className="publication-note">
              <Check size={15} />
              {ledger.records.length} results are published. Marksheets are ready in Student
              Marksheets.
            </div>
          )}
        </section>
        <LedgerAside />
      </div>
      <div className="assurance-strip">
        <span>
          <Fingerprint size={19} />
          <strong>Unique fingerprints</strong>Salted SHA-256 for every result
        </span>
        <span>
          <Layers size={19} />
          <strong>Merkle-tree verified</strong>One root anchors the entire batch
        </span>
        <span>
          <LockKeyhole size={19} />
          <strong>History, never overwritten</strong>Every correction creates a new block
        </span>
      </div>
    </>
  );
}
function Chevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
