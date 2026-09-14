'use client';

import { useState, useEffect } from 'react';
import rawSyllabusData from '@/data/syllabus.json';

import { Select, cn } from '@/components/ui';
import { useTeacherLanguage } from '@/app/teacher/layout';

const TRANSLATIONS: Record<string, any> = {
  uz: {
    subjectTopic: "Fan mavzusi",
    selectTopic: "Mavzuni tanlang...",
    chapter: "Bo'lim",
    selectChapter: "Bo'limni tanlang...",
    subtopic: "Kichik mavzu",
    selectSubtopic: "Kichik mavzuni tanlang...",
    difficultyLevel: "Murakkablik darajasi",
    difficulties: { Easy: "Oson", Medium: "O'rtacha", Hard: "Murakkab" },
  },
  en: {
    subjectTopic: "Subject Topic",
    selectTopic: "Select a Topic...",
    chapter: "Chapter",
    selectChapter: "Select Chapter...",
    subtopic: "Subtopic",
    selectSubtopic: "Select Subtopic...",
    difficultyLevel: "Difficulty Level",
    difficulties: { Easy: "Easy", Medium: "Medium", Hard: "Hard" },
  },
  ru: {
    subjectTopic: "Тема предмета",
    selectTopic: "Выберите тему...",
    chapter: "Раздел",
    selectChapter: "Выберите раздел...",
    subtopic: "Подтема",
    selectSubtopic: "Выберите подтему...",
    difficultyLevel: "Уровень сложности",
    difficulties: { Easy: "Лёгкий", Medium: "Средний", Hard: "Сложный" },
  },
};

interface Props {
  onChange: (selection: any) => void;
}

export default function SyllabusSelector({ onChange }: Props) {
  const { lang } = useTeacherLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const categories: any[] = Array.isArray(rawSyllabusData) ? rawSyllabusData : [];

  const [selectedTopic, setSelectedTopic] = useState<any | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<any | null>(null);
  const [selectedSubtopic, setSelectedSubtopic] = useState<any | null>(null);
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');

  useEffect(() => {
    onChange({
      topic: selectedTopic,
      chapter: selectedChapter,
      subtopic: selectedSubtopic,
      difficulty: difficulty
    });
  }, [selectedTopic, selectedChapter, selectedSubtopic, difficulty, onChange]);

  return (
    <div className="space-y-4 bg-surface-container rounded-m3-lg p-4">

      {/* TOPIC */}
      <Select
        label={t.subjectTopic}
        value={selectedTopic?.index || ""}
        onChange={(e) => {
          const topic = categories.find(c => c.index === Number(e.target.value)) || null;
          setSelectedTopic(topic);
          setSelectedChapter(null);
          setSelectedSubtopic(null);
        }}
      >
        <option value="" disabled>{t.selectTopic}</option>
        {categories.map(cat => <option key={cat.index} value={cat.index}>{cat.category}</option>)}
      </Select>

      <div className="grid grid-cols-1 gap-4">
        {/* CHAPTER */}
        <Select
          label={t.chapter}
          disabled={!selectedTopic}
          value={selectedChapter?.index || ""}
          onChange={(e) => {
            const chapter = selectedTopic?.chapters.find((c: any) => c.index === Number(e.target.value)) || null;
            setSelectedChapter(chapter);
            setSelectedSubtopic(null);
          }}
        >
          <option value="" disabled>{t.selectChapter}</option>
          {selectedTopic?.chapters?.map((chap: any) => <option key={chap.index} value={chap.index}>{chap.chapter}</option>)}
        </Select>

        {/* SUBTOPIC */}
        <Select
          label={t.subtopic}
          disabled={!selectedChapter}
          value={selectedSubtopic?.index || ""}
          onChange={(e) => {
            const sub = selectedChapter?.subtopics.find((s: any) => s.index === Number(e.target.value)) || null;
            setSelectedSubtopic(sub);
          }}
        >
          <option value="" disabled>{t.selectSubtopic}</option>
          {selectedChapter?.subtopics?.map((sub: any) => <option key={sub.index} value={sub.index}>{sub.name}</option>)}
        </Select>
      </div>

      {/* DIFFICULTY */}
      <div className="pt-3 border-t border-outline-variant mt-2">
        <label className="text-xs font-bold text-on-surface-variant mb-2 block">{t.difficultyLevel}</label>
        <div className="flex gap-2">
          {['Easy', 'Medium', 'Hard'].map((lvl: any) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setDifficulty(lvl)}
              className={cn(
                "m3-interactive flex-1 py-2 rounded-m3-sm text-xs font-bold transition-all",
                difficulty === lvl
                  ? "bg-secondary-container text-on-secondary-container shadow-elev-1"
                  : "bg-surface-container-lowest ring-1 ring-inset ring-outline-variant text-on-surface-variant hover:text-on-surface",
              )}
            >
              {t.difficulties[lvl] || lvl}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
