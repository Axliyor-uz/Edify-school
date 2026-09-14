'use client';

// Thin wrapper — the actual preview lives in app/teacher/ielts/_shared/TestPreview.tsx
// (shared with the listening view route).
import { useParams } from 'next/navigation';
import TestPreview from '@/app/teacher/ielts/_shared/TestPreview';

export default function ReadingTestViewPage() {
  const { id } = useParams() as { id: string };
  return <TestPreview skill="reading" testId={id} />;
}
