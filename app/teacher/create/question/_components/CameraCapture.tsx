"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, RefreshCw, RotateCcw } from "lucide-react";

import { useTeacherLanguage } from "@/app/teacher/layout";
import { Button, Dialog, Spinner } from "@/components/ui";

/**
 * Takes ONE photo with the device camera and hands it back as a `File`, exactly
 * as if it had been picked from disk.
 *
 * Why it exists: a teacher writing a question is usually looking at the question
 * on paper — a textbook, a board, a printed variant. "Save the photo to the
 * phone, then find it in the picker" is three steps for something the camera can
 * do in one.
 *
 * ⚠️ **The shot is DOWNSCALED before it leaves this component** (long edge
 * {@link MAX_EDGE}px, JPEG). A modern phone camera returns 4–12 MB per frame,
 * which is over `MAX_IMAGE_BYTES` and would be refused — and every one of these
 * files is uploaded to Storage and then fetched by every student sitting the
 * paper. ~200 KB renders identically at question size.
 *
 * ⚠️ `getUserMedia` needs a **secure context** (https, or localhost). On plain
 * http the button falls back to the OS camera app — see ImagePicker, which owns
 * that fallback because it owns the file input.
 */

/** Long edge of the saved photo, in pixels. Text on a board stays readable. */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

type Facing = "environment" | "user";

const TR = {
  uz: {
    title: "Kamera",
    desc: "Savolni rasmga oling — telefon galereyasiga saqlash shart emas.",
    starting: "Kamera ishga tushmoqda…",
    shoot: "Suratga olish",
    retake: "Qayta olish",
    use: "Ishlatish",
    flip: "Kamerani almashtirish",
    cancel: "Bekor qilish",
    denied: "Kameraga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering yoki rasmni fayldan yuklang.",
    missing: "Kamera topilmadi. Rasmni fayldan yuklang.",
    failed: "Kamerani ochib bo'lmadi. Rasmni fayldan yuklang.",
  },
  ru: {
    title: "Камера",
    desc: "Сфотографируйте вопрос — сохранять в галерею не нужно.",
    starting: "Камера запускается…",
    shoot: "Снять",
    retake: "Переснять",
    use: "Использовать",
    flip: "Сменить камеру",
    cancel: "Отмена",
    denied: "Доступ к камере запрещён. Разрешите его в настройках браузера или загрузите файл.",
    missing: "Камера не найдена. Загрузите изображение файлом.",
    failed: "Не удалось открыть камеру. Загрузите изображение файлом.",
  },
  en: {
    title: "Camera",
    desc: "Photograph the question — no need to save it to the gallery first.",
    starting: "Starting the camera…",
    shoot: "Take photo",
    retake: "Retake",
    use: "Use this",
    flip: "Switch camera",
    cancel: "Cancel",
    denied: "Camera access was denied. Allow it in your browser settings, or upload a file instead.",
    missing: "No camera found. Upload an image file instead.",
    failed: "Could not open the camera. Upload an image file instead.",
  },
};

interface Props {
  open: boolean;
  onClose: () => void;
  /** The captured photo, ready to be previewed and uploaded on save. */
  onCapture: (file: File) => void;
}

export default function CameraCapture({ open, onClose, onCapture }: Props) {
  const { lang } = useTeacherLanguage();
  const t = TR[lang as keyof typeof TR] || TR.uz;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facing, setFacing] = useState<Facing>("environment");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canFlip, setCanFlip] = useState(false);
  /** The frozen shot awaiting "use" / "retake". Null ⇒ the live view is up. */
  const [shot, setShot] = useState<{ file: File; url: string } | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  // The live view runs only while the dialog is open AND nothing is frozen —
  // a camera left streaming behind a preview keeps the indicator light on and
  // drains the battery for nothing.
  useEffect(() => {
    if (!open || shot) return;

    let cancelled = false;
    setStarting(true);
    setError(null);

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Safari rejects the promise when the element is re-bound mid-play;
          // there is nothing to do about it and nothing to report.
          videoRef.current.play().catch(() => {});
        }
        // Only offer the flip when there is something to flip TO — a laptop with
        // one webcam must not show a button that can only fail.
        navigator.mediaDevices
          .enumerateDevices()
          .then((devices) => {
            if (!cancelled) setCanFlip(devices.filter((d) => d.kind === "videoinput").length > 1);
          })
          .catch(() => {});
      } catch (err) {
        if (cancelled) return;
        const name = (err as DOMException)?.name;
        setError(name === "NotAllowedError" || name === "SecurityError" ? t.denied
          : name === "NotFoundError" || name === "OverconstrainedError" ? t.missing
          : t.failed);
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, shot, facing, stopStream, t]);

  // Closing (or unmounting) must never leave the camera on.
  useEffect(() => {
    if (open) return;
    stopStream();
    setShot((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setError(null);
  }, [open, stopStream]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // ⚠️ Drawn UNMIRRORED even when the front camera's preview is mirrored: the
    // preview is mirrored so the teacher can aim, but a photo of a page must
    // come out readable.
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) { setError(t.failed); return; }
        const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
        // Freezing the shot stops the stream through the effect above.
        setShot({ file, url: URL.createObjectURL(file) });
      },
      "image/jpeg",
      JPEG_QUALITY,
    );
  };

  const retake = () => {
    setShot((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  };

  const use = () => {
    if (!shot) return;
    onCapture(shot.file);
    // The caller previews from its own object URL; this one is ours to release.
    URL.revokeObjectURL(shot.url);
    setShot(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t.title}
      description={t.desc}
      className="max-w-2xl"
      actions={
        <>
          <Button variant="text" onClick={onClose}>{t.cancel}</Button>
          {shot ? (
            <>
              <Button variant="tonal" icon={<RotateCcw />} onClick={retake}>{t.retake}</Button>
              <Button variant="filled" icon={<Check />} onClick={use}>{t.use}</Button>
            </>
          ) : (
            <Button variant="filled" icon={<Camera />} onClick={capture} disabled={starting || !!error}>
              {t.shoot}
            </Button>
          )}
        </>
      }
    >
      <div className="mt-4 overflow-hidden rounded-m3-lg border border-outline-variant bg-black">
        <div className="relative aspect-video w-full">
          {shot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shot.url} alt="" className="h-full w-full object-contain" />
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`h-full w-full object-contain ${facing === "user" ? "scale-x-[-1]" : ""}`}
            />
          )}

          {!shot && starting && (
            <div className="absolute inset-0 grid place-items-center gap-2 bg-black/60 text-white">
              <Spinner size={26} />
              <span className="text-[12px] font-bold">{t.starting}</span>
            </div>
          )}

          {!shot && error && (
            <div className="absolute inset-0 grid place-items-center bg-black/75 p-6 text-center">
              <p className="text-[13px] font-bold leading-relaxed text-white">{error}</p>
            </div>
          )}

          {!shot && !error && canFlip && (
            <button
              type="button"
              aria-label={t.flip}
              onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
              className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75"
            >
              <RefreshCw size={16} />
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
