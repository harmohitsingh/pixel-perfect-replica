import { createFileRoute } from "@tanstack/react-router";
import { MarksheetsPanel } from "@/components/verimark/marksheets-panel";
export const Route = createFileRoute("/marksheets")({
  head: () => ({
    meta: [
      { title: "Student Marksheets | VeriMark Ledger" },
      {
        name: "description",
        content:
          "Printable university marksheets with QR codes, salted result hashes, and verifiable Merkle proofs.",
      },
      { property: "og:title", content: "Student Marksheets | VeriMark Ledger" },
      {
        property: "og:description",
        content:
          "Printable university marksheets with QR codes, salted result hashes, and verifiable Merkle proofs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MarksheetsPanel,
});
