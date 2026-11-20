import { createFileRoute } from "@tanstack/react-router";
import { VerifyPanel } from "@/components/verimark/verify-panel";
export const Route = createFileRoute("/verify")({
  head: () => ({
    meta: [
      { title: "Verify Marksheet | VeriMark Ledger" },
      {
        name: "description",
        content:
          "Verify university exam results using a QR camera scan, registration number, or cryptographic QR payload.",
      },
      { property: "og:title", content: "Verify Marksheet | VeriMark Ledger" },
      {
        property: "og:description",
        content:
          "Verify university exam results using a QR camera scan, registration number, or cryptographic QR payload.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VerifyPanel,
});
