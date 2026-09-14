'use client';

import { use } from 'react';
import AdminLangProvider from '../../_components/AdminLangProvider';
import ListeningBuilder from '@/app/teacher/ielts/listening/manual/_components/ListeningBuilder';

export default function AdminEditListeningTest({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AdminLangProvider>
      <ListeningBuilder asPlatform backHref="/admin/ielts" editTestId={id} />
    </AdminLangProvider>
  );
}
