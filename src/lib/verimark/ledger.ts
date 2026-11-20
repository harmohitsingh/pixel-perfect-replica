import Papa from "papaparse";
export type Student = {
  reg_no: string;
  name: string;
  subject_code: string;
  subject: string;
  marks: number;
  grade: string;
};
export type Proof = { hash: string; position: "left" | "right" };
export type Receipt = Student & {
  salt: string;
  leaf_hash: string;
  merkle_proof: Proof[];
  block_index: number;
};
export type Block = {
  index: number;
  timestamp: string;
  prev_hash: string;
  merkle_root: string;
  block_hash: string;
  rows: Receipt[];
  kind: "publication" | "correction";
};
export type Correction = {
  id: string;
  key: string;
  old_marks: number;
  new_marks: number;
  reason: string;
  approver1: string;
  approver2?: string;
  status: "PENDING_SECOND_APPROVAL" | "APPROVED";
  created: string;
  approved?: string;
};
export type Ledger = { blocks: Block[]; records: Receipt[]; corrections: Correction[] };
export const emptyLedger = (): Ledger => ({ blocks: [], records: [], corrections: [] });
export const keyOf = (r: Pick<Student, "reg_no" | "subject_code">) =>
  `${r.reg_no}|${r.subject_code}`;
export const shortHash = (s: string) => (s ? `${s.slice(0, 8)}…${s.slice(-6)}` : "—");
export const gradeFor = (marks: number) =>
  marks >= 90
    ? "O"
    : marks >= 80
      ? "A+"
      : marks >= 70
        ? "A"
        : marks >= 60
          ? "B+"
          : marks >= 50
            ? "B"
            : marks >= 40
              ? "C"
              : "F";
export const samples: Student[] = [
  {
    reg_no: "12204511",
    name: "Aarav Sharma",
    subject_code: "CSE310",
    subject: "Programming in Java",
    marks: 92,
    grade: "O",
  },
  {
    reg_no: "12204512",
    name: "Ananya Gupta",
    subject_code: "CSE310",
    subject: "Programming in Java",
    marks: 88,
    grade: "A+",
  },
  {
    reg_no: "12204513",
    name: "Rohan Mehta",
    subject_code: "CSE310",
    subject: "Programming in Java",
    marks: 76,
    grade: "A",
  },
  {
    reg_no: "12204514",
    name: "Priya Singh",
    subject_code: "CSE310",
    subject: "Programming in Java",
    marks: 95,
    grade: "O",
  },
  {
    reg_no: "12204515",
    name: "Ishaan Verma",
    subject_code: "CSE310",
    subject: "Programming in Java",
    marks: 67,
    grade: "B+",
  },
  {
    reg_no: "12204516",
    name: "Diya Patel",
    subject_code: "CSE310",
    subject: "Programming in Java",
    marks: 84,
    grade: "A+",
  },
  {
    reg_no: "12204517",
    name: "Arjun Kumar",
    subject_code: "CSE310",
    subject: "Programming in Java",
    marks: 73,
    grade: "A",
  },
  {
    reg_no: "12204518",
    name: "Meera Joshi",
    subject_code: "CSE310",
    subject: "Programming in Java",
    marks: 91,
    grade: "O",
  },
];
export async function sha256(input: string) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
export const leafInput = (
  r: Pick<Receipt, "reg_no" | "subject_code" | "marks" | "grade" | "salt">,
) => `${r.reg_no}|${r.subject_code}|${r.marks}|${r.grade}|${r.salt}`;
export async function merkleTree(leaves: string[]) {
  if (!leaves.length) throw new Error("Add at least one student.");
  const levels = [leaves];
  let level = leaves;
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] ?? left;
      if (!left || !right) throw new Error("Invalid Merkle node.");
      next.push(await sha256(left + right));
    }
    levels.push(next);
    level = next;
  }
  const root = level[0];
  if (!root) throw new Error("Missing Merkle root.");
  const proofs = leaves.map((_, leafIndex) => {
    const proof: Proof[] = [];
    let index = leafIndex;
    for (const nodes of levels.slice(0, -1)) {
      const right = index % 2 === 0;
      const hash = nodes[right ? index + 1 : index - 1] ?? nodes[index];
      if (!hash) throw new Error("Missing proof sibling.");
      proof.push({ hash, position: right ? "right" : "left" });
      index = Math.floor(index / 2);
    }
    return proof;
  });
  return { root, proofs };
}
export async function walkProof(leaf: string, proof: Proof[]) {
  let hash = leaf;
  const steps: string[] = [];
  for (const p of proof) {
    if (!/^[a-f0-9]{64}$/.test(p.hash) || !["left", "right"].includes(p.position))
      throw new Error("Invalid Merkle proof.");
    const expression = p.position === "left" ? p.hash + hash : hash + p.hash;
    hash = await sha256(expression);
    steps.push(
      `SHA256(${p.position === "left" ? "sibling | current" : "current | sibling"}) = ${hash}`,
    );
  }
  return { hash, steps };
}
export function validateStudents(rows: Student[]) {
  if (!rows.length) throw new Error("No student rows found.");
  const keys = new Set<string>();
  rows.forEach((r, i) => {
    if (
      !r.reg_no?.trim() ||
      !r.name?.trim() ||
      !r.subject_code?.trim() ||
      !r.grade?.trim() ||
      /\|/.test(r.reg_no + r.subject_code + r.grade)
    )
      throw new Error(
        `Row ${i + 1}: registration number, name, subject code, and grade are required (no | characters).`,
      );
    if (!Number.isFinite(r.marks) || r.marks < 0 || r.marks > 100)
      throw new Error(`Row ${i + 1}: marks must be between 0 and 100.`);
    const key = keyOf(r);
    if (keys.has(key)) throw new Error(`Duplicate registration/subject: ${key}.`);
    keys.add(key);
  });
}
export function parseCSV(text: string): Student[] {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) =>
      h
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_"),
  });
  if (parsed.errors.length) throw new Error(parsed.errors[0]?.message ?? "Invalid CSV.");
  const rows = parsed.data.map((r) => ({
    reg_no: (r["reg_no"] ?? r["registration_number"] ?? "").trim(),
    name: (r["name"] ?? r["student_name"] ?? "").trim(),
    subject_code: (r["subject_code"] ?? "").trim(),
    subject: (r["subject"] ?? r["subject_code"] ?? "").trim(),
    marks: r["marks"]?.trim() ? Number(r["marks"]) : NaN,
    grade: (r["grade"] ?? "").trim(),
  }));
  validateStudents(rows);
  return rows;
}
export async function publish(
  ledger: Ledger,
  students: Student[],
  kind: Block["kind"] = "publication",
): Promise<Ledger> {
  validateStudents(students);
  if (
    kind === "publication" &&
    students.some((s) => ledger.records.some((r) => keyOf(r) === keyOf(s)))
  )
    throw new Error(
      "A result for this registration and subject already exists. Use a two-signature correction.",
    );
  const index = ledger.blocks.length;
  const salted = await Promise.all(
    students.map(async (s) => {
      const salt = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      return { ...s, salt, leaf_hash: await sha256(leafInput({ ...s, salt })) };
    }),
  );
  const tree = await merkleTree(salted.map((r) => r.leaf_hash));
  const rows: Receipt[] = salted.map((r, i) => ({
    ...r,
    merkle_proof: tree.proofs[i] ?? [],
    block_index: index,
  }));
  const prev_hash = ledger.blocks.at(-1)?.block_hash ?? "0".repeat(64);
  const block: Block = {
    index,
    timestamp: new Date().toISOString(),
    prev_hash,
    merkle_root: tree.root,
    block_hash: await sha256(`${prev_hash}|${tree.root}`),
    rows,
    kind,
  };
  const keys = new Set(rows.map(keyOf));
  return {
    ...ledger,
    blocks: [...ledger.blocks, block],
    records: [
      ...ledger.records.filter((r) => !keys.has(keyOf(r))),
      ...rows.map((r) => ({ ...r, merkle_proof: r.merkle_proof.map((p) => ({ ...p })) })),
    ],
  };
}
export async function audit(ledger: Ledger): Promise<string[]> {
  const issues: string[] = [];
  let previous = "0".repeat(64);
  for (const [index, b] of ledger.blocks.entries()) {
    if (b.index !== index || b.prev_hash !== previous)
      issues.push(`Block ${index}: broken previous-hash link or index.`);
    if ((await sha256(`${b.prev_hash}|${b.merkle_root}`)) !== b.block_hash)
      issues.push(`Block ${index}: block hash mismatch.`);
    if (!b.rows.length) {
      issues.push(`Block ${index}: missing rows.`);
      previous = b.block_hash;
      continue;
    }
    const hashes = await Promise.all(b.rows.map((r) => sha256(leafInput(r))));
    if ((await merkleTree(hashes)).root !== b.merkle_root)
      issues.push(`Block ${index}: stored marks do not match its Merkle root.`);
    for (const r of b.rows) {
      if (
        (await sha256(leafInput(r))) !== r.leaf_hash ||
        (await walkProof(r.leaf_hash, r.merkle_proof)).hash !== b.merkle_root ||
        r.block_index !== index
      )
        issues.push(`${r.reg_no} / ${r.subject_code}: invalid archived proof.`);
    }
    previous = b.block_hash;
  }
  const latest = new Map<string, Receipt>();
  for (const b of ledger.blocks) for (const r of b.rows) latest.set(keyOf(r), r);
  const seen = new Set<string>();
  for (const r of ledger.records) {
    const key = keyOf(r);
    const archived = latest.get(key);
    if (seen.has(key)) issues.push(`${key}: duplicate database row.`);
    seen.add(key);
    if (!archived) {
      issues.push(`${key}: unanchored database row.`);
      continue;
    }
    for (const field of [
      "marks",
      "grade",
      "salt",
      "leaf_hash",
      "block_index",
      "name",
      "subject",
      "merkle_proof",
    ] as const) {
      if (JSON.stringify(r[field]) !== JSON.stringify(archived[field]))
        issues.push(
          `${r.reg_no} / ${r.subject_code}: ${field} differs — database ${JSON.stringify(r[field])}; proof ${JSON.stringify(archived[field])}.`,
        );
    }
  }
  for (const [key] of latest) if (!seen.has(key)) issues.push(`${key}: database row deleted.`);
  return issues;
}
export function requestCorrection(
  ledger: Ledger,
  key: string,
  marks: number,
  reason: string,
  name: string,
): Ledger {
  const r = ledger.records.find((r) => keyOf(r) === key);
  if (!r) throw new Error("Select a published student.");
  if (!Number.isFinite(marks) || marks < 0 || marks > 100)
    throw new Error("New marks must be between 0 and 100.");
  if (marks === r.marks) throw new Error("New marks must differ from the current marks.");
  if (!reason.trim() || !name.trim())
    throw new Error("A reason and first approver name are mandatory.");
  if (ledger.corrections.some((c) => c.key === key && c.status === "PENDING_SECOND_APPROVAL"))
    throw new Error("This student already has a pending correction.");
  return {
    ...ledger,
    corrections: [
      ...ledger.corrections,
      {
        id: globalThis.crypto.randomUUID(),
        key,
        old_marks: r.marks,
        new_marks: marks,
        reason: reason.trim(),
        approver1: name.trim(),
        status: "PENDING_SECOND_APPROVAL",
        created: new Date().toISOString(),
      },
    ],
  };
}
export async function approveCorrection(ledger: Ledger, id: string, name: string): Promise<Ledger> {
  const c = ledger.corrections.find((c) => c.id === id);
  if (!c || c.status !== "PENDING_SECOND_APPROVAL") throw new Error("No pending correction found.");
  if (
    !name.trim() ||
    name.trim().toLowerCase().replace(/\s+/g, " ") ===
      c.approver1.toLowerCase().replace(/\s+/g, " ")
  )
    throw new Error("Approver 2 must be a distinct person.");
  const row = ledger.records.find((r) => keyOf(r) === c.key);
  if (!row || row.marks !== c.old_marks)
    throw new Error("The original record changed. Audit before approving.");
  const next = await publish(
    ledger,
    [{ ...row, marks: c.new_marks, grade: gradeFor(c.new_marks) }],
    "correction",
  );
  return {
    ...next,
    corrections: next.corrections.map((item) =>
      item.id === id
        ? {
            ...item,
            approver2: name.trim(),
            status: "APPROVED",
            approved: new Date().toISOString(),
          }
        : item,
    ),
  };
}
export function parsePayload(text: string): Receipt {
  const r = JSON.parse(text) as Receipt;
  if (
    !r ||
    typeof r.reg_no !== "string" ||
    typeof r.subject_code !== "string" ||
    typeof r.marks !== "number" ||
    !Number.isFinite(r.marks) ||
    r.marks < 0 ||
    r.marks > 100 ||
    typeof r.grade !== "string" ||
    typeof r.salt !== "string" ||
    !/^[a-f0-9]{64}$/.test(r.leaf_hash) ||
    !Number.isInteger(r.block_index) ||
    r.block_index < 0 ||
    !Array.isArray(r.merkle_proof)
  )
    throw new Error("Invalid QR payload. Paste the complete JSON from a marksheet.");
  return r;
}
export const qrPayload = (r: Receipt) =>
  JSON.stringify({
    reg_no: r.reg_no,
    subject_code: r.subject_code,
    marks: r.marks,
    grade: r.grade,
    salt: r.salt,
    leaf_hash: r.leaf_hash,
    merkle_proof: r.merkle_proof,
    block_index: r.block_index,
  });
export async function verifyReceipt(ledger: Ledger, r: Receipt) {
  const block = ledger.blocks.find((b) => b.index === r.block_index);
  if (!block) throw new Error("The referenced block is not available in this ledger.");
  const hash = await sha256(leafInput(r));
  const walked = await walkProof(hash, r.merkle_proof);
  const archived = block.rows.find((a) => keyOf(a) === keyOf(r));
  const current = ledger.records.find((a) => keyOf(a) === keyOf(r));
  const differences: string[] = [];
  if (!archived) differences.push("No matching result exists in the referenced block.");
  if (hash !== r.leaf_hash)
    differences.push(`QR leaf hash differs: computed ${hash}; supplied ${r.leaf_hash}.`);
  if (walked.hash !== block.merkle_root)
    differences.push(`Merkle root differs: computed ${walked.hash}; stored ${block.merkle_root}.`);
  if (archived)
    for (const field of ["marks", "grade", "salt"] as const)
      if (r[field] !== archived[field])
        differences.push(`${field}: QR ${r[field]}; cryptographic record ${archived[field]}.`);
  differences.push(...(await audit(ledger)));
  return {
    authentic: differences.length === 0,
    differences,
    hash,
    root: walked.hash,
    expectedRoot: block.merkle_root,
    steps: walked.steps,
    historical: current?.block_index !== r.block_index,
  };
}
