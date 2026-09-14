"use client";

import { useState, useEffect } from "react";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CreditCard, Calendar, Save, Loader2, Bot, Zap, RotateCcw, Layout, Users, CheckSquare, Square } from "lucide-react";
import toast from "react-hot-toast";

// YOUR PLANS CONFIG
import { PLANS_CONFIG, FEATURE_REGISTRY, PlanId, FeatureKey } from "@/app/teacher/subscription/plansData";

const formatForInput = (ts: any) => {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
  
  // Safely extract local Year, Month, and Day to avoid UTC timezone shifts
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

export default function MembershipTab({ teacher, onUpdated }: any) {
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // 1. STATE INITIALIZATION
  const sub = teacher.subscription || {};
  const limits = teacher.currentLimits || {};
  const usage = teacher.usage || {};

  const [planId, setPlanId] = useState<PlanId | 'custom'>((sub.planId as PlanId) || teacher.planId || "free");
  const [billingCycle, setBillingCycle] = useState(sub.billingCycle || "monthly");
  const [status, setStatus] = useState(sub.status || teacher.subscriptionStatus || "active");
  const [expiresAt, setExpiresAt] = useState(formatForInput(sub.expiresAt || teacher.subscriptionEndsAt));

  const [maxClasses, setMaxClasses] = useState<number>(limits.maxClasses ?? 1);
  const [maxStudents, setMaxStudents] = useState<number>(limits.maxStudents ?? 20);
  const [monthlyAiQuestions, setMonthlyAiQuestions] = useState<number>(limits.monthlyAiQuestions ?? teacher.aiDailyQuestionLimit ?? 100);

  const [includedFeatures, setIncludedFeatures] = useState<FeatureKey[]>(teacher.includedFeatures || ['ONLINE_LIBRARY']);

  // 🟢 NEW: State for AI Reset Date
  const [aiResetDate, setAiResetDate] = useState(usage.aiLimitResetDate || "");

  // Read-Only Usage
  const usedClasses = usage.activeClassCount ?? teacher.activeClassCount ?? 0;
  const usedStudents = usage.totalStudents ?? teacher.totalStudents ?? 0;
  const usedAi = usage.aiQuestionsUsed ?? teacher.aiQuestionUsedToday ?? 0;

  // 2. SYNC EFFECT (Prevents React Stale State)
  useEffect(() => {
    const freshSub = teacher.subscription || {};
    const freshLimits = teacher.currentLimits || {};
    const freshUsage = teacher.usage || {};
    
    setPlanId((freshSub.planId as PlanId) || teacher.planId || "free");
    setBillingCycle(freshSub.billingCycle || "monthly");
    setStatus(freshSub.status || teacher.subscriptionStatus || "active");
    setExpiresAt(formatForInput(freshSub.expiresAt || teacher.subscriptionEndsAt));
    
    setMaxClasses(freshLimits.maxClasses ?? 1);
    setMaxStudents(freshLimits.maxStudents ?? 20);
    setMonthlyAiQuestions(freshLimits.monthlyAiQuestions ?? teacher.aiDailyQuestionLimit ?? 100);
    setIncludedFeatures(teacher.includedFeatures || ['ONLINE_LIBRARY']);
    
    // 🟢 NEW: Sync AI Reset Date
    setAiResetDate(freshUsage.aiLimitResetDate || "");
  }, [teacher]);

  // SMART AUTO-FILL
  const handlePlanChange = (newPlanId: PlanId | 'custom') => {
    setPlanId(newPlanId);
    
    if (newPlanId !== 'custom' && PLANS_CONFIG[newPlanId as PlanId]) {
      const plan = PLANS_CONFIG[newPlanId as PlanId];
      
      // 1. Limitlarni yangilash
      setMaxClasses(plan.limits.maxClasses);
      setMaxStudents(plan.limits.maxStudents);
      setMonthlyAiQuestions(plan.limits.monthlyAiQuestions);
      setIncludedFeatures(plan.includedFeatures);

      // 2. 🟢 SMART STATUS UPDATE
      // Agar admin qo'lda tarifni o'zgartirsa, status "Expired" bo'lsa uni "Active"ga qaytaramiz
      if (status === "expired" || status === "canceled" || status === "past_due") {
        setStatus("active");
      }

      // 3. Expiry Date mantiqi
      if (newPlanId === 'free') {
        setExpiresAt("");
      } else {
        // Agar pullik tarifga o'tsa va sana bo'sh bo'lsa, avtomatik 1 oy qo'shish (ixtiyoriy)
        if (!expiresAt) {
          const nextMonth = new Date();
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          setExpiresAt(nextMonth.toISOString().split('T')[0]);
        }
      }

      toast.success(`Loaded defaults for ${plan.ui.name}`);
    }
  };

  const toggleFeature = (featureKey: FeatureKey) => {
    setIncludedFeatures(prev => prev.includes(featureKey) ? prev.filter(f => f !== featureKey) : [...prev, featureKey]);
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      // Safe Date parsing to prevent Firebase crashes
      let validExpiryTimestamp = null;
      if (expiresAt && expiresAt.trim() !== "") {
        const dateObj = new Date(expiresAt);
        if (!isNaN(dateObj.getTime())) {
          validExpiryTimestamp = Timestamp.fromDate(dateObj);
        }
      }

      await updateDoc(doc(db, "users", teacher.id), {
        "subscription.planId": planId,
        "subscription.billingCycle": billingCycle,
        "subscription.status": status,
        "subscription.expiresAt": validExpiryTimestamp,
        "currentLimits.maxClasses": Number(maxClasses),
        "currentLimits.maxStudents": Number(maxStudents),
        "currentLimits.monthlyAiQuestions": Number(monthlyAiQuestions),
        "includedFeatures": includedFeatures,
        
        // 🟢 NEW: Save the AI Reset Date directly to the usage object
        "usage.aiLimitResetDate": aiResetDate
      });
      
      toast.success("Teacher SaaS Plan updated successfully!");
      onUpdated();
    } catch (error) { 
      toast.error("Failed to update membership."); 
      console.error(error);
    } 
    finally { setIsSaving(false); }
  };

  const handleResetAiUsage = async () => {
    if (!confirm("Are you sure you want to refund this teacher's AI usage to 0?")) return;
    setIsResetting(true);
    try {
      await updateDoc(doc(db, "users", teacher.id), { "usage.aiQuestionsUsed": 0 });
      toast.success("AI usage reset to 0!");
      onUpdated();
    } catch (error) { toast.error("Failed to reset usage."); } 
    finally { setIsResetting(false); }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      {/* 1. USAGE VS LIMITS OVERVIEW */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-slate-900 font-bold mb-6 flex items-center gap-2 text-lg">
          <Zap size={20} className="text-amber-500"/> Current Usage vs Limits
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <UsageBar icon={<Layout size={16}/>} label="Classes" used={usedClasses} limit={maxClasses} color="emerald" />
          <UsageBar icon={<Users size={16}/>} label="Students" used={usedStudents} limit={maxStudents} color="blue" />
          <UsageBar icon={<Bot size={16}/>} label="AI Questions" used={usedAi} limit={monthlyAiQuestions} color="indigo" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* 2. SUBSCRIPTION CONTROLS */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col">
          <h3 className="text-slate-900 font-bold flex items-center gap-2 mb-6 text-xl">
            <CreditCard size={22} className="text-indigo-600"/> Subscription State
          </h3>
          <div className="space-y-5 flex-1">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Base Plan</label>
              
              <select value={planId} onChange={e => handlePlanChange(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl p-3.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-bold text-sm transition-all">
                {Object.values(PLANS_CONFIG).map((plan) => (
                  <option key={plan.id} value={plan.id}>{plan.ui.name} ({plan.id.toUpperCase()})</option>
                ))}
                <option value="custom">Custom Override (B2B)</option>
              </select>

            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Cycle</label>
                <select value={billingCycle} onChange={e => setBillingCycle(e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl p-3.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-bold text-sm transition-all">
                  <option value="monthly">Monthly</option>
                  <option value="sixMonth">6-Months</option>
                  <option value="lifetime">Lifetime</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl p-3.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-bold text-sm transition-all">
                  <option value="active">Active</option>
                  <option value="trialing">Trialing</option>
                  <option value="past_due">Past Due</option>
                  <option value="canceled">Canceled</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Calendar size={14}/> Expiry Date</label>
              <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl p-3.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-mono text-sm transition-all"/>
            </div>
          </div>
        </div>

        {/* 3. LIMITS & FEATURES */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          <h3 className="text-slate-900 font-bold flex items-center gap-2 mb-6 text-xl">
            <Layout size={22} className="text-rose-500"/> Hard Limits & Entitlements
          </h3>
          <div className="space-y-4 mb-6">
            <LimitInput label="Max Classes" value={maxClasses} onChange={setMaxClasses} />
            <LimitInput label="Max Students" value={maxStudents} onChange={setMaxStudents} />
            <LimitInput label="Monthly AI Questions" value={monthlyAiQuestions} onChange={setMonthlyAiQuestions} />
            
            {/* 🟢 NEW: AI RESET DATE INPUT */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[13px] font-bold text-slate-600 pl-2 flex items-center gap-1.5">
                <RotateCcw size={14} className="text-slate-400"/> Next AI Reset Date
              </span>
              <input 
                type="date" 
                value={aiResetDate} 
                onChange={(e) => setAiResetDate(e.target.value)} 
                className="w-36 p-2 bg-white border border-slate-200 text-slate-900 rounded-lg text-sm font-black text-center outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all" 
              />
            </div>
          </div>
          <div className="pt-6 border-t border-slate-100">
             <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Enabled Features</label>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
               {(Object.keys(FEATURE_REGISTRY) as FeatureKey[]).map(key => {
                 const isEnabled = includedFeatures.includes(key);
                 return (
                   <div key={key} onClick={() => toggleFeature(key)} className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${isEnabled ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                     <div className="mt-0.5">{isEnabled ? <CheckSquare size={16} className="text-indigo-600" /> : <Square size={16} className="text-slate-400" />}</div>
                     <span className="text-xs font-bold leading-snug">{FEATURE_REGISTRY[key].label}</span>
                   </div>
                 )
               })}
             </div>
          </div>
        </div>
      </div>

      {/* 4. BOTTOM ACTION BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-200">
        <button onClick={handleResetAiUsage} disabled={isResetting} className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 text-sm font-bold border border-slate-200 hover:border-rose-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm">
          {isResetting ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />} Refund AI Usage
        </button>
        <button onClick={handleSaveAll} disabled={isSaving} className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all active:scale-95 flex justify-center items-center gap-2 disabled:opacity-50">
          {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save All Master Settings
        </button>
      </div>
    </div>
  );
}

// Subcomponents
function UsageBar({ icon, label, used, limit, color }: any) {
  const percent = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isDanger = percent >= 90;
  const colorMap: any = { 
    emerald: 'bg-emerald-500', 
    blue: 'bg-blue-500', 
    indigo: 'bg-indigo-500', 
    danger: 'bg-rose-500' 
  };
  return (
    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
      <div className="flex justify-between items-end mb-2.5">
        <div className="flex items-center gap-1.5 text-slate-500 font-bold text-[10px] uppercase tracking-wider">{icon} {label}</div>
        <div className="text-right"><span className={`text-xl font-black ${isDanger ? 'text-rose-600' : 'text-slate-900'}`}>{used}</span><span className="text-slate-400 font-bold text-sm"> / {limit >= 5000 ? '∞' : limit}</span></div>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${isDanger ? colorMap.danger : colorMap[color]}`} style={{ width: `${percent}%` }}></div>
      </div>
    </div>
  );
}

function LimitInput({ label, value, onChange }: any) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
      <span className="text-[13px] font-bold text-slate-600 pl-2">{label}</span>
      <input type="number" min="0" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-24 p-2 bg-white border border-slate-200 text-slate-900 rounded-lg text-sm font-black text-center outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all" />
    </div>
  );
}