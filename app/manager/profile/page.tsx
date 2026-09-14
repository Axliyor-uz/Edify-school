"use client";

import { useEffect, useRef, useState } from "react";
import { db, storage } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { updateProfile } from "firebase/auth";
import { useAuth } from "@/lib/AuthContext";
import {
  AtSign, Building2, Calendar, Camera, Check, Loader2,
  Mail, Phone, Trash2, User, X,
} from "lucide-react";
import toast from "react-hot-toast";
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Button, Spinner } from "@/components/manager-ui";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";

const TRANSLATIONS = {
  uz: {
    photoUpdated: "Rasm yangilandi!",
    photoUploadError: "Rasm yuklashda xatolik",
    photoDeleted: "Rasm o'chirildi!",
    deleteError: "O'chirishda xatolik",
    profileNotFound: "Profil topilmadi.",
    cropTitle: "Rasmni Kesish",
    cropPreviewAlt: "Kesish uchun rasm",
    cancel: "Bekor qilish",
    save: "Saqlash",
    profilePhotoAlt: "Profil rasmi",
    changePhoto: "Rasmni o'zgartirish",
    manager: "Menejer",
    contactInfo: "Aloqa Ma'lumotlari",
    email: "Email",
    phone: "Telefon",
    notProvided: "Kiritilmagan",
    center: "Markaz",
    learningCenter: "O'quv markazi",
    joinedYear: "Qo'shilgan yili",
  },
  en: {
    photoUpdated: "Photo updated!",
    photoUploadError: "Failed to upload the photo",
    photoDeleted: "Photo deleted!",
    deleteError: "Failed to delete",
    profileNotFound: "Profile not found.",
    cropTitle: "Crop Photo",
    cropPreviewAlt: "Crop preview",
    cancel: "Cancel",
    save: "Save",
    profilePhotoAlt: "Profile photo",
    changePhoto: "Change photo",
    manager: "Manager",
    contactInfo: "Contact Details",
    email: "Email",
    phone: "Phone",
    notProvided: "Not provided",
    center: "Center",
    learningCenter: "Learning center",
    joinedYear: "Year joined",
  },
  ru: {
    photoUpdated: "Фото обновлено!",
    photoUploadError: "Ошибка при загрузке фото",
    photoDeleted: "Фото удалено!",
    deleteError: "Ошибка при удалении",
    profileNotFound: "Профиль не найден.",
    cropTitle: "Обрезка фото",
    cropPreviewAlt: "Предпросмотр обрезки",
    cancel: "Отмена",
    save: "Сохранить",
    profilePhotoAlt: "Фото профиля",
    changePhoto: "Изменить фото",
    manager: "Менеджер",
    contactInfo: "Контактные данные",
    email: "Email",
    phone: "Телефон",
    notProvided: "Не указано",
    center: "Центр",
    learningCenter: "Учебный центр",
    joinedYear: "Год присоединения",
  },
};
type T = typeof TRANSLATIONS.uz;

function getInitials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "M";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function ManagerProfilePage() {
  const { user } = useAuth();
  const { lang } = useManagerLanguage();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;

  const [profile, setProfile] = useState<any>(null);
  const [centerName, setCenterName] = useState("");
  const [loading, setLoading] = useState(true);

  // Photo & cropper state — same flow as the teacher/student profile pages.
  const [isUploading, setIsUploading] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imgSrc, setImgSrc] = useState("");
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setProfile(data);
          if (data.centerId) {
            try {
              const centerSnap = await getDoc(doc(db, "centers", data.centerId));
              if (centerSnap.exists()) setCenterName(centerSnap.data().name || "");
            } catch { /* center name is cosmetic */ }
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const reader = new FileReader();
      reader.addEventListener("load", () => setImgSrc(reader.result?.toString() || ""));
      reader.readAsDataURL(file);
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const cropSize = Math.min(width, height) * 0.9;
    setCrop(centerCrop(makeAspectCrop({ unit: "px", width: cropSize }, 1, width, height), width, height));
  };

  const handleUploadCroppedImage = async () => {
    if (!completedCrop || !imgRef.current || !user || !selectedFile) return;

    setIsUploading(true);
    try {
      const canvas = document.createElement("canvas");
      const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
      const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

      let cropPixelWidth = completedCrop.width * scaleX;
      let cropPixelHeight = completedCrop.height * scaleY;

      // Smart compression thresholds — identical to the teacher/student pages.
      const originalKb = selectedFile.size / 1024;
      let outputQuality = 0.95;
      if (originalKb > 1024) {
        outputQuality = 0.75;
        if (cropPixelWidth > 800) {
          const ratio = 800 / cropPixelWidth;
          cropPixelWidth = 800;
          cropPixelHeight = cropPixelHeight * ratio;
        }
      } else if (originalKb > 200) {
        outputQuality = 0.85;
        if (cropPixelWidth > 1024) {
          const ratio = 1024 / cropPixelWidth;
          cropPixelWidth = 1024;
          cropPixelHeight = cropPixelHeight * ratio;
        }
      } else {
        outputQuality = 1.0;
      }

      canvas.width = cropPixelWidth;
      canvas.height = cropPixelHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No 2d context");

      ctx.drawImage(
        imgRef.current,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0, 0, canvas.width, canvas.height
      );

      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas is empty"))), "image/jpeg", outputQuality);
      });

      const storageRef = ref(storage, `profile_images/${user.uid}.jpg`);
      await uploadBytes(storageRef, blob);

      const downloadUrl = await getDownloadURL(storageRef);
      const finalUrl = `${downloadUrl}&t=${Date.now()}`;

      await updateDoc(doc(db, "users", user.uid), { photoURL: finalUrl });
      await updateProfile(user, { photoURL: finalUrl });

      setProfile((prev: any) => ({ ...prev, photoURL: finalUrl }));
      toast.success(t.photoUpdated);

      setImgSrc("");
      setSelectedFile(null);
    } catch (error) {
      console.error(error);
      toast.error(t.photoUploadError);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeletePhoto = async () => {
    if (!user) return;
    setIsUploading(true);
    try {
      try { await deleteObject(ref(storage, `profile_images/${user.uid}.jpg`)); } catch { /* ignore if missing */ }

      await updateDoc(doc(db, "users", user.uid), { photoURL: null });
      await updateProfile(user, { photoURL: "" });

      setProfile((prev: any) => ({ ...prev, photoURL: null }));
      setShowPhotoViewer(false);
      toast.success(t.photoDeleted);
    } catch (error) {
      console.error(error);
      toast.error(t.deleteError);
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spinner size={32} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl p-16 text-center text-on-surface-variant font-medium">
        {t.profileNotFound}
      </div>
    );
  }

  const joinYear = profile.createdAt
    ? (profile.createdAt.toDate ? new Date(profile.createdAt.toDate()).getFullYear() : new Date(profile.createdAt).getFullYear())
    : "-";

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* Hidden file input */}
      <input type="file" accept="image/jpeg, image/png, image/webp" ref={fileInputRef} className="hidden" onChange={onSelectFile} />

      {/* Cropper modal */}
      {imgSrc && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={() => !isUploading && setImgSrc("")}></div>
          <div className="relative bg-surface-container-lowest rounded-m3-xl p-6 max-w-md w-full shadow-elev-3 border border-outline-variant z-10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-on-surface">{t.cropTitle}</h3>
              <button onClick={() => setImgSrc("")} disabled={isUploading} className="text-on-surface-variant hover:text-on-surface transition-colors"><X size={20} /></button>
            </div>

            <div className="w-full max-h-[60vh] overflow-hidden bg-surface-container rounded-m3-md flex items-center justify-center mb-6">
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                circularCrop
                className="max-h-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img ref={imgRef} src={imgSrc} alt={t.cropPreviewAlt} onLoad={onImageLoad} className="max-h-[60vh] object-contain" />
              </ReactCrop>
            </div>

            <div className="flex gap-3 justify-end">
              <Button variant="tonal" onClick={() => setImgSrc("")} disabled={isUploading}>
                {t.cancel}
              </Button>
              <Button onClick={handleUploadCroppedImage} loading={isUploading} icon={<Check strokeWidth={3} />}>
                {t.save}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Hero card */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl p-6 md:p-8 shadow-elev-1 flex flex-col sm:flex-row items-center sm:items-start gap-6">

        {/* Avatar */}
        <div className="relative shrink-0">
          <div
            onClick={() => profile.photoURL && !isUploading ? setShowPhotoViewer(true) : null}
            className={`w-32 h-32 rounded-full p-1 t-gradient shadow-elev-2 relative overflow-hidden transition-transform duration-300 ${profile.photoURL ? "cursor-pointer hover:scale-[1.02]" : ""}`}
          >
            <div className="w-full h-full bg-surface-container-lowest rounded-full overflow-hidden flex items-center justify-center border-4 border-surface-container-lowest relative">
              {profile.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.photoURL} alt={t.profilePhotoAlt} className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-black bg-primary-container text-on-primary-container w-full h-full flex items-center justify-center">
                  {getInitials(profile.displayName)}
                </span>
              )}
              {isUploading && <div className="absolute inset-0 bg-scrim backdrop-blur-sm flex items-center justify-center"><Spinner size={28} /></div>}
            </div>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            title={t.changePhoto}
            className="absolute bottom-1 right-1 w-10 h-10 bg-primary text-on-primary rounded-full flex items-center justify-center border-4 border-surface-container-lowest shadow-elev-2 hover:shadow-elev-3 transition-transform active:scale-90 disabled:opacity-50 z-10"
          >
            <Camera size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Identity */}
        <div className="flex-1 text-center sm:text-left min-w-0">
          <h1 className="text-2xl md:text-[28px] font-black text-on-surface tracking-tight truncate">{profile.displayName || t.manager}</h1>
          {profile.username && <p className="text-on-surface-variant font-bold text-[14px] mt-0.5">@{profile.username}</p>}

          <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-container text-on-primary-container text-[12px] font-bold rounded-m3-md">
              <User size={13} /> {t.manager}
            </span>
            {centerName && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-container text-on-surface-variant text-[12px] font-bold rounded-m3-md">
                <Building2 size={13} /> {centerName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-surface-container-lowest p-6 rounded-m3-xl border border-outline-variant shadow-elev-1">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-tertiary-container rounded-m3-md flex items-center justify-center text-on-tertiary-container"><Mail size={19} /></div>
            <h3 className="font-black text-on-surface text-[15px]">{t.contactInfo}</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-1">{t.email}</p>
              <p className="flex items-center gap-2 text-on-surface font-bold text-[14px] truncate"><AtSign size={14} className="text-on-surface-variant shrink-0" /> {profile.email}</p>
            </div>
            <div className="h-px w-full bg-outline-variant"></div>
            <div>
              <p className="text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-1">{t.phone}</p>
              <p className="flex items-center gap-2 text-on-surface font-bold text-[14px]"><Phone size={14} className="text-on-surface-variant shrink-0" /> {profile.phone || <span className="text-on-surface-variant font-medium italic">{t.notProvided}</span>}</p>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-m3-xl border border-outline-variant shadow-elev-1">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-primary-container rounded-m3-md flex items-center justify-center text-on-primary-container"><Building2 size={19} /></div>
            <h3 className="font-black text-on-surface text-[15px]">{t.center}</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-1">{t.learningCenter}</p>
              <p className="text-on-surface font-bold text-[14px] truncate">{centerName || <span className="text-on-surface-variant font-medium italic">{t.notProvided}</span>}</p>
            </div>
            <div className="h-px w-full bg-outline-variant"></div>
            <div>
              <p className="text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-1">{t.joinedYear}</p>
              <p className="flex items-center gap-2 text-on-surface font-bold text-[14px]"><Calendar size={14} className="text-on-surface-variant shrink-0" /> {joinYear}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Full-screen photo viewer */}
      {showPhotoViewer && profile.photoURL && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={() => setShowPhotoViewer(false)}></div>
          <div className="relative w-full max-w-lg aspect-square rounded-m3-xl bg-inverse-surface overflow-hidden shadow-elev-3 border border-outline-variant">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={profile.photoURL} alt={t.profilePhotoAlt} className="w-full h-full object-cover" />
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-scrim to-transparent">
              <button onClick={() => setShowPhotoViewer(false)} className="w-10 h-10 rounded-full bg-surface-blur text-on-surface flex items-center justify-center hover:text-primary backdrop-blur-md transition-colors"><X size={20} strokeWidth={2.5} /></button>
              <button onClick={handleDeletePhoto} disabled={isUploading} className="w-10 h-10 rounded-full bg-surface-blur text-error hover:bg-error-container hover:text-on-error-container flex items-center justify-center backdrop-blur-md transition-colors disabled:opacity-50">
                {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} strokeWidth={2.5} />}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
