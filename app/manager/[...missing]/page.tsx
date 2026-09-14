import { notFound } from "next/navigation";

// Catch-all for unmatched /manager/* URLs. Without this, a mistyped manager
// URL would fall through to the root 404 (outside the manager layout).
// Real routes are more specific, so they always win over this segment.
export default function ManagerCatchAll() {
  notFound();
}
