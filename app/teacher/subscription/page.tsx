'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Tag, ArrowLeft, Layout, Zap, Users, Bot, PhoneCall, Star, Send, Crown } from 'lucide-react';
import { PLANS_CONFIG, ACTIVE_PROMO, FEATURE_REGISTRY, FeatureKey } from './plansData';
import { useRouter } from 'next/navigation';
import { httpsCallable } from 'firebase/functions'; 
import { functions, auth, db } from '@/lib/firebase'; 
import { doc, onSnapshot } from 'firebase/firestore'; 
import { onAuthStateChanged } from 'firebase/auth'; 
import toast from 'react-hot-toast';
import { createPortal } from 'react-dom';

import { Button, ProgressBar, Spinner } from '@/components/ui';

// 🟢 GLOBAL LANGUAGE HOOK
import { useTeacherLanguage } from '@/app/teacher/layout';

// 🟢 TRANSLATION DICTIONARY
const TRANSLATIONS = {
  uz: {
    back: "Orqaga",
    loading: "Ma'lumotlar yuklanmoqda...",
    currentStatus: "Joriy Limitlar",
    activeClasses: "Sinflar",
    students: "O'quvchilar",
    aiRequests: "AI So'rovlar",
    renews: "Yangilanadi:",
    choosePlan: "Tarifni tanlang",
    monthly: "1 Oylik",
    sixMonth: "6 Oylik",
    discount: "Chegirma",
    activeBadge: "FAOL",
    saveBadge: "TEJANG",
    free: "BEPUL",
    currency: "so'm",
    currentPlanBtn: "Joriy Tarif",
    trialBtn: "30 Kun Bepul Sinash",
    purchaseBtn: "Tarifga O'tish",
    trialSuccessTitle: "Tabriklaymiz! 🎉",
    trialSuccessDesc: "Siz 30 kunlik Pro tarifini muvaffaqiyatli faollashtirdingiz. Barcha premium imkoniyatlardan 1 oy davomida bepul foydalanishingiz mumkin.",
    contactAdminTitle: "Tarifni Faollashtirish",
    contactAdminDesc: "Ushbu tarifni xarid qilish va hisobingizni faollashtirish uchun admin bilan Telegram orqali bog'laning.",
    selectedPlan: "Tanlangan Tarif:",
    telegramBtn: "Telegram orqali yozish",
    closeBtn: "Yopish",
    b2bTag: "B2B / Ta'lim markazlari",
    b2bTitle: "Maxsus Litsenziya",
    b2bDesc: "Maktablar va o'quv markazlari uchun. Cheklovsiz o'quvchilar va maxsus arzonlashtirilgan narxlar kafolatlanadi.",
    b2bBtn: "Admin bilan bog'lanish",
    unlimited: "Cheksiz"
  },
  ru: {
    back: "Назад",
    loading: "Загрузка...",
    currentStatus: "Текущие Лимиты",
    activeClasses: "Классы",
    students: "Ученики",
    aiRequests: "AI Запросы",
    renews: "Обновляется:",
    choosePlan: "Выберите тариф",
    monthly: "1 Месяц",
    sixMonth: "6 Месяцев",
    discount: "Скидка",
    activeBadge: "АКТИВЕН",
    saveBadge: "ЭКОНОМИЯ",
    free: "БЕСПЛАТНО",
    currency: "сум",
    currentPlanBtn: "Текущий тариф",
    trialBtn: "30 дней бесплатно",
    purchaseBtn: "Выбрать тариф",
    trialSuccessTitle: "Поздравляем! 🎉",
    trialSuccessDesc: "Вы успешно активировали тариф Pro на 30 дней. Пользуйтесь всеми премиум функциями бесплатно.",
    contactAdminTitle: "Активация тарифа",
    contactAdminDesc: "Для приобретения этого тарифа и активации аккаунта свяжитесь с администратором через Telegram.",
    selectedPlan: "Выбранный тариф:",
    telegramBtn: "Написать в Telegram",
    closeBtn: "Закрыть",
    b2bTag: "Для школ и центров",
    b2bTitle: "Специальная лицензия",
    b2bDesc: "Для школ и учебных центров. Неограниченное количество учеников и специальные скидки.",
    b2bBtn: "Связаться с админом",
    unlimited: "Безлимит"
  },
  en: {
    back: "Back",
    loading: "Loading...",
    currentStatus: "Current Limits",
    activeClasses: "Classes",
    students: "Students",
    aiRequests: "AI Requests",
    renews: "Renews:",
    choosePlan: "Choose a Plan",
    monthly: "1 Month",
    sixMonth: "6 Months",
    discount: "Discount",
    activeBadge: "ACTIVE",
    saveBadge: "SAVE",
    free: "FREE",
    currency: "UZS",
    currentPlanBtn: "Current Plan",
    trialBtn: "30 Days Free",
    purchaseBtn: "Upgrade Plan",
    trialSuccessTitle: "Congratulations! 🎉",
    trialSuccessDesc: "You have successfully activated the Pro plan for 30 days. Enjoy all premium features for free.",
    contactAdminTitle: "Plan Activation",
    contactAdminDesc: "To purchase this plan and activate your account, please contact the admin via Telegram.",
    selectedPlan: "Selected Plan:",
    telegramBtn: "Contact via Telegram",
    closeBtn: "Close",
    b2bTag: "Schools & B2B",
    b2bTitle: "Custom License",
    b2bDesc: "Designed for schools and educational centers. Unlimited students and special discounted prices.",
    b2bBtn: "Contact Admin",
    unlimited: "Unlimited"
  }
};

export default function SubscriptionPage() { 
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  
  // 🟢 USE GLOBAL LANGUAGE HOOK
  const { lang } = useTeacherLanguage();
  const t = TRANSLATIONS[lang as keyof typeof TRANSLATIONS] || TRANSLATIONS['uz'];

  const [isSixMonth, setIsSixMonth] = useState(false);
  const [isActivatingTrial, setIsActivatingTrial] = useState(false);
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 🟢 MODAL STATES
  const [trialSuccessModal, setTrialSuccessModal] = useState(false);
  const [purchaseModal, setPurchaseModal] = useState<{isOpen: boolean, planName: string, period: string}>({ isOpen: false, planName: "", period: "" });

  useEffect(() => {
    setMounted(true);
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const unsubscribeDb = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
          if (docSnap.exists()) {
            setCurrentUser({ id: docSnap.id, ...docSnap.data() });
          }
          setLoading(false);
        });
        return () => unsubscribeDb();
      } else {
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const plansArray = Object.values(PLANS_CONFIG);
  const allFeatureKeys = Object.keys(FEATURE_REGISTRY) as FeatureKey[];

  const formatNumber = (num: number) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  const hasUsedTrial = currentUser?.hasUsedTrial === true;
  const currentPlanId = currentUser?.subscription?.planId || 'free';
  const isActive = currentUser?.subscription?.status === 'active' || currentUser?.subscription?.status === 'trialing';

  const limits = currentUser?.currentLimits || { maxClasses: 1, maxStudents: 20, monthlyAiQuestions: 100 };
  const usage = currentUser?.usage || { activeClassCount: 0, totalStudents: 0, aiQuestionsUsed: 0, aiLimitResetDate: '' };
  
  const handleStartTrial = async () => {
    setIsActivatingTrial(true);
    try {
      const startFreeTrial = httpsCallable(functions, 'startFreeTrial');
      await startFreeTrial();
      setTrialSuccessModal(true); 
    } catch (error: any) {
      toast.error(error.message || "Error activating trial.");
    } finally {
      setIsActivatingTrial(false);
    }
  };

  const handlePurchaseClick = (planName: string) => {
    const period = isSixMonth ? t.sixMonth : t.monthly;
    setPurchaseModal({ isOpen: true, planName, period });
  };

  // M3 tier theming: free → neutral surfaces, pro → primary, vip → tertiary.
  const getTheme = (planId: string) => {
    switch(planId) {
      case 'pro': return {
        header: 'bg-primary text-on-primary',
        badge: 'bg-[color-mix(in_oklab,var(--m3-on-primary)_20%,transparent)] text-on-primary',
        discountChip: 'bg-on-primary text-primary',
        highlightBorder: 'border-2 border-primary shadow-elev-3'
      };
      case 'vip': return {
        header: 'bg-tertiary text-on-tertiary',
        badge: 'bg-[color-mix(in_oklab,var(--m3-on-tertiary)_20%,transparent)] text-on-tertiary',
        discountChip: 'bg-on-tertiary text-tertiary',
        highlightBorder: 'border-2 border-tertiary shadow-elev-3'
      };
      default: return {
        header: 'bg-surface-container-highest text-on-surface-variant',
        badge: 'bg-surface-container-lowest text-on-surface-variant',
        discountChip: 'bg-on-surface text-surface',
        highlightBorder: 'border border-outline-variant shadow-elev-1'
      };
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-surface flex flex-col items-center justify-center">
        <Spinner size={32} className="mb-3" />
        <p className="text-on-surface-variant font-bold text-sm">{t.loading}</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-surface font-t-body pb-20 selection:bg-primary-container selection:text-on-primary-container relative overflow-hidden">

      <div className="absolute top-0 inset-x-0 h-[40vh] bg-gradient-to-b from-surface-container to-transparent pointer-events-none z-0"></div>

      <AnimatePresence>
        {ACTIVE_PROMO && (
          <motion.div initial={{ y: -50 }} animate={{ y: 0 }} className="relative z-30 bg-primary text-on-primary py-2 px-3 text-center text-[11px] md:text-[13px] font-bold flex items-center justify-center gap-1.5 shadow-elev-1">
            <Tag size={14} className="animate-pulse" /> {ACTIVE_PROMO}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🟢 ULTRA-MINIMAL TOP BAR */}
      <div className="relative z-20 max-w-6xl mx-auto px-4 pt-4 md:pt-6">
        <button onClick={() => router.back()} className="m3-interactive flex items-center justify-center w-10 h-10 md:w-auto md:h-auto md:px-4 md:py-2 text-on-surface-variant hover:text-on-surface bg-surface-container-lowest rounded-full border border-outline-variant shadow-elev-1 transition-all active:scale-95">
          <ArrowLeft size={18} /> <span className="hidden md:block font-bold text-[13px] ml-1.5">{t.back}</span>
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-4 relative z-10 pt-4 md:pt-6">

        {/* 🟢 COMPACT LIMITS DASHBOARD */}
        <div className="mb-8 md:mb-12 bg-inverse-surface rounded-m3-lg p-4 md:p-6 shadow-elev-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-[color-mix(in_oklab,var(--m3-inverse-primary)_15%,transparent)] rounded-full blur-2xl pointer-events-none"></div>

          <h2 className="text-inverse-on-surface font-black text-[14px] md:text-[16px] mb-4 flex items-center gap-1.5">
            <Zap className="text-inverse-primary" size={16} /> {t.currentStatus}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 relative z-10">
            <UserUsageBar icon={<Layout size={12} />} label={t.activeClasses} used={usage.activeClassCount} limit={limits.maxClasses} t={t} />
            <UserUsageBar icon={<Users size={12} />} label={t.students} used={usage.totalStudents} limit={limits.maxStudents} t={t} />
            <UserUsageBar icon={<Bot size={12} />} label={t.aiRequests} used={usage.aiQuestionsUsed} limit={limits.monthlyAiQuestions} resetDate={usage.aiLimitResetDate} t={t} />
          </div>
        </div>
        
        {/* HEADER */}
        <div className="text-center max-w-2xl mx-auto mb-8 md:mb-12">
          <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-[22px] md:text-4xl font-black text-on-surface tracking-tight mb-5 leading-tight">
            {t.choosePlan}
          </motion.h1>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex items-center p-1 bg-surface-container-high rounded-m3-md backdrop-blur-sm">
            <button onClick={() => setIsSixMonth(false)} className={`px-4 py-2 md:px-6 md:py-2.5 rounded-m3-sm text-[12px] md:text-[13px] font-bold transition-all ${!isSixMonth ? 'bg-surface-container-lowest text-primary shadow-elev-1' : 'text-on-surface-variant'}`}>
              {t.monthly}
            </button>
            <button onClick={() => setIsSixMonth(true)} className={`px-4 py-2 md:px-6 md:py-2.5 rounded-m3-sm text-[12px] md:text-[13px] font-bold transition-all flex items-center gap-1.5 ${isSixMonth ? 'bg-surface-container-lowest text-primary shadow-elev-1' : 'text-on-surface-variant'}`}>
              {t.sixMonth}
              <span className={`text-[8px] md:text-[9px] uppercase px-1.5 py-0.5 rounded-m3-xs flex-shrink-0 font-black ${isSixMonth ? 'bg-primary text-on-primary' : 'bg-primary-container text-on-primary-container'}`}>{t.discount}</span>
            </button>
          </motion.div>
        </div>

        {/* PRICING CARDS (Ultra-Compact on Mobile) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6 mb-12">
          {plansArray.map((plan, index) => {
            const currentPricing = isSixMonth ? plan.pricing.sixMonth : plan.pricing.monthly;
            const finalPrice = currentPricing.price;
            const oldPrice = currentPricing.originalPrice || 0;
            const hasDiscount = oldPrice > finalPrice && !plan.pricing.isFree;
            const savings = oldPrice - finalPrice;
            const discountPercent = hasDiscount ? Math.round(((oldPrice - finalPrice) / oldPrice) * 100) : 0;
            
            const isHighlighted = (isSixMonth && plan.id === 'vip') || (!isSixMonth && plan.id === 'pro');
            const theme = getTheme(plan.id);

            const isCurrentPlan = currentPlanId === plan.id && isActive;
            const isTrialAvailable = plan.id === 'pro' && !hasUsedTrial && currentPlanId === 'free';
            
            let buttonText = plan.pricing.isFree ? plan.ui.buttonText : t.purchaseBtn;
            if (isCurrentPlan) buttonText = t.currentPlanBtn;
            else if (isTrialAvailable) buttonText = t.trialBtn;

            return (
              <motion.div 
                key={plan.id}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, type: 'spring', stiffness: 100 }}
                className={`relative bg-surface-container-low rounded-m3-lg transition-all flex flex-col overflow-hidden ${isHighlighted ? `${theme.highlightBorder} lg:-translate-y-2` : 'border border-outline-variant shadow-elev-1'}`}
              >
                <div className={`p-5 md:p-6 text-center relative ${theme.header}`}>
                  {(plan.ui.badge || hasDiscount || isCurrentPlan) && (
                    <div className={`absolute top-3 right-3 backdrop-blur-md text-[8px] md:text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-elev-1 ${theme.badge}`}>
                      {isCurrentPlan ? t.activeBadge : (hasDiscount ? `${discountPercent}% ${t.saveBadge}` : plan.ui.badge)}
                    </div>
                  )}

                  <h3 className="text-[15px] md:text-[17px] font-bold uppercase tracking-widest mb-3 opacity-90">{plan.ui.name}</h3>

                  <div className="flex flex-col items-center justify-center min-h-[70px] md:min-h-[80px]">
                    {plan.pricing.isFree ? (
                      <span className="text-3xl md:text-4xl font-black tracking-tight drop-shadow-sm">{t.free}</span>
                    ) : (
                      <>
                        {hasDiscount && !isCurrentPlan && (
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[11px] md:text-[12px] font-bold opacity-70 line-through">
                              {formatNumber(oldPrice)}
                            </span>
                            <span className={`text-[8px] md:text-[9px] font-black px-1.5 py-0.5 rounded-m3-xs uppercase ${theme.discountChip}`}>
                              -{formatNumber(savings)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-end justify-center gap-1">
                          <span className="text-3xl md:text-4xl font-black tracking-tight drop-shadow-sm leading-none">{formatNumber(finalPrice)}</span>
                        </div>
                        <span className="text-[10px] md:text-[11px] font-bold opacity-80 mt-1.5 block">{currentPricing.periodLabel}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-5 md:p-6 flex-1 flex flex-col">

                  <div className="space-y-3 mb-5 pb-5 border-b border-outline-variant">
                    <div className="flex justify-between items-center text-[11px] md:text-[12px]">
                      <span className="font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5"><Layout size={14}/> {t.activeClasses}</span>
                      <span className="font-black text-on-surface">{plan.displayLimits.classes}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] md:text-[12px]">
                      <span className="font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5"><Users size={14}/> {t.students}</span>
                      <span className="font-black text-on-surface">{plan.displayLimits.students}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] md:text-[12px]">
                      <span className="font-bold text-primary uppercase tracking-widest flex items-center gap-1.5"><Bot size={14}/> {t.aiRequests}</span>
                      <span className="font-black text-on-primary-container bg-primary-container px-2 py-0.5 rounded-m3-xs">{plan.displayLimits.aiQuestions}</span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3 mb-6">
                    {allFeatureKeys.map((featureKey) => {
                      const isIncluded = plan.includedFeatures.includes(featureKey);
                      const featureInfo = FEATURE_REGISTRY[featureKey];

                      return (
                        <div key={featureKey} className={`flex items-start gap-2.5 text-[11px] md:text-[12px] font-bold group ${isIncluded ? 'text-on-surface' : 'text-disabled-fg'}`}>
                          {isIncluded ? <CheckCircle2 size={16} className="text-success shrink-0" /> : <XCircle size={16} className="text-disabled-fg shrink-0" />}
                          <span className="leading-snug flex items-center gap-1">
                            {featureInfo.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {isCurrentPlan ? (
                    <Button variant="outlined" disabled className="w-full" icon={<Star />}>
                      {t.currentPlanBtn}
                    </Button>
                  ) : (
                    <Button
                      variant={isHighlighted ? 'filled' : 'tonal'}
                      className="w-full"
                      disabled={plan.pricing.isFree}
                      loading={isActivatingTrial && isTrialAvailable}
                      onClick={() => {
                        if (isTrialAvailable) {
                          handleStartTrial();
                        } else if (!plan.pricing.isFree) {
                          handlePurchaseClick(plan.ui.name);
                        }
                      }}
                    >
                      {buttonText}
                    </Button>
                  )}
                </div>

              </motion.div>
            );
          })}
        </div>

        {/* CUSTOM B2B BANNER */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-inverse-surface rounded-m3-lg p-6 md:p-10 shadow-elev-3 flex flex-col sm:flex-row items-center justify-between gap-5 relative overflow-hidden"
        >
          <div className="absolute right-0 top-0 w-60 h-60 bg-[color-mix(in_oklab,var(--m3-inverse-primary)_25%,transparent)] rounded-full blur-[80px] pointer-events-none"></div>

          <div className="relative z-10 text-center sm:text-left flex-1">
            <div className="inline-flex px-3 py-1 rounded-m3-xs bg-[color-mix(in_oklab,var(--m3-inverse-on-surface)_12%,transparent)] text-inverse-on-surface text-[9px] font-black uppercase tracking-widest mb-3">
              {t.b2bTag}
            </div>
            <h3 className="text-xl md:text-2xl font-black text-inverse-on-surface mb-2 tracking-tight">{t.b2bTitle}</h3>
            <p className="text-inverse-on-surface opacity-80 font-medium text-[12px] md:text-[13px] leading-relaxed mx-auto sm:mx-0 max-w-sm">
              {t.b2bDesc}
            </p>
          </div>

          <div className="relative z-10 w-full sm:w-auto shrink-0">
            <Button variant="elevated" icon={<PhoneCall />} onClick={() => window.open('https://t.me/Umidjon0339', '_blank')} className="w-full sm:w-auto">
              {t.b2bBtn}
            </Button>
          </div>
        </motion.div>

      </div>

      {/* ===================================================================== */}
      {/* 🟢 MODALS (PORTALIZED FOR Z-INDEX SAFETY)                             */}
      {/* ===================================================================== */}

      {mounted && createPortal(
        <AnimatePresence>
          {trialSuccessModal && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-scrim backdrop-blur-sm" />
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="relative bg-surface-container-low rounded-m3-xl p-6 w-full max-w-sm shadow-elev-3 z-10 flex flex-col items-center text-center overflow-hidden">
                <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-[color-mix(in_oklab,var(--m3-success)_20%,transparent)] rounded-full blur-[60px] pointer-events-none"></div>

                <div className="w-16 h-16 bg-success-container rounded-m3-lg flex items-center justify-center mb-4 relative z-10">
                  <Star size={32} className="fill-success text-success" />
                </div>

                <h3 className="text-[18px] font-black text-on-surface mb-2 relative z-10">{t.trialSuccessTitle}</h3>
                <p className="text-[12px] md:text-[13px] text-on-surface-variant mb-6 font-medium leading-relaxed relative z-10">
                  {t.trialSuccessDesc}
                </p>

                <Button variant="filled" className="w-full relative z-10" onClick={() => setTrialSuccessModal(false)}>
                  {t.closeBtn}
                </Button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {mounted && createPortal(
        <AnimatePresence>
          {purchaseModal.isOpen && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={() => setPurchaseModal({ isOpen: false, planName: "", period: "" })} />
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="relative bg-surface-container-low rounded-m3-xl p-6 w-full max-w-sm shadow-elev-3 z-10 flex flex-col items-center text-center">

                <div className="w-14 h-14 bg-primary-container rounded-m3-lg flex items-center justify-center mb-4">
                  <Crown size={24} className="text-on-primary-container" />
                </div>

                <h3 className="text-[16px] md:text-[18px] font-black text-on-surface mb-2">{t.contactAdminTitle}</h3>

                <div className="bg-surface-container border border-outline-variant w-full p-3 rounded-m3-md mb-4 text-left">
                  <p className="text-[9px] md:text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-1">{t.selectedPlan}</p>
                  <p className="text-[13px] md:text-[14px] font-bold text-primary">{purchaseModal.planName} • {purchaseModal.period}</p>
                </div>

                <p className="text-[11px] md:text-[12px] text-on-surface-variant mb-6 font-medium leading-relaxed">
                  {t.contactAdminDesc}
                </p>

                <div className="w-full flex flex-col gap-2">
                  <Button variant="filled" icon={<Send />} className="w-full" onClick={() => window.open('https://t.me/Umidjon0339', '_blank')}>
                    {t.telegramBtn}
                  </Button>
                  <Button variant="tonal" className="w-full" onClick={() => setPurchaseModal({ isOpen: false, planName: "", period: "" })}>
                    {t.closeBtn}
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

    </div>
  );
}

// 🟢 ULTRA-COMPACT USAGE BAR
function UserUsageBar({ icon, label, used, limit, resetDate, t }: any) {
  const isUnlimited = limit >= 5000;
  const percent = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);
  const isDanger = percent >= 90 && !isUnlimited;

  return (
    <div className="bg-surface-container-lowest p-3.5 md:p-4 rounded-m3-md shadow-elev-1 flex flex-col justify-between">
      <div className="flex justify-between items-center mb-2.5">
        <div className="flex items-center gap-1.5 text-on-surface-variant font-bold text-[10px] uppercase tracking-wider">
          {icon} <span className="truncate max-w-[80px] sm:max-w-full">{label}</span>
        </div>
        <div className="text-right flex items-baseline gap-0.5">
          <span className={`text-[15px] md:text-[18px] font-black leading-none tracking-tight ${isDanger ? 'text-error' : 'text-on-surface'}`}>
            {used}
          </span>
          <span className="text-on-surface-variant font-bold text-[10px]">
            {isUnlimited ? `/${t.unlimited}` : `/${limit}`}
          </span>
        </div>
      </div>

      {!isUnlimited && (
        <ProgressBar value={percent} tone={isDanger ? 'error' : 'primary'} />
      )}
      {isUnlimited && (
        <div className="w-full bg-secondary-container rounded-full h-1.5 overflow-hidden">
          <div className="w-full h-full bg-success-container"></div>
        </div>
      )}

      {resetDate && (
        <div className="text-[9px] font-medium text-on-surface-variant mt-1.5 truncate">
          {t.renews} {resetDate}
        </div>
      )}
    </div>
  );
}