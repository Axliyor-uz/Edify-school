'use client';

import { useState } from 'react';
import { TeacherLanguageContext, type LangType } from '@/app/teacher/layout';

/** The reused teacher builder/form components call useTeacherLanguage(), which throws
 * outside TeacherLayout — this provides the context inside the admin tree (English default). */
export default function AdminLangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<LangType>('en');
  return (
    <TeacherLanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </TeacherLanguageContext.Provider>
  );
}
