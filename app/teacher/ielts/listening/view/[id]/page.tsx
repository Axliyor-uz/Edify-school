'use client';

// Listening finally gets a real preview route (audio + transcript + questions) instead
// of the old flattened reuse of the reading PreviewModal.
import { useParams } from 'next/navigation';
import TestPreview from '@/app/teacher/ielts/_shared/TestPreview';

export default function ListeningTestViewPage() {
  const { id } = useParams() as { id: string };
  return <TestPreview skill="listening" testId={id} />;
}
