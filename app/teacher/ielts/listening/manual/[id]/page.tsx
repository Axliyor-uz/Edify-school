'use client';

// Edit an existing listening test — the builder loads it via loadTestForEdit('listening', id)
// and keeps its draft under the per-test key `ielts_listening_draft_{id}`.

import { useParams } from 'next/navigation';
import ListeningBuilder from '../_components/ListeningBuilder';

export default function EditListeningTestPage() {
  const { id } = useParams();
  const testId = Array.isArray(id) ? id[0] : id;
  if (!testId) return null;
  return <ListeningBuilder backHref="/teacher/ielts/listening" editTestId={testId} />;
}
