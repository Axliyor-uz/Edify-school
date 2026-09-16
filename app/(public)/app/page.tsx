import { Download, ShieldCheck, Smartphone, RefreshCw, Sparkles } from 'lucide-react';
import version from '@/public/app/version.json';

export const metadata = {
  title: 'Edify Manager — Android ilova',
  description: "O'quv markazi menejerlari uchun Edify Manager Android ilovasini yuklab oling.",
};


// Manager APK download page (docs/APP_DISTRIBUTION.md). The Android app's
// update gate sends users here; version info comes from public/app/version.json
// which deploys together with the APK, so page and file never disagree.
// Uzbek-only by design — the manager app itself is Uzbek-only.
const INSTALL_STEPS = [
  'Yuklab olish tugmasini bosing va APK fayl yuklanishini kuting.',
  "Yuklangan edify-manager.apk faylini oching (bildirishnomalar paneli yoki Fayllar ilovasi orqali).",
  "Agar so'ralsa, brauzeringiz uchun “Noma'lum ilovalarni o'rnatish” ruxsatini yoqing.",
  "“O'rnatish” tugmasini bosing. Yangilashda ma'lumotlaringiz saqlanib qoladi.",
];

export default function ManagerAppPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] px-4 py-16 sm:py-24">
      <div className="mx-auto w-full max-w-2xl">
        {/* Hero */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100 px-4 py-1.5 text-sm font-bold text-blue-700">
            <Smartphone className="h-4 w-4" />
            Android ilova
          </div>
          <h1 className="mt-4 text-4xl sm:text-5xl font-black text-slate-900">Edify Manager</h1>
          <p className="mt-3 text-[17px] text-slate-600">
            O&apos;quv markazi menejerlari uchun mobil ilova: guruhlar, davomat,
            o&apos;quvchilar va moliyani telefoningizdan boshqaring.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3 text-sm font-bold text-slate-500">
            <span>Versiya {version.versionName}</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>Android {version.minAndroid}+</span>
          </div>

          {/* Relative link (not version.apkUrl): downloads from whatever host
              serves this page, so it works before deploy and in local testing. */}
          <a
            href={`/app/edify-manager.apk?v=${version.versionCode}`}
            className="mt-8 inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-[17px] font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-600/30"
          >
            <Download className="h-5 w-5" />
            APK yuklab olish
          </a>
        </div>

        {/* What's new */}
        {version.changelog && (
          <div className="mt-12 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2 text-slate-900">
              <Sparkles className="h-5 w-5 text-blue-600" />
              <h2 className="font-bold">Nima yangiliklar</h2>
            </div>
            <p className="mt-2 text-[15px] text-slate-600">{version.changelog}</p>
          </div>
        )}

        {/* Install steps */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-bold text-slate-900">O&apos;rnatish tartibi</h2>
          <ol className="mt-4 space-y-3">
            {INSTALL_STEPS.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-black text-blue-700">
                  {i + 1}
                </span>
                <span className="text-[15px] text-slate-600">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Notes */}
        <div className="mt-6 space-y-3">
          <div className="flex items-start gap-3 rounded-xl bg-slate-50 border border-slate-100 p-4">
            <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
            <p className="text-sm text-slate-600">
              Yangi versiya chiqqanda ilova ochilishda o&apos;zi ogohlantiradi va sizni
              shu sahifaga olib keladi — qayta tekshirib yurish shart emas.
            </p>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-slate-50 border border-slate-100 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
            <p className="text-sm text-slate-600">
              Ilova faqat markaz menejerlari uchun — kirish uchun hisobingiz menejer
              roliga ega bo&apos;lishi kerak.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
