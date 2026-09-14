'use client';

import AdminLangProvider from '../../_components/AdminLangProvider';
import ReadingBuilder from '@/app/teacher/ielts/reading/manual/_components/ReadingBuilder';

export default function AdminNewReadingTest() {
  return (
    <AdminLangProvider>
      <ReadingBuilder asPlatform backHref="/admin/ielts" />
    </AdminLangProvider>
  );
}
