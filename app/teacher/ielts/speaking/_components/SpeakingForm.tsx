'use client';

// IELTS speaking-set authoring form: Part 1 questions, Part 2 cue card (topic + bullets),
// Part 3 questions. Reusable by the admin platform panel via { asPlatform: true }.
// Saves via saveSpeakingTest — empty rows filtered out, no undefined written.

import { useRef, useState } from 'react';
import { Plus, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { saveSpeakingTest } from '@/services/ieltsService';

const T: Record<string, any> = {
  uz: {
    formTitleNew: "Yangi Speaking To'plami",
    formTitleEdit: "Speaking To'plamini Tahrirlash",
    labelTitle: "To'plam nomi",
    titlePh: "masalan: Hobbies & Free Time",
    part1: "Part 1 — Kirish savollari",
    part2: "Part 2 — Cue Card",
    part3: "Part 3 — Muhokama savollari",
    questionPh: (n: number) => `Savol ${n}...`,
    addQuestion: "Savol qo'shish",
    topicLabel: "Mavzu",
    topicPh: "Describe a hobby you enjoy.",
    bulletsLabel: "Rejalar (You should say:)",
    bulletPh: (n: number) => `masalan: what it is / when you started...`,
    addBullet: "Reja qo'shish",
    save: "Saqlash",
    saving: "Saqlanmoqda...",
    cancel: "Bekor qilish",
    errNoTitle: "To'plam nomini kiriting!",
    errNoTopic: "Part 2 mavzusini kiriting!",
    errNoQuestions: "Kamida bitta savol kiriting!",
    saveSuccess: "To'plam muvaffaqiyatli saqlandi!",
    saveError: "Saqlashda xatolik yuz berdi!",
  },
  en: {
    formTitleNew: "New Speaking Set",
    formTitleEdit: "Edit Speaking Set",
    labelTitle: "Set title",
    titlePh: "e.g. Hobbies & Free Time",
    part1: "Part 1 — Introduction questions",
    part2: "Part 2 — Cue Card",
    part3: "Part 3 — Discussion questions",
    questionPh: (n: number) => `Question ${n}...`,
    addQuestion: "Add question",
    topicLabel: "Topic",
    topicPh: "Describe a hobby you enjoy.",
    bulletsLabel: "Bullets (You should say:)",
    bulletPh: (n: number) => `e.g. what it is / when you started...`,
    addBullet: "Add bullet",
    save: "Save",
    saving: "Saving...",
    cancel: "Cancel",
    errNoTitle: "Enter a set title!",
    errNoTopic: "Enter the Part 2 topic!",
    errNoQuestions: "Enter at least one question!",
    saveSuccess: "Set saved successfully!",
    saveError: "Failed to save!",
  },
  ru: {
    formTitleNew: "Новый Speaking набор",
    formTitleEdit: "Редактировать Speaking набор",
    labelTitle: "Название набора",
    titlePh: "например: Hobbies & Free Time",
    part1: "Part 1 — Вводные вопросы",
    part2: "Part 2 — Cue Card",
    part3: "Part 3 — Вопросы для обсуждения",
    questionPh: (n: number) => `Вопрос ${n}...`,
    addQuestion: "Добавить вопрос",
    topicLabel: "Тема",
    topicPh: "Describe a hobby you enjoy.",
    bulletsLabel: "Пункты (You should say:)",
    bulletPh: (n: number) => `например: what it is / when you started...`,
    addBullet: "Добавить пункт",
    save: "Сохранить",
    saving: "Сохранение...",
    cancel: "Отмена",
    errNoTitle: "Введите название набора!",
    errNoTopic: "Введите тему Part 2!",
    errNoQuestions: "Введите хотя бы один вопрос!",
    saveSuccess: "Набор успешно сохранён!",
    saveError: "Ошибка при сохранении!",
  },
};

function slugId(title: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '') || 'speaking';
  return `${base}_${Math.random().toString(36).substring(2, 8)}`;
}

function StringListEditor({ items, onChange, placeholder, addLabel }: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: (n: number) => string;
  addLabel: string;
}) {
  const update = (i: number, val: string) => {
    const next = [...items];
    next[i] = val;
    onChange(next);
  };
  const remove = (i: number) => {
    const next = [...items];
    next.splice(i, 1);
    onChange(next.length ? next : ['']);
  };
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 group/row">
          <span className="w-7 h-8 flex items-center justify-center text-[11px] font-black text-on-surface-variant bg-surface-container-high rounded-m3-xs shrink-0">{i + 1}</span>
          <input
            type="text" value={item} placeholder={placeholder(i + 1)}
            onChange={(e) => update(i, e.target.value)}
            className="flex-1 h-8 text-[13px] bg-surface-container-lowest border border-outline-variant rounded-m3-sm px-2.5 outline-none focus:border-primary placeholder:text-on-surface-variant font-medium"
          />
          <button onClick={() => remove(i)} disabled={items.length === 1} className="w-6 h-8 flex items-center justify-center text-on-surface-variant hover:text-error opacity-0 group-hover/row:opacity-100 disabled:opacity-0 shrink-0 transition-colors"><X size={14}/></button>
        </div>
      ))}
      <Button variant="text" size="sm" icon={<Plus />} onClick={() => onChange([...items, ''])}>
        {addLabel}
      </Button>
    </div>
  );
}

export default function SpeakingForm({ asPlatform = false, initial, onSaved, onCancel }: {
  asPlatform?: boolean;
  initial?: any | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { lang } = useTeacherLanguage();
  const t = T[lang] || T.uz;

  const testIdRef = useRef<string>(initial?.test_id || initial?.id || '');
  const [title, setTitle] = useState(initial?.test_title || '');
  const [part1, setPart1] = useState<string[]>(initial?.part1Questions?.length ? initial.part1Questions : ['']);
  const [topic, setTopic] = useState(initial?.part2CueCard?.topic || '');
  const [bullets, setBullets] = useState<string[]>(initial?.part2CueCard?.bullets?.length ? initial.part2CueCard.bullets : ['']);
  const [part3, setPart3] = useState<string[]>(initial?.part3Questions?.length ? initial.part3Questions : ['']);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const p1 = part1.map((q) => q.trim()).filter(Boolean);
    const p3 = part3.map((q) => q.trim()).filter(Boolean);
    const bl = bullets.map((b) => b.trim()).filter(Boolean);

    if (!title.trim()) { toast.error(t.errNoTitle); return; }
    if (!topic.trim()) { toast.error(t.errNoTopic); return; }
    if (p1.length === 0 && p3.length === 0) { toast.error(t.errNoQuestions); return; }

    setIsSaving(true);
    try {
      if (!testIdRef.current) testIdRef.current = slugId(title);
      await saveSpeakingTest({
        test_id: testIdRef.current,
        test_title: title.trim(),
        total_time_minutes: 14,
        total_questions: p1.length + 1 + p3.length,
        part1Questions: p1,
        part2CueCard: { topic: topic.trim(), bullets: bl },
        part3Questions: p3,
      }, asPlatform ? { asPlatform: true } : undefined);
      toast.success(t.saveSuccess);
      onSaved();
    } catch (error) {
      console.error('Save failed', error);
      toast.error(t.saveError);
    } finally {
      setIsSaving(false);
    }
  };

  const sectionCls = "bg-surface-container p-4 rounded-m3-md border border-outline-variant space-y-3";
  const labelCls = "block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest";
  const inputCls = "w-full bg-surface-container-lowest border border-outline-variant rounded-m3-md px-3 py-2.5 text-[13px] font-medium text-on-surface outline-none focus:border-primary placeholder:text-on-surface-variant";

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-m3-lg shadow-elev-1 p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-black text-on-surface tracking-tight">
          {initial ? t.formTitleEdit : t.formTitleNew}
        </h2>
        <button onClick={onCancel} className="w-8 h-8 rounded-m3-md flex items-center justify-center text-on-surface-variant hover:bg-state-hover hover:text-on-surface transition-colors">
          <X size={16} />
        </button>
      </div>

      <div>
        <label className={`${labelCls} mb-2`}>{t.labelTitle}</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.titlePh} className={inputCls} />
      </div>

      <div className={sectionCls}>
        <div className="text-[12px] font-black text-primary uppercase tracking-widest">{t.part1}</div>
        <StringListEditor items={part1} onChange={setPart1} placeholder={t.questionPh} addLabel={t.addQuestion} />
      </div>

      <div className={sectionCls}>
        <div className="text-[12px] font-black text-primary uppercase tracking-widest">{t.part2}</div>
        <div>
          <label className={`${labelCls} mb-1.5`}>{t.topicLabel}</label>
          <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t.topicPh} className={inputCls} />
        </div>
        <div>
          <label className={`${labelCls} mb-1.5`}>{t.bulletsLabel}</label>
          <StringListEditor items={bullets} onChange={setBullets} placeholder={t.bulletPh} addLabel={t.addBullet} />
        </div>
      </div>

      <div className={sectionCls}>
        <div className="text-[12px] font-black text-primary uppercase tracking-widest">{t.part3}</div>
        <StringListEditor items={part3} onChange={setPart3} placeholder={t.questionPh} addLabel={t.addQuestion} />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outlined" onClick={onCancel}>{t.cancel}</Button>
        <Button variant="filled" icon={<Save size={14} />} loading={isSaving} onClick={handleSave}>
          {isSaving ? t.saving : t.save}
        </Button>
      </div>
    </div>
  );
}
