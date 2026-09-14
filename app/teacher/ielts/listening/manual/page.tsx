'use client';

// Thin wrapper — the builder lives in _components/ListeningBuilder.tsx so the
// admin platform panel can reuse it with { asPlatform: true }.

import ListeningBuilder from './_components/ListeningBuilder';

export default function ManualListeningBuilderPage() {
  return <ListeningBuilder backHref="/teacher/ielts/listening" />;
}
