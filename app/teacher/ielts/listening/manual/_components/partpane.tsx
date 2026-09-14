'use client';

// Left pane of the listening builder: one IELTS part = one audio file (uploaded to
// Firebase Storage at ielts_audio/{testId}/part{n}_{filename}, duration captured via an
// Audio element) plus an optional transcript (powers locate-in-transcript review).

import { useRef, useState } from 'react';
import { Headphones, Trash2, UploadCloud, FileAudio } from 'lucide-react';
import toast from 'react-hot-toast';
import { Spinner } from '@/components/ui';
import { useTeacherLanguage } from '@/app/teacher/layout';

import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const TRANSLATIONS: Record<string, any> = {
  uz: {
    partLabel: (n: number) => `Part ${n}`,
    audioTitle: 'Audio fayl',
    clickToUpload: 'Audio yuklash uchun bosing (MP3 / M4A / OGG)',
    uploading: 'Yuklanmoqda...',
    uploaded: 'Audio yuklandi!',
    uploadError: 'Audio yuklashda xatolik!',
    badType: 'Faqat MP3, M4A yoki OGG fayl yuklang!',
    removeAudio: "Audioni o'chirish",
    durationLabel: 'Davomiyligi',
    transcriptTitle: 'Transkript (ixtiyoriy)',
    transcriptPh: "Audio matnini shu yerga kiriting — o'quvchi natijani tahlil qilganda javob joyini ko'rsatish uchun ishlatiladi...",
  },
  en: {
    partLabel: (n: number) => `Part ${n}`,
    audioTitle: 'Audio file',
    clickToUpload: 'Click to upload audio (MP3 / M4A / OGG)',
    uploading: 'Uploading...',
    uploaded: 'Audio uploaded!',
    uploadError: 'Failed to upload audio!',
    badType: 'Only MP3, M4A or OGG files are allowed!',
    removeAudio: 'Remove audio',
    durationLabel: 'Duration',
    transcriptTitle: 'Transcript (optional)',
    transcriptPh: 'Paste the audio transcript here — it powers "locate in transcript" when students review their answers...',
  },
  ru: {
    partLabel: (n: number) => `Part ${n}`,
    audioTitle: 'Аудиофайл',
    clickToUpload: 'Нажмите, чтобы загрузить аудио (MP3 / M4A / OGG)',
    uploading: 'Загрузка...',
    uploaded: 'Аудио загружено!',
    uploadError: 'Ошибка загрузки аудио!',
    badType: 'Разрешены только файлы MP3, M4A или OGG!',
    removeAudio: 'Удалить аудио',
    durationLabel: 'Длительность',
    transcriptTitle: 'Транскрипт (необязательно)',
    transcriptPh: 'Вставьте сюда текст аудио — используется для показа места ответа при разборе...',
  },
};

const ACCEPTED = ['.mp3', '.m4a', '.ogg'];

function formatDuration(secs: number): string {
  if (!secs || !isFinite(secs)) return '—';
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Resolve audio duration (seconds) from a File via an Audio element. 0 if unreadable. */
function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = (d: number) => { URL.revokeObjectURL(url); resolve(d); };
    audio.addEventListener('loadedmetadata', () => done(Math.round(audio.duration || 0)));
    audio.addEventListener('error', () => done(0));
    audio.src = url;
  });
}

export default function PartPane({ part, update, testId }: {
  part: any;
  update: (key: string, val: any) => void;
  testId: string;
}) {
  const { lang } = useTeacherLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lower = file.name.toLowerCase();
    if (!ACCEPTED.some((ext) => lower.endsWith(ext)) && !file.type.startsWith('audio/')) {
      toast.error(t.badType);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const duration = await readAudioDuration(file);
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const storageRef = ref(storage, `ielts_audio/${testId}/part${part.part_number}_${cleanFileName}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      update('audio_url', downloadURL);
      update('audio_duration_seconds', duration);
      toast.success(t.uploaded);
    } catch (error) {
      console.error('Audio upload failed', error);
      toast.error(t.uploadError);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAudio = async () => {
    if (!part.audio_url) return;
    try {
      await deleteObject(ref(storage, part.audio_url));
    } catch {
      console.log('Audio file already deleted or not found in storage.');
    }
    update('audio_url', '');
    update('audio_duration_seconds', 0);
  };

  return (
    <div className="p-4 md:p-6 space-y-5">

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-m3-md bg-primary-container text-on-primary-container flex items-center justify-center shadow-elev-1">
          <Headphones size={18} strokeWidth={2.5} />
        </div>
        <h2 className="text-[16px] font-black text-on-surface tracking-tight">{t.partLabel(part.part_number)}</h2>
      </div>

      {/* AUDIO */}
      <div className="bg-surface-container p-4 rounded-m3-md border border-outline-variant">
        <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-3">{t.audioTitle}</div>
        <input type="file" ref={fileInputRef} onChange={handleAudioUpload} accept="audio/mpeg,audio/mp4,audio/ogg,.mp3,.m4a,.ogg" className="hidden" />

        {!part.audio_url ? (
          <div
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className="w-full h-28 border-2 border-dashed border-outline bg-surface-container-lowest rounded-m3-md flex flex-col items-center justify-center text-primary hover:bg-state-hover hover:border-primary transition-colors cursor-pointer"
          >
            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <Spinner size={22} />
                <span className="text-[11px] font-bold">{t.uploading}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 text-center">
                <UploadCloud size={26} />
                <span className="text-[11px] font-bold">{t.clickToUpload}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <audio controls src={part.audio_url} className="w-full h-10" preload="metadata" />
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-on-surface-variant">
                <FileAudio size={13} /> {t.durationLabel}: {formatDuration(part.audio_duration_seconds)}
              </span>
              <button
                onClick={handleDeleteAudio}
                className="m3-interactive flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold text-error hover:bg-error-container rounded-m3-sm transition-colors"
              >
                <Trash2 size={13} /> {t.removeAudio}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* TRANSCRIPT */}
      <div className="bg-surface-container p-4 rounded-m3-md border border-outline-variant">
        <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-3">{t.transcriptTitle}</div>
        <textarea
          value={part.transcript || ''}
          onChange={(e) => update('transcript', e.target.value)}
          placeholder={t.transcriptPh}
          rows={14}
          className="w-full bg-surface-container-lowest border border-outline-variant rounded-m3-md p-3 text-[13px] leading-relaxed text-on-surface outline-none focus:border-primary placeholder:text-on-surface-variant font-medium resize-y custom-scrollbar"
        />
      </div>
    </div>
  );
}
