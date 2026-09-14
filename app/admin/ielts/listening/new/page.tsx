'use client';

import AdminLangProvider from '../../_components/AdminLangProvider';
import ListeningBuilder from '@/app/teacher/ielts/listening/manual/_components/ListeningBuilder';

export default function AdminNewListeningTest() {
  return (
    <AdminLangProvider>
      <ListeningBuilder asPlatform backHref="/admin/ielts" />
    </AdminLangProvider>
  );
}
