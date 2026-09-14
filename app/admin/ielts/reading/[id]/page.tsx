'use client';

import { use } from 'react';
import AdminLangProvider from '../../_components/AdminLangProvider';
import ReadingBuilder from '@/app/teacher/ielts/reading/manual/_components/ReadingBuilder';

export default function AdminEditReadingTest({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AdminLangProvider>
      <ReadingBuilder asPlatform backHref="/admin/ielts" editTestId={id} />
    </AdminLangProvider>
  );
}
