'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom'; // 🟢 ADDED PORTAL
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { X, UploadCloud, File as FileIcon, Link as LinkIcon, Folder, Cloud } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/AuthContext';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { Button, IconButton, ProgressBar, Spinner } from '@/components/ui';

// --- TRANSLATION DICTIONARY ---
const UPLOAD_MODAL_TRANSLATIONS = {
  uz: {
    toasts: { noTitle: "Sarlavha kiriting.", noFile: "Fayl tanlang.", noUrl: "To'g'ri havola kiriting.", notLoggedIn: "Tizimga kiring.", linkSuccess: "Havola qo'shildi!", uploadFailed: "Yuklashda xatolik!", fileSuccess: "Material yuklandi!", saveFailed: "Saqlashda xatolik." },
    modalTitle: "Material Qo'shish", modes: { file: "Fayl Yuklash", link: "Tashqi Havola" },
    form: { title: "Sarlavha", titlePlaceholder: "Masalan: 1-bob PDF", topic: "Mavzu (Ixtiyoriy)", topicPlaceholder: "Masalan: 1-hafta", description: "Tavsif (Ixtiyoriy)", descPlaceholder: "Ko'rsatmalar qo'shing...", url: "Havola (URL)", urlPlaceholder: "https://youtube.com/..." },
    dropzone: { select: "Fayl tanlash uchun bosing", types: "PDF, Rasm yoki Video fayllar", change: "Boshqa fayl tanlash" },
    progress: "Yuklanmoqda...", buttons: { save: "Materialni Saqlash", saving: "Saqlanmoqda..." }
  },
  en: {
    toasts: { noTitle: "Provide a title.", noFile: "Select a file.", noUrl: "Provide a valid URL.", notLoggedIn: "Please log in.", linkSuccess: "Link added!", uploadFailed: "Upload failed!", fileSuccess: "Material uploaded!", saveFailed: "Failed to save." },
    modalTitle: "Add Material", modes: { file: "Upload File", link: "External Link" },
    form: { title: "Title", titlePlaceholder: "e.g. Chapter 1 PDF", topic: "Topic (Optional)", topicPlaceholder: "e.g. Week 1", description: "Description (Optional)", descPlaceholder: "Add instructions...", url: "URL / Link", urlPlaceholder: "https://youtube.com/..." },
    dropzone: { select: "Click to select a file", types: "PDF, Image, or Video files", change: "Change file" },
    progress: "Uploading...", buttons: { save: "Save Material", saving: "Saving..." }
  },
  ru: {
    toasts: { noTitle: "Введите заголовок.", noFile: "Выберите файл.", noUrl: "Введите ссылку.", notLoggedIn: "Войдите в систему.", linkSuccess: "Ссылка добавлена!", uploadFailed: "Ошибка загрузки!", fileSuccess: "Материал загружен!", saveFailed: "Ошибка сохранения." },
    modalTitle: "Добавить Материал", modes: { file: "Загрузить Файл", link: "Внешняя Ссылка" },
    form: { title: "Заголовок", titlePlaceholder: "Напр. Глава 1 PDF", topic: "Тема (Необяз.)", topicPlaceholder: "Напр. Неделя 1", description: "Описание (Необяз.)", descPlaceholder: "Добавьте инструкции...", url: "Ссылка (URL)", urlPlaceholder: "https://youtube.com/..." },
    dropzone: { select: "Нажмите, чтобы выбрать файл", types: "PDF, Изображение или Видео", change: "Изменить файл" },
    progress: "Загрузка...", buttons: { save: "Сохранить", saving: "Сохранение..." }
  }
};

interface Props {
  classId: string;
  isOpen: boolean;
  onClose: () => void;
}

const getFileType = (mimeType: string) => {
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('image')) return 'image';
  if (mimeType.includes('video')) return 'video';
  return 'document';
};

export default function UploadMaterialModal({ classId, isOpen, onClose }: Props) {
  const { user } = useAuth();
  const { lang } = useTeacherLanguage();
  const t = UPLOAD_MODAL_TRANSLATIONS[lang] || UPLOAD_MODAL_TRANSLATIONS['en'];

  // 🟢 SSR HYDRATION FIX FOR PORTAL
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [uploadMode, setUploadMode] = useState<'file' | 'link'>('file');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [topic, setTopic] = useState(''); 
  const [linkUrl, setLinkUrl] = useState(''); 
  const [file, setFile] = useState<File | null>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleSave = async () => {
    if (!title.trim()) return toast.error(t.toasts.noTitle);
    if (uploadMode === 'file' && !file) return toast.error(t.toasts.noFile);
    if (uploadMode === 'link' && !linkUrl.trim()) return toast.error(t.toasts.noUrl);
    if (!user) return toast.error(t.toasts.notLoggedIn);

    setIsUploading(true);

    try {
      if (uploadMode === 'link') {
        await addDoc(collection(db, 'classes', classId, 'materials'), {
          classId, title: title.trim(), description: description.trim(), topicId: topic.trim() || null, 
          orderIndex: Date.now(), isExternal: true, externalUrl: linkUrl.trim(), fileType: 'link',       
          fileSize: 0, fileExtension: '', fileUrl: linkUrl.trim(), storagePath: null,      
          createdAt: serverTimestamp(), uploaderId: user.uid, isVisible: true, isArchived: false, viewCount: 0, downloadCount: 0
        });
        toast.success(t.toasts.linkSuccess);
        handleClose();
      } 
      else if (uploadMode === 'file' && file) {
        const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
        const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(2)}${fileExtension}`;
        const storagePath = `classes/${classId}/materials/${uniqueFileName}`;
        const storageRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
          (snapshot) => setProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
          (error) => { toast.error(t.toasts.uploadFailed); setIsUploading(false); },
          async () => {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            await addDoc(collection(db, 'classes', classId, 'materials'), {
              classId, title: title.trim(), description: description.trim(), topicId: topic.trim() || null, 
              orderIndex: Date.now(), isExternal: false, externalUrl: null,      
              fileType: getFileType(file.type), fileSize: file.size, fileExtension,
              fileUrl: downloadUrl, storagePath: storagePath, 
              createdAt: serverTimestamp(), uploaderId: user.uid, isVisible: true, isArchived: false, viewCount: 0, downloadCount: 0
            });
            toast.success(t.toasts.fileSuccess);
            handleClose();
          }
        );
      }
    } catch (err) {
      toast.error(t.toasts.saveFailed);
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null); setTitle(''); setDescription(''); setTopic(''); setLinkUrl('');
    setProgress(0); setIsUploading(false); onClose();
  };

  if (!mounted || !isOpen) return null;

  // 🟢 WRAPPED IN CREATE PORTAL
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-6">
      
      {/* Premium Backdrop */}
      <div className="absolute inset-0 bg-scrim backdrop-blur-sm transition-opacity" onClick={!isUploading ? handleClose : undefined}></div>

      {/* 🟢 ULTRA MINIMALISTIC MOBILE-FIRST MODAL */}
      <div className="relative bg-surface-container-low rounded-t-m3-xl sm:rounded-m3-xl w-full max-w-lg overflow-hidden shadow-elev-3 animate-in slide-in-from-bottom-10 sm:zoom-in-95 fade-in duration-300 flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">

        {/* HEADER */}
        <div className="px-5 py-4 sm:px-8 sm:py-5 border-b border-outline-variant flex justify-between items-center bg-[color-mix(in_oklab,var(--m3-surface-container-low)_90%,transparent)] backdrop-blur-xl shrink-0 z-20 shadow-elev-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-m3-md bg-primary-container flex items-center justify-center text-on-primary-container shadow-elev-1 shrink-0">
               <Cloud size={18} strokeWidth={2.5} className="sm:w-5 sm:h-5"/>
            </div>
            <h2 className="text-[16px] sm:text-[18px] font-black text-on-surface tracking-tight leading-tight">{t.modalTitle}</h2>
          </div>
          <IconButton aria-label="Yopish" size="sm" onClick={handleClose} disabled={isUploading} className="shrink-0">
            <X strokeWidth={2.5} />
          </IconButton>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-surface space-y-5 sm:space-y-6 custom-scrollbar relative pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-8">

          {/* Segmented Tabs */}
          <div className="flex p-1.5 bg-surface-container-high rounded-m3-lg shadow-inner">
            <button
              onClick={() => setUploadMode('file')} disabled={isUploading}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-2 text-[12px] font-bold rounded-m3-md transition-all ${uploadMode === 'file' ? 'bg-surface-container-lowest shadow-elev-1 text-primary ring-1 ring-outline-variant' : 'text-on-surface-variant hover:text-on-surface disabled:opacity-50'}`}
            >
              <FileIcon size={14}/> {t.modes.file}
            </button>
            <button
              onClick={() => setUploadMode('link')} disabled={isUploading}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-2 text-[12px] font-bold rounded-m3-md transition-all ${uploadMode === 'link' ? 'bg-surface-container-lowest shadow-elev-1 text-primary ring-1 ring-outline-variant' : 'text-on-surface-variant hover:text-on-surface disabled:opacity-50'}`}
            >
              <LinkIcon size={14}/> {t.modes.link}
            </button>
          </div>

          {/* Title & Topic Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] sm:text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-1.5 sm:mb-2">{t.form.title} <span className="text-error">*</span></label>
              <input 
                type="text" value={title} onChange={e => setTitle(e.target.value)} disabled={isUploading} placeholder={t.form.titlePlaceholder} 
                className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-m3-md text-[13px] sm:text-[14px] font-bold text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-4 focus:ring-[color-mix(in_oklab,var(--m3-primary)_12%,transparent)] outline-none transition-all shadow-elev-1 disabled:opacity-50" 
              />
            </div>
            <div>
              <label className="block text-[10px] sm:text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-1.5 sm:mb-2 flex items-center gap-1.5"><Folder size={12}/> {t.form.topic}</label>
              <input 
                type="text" value={topic} onChange={e => setTopic(e.target.value)} disabled={isUploading} placeholder={t.form.topicPlaceholder} 
                className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-m3-md text-[13px] sm:text-[14px] font-bold text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-4 focus:ring-[color-mix(in_oklab,var(--m3-primary)_12%,transparent)] outline-none transition-all shadow-elev-1 disabled:opacity-50" 
              />
            </div>
          </div>
          
          {/* Description */}
          <div>
            <label className="block text-[10px] sm:text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-1.5 sm:mb-2">{t.form.description}</label>
            <textarea 
              value={description} onChange={e => setDescription(e.target.value)} disabled={isUploading} rows={2} placeholder={t.form.descPlaceholder} 
              className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-m3-md text-[13px] sm:text-[14px] font-medium text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-4 focus:ring-[color-mix(in_oklab,var(--m3-primary)_12%,transparent)] outline-none resize-none transition-all shadow-elev-1 disabled:opacity-50" 
            />
          </div>

          {/* DYNAMIC INPUT: Link OR File */}
          <div className="pt-2 sm:pt-3 border-t border-outline-variant">
            {uploadMode === 'link' ? (
              <div>
                <label className="block text-[10px] sm:text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-1.5 sm:mb-2">{t.form.url} <span className="text-error">*</span></label>
                <div className="relative group">
                  <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors" size={16}/>
                  <input 
                    type="url" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} disabled={isUploading} placeholder={t.form.urlPlaceholder} 
                    className="w-full pl-11 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-m3-md text-[13px] sm:text-[14px] font-bold text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-4 focus:ring-[color-mix(in_oklab,var(--m3-primary)_12%,transparent)] outline-none transition-all shadow-elev-1 disabled:opacity-50" 
                  />
                </div>
              </div>
            ) : (
              <div className="relative">
                <input type="file" id="file-upload" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} disabled={isUploading} />
                <label 
                  htmlFor="file-upload" 
                  className={`flex flex-col items-center justify-center w-full h-32 sm:h-36 border-2 border-dashed rounded-m3-lg cursor-pointer transition-all relative overflow-hidden group active:scale-[0.98] sm:active:scale-100 ${
                    file
                      ? 'border-primary bg-primary-container'
                      : 'border-outline bg-surface-container-lowest hover:bg-surface-container hover:border-primary'
                  } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  {/* Subtle hover flare */}
                  {!file && <div className="absolute inset-0 bg-gradient-to-br from-transparent to-[color-mix(in_oklab,var(--m3-primary)_6%,transparent)] opacity-0 group-hover:opacity-100 transition-opacity"></div>}

                  {file ? (
                    <div className="text-center relative z-10 flex flex-col items-center">
                      <div className="w-10 h-10 bg-surface-container-lowest rounded-m3-md shadow-elev-1 flex items-center justify-center mb-2 text-primary">
                        <FileIcon size={20} strokeWidth={2.5} />
                      </div>
                      <p className="text-[13px] font-black text-on-surface truncate px-4 max-w-[250px]">{file.name}</p>
                      <p className="text-[11px] font-bold text-primary mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB • <span className="underline decoration-[color-mix(in_oklab,var(--m3-primary)_35%,transparent)] hover:decoration-primary">{t.dropzone.change}</span></p>
                    </div>
                  ) : (
                    <div className="text-center text-on-surface-variant relative z-10">
                      <UploadCloud className="mx-auto mb-2 text-on-surface-variant group-hover:text-primary transition-colors group-hover:-translate-y-1 duration-300" size={28} />
                      <p className="text-[12px] sm:text-[13px] font-bold text-on-surface group-hover:text-primary transition-colors">{t.dropzone.select}</p>
                      <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-on-surface-variant mt-1.5">{t.dropzone.types}</p>
                    </div>
                  )}
                </label>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {isUploading && uploadMode === 'file' && (
            <div className="pt-2 animate-in fade-in duration-300">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] sm:text-[11px] font-black text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5"><Spinner size={12}/> {t.progress}</span>
                <span className="text-[10px] sm:text-[11px] font-black text-on-primary-container bg-primary-container px-2 py-0.5 rounded-m3-xs">{progress}%</span>
              </div>
              <ProgressBar value={progress} className="h-2.5" />
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-4 sm:px-8 py-4 sm:py-5 bg-surface-container-low border-t border-outline-variant flex justify-end shrink-0 z-20 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-5 shadow-[0_-10px_30px_rgb(0,0,0,0.03)]">
          <Button
            variant="filled"
            size="lg"
            onClick={handleSave}
            disabled={isUploading || !title.trim()}
            loading={isUploading}
            icon={<Cloud strokeWidth={2.5}/>}
            className="w-full sm:w-auto"
          >
            {isUploading ? t.buttons.saving : t.buttons.save}
          </Button>
        </div>

      </div>
    </div>,
    document.body
  );
}