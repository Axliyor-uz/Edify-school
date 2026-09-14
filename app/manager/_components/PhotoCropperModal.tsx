"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";

const TRANSLATIONS = {
  uz: { title: "Rasmni Kesish", cancel: "Bekor qilish", save: "Saqlash", previewAlt: "Kesish uchun rasm" },
  en: { title: "Crop Photo", cancel: "Cancel", save: "Save", previewAlt: "Crop preview" },
  ru: { title: "Обрезка фото", cancel: "Отмена", save: "Сохранить", previewAlt: "Предпросмотр обрезки" },
};
type T = typeof TRANSLATIONS.uz;

interface Props {
  /** The raw image file the user picked. */
  file: File;
  /** Disable controls while the parent is uploading. */
  busy?: boolean;
  onCancel: () => void;
  /** Receives the cropped, compressed JPEG blob. */
  onSave: (blob: Blob) => void;
}

/**
 * Square/circular photo cropper — the same crop → canvas → smart-compress flow
 * used on the student/teacher/manager profile pages, extracted so the manager
 * info panels can reuse it for setting other users' photos.
 */
export default function PhotoCropperModal({ file, busy = false, onCancel, onSave }: Props) {
  const { lang } = useManagerLanguage();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [imgSrc, setImgSrc] = useState("");
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const reader = new FileReader();
    reader.addEventListener("load", () => setImgSrc(reader.result?.toString() || ""));
    reader.readAsDataURL(file);
  }, [file]);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const cropSize = Math.min(width, height) * 0.9;
    setCrop(centerCrop(makeAspectCrop({ unit: "px", width: cropSize }, 1, width, height), width, height));
  };

  const handleSave = async () => {
    if (!completedCrop || !imgRef.current) return;

    const canvas = document.createElement("canvas");
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

    let cropPixelWidth = completedCrop.width * scaleX;
    let cropPixelHeight = completedCrop.height * scaleY;

    // Smart compression thresholds — identical to the profile pages.
    const originalKb = file.size / 1024;
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
    if (!ctx) return;

    ctx.drawImage(
      imgRef.current,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0, 0, canvas.width, canvas.height
    );

    canvas.toBlob((blob) => { if (blob) onSave(blob); }, "image/jpeg", outputQuality);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={() => !busy && onCancel()}></div>
      <div className="relative bg-surface-container-lowest rounded-m3-xl p-6 max-w-md w-full shadow-elev-3 border border-outline-variant z-10">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-black text-on-surface">{t.title}</h3>
          <button onClick={onCancel} disabled={busy} className="text-on-surface-variant hover:text-on-surface transition-colors"><X size={20} /></button>
        </div>

        <div className="w-full max-h-[60vh] overflow-hidden bg-surface-container rounded-m3-md flex items-center justify-center mb-6">
          {imgSrc && (
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={1}
              circularCrop
              className="max-h-full"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={imgRef} src={imgSrc} alt={t.previewAlt} onLoad={onImageLoad} className="max-h-[60vh] object-contain" />
            </ReactCrop>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={busy} className="m3-interactive px-5 h-t-control text-[14px] font-bold text-on-surface bg-surface-container-high rounded-m3-btn transition-colors disabled:opacity-50">
            {t.cancel}
          </button>
          <button onClick={handleSave} disabled={busy || !completedCrop} className="m3-interactive px-6 h-t-control text-[14px] font-bold text-on-primary bg-primary rounded-m3-btn transition-colors shadow-elev-1 disabled:opacity-50 flex items-center gap-2">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />}
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
