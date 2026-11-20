import { createFileRoute } from "@tanstack/react-router";
import { PublishPanel } from "@/components/verimark/publish-panel";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Publish Results | VeriMark Ledger" },
      {
        name: "description",
        content:
          "Publish university exam results to a SHA-256 Merkle-tree ledger with verifiable, hash-linked records.",
      },
      { property: "og:title", content: "Publish Results | VeriMark Ledger" },
      {
        property: "og:description",
        content: "Preserve academic achievement with cryptographically verifiable result batches.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublishPanel,
});
