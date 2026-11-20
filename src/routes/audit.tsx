import { createFileRoute } from "@tanstack/react-router";
import { AuditPanel } from "@/components/verimark/audit-panel";
export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Corrections & Integrity Audit | VeriMark Ledger" },
      {
        name: "description",
        content:
          "Request two-signature corrections and inspect every result, Merkle proof, and hash-chain link for tampering.",
      },
      { property: "og:title", content: "Corrections & Integrity Audit | VeriMark Ledger" },
      {
        property: "og:description",
        content:
          "Request two-signature corrections and inspect every result, Merkle proof, and hash-chain link for tampering.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuditPanel,
});
