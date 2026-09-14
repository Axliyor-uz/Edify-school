'use client';

// IELTS writing-task authoring form (Task 1 prompt + optional image + optional model answer,
// Task 2 prompt + optional model answer). Reusable by the admin platform panel via
// { asPlatform: true }. Saves via saveWritingTest — optional fields built conditionally so
// undefined is never written to Firestore.

import { useRef, useState } from 'react';
import { Trash2, UploadCloud, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Spinner } from '@/components/ui';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { saveWritingTest } from '@/services/ieltsService';

import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const T: Record<string, any> = {
  uz: {
    formTitleNew: "Yangi Writing Test",
    formTitleEdit: "Writing Testni Tahrirlash",
    labelTitle: "Test nomi",
    titlePh: "masalan: Cambridge 18 Writing 1",
    task1: "Task 1",
    task2: "Task 2",
    promptLabel: "Topshiriq matni",
    task1PromptPh: "The chart below shows... Summarise the information by selecting and reporting the main features.",
    task2PromptPh: "Some people believe that... Discuss both views and give your own opinion.",
    imageLabel: "Rasm (grafik/jadval, ixtiyoriy)",
    clickToUpload: "Rasm yuklash uchun bosing",
    uploading: "Yuklanmoqda...",
    imgUploaded: "Rasm yuklandi!",
    imgUploadError: "Rasmni yuklashda xatolik!",
    removeImage: "Rasmni o'chirish",
    modelLabel: "Namuna javob (ixtiyoriy)",
    modelPh: "Band 8-9 darajadagi namuna insho...",
    save: "Saqlash",
    saving: "Saqlanmoqda...",
    cancel: "Bekor qilish",
    errNoTitle: "Test nomini kiriting!",
    errNoTask1: "Task 1 topshirig'ini kiriting!",
    errNoTask2: "Task 2 topshirig'ini kiriting!",
    saveSuccess: "Test muvaffaqiyatli saqlandi!",
    saveError: "Saqlashda xatolik yuz berdi!",
  },
  en: {
    formTitleNew: "New Writing Test",
    formTitleEdit: "Edit Writing Test",
    labelTitle: "Test title",
    titlePh: "e.g. Cambridge 18 Writing 1",
    task1: "Task 1",
    task2: "Task 2",
    promptLabel: "Prompt",
    task1PromptPh: "The chart below shows... Summarise the information by selecting and reporting the main features.",
    task2PromptPh: "Some people believe that... Discuss both views and give your own opinion.",
    imageLabel: "Image (chart/diagram, optional)",
    clickToUpload: "Click to upload an image",
    uploading: "Uploading...",
    imgUploaded: "Image uploaded!",
    imgUploadError: "Failed to upload the image!",
    removeImage: "Remove image",
    modelLabel: "Model answer (optional)",
    modelPh: "A band 8-9 sample essay...",
    save: "Save",
    saving: "Saving...",
    cancel: "Cancel",
    errNoTitle: "Enter a test title!",
    errNoTask1: "Enter the Task 1 prompt!",
    errNoTask2: "Enter the Task 2 prompt!",
    saveSuccess: "Test saved successfully!",
    saveError: "Failed to save!",
  },
  ru: {
    formTitleNew: "Новый Writing тест",
    formTitleEdit: "Редактировать Writing тест",
    labelTitle: "Название теста",
    titlePh: "например: Cambridge 18 Writing 1",
    task1: "Task 1",
    task2: "Task 2",
    promptLabel: "Задание",
    task1PromptPh: "The chart below shows... Summarise the information by selecting and reporting the main features.",
    task2PromptPh: "Some people believe that... Discuss both views and give your own opinion.",
    imageLabel: "Изображение (график/диаграмма, необязательно)",
    clickToUpload: "Нажмите, чтобы загрузить изображение",
    uploading: "Загрузка...",
    imgUploaded: "Изображение загружено!",
    imgUploadError: "Ошибка загрузки изображения!",
    removeImage: "Удалить изображение",
    modelLabel: "Образец ответа (необязательно)",
    modelPh: "Образец эссе уровня band 8-9...",
    save: "Сохранить",
    saving: "Сохранение...",
    cancel: "Отмена",
    errNoTitle: "Введите название теста!",
    errNoTask1: "Введите задание Task 1!",
    errNoTask2: "Введите задание Task 2!",
    saveSuccess: "Тест успешно сохранён!",
    saveError: "Ошибка при сохранении!",
  },
};

function slugId(title: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '') || 'writing';
  return `${base}_${Math.random().toString(36).substring(2, 8)}`;
}

export default function WritingForm({ asPlatform = false, initial, onSaved, onCancel }: {
  asPlatform?: boolean;
  initial?: any | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { lang } = useTeacherLanguage();
  const t = T[lang] || T.uz;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const testIdRef = useRef<string>(initial?.test_id || initial?.id || '');
  const [title, setTitle] = useState(initial?.test_title || '');
  const [task1Prompt, setTask1Prompt] = useState(initial?.task1?.prompt || '');
  const [task1ImageUrl, setTask1ImageUrl] = useState(initial?.task1?.imageUrl || '');
  const [task1Model, setTask1Model] = useState(initial?.task1?.modelAnswer || '');
  const [task2Prompt, setTask2Prompt] = useState(initial?.task2?.prompt || '');
  const [task2Model, setTask2Model] = useState(initial?.task2?.modelAnswer || '');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const ensureId = () => {
    if (!testIdRef.current) testIdRef.current = slugId(title);
    return testIdRef.current;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const storageRef = ref(storage, `ielts_writing/${ensureId()}/task1_${Date.now()}_${cleanFileName}`);
      const snapshot = await uploadBytes(storageRef, file);
      setTask1ImageUrl(await getDownloadURL(snapshot.ref));
      toast.success(t.imgUploaded);
    } catch (error) {
      console.error('Upload failed', error);
      toast.error(t.imgUploadError);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteImage = async () => {
    if (!task1ImageUrl) return;
    try {
      await deleteObject(ref(storage, task1ImageUrl));
    } catch {
      console.log('Image already deleted or not found in storage.');
    }
    setTask1ImageUrl('');
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error(t.errNoTitle); return; }
    if (!task1Prompt.trim()) { toast.error(t.errNoTask1); return; }
    if (!task2Prompt.trim()) { toast.error(t.errNoTask2); return; }
    setIsSaving(true);
    try {
      await saveWritingTest({
        test_id: ensureId(),
        test_title: title.trim(),
        total_time_minutes: 60,
        total_questions: 2,
        task1: {
          prompt: task1Prompt.trim(),
          ...(task1ImageUrl ? { imageUrl: task1ImageUrl } : {}),
          ...(task1Model.trim() ? { modelAnswer: task1Model.trim() } : {}),
        },
        task2: {
          prompt: task2Prompt.trim(),
          ...(task2Model.trim() ? { modelAnswer: task2Model.trim() } : {}),
        },
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
  const areaCls = `${inputCls} resize-y leading-relaxed custom-scrollbar`;

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* TASK 1 */}
        <div className={sectionCls}>
          <div className="text-[12px] font-black text-primary uppercase tracking-widest">{t.task1}</div>
          <div>
            <label className={`${labelCls} mb-1.5`}>{t.promptLabel}</label>
            <textarea rows={4} value={task1Prompt} onChange={(e) => setTask1Prompt(e.target.value)} placeholder={t.task1PromptPh} className={areaCls} />
          </div>
          <div>
            <label className={`${labelCls} mb-1.5`}>{t.imageLabel}</label>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
            {!task1ImageUrl ? (
              <div
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className="w-full h-24 border-2 border-dashed border-outline bg-surface-container-lowest rounded-m3-md flex flex-col items-center justify-center text-primary hover:bg-state-hover hover:border-primary transition-colors cursor-pointer"
              >
                {isUploading ? (
                  <div className="flex flex-col items-center gap-1.5"><Spinner size={20} /><span className="text-[11px] font-bold">{t.uploading}</span></div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5"><UploadCloud size={22} /><span className="text-[11px] font-bold">{t.clickToUpload}</span></div>
                )}
              </div>
            ) : (
              <div className="relative group/img">
                <img src={task1ImageUrl} alt="Task 1" className="w-full rounded-m3-sm border border-outline-variant shadow-elev-1 object-contain max-h-48 bg-surface-container-lowest" />
                <button
                  onClick={handleDeleteImage}
                  className="absolute top-2 right-2 p-1.5 bg-surface-container-lowest text-error rounded-m3-sm shadow-elev-2 opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-error-container"
                  title={t.removeImage}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
          <div>
            <label className={`${labelCls} mb-1.5`}>{t.modelLabel}</label>
            <textarea rows={4} value={task1Model} onChange={(e) => setTask1Model(e.target.value)} placeholder={t.modelPh} className={areaCls} />
          </div>
        </div>

        {/* TASK 2 */}
        <div className={sectionCls}>
          <div className="text-[12px] font-black text-primary uppercase tracking-widest">{t.task2}</div>
          <div>
            <label className={`${labelCls} mb-1.5`}>{t.promptLabel}</label>
            <textarea rows={4} value={task2Prompt} onChange={(e) => setTask2Prompt(e.target.value)} placeholder={t.task2PromptPh} className={areaCls} />
          </div>
          <div>
            <label className={`${labelCls} mb-1.5`}>{t.modelLabel}</label>
            <textarea rows={9} value={task2Model} onChange={(e) => setTask2Model(e.target.value)} placeholder={t.modelPh} className={areaCls} />
          </div>
        </div>
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
