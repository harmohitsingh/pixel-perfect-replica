import { describe, it, expect, vi } from "vitest";
import { webcrypto } from "node:crypto";
import {
  audit,
  approveCorrection,
  emptyLedger,
  keyOf,
  merkleTree,
  parseCSV,
  publish,
  requestCorrection,
  samples,
  sha256,
  verifyReceipt,
  walkProof,
  qrPayload,
  resolvePayload,
} from "./ledger";
vi.stubGlobal("crypto", webcrypto);
describe("VeriMark ledger rules", () => {
  it("issues a compact payload with exactly the five verification fields", async () => {
    const ledger = await publish(emptyLedger(), samples.slice(0, 1));
    const row = ledger.records[0];
    if (!row) throw new Error("Missing row");
    expect(JSON.parse(qrPayload(row))).toEqual({
      reg_no: "12204511",
      leaf_hash: row.leaf_hash,
      block_index: 0,
      marks: 92,
      grade: "O",
    });
    expect((await verifyReceipt(ledger, resolvePayload(qrPayload(row), ledger))).authentic).toBe(
      true,
    );
  });
  it("does not hide altered marks in a compact QR payload", async () => {
    const ledger = await publish(emptyLedger(), samples.slice(0, 1));
    const row = ledger.records[0];
    if (!row) throw new Error("Missing row");
    const payload = { ...JSON.parse(qrPayload(row)), marks: 99 };
    const result = await verifyReceipt(ledger, resolvePayload(JSON.stringify(payload), ledger));
    expect(result.authentic).toBe(false);
    expect(result.differences.join(" ")).toContain("marks: QR 99; cryptographic record 92");
  });
  it("resolves historical compact receipts after a correction and still accepts original full proofs", async () => {
    const original = await publish(emptyLedger(), samples.slice(0, 1));
    const row = original.records[0];
    if (!row) throw new Error("Missing row");
    const pending = requestCorrection(original, keyOf(row), 94, "Revaluation", "Admin One");
    const c = pending.corrections[0];
    if (!c) throw new Error("Missing request");
    const corrected = await approveCorrection(pending, c.id, "Admin Two");
    const result = await verifyReceipt(corrected, resolvePayload(qrPayload(row), corrected));
    expect(result.authentic).toBe(true);
    expect(result.historical).toBe(true);
    expect(
      (await verifyReceipt(corrected, resolvePayload(JSON.stringify(row), corrected))).authentic,
    ).toBe(true);
  });
  it("rejects an unknown compact fingerprint rather than substituting a student record", async () => {
    const ledger = await publish(emptyLedger(), samples.slice(0, 1));
    const row = ledger.records[0];
    if (!row) throw new Error("Missing row");
    expect(() =>
      resolvePayload(
        JSON.stringify({ ...JSON.parse(qrPayload(row)), leaf_hash: "a".repeat(64) }),
        ledger,
      ),
    ).toThrow("fingerprint");
  });
  it("loads eight realistic LPU students including registration 12204511", () => {
    expect(samples).toHaveLength(8);
    expect(samples[0]?.reg_no).toBe("12204511");
  });
  it("uses real SHA-256", async () => {
    expect(await sha256("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
  it("duplicates the final node for an odd binary Merkle level", async () => {
    const leaves = await Promise.all(["a", "b", "c"].map(sha256));
    const [a, b, c] = leaves;
    if (!a || !b || !c) throw new Error("Missing test leaves");
    const tree = await merkleTree(leaves);
    expect(tree.root).toBe(await sha256((await sha256(a + b)) + (await sha256(c + c))));
    for (let i = 0; i < leaves.length; i++) {
      const leaf = leaves[i];
      if (!leaf) throw new Error("Missing leaf");
      expect((await walkProof(leaf, tree.proofs[i] ?? [])).hash).toBe(tree.root);
    }
  });
  it("hashes exact salted fields and links each batch to the previous block", async () => {
    const l = await publish(emptyLedger(), samples.slice(0, 1));
    const row = l.records[0];
    if (!row) throw new Error("Missing row");
    expect(row.leaf_hash).toBe(
      await sha256(`${row.reg_no}|${row.subject_code}|${row.marks}|${row.grade}|${row.salt}`),
    );
    const next = await publish(l, samples.slice(1, 2));
    const block = next.blocks[1];
    if (!block) throw new Error("Missing block");
    expect(block.prev_hash).toBe(l.blocks[0]?.block_hash);
    expect(block.block_hash).toBe(await sha256(`${block.prev_hash}|${block.merkle_root}`));
  });
  it("keeps original marks unchanged pending a second approval", async () => {
    const l = await publish(emptyLedger(), samples.slice(0, 1));
    const r = l.records[0];
    if (!r) throw new Error("Missing row");
    const next = requestCorrection(l, keyOf(r), 94, "Revaluation", "Admin One");
    expect(next.records[0]?.marks).toBe(92);
    expect(next.corrections[0]?.status).toBe("PENDING_SECOND_APPROVAL");
    expect(next.blocks).toHaveLength(1);
  });
  it("requires a mandatory correction reason", async () => {
    const l = await publish(emptyLedger(), samples.slice(0, 1));
    expect(() => requestCorrection(l, "12204511|CSE310", 94, "", "Admin One")).toThrow("mandatory");
  });
  it("rejects the same second approver with case and whitespace differences", async () => {
    const l = requestCorrection(
      await publish(emptyLedger(), samples.slice(0, 1)),
      "12204511|CSE310",
      94,
      "Revaluation",
      "Admin One",
    );
    const c = l.corrections[0];
    if (!c) throw new Error("Missing request");
    await expect(approveCorrection(l, c.id, " ADMIN   ONE ")).rejects.toThrow("distinct");
  });
  it("co-signing changes marks, appends a block, and preserves both signatures and the original receipt", async () => {
    const original = await publish(emptyLedger(), samples.slice(0, 1));
    const r = original.records[0];
    if (!r) throw new Error("Missing row");
    const pending = requestCorrection(original, keyOf(r), 94, "Revaluation", "Admin One");
    const c = pending.corrections[0];
    if (!c) throw new Error("Missing request");
    const next = await approveCorrection(pending, c.id, "Admin Two");
    expect(next.records[0]?.marks).toBe(94);
    expect(next.blocks).toHaveLength(2);
    expect(next.blocks[0]?.rows[0]?.marks).toBe(92);
    expect(next.corrections[0]).toMatchObject({
      reason: "Revaluation",
      approver1: "Admin One",
      approver2: "Admin Two",
      status: "APPROVED",
    });
    expect((await verifyReceipt(next, r)).authentic).toBe(true);
    expect(await audit(next)).toEqual([]);
  });
  it("detects database marks changed outside the proof", async () => {
    const l = await publish(emptyLedger(), samples.slice(0, 1));
    const tampered = structuredClone(l);
    const r = tampered.records[0];
    if (!r) throw new Error("Missing row");
    r.marks = 99;
    expect((await audit(tampered)).join(" ")).toContain("database 99; proof 92");
    expect((await verifyReceipt(tampered, r)).authentic).toBe(false);
  });
  it("detects a changed previous hash", async () => {
    const l = await publish(emptyLedger(), samples);
    const block = l.blocks[0];
    if (!block) throw new Error("Missing block");
    block.prev_hash = "1".repeat(64);
    expect((await audit(l)).join(" ")).toContain("previous-hash");
  });
  it("accepts hidden CSV data including quoted student names", () => {
    const rows = parseCSV(
      'reg_no,name,subject_code,subject,marks,grade\n19990001,"Singh, Riya",MAT101,Mathematics,85,A+',
    );
    expect(rows[0]).toMatchObject({ name: "Singh, Riya", marks: 85, reg_no: "19990001" });
  });
  it("rejects out-of-range marks and duplicate registration/subject combinations", () => {
    expect(() =>
      parseCSV("reg_no,name,subject_code,marks,grade\n12204511,Aarav,CSE310,101,O"),
    ).toThrow("0 and 100");
    expect(() =>
      parseCSV(
        "reg_no,name,subject_code,marks,grade\n12204511,Aarav,CSE310,92,O\n12204511,Aarav,CSE310,92,O",
      ),
    ).toThrow("Duplicate");
  });
});
