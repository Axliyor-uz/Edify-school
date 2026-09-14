"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui";
import { useTeacherLanguage } from "@/app/teacher/layout";

const TRANSLATIONS: Record<string, any> = {
  uz: {
    download: "PDF Yuklab Olish",
    generating: "PDF Yaratilmoqda...",
    noContainer: "Preview oynasi topilmadi!",
    noPages: "Yuklab olish uchun sahifalar yo'q!",
    success: "PDF muvaffaqiyatli yuklandi!",
    error: "PDF yaratishda xatolik yuz berdi.",
  },
  en: {
    download: "Download PDF",
    generating: "Generating PDF...",
    noContainer: "Preview container not found!",
    noPages: "No pages to capture!",
    success: "PDF downloaded successfully!",
    error: "An error occurred while generating the PDF.",
  },
  ru: {
    download: "Скачать PDF",
    generating: "Создание PDF...",
    noContainer: "Окно предпросмотра не найдено!",
    noPages: "Нет страниц для сохранения!",
    success: "PDF успешно загружен!",
    error: "Произошла ошибка при создании PDF.",
  },
};

interface DownloadPdfButtonProps {
  targetRef: React.RefObject<HTMLDivElement>;
  fileName?: string;
  buttonText?: string;
}

// A4 at 96dpi: 210mm × 297mm → 794px × 1123px
const A4_W_PX = 794;
const A4_H_PX = 1123;

export default function DownloadPdfButton({
  targetRef,
  fileName = "Edify_Test_Document.pdf",
  buttonText,
}: DownloadPdfButtonProps) {
  const { lang } = useTeacherLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    setIsGenerating(true);

    try {
      const htmlToImage = await import("html-to-image");
      const { jsPDF } = await import("jspdf");

      const A4_W_MM = 210;
      const A4_H_MM = 297;

      const scaler = document.getElementById("preview-pages-scaler");
      if (!scaler) {
        toast.error(t.noContainer);
        return;
      }

      const previewPages = scaler.querySelectorAll<HTMLElement>(".a4-capture-page");
      if (previewPages.length === 0) {
        toast.error(t.noPages);
        return;
      }

      // Save original transform
      const origTransform = scaler.style.transform;
      const origTransformOrigin = scaler.style.transformOrigin;
      const origWidth = scaler.style.width;
      const origMinHeight = scaler.style.minHeight;

      // Reset zoom to 1:1
      scaler.style.transform = "scale(1)";
      scaler.style.transformOrigin = "top left";
      scaler.style.width = `${A4_W_PX}px`;
      scaler.style.minHeight = "auto";

      // Wait for layout
      await new Promise((resolve) => setTimeout(resolve, 400));

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      for (let i = 0; i < previewPages.length; i++) {
        const page = previewPages[i];

        // Temporarily remove shadow
        const origBoxShadow = page.style.boxShadow;
        page.style.boxShadow = "none";

        const imgData = await htmlToImage.toJpeg(page, {
          quality: 0.95,
          pixelRatio: 2,
          backgroundColor: "#ffffff",
          width: A4_W_PX,
          height: A4_H_PX,
          style: {
            margin: '0',
            transform: 'none',
          }
        });

        // Restore shadow
        page.style.boxShadow = origBoxShadow;

        if (i > 0) {
          pdf.addPage();
        }

        pdf.addImage(imgData, "JPEG", 0, 0, A4_W_MM, A4_H_MM);
      }

      // Restore original preview zoom
      scaler.style.transform = origTransform;
      scaler.style.transformOrigin = origTransformOrigin;
      scaler.style.width = origWidth;
      scaler.style.minHeight = origMinHeight;

      pdf.save(fileName);
      toast.success(t.success);
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error(t.error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      variant="outlined"
      size="lg"
      onClick={handleDownload}
      loading={isGenerating}
      icon={<Download />}
      className="w-full"
    >
      {isGenerating ? t.generating : (buttonText ?? t.download)}
    </Button>
  );
}