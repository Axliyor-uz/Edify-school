'use client';

// Edit an existing reading test. The old localStorage-injection redirect hack is gone:
// the builder itself loads the test via loadTestForEdit('reading', id) (answers re-inlined
// from ielts_answer_keys) and keeps its draft under the per-test key
// `ielts_reading_draft_{id}`, so an in-progress new-test draft is never clobbered.

import { useParams } from 'next/navigation';
import ReadingBuilder from '../_components/ReadingBuilder';

export default function EditReadingTestPage() {
  const { id } = useParams();
  const testId = Array.isArray(id) ? id[0] : id;
  if (!testId) return null;
  return <ReadingBuilder backHref="/teacher/ielts/reading" editTestId={testId} />;
}
