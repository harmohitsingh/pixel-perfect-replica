import { useState } from "react";
import {
  Fingerprint,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  Check,
  LoaderCircle,
  Clock3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PageHeading, useLedger } from "./workspace";
import { requestCorrection, approveCorrection, audit, keyOf } from "@/lib/verimark/ledger";
export function AuditPanel() {
  const { ledger, mutate, busy, fresh } = useLedger();
  const [student, setStudent] = useState("");
  const [marks, setMarks] = useState("");
  const [reason, setReason] = useState("");
  const [name, setName] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const [findings, setFindings] = useState<string[] | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  async function scan() {
    setAuditing(true);
    setFindings(null);
    try {
      const current = await fresh();
      setFindings(await audit(current));
      setScanCount(current.records.length);
    } catch (e) {
      setFindings([e instanceof Error ? e.message : "Unable to audit malformed data."]);
    } finally {
      setAuditing(false);
    }
  }
  async function submit() {
    if (!marks.trim()) {
      toast.error("Enter new marks.");
      return;
    }
    const ok = await mutate(
      (l) => requestCorrection(l, student, Number(marks), reason, name),
      "Correction pending second approval. Original marks remain unchanged.",
    );
    if (ok) {
      setMarks("");
      setReason("");
      setName("");
    }
  }
  const pending = ledger.corrections.filter((c) => c.status === "PENDING_SECOND_APPROVAL");
  return (
    <>
      <PageHeading
        eyebrow="GOVERNANCE & INTEGRITY"
        title="Accountable changes. Visible history."
        description="Two named approvals for corrections. A full cryptographic audit for every record."
      />
      <div className="correction-layout">
        <section className="correction-form">
          <div className="section-title">
            <div>
              <h2>Request a correction</h2>
              <p>Original marks remain unchanged until co-signed.</p>
            </div>
            <UserCheck size={23} />
          </div>
          <label>
            Select student
            <select
              aria-label="Select student"
              value={student}
              onChange={(e) => setStudent(e.target.value)}
            >
              <option value="">Choose a published result</option>
              {ledger.records.map((r) => (
                <option key={keyOf(r)} value={keyOf(r)}>
                  {r.name} · {r.reg_no} · {r.subject_code} · {r.marks} marks
                </option>
              ))}
            </select>
          </label>
          <div className="form-row">
            <label>
              New Marks
              <input
                aria-label="New Marks"
                type="number"
                min="0"
                max="100"
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
                placeholder="0–100"
              />
            </label>
            <label>
              Approver 1 Name
              <input
                aria-label="Approver 1 Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
              />
            </label>
          </div>
          <label>
            Mandatory Reason
            <textarea
              aria-label="Mandatory Reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for the marks correction"
            />
          </label>
          <Button onClick={() => void submit()} disabled={busy || !ledger.records.length}>
            <Clock3 />
            Request Second Approval
          </Button>
        </section>
        <section className="audit-tool">
          <span className="audit-large-icon">
            <Fingerprint size={36} />
          </span>
          <h2>Database integrity audit</h2>
          <p>
            Check every stored result, Merkle proof, and previous-block link against the ledger.
          </p>
          <dl>
            <div>
              <dt>Results in scope</dt>
              <dd>{ledger.records.length}</dd>
            </div>
            <div>
              <dt>Blocks in scope</dt>
              <dd>{ledger.blocks.length}</dd>
            </div>
          </dl>
          <Button size="lg" onClick={() => void scan()} disabled={auditing}>
            {auditing ? <LoaderCircle className="spin" /> : <ShieldCheck />}Run Full Database
            Integrity Audit
          </Button>
          {findings && (
            <div
              className={`audit-findings ${findings.length ? "failure" : "passed"}`}
              role="status"
            >
              {findings.length ? (
                <>
                  <ShieldAlert size={24} />
                  <h3>Integrity violations detected</h3>
                  <ul>
                    {findings.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <ShieldCheck size={25} />
                  <h3>{scanCount ? "All records verified" : "Empty ledger verified"}</h3>
                  <p>{scanCount} results checked. No broken proofs or hash-chain links.</p>
                </>
              )}
            </div>
          )}
        </section>
      </div>
      <section className="approvals-section">
        <div className="section-title">
          <div>
            <h2>
              Pending second approval <span className="count-label">{pending.length}</span>
            </h2>
            <p>A distinct co-signer must approve each request.</p>
          </div>
        </div>
        {pending.length ? (
          pending.map((c) => (
            <article className="pending-correction" key={c.id}>
              <div>
                <span className="pending-pill">PENDING_SECOND_APPROVAL</span>
                <h3>{c.key.replace("|", " · ")}</h3>
                <p>
                  <strong>
                    {c.old_marks} → {c.new_marks} marks
                  </strong>{" "}
                  · Requested by {c.approver1}
                </p>
                <p>{c.reason}</p>
                <small>{new Date(c.created).toLocaleString("en-GB")}</small>
              </div>
              <div className="cosign">
                <label>
                  Approver 2 Name
                  <input
                    aria-label={`Approver 2 Name for ${c.key}`}
                    placeholder="Distinct second approver"
                    value={names[c.id] ?? ""}
                    onChange={(e) => setNames({ ...names, [c.id]: e.target.value })}
                  />
                </label>
                <Button
                  disabled={busy}
                  onClick={() =>
                    void mutate(
                      (l) => approveCorrection(l, c.id, names[c.id] ?? ""),
                      "Correction approved. A new hash-linked block has been created.",
                    )
                  }
                >
                  <UserCheck />
                  Co-Sign & Approve
                </Button>
              </div>
            </article>
          ))
        ) : (
          <p className="quiet-empty">
            <Check size={18} />
            No corrections awaiting approval.
          </p>
        )}
      </section>
      <section className="audit-trail">
        <div className="section-title">
          <div>
            <h2>Correction audit trail</h2>
            <p>The original result and both signatures are retained.</p>
          </div>
        </div>
        <div className="table-scroll">
          <table className="results-table">
            <thead>
              <tr>
                <th>RESULT</th>
                <th>CHANGE</th>
                <th>REASON</th>
                <th>APPROVER 1</th>
                <th>APPROVER 2</th>
                <th>STATUS / TIME</th>
              </tr>
            </thead>
            <tbody>
              {ledger.corrections
                .slice()
                .reverse()
                .map((c) => (
                  <tr key={c.id}>
                    <td className="mono">{c.key.replace("|", " / ")}</td>
                    <td>
                      {c.old_marks} → {c.new_marks}
                    </td>
                    <td>{c.reason}</td>
                    <td>{c.approver1}</td>
                    <td>{c.approver2 ?? "Awaiting co-sign"}</td>
                    <td>
                      <span className={c.status === "APPROVED" ? "success-text" : "pending-text"}>
                        {c.status === "APPROVED" ? "Approved" : "Pending"}
                      </span>
                      <small className="subject-name">
                        {new Date(c.approved ?? c.created).toLocaleString("en-GB")}
                      </small>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!ledger.corrections.length && (
            <p className="quiet-empty">No corrections have been requested.</p>
          )}
        </div>
      </section>
    </>
  );
}
