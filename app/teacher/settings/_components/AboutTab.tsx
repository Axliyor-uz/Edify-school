'use client';

import { Phone, Send, Github, Linkedin } from 'lucide-react';

export default function AboutTab({ t }: { t: any }) {
  return (
    <div className="bg-surface-container-low rounded-m3-lg overflow-hidden shadow-elev-1 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* 🟢 PREMIUM HERO HEADER */}
      <div className="relative h-56 bg-inverse-surface overflow-hidden shrink-0 flex items-center justify-center">
        <div className="absolute top-0 right-0 w-72 h-72 bg-primary rounded-full mix-blend-screen filter blur-[64px] opacity-40 -translate-y-1/2 translate-x-1/3 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-tertiary rounded-full mix-blend-screen filter blur-[64px] opacity-40 translate-y-1/3 -translate-x-1/3"></div>

        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-surface-container-lowest rounded-m3-xl flex items-center justify-center shadow-elev-3 mb-4 rotate-3 hover:rotate-0 transition-transform">
              <span className="text-3xl font-black bg-gradient-to-br from-primary to-tertiary bg-clip-text text-transparent">E</span>
          </div>
          <h2 className="text-3xl font-black text-inverse-on-surface tracking-tight">Edify<span className="text-inverse-primary">Teacher</span></h2>
          <p className="text-inverse-on-surface opacity-60 text-[10px] font-black mt-1.5 uppercase tracking-widest">{t.about.title}</p>
        </div>
      </div>

      <div className="p-8 md:p-10">
        <div className="mb-12 text-center max-w-2xl mx-auto">
            <h3 className="text-[18px] font-black text-on-surface mb-3">{t.about.descTitle}</h3>
            <p className="text-on-surface-variant font-medium text-[14px] leading-relaxed">{t.about.desc}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* SUPPORT CONTACTS */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-black text-on-surface-variant uppercase tracking-widest flex items-center gap-2 mb-2">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full"></span> {t.about.support}
              </h3>

              <a href="https://t.me/Umidjon0339" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-4 p-4 rounded-m3-lg border border-outline-variant bg-surface-container-lowest hover:shadow-elev-2 hover:border-outline transition-all duration-300">
                  <div className="w-12 h-12 rounded-m3-md flex items-center justify-center shadow-elev-1 text-on-primary bg-primary group-hover:scale-110 transition-transform duration-300">
                    <Send size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-0.5">Telegram</p>
                    <p className="text-[14px] font-bold text-on-surface group-hover:text-primary transition-colors">@Umidjon0339</p>
                  </div>
              </a>

              <div className="group flex items-center gap-4 p-4 rounded-m3-lg border border-outline-variant bg-surface-container-lowest hover:shadow-elev-2 hover:border-outline transition-all duration-300 cursor-default">
                  <div className="w-12 h-12 rounded-m3-md flex items-center justify-center shadow-elev-1 text-on-tertiary bg-tertiary group-hover:scale-110 transition-transform duration-300">
                    <Phone size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-0.5">{t.about.hotline}</p>
                    <p className="text-[14px] font-bold text-on-surface group-hover:text-tertiary transition-colors">+998 33 860 20 06</p>
                  </div>
              </div>
            </div>

            {/* DEVELOPER LINKS */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-black text-on-surface-variant uppercase tracking-widest flex items-center gap-2 mb-2">
                  <span className="w-1.5 h-1.5 bg-tertiary rounded-full"></span> {t.about.dev}
              </h3>

              <a href="https://github.com/Wasp-2-AI" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-4 p-4 rounded-m3-lg border border-outline-variant bg-surface-container-lowest hover:shadow-elev-2 hover:border-outline transition-all duration-300">
                  <div className="w-12 h-12 rounded-m3-md flex items-center justify-center shadow-elev-1 text-inverse-on-surface bg-inverse-surface group-hover:scale-110 transition-transform duration-300">
                    <Github size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-0.5">GitHub</p>
                    <p className="text-[14px] font-bold text-on-surface transition-colors">Wasp-2-AI</p>
                  </div>
              </a>

              <a href="https://www.linkedin.com/company/wasp-2-ai" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-4 p-4 rounded-m3-lg border border-outline-variant bg-surface-container-lowest hover:shadow-elev-2 hover:border-outline transition-all duration-300">
                  <div className="w-12 h-12 rounded-m3-md flex items-center justify-center shadow-elev-1 text-on-primary bg-primary group-hover:scale-110 transition-transform duration-300">
                    <Linkedin size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-0.5">LinkedIn</p>
                    <p className="text-[14px] font-bold text-on-surface group-hover:text-primary transition-colors">WASP-2 AI Solutions</p>
                  </div>
              </a>
            </div>
        </div>

        <div className="mt-10 text-center pt-6 border-t border-outline-variant">
            <p className="text-[12px] font-bold text-on-surface-variant">{t.about.version}</p>
            <p className="text-[10px] font-medium text-on-surface-variant mt-1 uppercase tracking-widest">© 2026 WASP-2 AI Solutions. {t.about.rights}</p>
        </div>
      </div>
    </div>
  );
}