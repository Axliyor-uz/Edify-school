'use client';

// Thin wrapper — the whole builder lives in _components/ReadingBuilder.tsx so the
// admin platform panel can reuse it with { asPlatform: true }.

import ReadingBuilder from './_components/ReadingBuilder';

export default function ManualReadingBuilderPage() {
  return <ReadingBuilder backHref="/teacher/ielts/reading" />;
}
