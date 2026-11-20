# VeriMark Ledger — Tamper-Proof Exam Result Ledger (H8)

VeriMark Ledger verifies academic exam records using SHA-256 hashing, Merkle trees, hash-chained blocks, printable QR marksheets, and a two-signature correction audit trail.

## Key Features
- **Publish Batch:** Computes per-record SHA-256 leaf hashes, builds a Merkle tree root, and appends a block to the hash chain.
- **Student Marksheets & QR Codes:** Generates marksheet views and QR payloads for quick verification.
- **Verify Marksheet:** Validates student records and Merkle proofs against ledger blocks and flags tampering.
- **Two-Signature Corrections & Audit:** Requires two distinct approvers and a reason for corrections, and runs integrity audits across stored records and blocks.

## AI Usage Declaration
- **Lovable:** Used to scaffold the initial React and Tailwind UI and core VeriMark workflows.
- **IBM Bob:** Used locally for repository management, verification, and iterative code refinement.
