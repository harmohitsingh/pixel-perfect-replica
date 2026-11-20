import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  ShieldCheck,
  Database,
  ChevronDown,
  Upload,
  QrCode,
  ScanLine,
  Fingerprint,
  ArrowUpRight,
  CircleCheck,
  Layers,
  Users,
  Clock3,
  LockKeyhole,
  X,
  LoaderCircle,
  Link2,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Toaster, toast } from "sonner";
import { audit, emptyLedger, shortHash, type Ledger } from "@/lib/verimark/ledger";
import {
  readLocal,
  readSettings,
  saveLocal,
  saveSettings,
  readRemote,
  saveRemote,
  setupSQL,
  type Settings,
} from "@/lib/verimark/storage";
type Workspace = {
  ledger: Ledger;
  busy: boolean;
  issues: string[];
  mode: string;
  mutate: (fn: (l: Ledger) => Ledger | Promise<Ledger>, success: string) => Promise<boolean>;
  fresh: () => Promise<Ledger>;
};
const Context = createContext<Workspace | null>(null);
export function useLedger() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing ledger workspace.");
  return value;
}
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [ledger, setLedger] = useState<Ledger>(emptyLedger);
  const [settings, setSettings] = useState<Settings>({ url: "", key: "" });
  const [mode, setMode] = useState("Local storage");
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const [setup, setSetup] = useState(false);
  const [draft, setDraft] = useState<Settings>({ url: "", key: "" });
  const [showSQL, setShowSQL] = useState(false);
  const revision = useRef(-1);
  const lock = useRef(false);
  const latest = useRef(ledger);
  useEffect(() => {
    async function load() {
      try {
        const s = readSettings();
        const local = readLocal();
        setSettings(s);
        setDraft(s);
        latest.current = local;
        setLedger(local);
        if (s.url && s.key) {
          try {
            const remote = await readRemote(s);
            revision.current = remote.revision;
            latest.current = remote.ledger;
            setLedger(remote.ledger);
            saveLocal(remote.ledger);
            setMode("Database connected");
          } catch (e) {
            setMode("Offline · local copy");
            toast.error(e instanceof Error ? e.message : "Connection unavailable.");
          }
        }
      } catch {
        toast.error("Saved data could not be read. Check browser storage before publishing.");
        setIssues(["Browser storage is unavailable or contains invalid ledger data."]);
      }
    }
    void load();
  }, []);
  useEffect(() => {
    let active = true;
    void audit(ledger)
      .then((result) => {
        if (active) setIssues(result);
      })
      .catch(() => {
        if (active) setIssues(["Ledger contains malformed cryptographic data."]);
      });
    return () => {
      active = false;
    };
  }, [ledger]);
  async function fresh() {
    let result = readLocal();
    if (settings.url && settings.key && mode === "Database connected") {
      const remote = await readRemote(settings);
      result = remote.ledger;
      revision.current = remote.revision;
      saveLocal(result);
    }
    latest.current = result;
    setLedger(result);
    return result;
  }
  async function mutate(fn: (l: Ledger) => Ledger | Promise<Ledger>, success: string) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    try {
      const base = await fresh();
      const problems = await audit(base);
      if (problems.length)
        throw new Error(
          "Integrity check failed. Resolve the tampered records before changing the ledger.",
        );
      const next = await fn(base);
      if (settings.url && settings.key) {
        if (mode !== "Database connected")
          throw new Error(
            "Database unavailable. Reconnect or explicitly choose local mode in Database Setup.",
          );
        revision.current = await saveRemote(settings, next, revision.current);
      }
      saveLocal(next);
      latest.current = next;
      setLedger(next);
      toast.success(success);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Operation failed.");
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function connect() {
    setBusy(true);
    try {
      const s = { url: draft.url.trim(), key: draft.key.trim() };
      if (Boolean(s.url) !== Boolean(s.key))
        throw new Error("Enter both the database URL and public anon key, or leave both empty.");
      if (s.url) {
        if (!s.url.startsWith("https://")) throw new Error("Use an HTTPS database URL.");
        if (s.key.startsWith("sb_secret_"))
          throw new Error("Never enter a secret or service-role key. Use the public anon key.");
        const remote = await readRemote(s);
        revision.current = remote.revision;
        setLedger(remote.ledger);
        latest.current = remote.ledger;
        saveLocal(remote.ledger);
        setMode("Database connected");
      } else {
        setMode("Local storage");
        const local = readLocal();
        latest.current = local;
        setLedger(local);
      }
      saveSettings(s);
      setSettings(s);
      setSetup(false);
      toast.success(s.url ? "Database connected." : "Local mode enabled.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Connection failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Context.Provider value={{ ledger, busy, issues, mode, mutate, fresh }}>
      <Shell onSetup={() => setSetup(true)}>{children}</Shell>
      <Toaster richColors position="bottom-right" />
      <Dialog open={setup} onOpenChange={setSetup}>
        <DialogContent className="setup-dialog">
          <DialogTitle>Database Setup</DialogTitle>
          <DialogDescription>
            Optional demo database connection. Empty settings keep this ledger on this browser only.
          </DialogDescription>
          <label>
            Supabase URL
            <input
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              placeholder="https://your-project.supabase.co"
            />
          </label>
          <label>
            Public Supabase Anon Key
            <input
              type="password"
              value={draft.key}
              onChange={(e) => setDraft({ ...draft, key: e.target.value })}
              placeholder="Public anon / publishable key only"
            />
          </label>
          <p className="safety-note">
            Use synthetic data only. Named co-signers are not authenticated identities, and
            browser/database owners can rewrite all hashes. Production use needs authenticated roles
            and an independently anchored root.
          </p>
          <Button variant="outline" onClick={() => setShowSQL(!showSQL)}>
            <Database /> {showSQL ? "Hide" : "Show"} demo table SQL
          </Button>
          {showSQL && (
            <>
              <pre className="sql-code">{setupSQL}</pre>
              <Button
                variant="ghost"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(setupSQL)
                    .then(() => toast.success("Setup SQL copied."))
                    .catch(() => toast.error("Clipboard unavailable."))
                }
              >
                Copy SQL
              </Button>
            </>
          )}
          <Button onClick={() => void connect()} disabled={busy}>
            {busy ? <LoaderCircle className="spin" /> : <Link2 />} Save & test connection
          </Button>
        </DialogContent>
      </Dialog>
    </Context.Provider>
  );
}
const navigation = [
  { to: "/" as const, label: "Publish Results", icon: Upload },
  { to: "/marksheets" as const, label: "Student Marksheets", icon: QrCode },
  { to: "/verify" as const, label: "Verify Marksheet", icon: ScanLine },
  { to: "/audit" as const, label: "Corrections & Audit", icon: Fingerprint },
];
function Shell({ children, onSetup }: { children: ReactNode; onSetup: () => void }) {
  const { ledger, issues, mode } = useLedger();
  const path = useLocation().pathname;
  return (
    <div className="workspace">
      <header className="topbar">
        <div className="brand">
          <span className="brand-symbol">
            <ShieldCheck size={25} />
          </span>
          <span>
            VeriMark <span className="brand-light">Ledger</span>
            <small>ACADEMIC INTEGRITY, VERIFIED.</small>
          </span>
        </div>
        <div className="topbar-actions">
          <span className={`integrity-badge ${issues.length ? "is-danger" : ""}`}>
            <span className="status-dot" />
            {issues.length ? "Integrity issue detected" : "System integrity intact"}
          </span>
          <Button variant="outline" onClick={onSetup}>
            <Database />
            <span>Database Setup</span>
          </Button>
          <span className="profile-avatar" title="Exam controller">
            EC
          </span>
        </div>
      </header>
      <nav className="nav-tabs" aria-label="Ledger sections">
        {navigation.map((n) => (
          <Link key={n.to} to={n.to} className={`nav-tab ${path === n.to ? "active" : ""}`}>
            <n.icon size={18} />
            {n.label}
            {n.to === "/audit" &&
              ledger.corrections.some((c) => c.status === "PENDING_SECOND_APPROVAL") && (
                <span className="nav-count">
                  {ledger.corrections.filter((c) => c.status === "PENDING_SECOND_APPROVAL").length}
                </span>
              )}
          </Link>
        ))}
        <span className="nav-context">
          <span className="status-dot" />
          {mode}
        </span>
      </nav>
      <main className="main-content">{children}</main>
      <footer className="footer">
        <span>
          <ShieldCheck size={14} /> VeriMark · Tamper-evident academic records
        </span>
        <span>
          SHA-256 <i /> Merkle proofs <i /> Hash-linked ledger
        </span>
      </footer>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
export function Stats() {
  const { ledger } = useLedger();
  const last = ledger.blocks.at(-1);
  return (
    <div className="stats-grid">
      {[
        {
          icon: Users,
          label: "Published results",
          value: ledger.records.length.toString().padStart(2, "0"),
          sub: "Student records on the ledger",
        },
        {
          icon: Layers,
          label: "Ledger blocks",
          value: ledger.blocks.length.toString().padStart(2, "0"),
          sub: "Cryptographically linked batches",
        },
        {
          icon: ShieldCheck,
          label: "Hash algorithm",
          value: "SHA-256",
          sub: "256-bit cryptographic fingerprint",
        },
        {
          icon: Clock3,
          label: "Last published",
          value: last
            ? new Date(last.timestamp).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Not yet",
          sub: last
            ? new Date(last.timestamp).toLocaleDateString("en-GB")
            : "Your first block starts here",
        },
      ].map((s) => (
        <div className="stat" key={s.label}>
          <div className="stat-label">
            {s.label}
            <s.icon size={17} />
          </div>
          <div className="stat-value">{s.value}</div>
          <div className="stat-sub">{s.sub}</div>
        </div>
      ))}
    </div>
  );
}
export function LedgerAside() {
  const { ledger, issues } = useLedger();
  const last = ledger.blocks.at(-1);
  return (
    <aside className="ledger-aside">
      <div className="aside-heading">
        <span>
          <Layers size={18} />
          Ledger overview
        </span>
        <span className="live-label">
          <span className="status-dot" /> LIVE
        </span>
      </div>
      <div className="tree-visual" aria-label="Binary Merkle tree visualization">
        <div className="tree-root">
          <ShieldCheck size={16} /> MERKLE ROOT
        </div>
        <div className="tree-connect root-connect" />
        <div className="tree-pair">
          <span>HASH 01</span>
          <span>HASH 02</span>
        </div>
        <div className="tree-connect leaf-connect" />
        <div className="tree-leaves">
          {[1, 2, 3, 4].map((n) => (
            <span key={n}>
              <Fingerprint size={17} />
            </span>
          ))}
        </div>
        <p>Every result. One verifiable root.</p>
      </div>
      <dl className="ledger-details">
        <div>
          <dt>Latest block</dt>
          <dd>{last ? `#${String(last.index).padStart(3, "0")}` : "Awaiting publication"}</dd>
        </div>
        <div>
          <dt>Chain status</dt>
          <dd className={issues.length ? "error-text" : "success-text"}>
            {issues.length ? "Compromised" : "Intact"}
            <CircleCheck size={13} />
          </dd>
        </div>
        <div>
          <dt>Merkle root</dt>
          <dd className="mono">{shortHash(last?.merkle_root ?? "")}</dd>
        </div>
        <div>
          <dt>Previous hash</dt>
          <dd className="mono">{shortHash(last?.prev_hash ?? "")}</dd>
        </div>
      </dl>
      <div className="aside-note">
        <LockKeyhole size={17} />
        <span>
          Published blocks are append-only.
          <br />
          Corrections preserve the original record.
        </span>
      </div>
      <div className="recent-blocks">
        <h3>
          Recent activity <Activity size={15} />
        </h3>
        {ledger.blocks.length ? (
          ledger.blocks
            .slice(-3)
            .reverse()
            .map((b) => (
              <div className="activity-item" key={b.index}>
                <span className="activity-icon">
                  <Layers size={14} />
                </span>
                <div>
                  <strong>
                    {b.kind === "correction" ? "Correction co-signed" : "Results published"}
                  </strong>
                  <small>
                    Block #{String(b.index).padStart(3, "0")} · {b.rows.length} result
                    {b.rows.length !== 1 ? "s" : ""}
                  </small>
                </div>
                <CircleCheck size={14} />
              </div>
            ))
        ) : (
          <div className="activity-empty">
            No blocks published yet.
            <br />
            The ledger is ready for your first batch.
          </div>
        )}
      </div>
      <Link to="/audit" className="aside-link">
        View integrity audit
        <ArrowUpRight size={16} />
      </Link>
    </aside>
  );
}
export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <QrCode size={38} />
      <h2>{title}</h2>
      <p>{text}</p>
      <Button asChild>
        <Link to="/">
          Publish results
          <ArrowUpRight />
        </Link>
      </Button>
    </div>
  );
}
