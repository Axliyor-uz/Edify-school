"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile, deleteUser } from "firebase/auth";
import { doc, getDoc, writeBatch, collection } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { checkUsernameUnique } from "@/services/userService";
import { suggestUsername } from "@/lib/googleAuth";
import { getSsoReturnTo, completeSsoRedirect } from "@/lib/sso";
import { Loader2, ArrowRight, ArrowLeft, User, Phone, Building, Hash, FileText, ShieldCheck, CheckCircle, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { Step1Auth } from "./FormSteps";

const validatePassword = (pwd: string) => { if (pwd.length < 8) return "Parol kamida 8 ta belgidan iborat bo'lishi kerak."; return null; };
const validateUsernameFormat = (u: string) => { if (!u) return null; if (u.length < 5) return "Min 5ta belgi."; if (!/^[a-zA-Z]/.test(u)) return "Harf bilan boshlanishi kerak."; if (!/^[a-zA-Z0-9_]+$/.test(u)) return "Faqat a-z, 0-9, _ ruxsat etiladi."; return null; };
const validatePhone = (p: string) => {
  const phoneRegex = /^\+998\s?\d{2}\s?\d{3}\s?\d{2}\s?\d{2}$/;
  if (!phoneRegex.test(p)) return "Telefon formati: +998 XX XXX XX XX";
  return null;
};

// 🟢 MANAGER STEP 2: PERSONAL PROFILE
const Step2ManagerProfile = ({ formData, handleChange, usernameError, usernameAvailable, isCheckingUser, t }: any) => {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right">
      <div className="group relative">
        <User className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
        <input name="fullName" type="text" placeholder={t.inputs.fullname} required value={formData.fullName} onChange={handleChange} className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 focus:bg-white outline-none font-semibold transition text-[15px]" autoFocus />
      </div>

      <div className="relative group">
        <span className="absolute left-4 top-3.5 text-slate-400 font-bold group-focus-within:text-blue-500 transition-colors">@</span>
        <input name="username" type="text" placeholder={t.inputs.username} required value={formData.username} onChange={handleChange} className={`w-full pl-10 pr-10 py-3.5 rounded-xl border outline-none font-semibold text-[15px] transition text-slate-900 bg-slate-50 placeholder:text-slate-400 focus:bg-white focus:ring-4 ${usernameError ? "border-red-300 focus:border-red-500" : usernameAvailable === true ? "border-green-300 focus:border-green-500" : usernameAvailable === false ? "border-amber-300 focus:border-amber-500" : "border-slate-200 focus:border-blue-500"}`} />
        <div className="absolute right-4 top-3.5">
          {isCheckingUser ? <Loader2 className="animate-spin text-slate-400" size={20} /> : usernameError ? <XCircle className="text-red-500" size={20} /> : usernameAvailable === true ? <CheckCircle className="text-green-500" size={20} /> : usernameAvailable === false ? <XCircle className="text-amber-500" size={20} /> : null}
        </div>
        {usernameError && <p className="text-[11px] text-red-500 font-bold mt-1.5 ml-1">{usernameError}</p>}
        {usernameAvailable === false && <p className="text-[11px] text-amber-500 font-bold mt-1.5 ml-1">{t.validation.userTaken}</p>}
      </div>

      <div className="relative group">
        <Phone className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
        <input name="phone" type="tel" placeholder={t.inputs.phone || "+998 90 123 45 67"} required value={formData.phone} onChange={handleChange} className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 focus:bg-white outline-none font-semibold transition text-[15px]" />
      </div>
    </div>
  );
};

// 🟢 MANAGER STEP 3: CENTER PROFILE
const Step3CenterProfile = ({ formData, handleChange, setShowTerms, setShowPrivacy, t }: any) => {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right">
      <div className="group relative">
        <Building className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
        <input name="centerName" type="text" placeholder={t.inputs.centerName || "O'quv markazi nomi"} required value={formData.centerName} onChange={handleChange} className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 focus:bg-white outline-none font-semibold transition text-[15px]" autoFocus />
      </div>

      <div className="group relative">
        <Hash className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
        <input name="centerSlug" type="text" placeholder="center-slug" required value={formData.centerSlug} onChange={handleChange} className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 focus:bg-white outline-none font-semibold transition text-[15px]" />
      </div>

      <div className="relative group">
        <div className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors">
          <User size={20} />
        </div>
        <select name="studentCount" value={formData.studentCount} onChange={handleChange} required className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 focus:bg-white outline-none font-semibold text-[15px] transition appearance-none">
          <option value="" disabled>{t.inputs.studentCount || "O'quvchilar soni"}</option>
          <option value="1-50">1-50</option>
          <option value="51-200">51-200</option>
          <option value="200-500">200-500</option>
          <option value="500+">500+</option>
        </select>
      </div>

      <div className="flex items-start gap-3 mt-5 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
        <input type="checkbox" required id="terms-checkbox" className="mt-0.5 w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shadow-sm" />
        <label htmlFor="terms-checkbox" className="text-[13px] font-medium text-slate-600 leading-relaxed cursor-pointer select-none">
          {t.terms.text1}
          <button type="button" onClick={(e) => { e.preventDefault(); setShowTerms(true); }} className="text-blue-600 font-bold hover:text-blue-800 hover:underline underline-offset-2 transition-colors">
            {t.terms.link1}
          </button>
          {t.terms.text2}
          <button type="button" onClick={(e) => { e.preventDefault(); setShowPrivacy(true); }} className="text-blue-600 font-bold hover:text-blue-800 hover:underline underline-offset-2 transition-colors">
            {t.terms.link2}
          </button>
          {t.terms.text3}
        </label>
      </div>
    </div>
  );
};

// googleMode: the user is already authenticated via Google (complete-profile
// page) — step 1 (email/password) is skipped, making this a 2-step wizard
// (profile → center); the account comes from auth.currentUser.
export default function ManagerSignupFlow({ onBack, t, googleMode = false }: any) {
  const router = useRouter();
  const [step, setStep] = useState(googleMode ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Modals for Terms and Privacy
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  // Enterprise Username Checking State
  const [isCheckingUser, setIsCheckingUser] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const cache = useRef(new Map<string, boolean>());

  const [formData, setFormData] = useState(() => ({
    email: "", password: "",
    fullName: (googleMode && auth.currentUser?.displayName) || "",
    username: googleMode ? suggestUsername(auth.currentUser?.email ?? null) : "",
    phone: "",
    centerName: "", centerSlug: "", studentCount: ""
  }));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Auto-generate slug when center name changes
    if (name === "centerName" && !formData.centerSlug) {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        centerSlug: value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Debounced Username Check
  useEffect(() => {
    const input = formData.username.trim().toLowerCase();
    setUsernameAvailable(null); setUsernameError(null);
    if (!input) return;

    const error = validateUsernameFormat(input);
    if (error) return setUsernameError(error);

    if (cache.current.has(input)) {
      setUsernameAvailable(cache.current.get(input)!);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsCheckingUser(true);
      try {
        const isUnique = await checkUsernameUnique(input);
        cache.current.set(input, isUnique);
        setUsernameAvailable(isUnique);
      } catch (err) { setUsernameAvailable(true); } 
      finally { setIsCheckingUser(false); }
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [formData.username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      if (!formData.email || !formData.password) return toast.error(t.validation.fillAll);
      const pwdError = validatePassword(formData.password);
      if (pwdError) return toast.error(pwdError);
      setStep(2);
      return;
    }
    
    if (step === 2) {
      if (!formData.fullName || !formData.username || !formData.phone) return toast.error(t.validation.fillAll);
      if (usernameError || usernameAvailable === false) return toast.error(t.validation.userTaken);
      const phoneErr = validatePhone(formData.phone);
      if (phoneErr) return toast.error(phoneErr);
      setStep(3);
      return;
    }
    
    if (step === 3) {
      if (!formData.centerName || !formData.centerSlug || !formData.studentCount) return toast.error(t.validation.fillAll);
      await handleSignup();
    }
  };

  const handleSignup = async () => {
    setLoading(true);
    let user = null;
    try {
      let email: string;
      if (googleMode) {
        user = auth.currentUser;
        if (!user) { toast.error("Sessiya tugadi. Qaytadan kiring."); router.push("/auth/login"); return; }
        // A profile may already exist (merged Google/password account, stale
        // tab). Overwriting it would reset XP/role data — redirect instead.
        const existing = await getDoc(doc(db, "users", user.uid));
        if (existing.exists()) {
          const role = existing.data().role;
          toast.success("Bu hisob allaqachon ro'yxatdan o'tgan.");
          router.push(role === "teacher" ? "/teacher/dashboard" : role === "manager" ? "/manager/dashboard" : "/dashboard");
          return;
        }
        email = user.email || "";
        await updateProfile(user, { displayName: formData.fullName });
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        user = userCredential.user;
        email = formData.email;
        await updateProfile(user, { displayName: formData.fullName });
      }

      const batch = writeBatch(db);
      const lowerUsername = formData.username.toLowerCase();
      
      const centerRef = doc(collection(db, 'centers'));
      const centerId = centerRef.id;

      // 1. Center Payload
      batch.set(centerRef, {
        id: centerId,
        name: formData.centerName,
        slug: formData.centerSlug,
        ownerUid: user.uid,
        size: formData.studentCount,
        // New centers wait for super-admin approval; rules enforce 'pending' here.
        status: "pending",
        subscription: {
          plan: "free_trial",
          validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        },
        createdAt: new Date().toISOString()
      });

      // 2. Manager User Payload
      batch.set(doc(db, "users", user.uid), {
        uid: user.uid,
        email: email,
        username: lowerUsername,
        displayName: formData.fullName,
        // Google avatar; optional fields are built conditionally — never write undefined
        ...(user.photoURL ? { photoURL: user.photoURL } : {}),
        phone: formData.phone,
        role: "manager",
        centerId: centerId,
        createdAt: new Date().toISOString(),
      });

      // 3. Username Payload
      batch.set(doc(db, "usernames", lowerUsername), { uid: user.uid });

      // 4. Contact details — owner-only subcollection, because the parent users/{uid}
      // doc is readable by every signed-in user (docs/AUTH.md). The email/phone above
      // are a migration mirror and go away with DEPLOY 2.
      batch.set(doc(db, "users", user.uid, "private", "contact"), {
        email: email,
        phone: formData.phone,
      });

      // Execute Write
      await batch.commit();

      toast.success(t.validation.welcome.replace("{role}", "Menejer"));
      // SSO: a partner app sent this user here — bounce back signed in
      const ssoReturnTo = getSsoReturnTo();
      if (ssoReturnTo && (await completeSsoRedirect(ssoReturnTo))) return;
      router.push("/manager/dashboard");
    } catch (error: any) {
      console.error("signup failed:", error);
      // 🛡️ Rollback auth if database write fails. Google accounts pre-exist and
      // onboarding is resumable (complete-profile), so never delete them.
      if (!googleMode && user && auth.currentUser) await deleteUser(auth.currentUser);
      // permission-denied at signup ≈ the immutable usernames/{name} doc already
      // exists — the availability check fails open on network errors (docs/AUTH.md)
      toast.error(
        error.code === "auth/email-already-in-use" ? "Bu email band qilingan."
        : error.code === "permission-denied" ? t.validation.userTaken
        : "Xatolik yuz berdi."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          {step === 3 ? "Markaz profilini yarating" : googleMode ? t.steps.google.title : t.steps[step].title}
        </h1>
        <p className="text-slate-500 mt-2 font-medium">
          {googleMode ? `${step - 1} / 2 qadam` : `${step} / 3 qadam`}
        </p>
        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-6 overflow-hidden">
          <div className="bg-blue-600 h-full transition-all duration-500 ease-out" style={{ width: `${googleMode ? ((step - 1) / 2) * 100 : (step / 3) * 100}%` }}></div>
        </div>
      </div>

      {step === 1 && <Step1Auth formData={formData} handleChange={handleChange} showPassword={showPassword} setShowPassword={setShowPassword} t={t} />}
      {step === 2 && <Step2ManagerProfile formData={formData} handleChange={handleChange} usernameError={usernameError} usernameAvailable={usernameAvailable} isCheckingUser={isCheckingUser} t={t} />}
      {step === 3 && <Step3CenterProfile formData={formData} handleChange={handleChange} setShowTerms={setShowTerms} setShowPrivacy={setShowPrivacy} t={t} />}

      <div className="flex gap-3 mt-8 pt-6 border-t border-slate-100">
        <button type="button" onClick={() => (step === 1 || (googleMode && step === 2)) ? onBack() : setStep(step - 1)} className="px-6 py-3.5 rounded-xl font-bold text-slate-500 bg-white border border-slate-200 shadow-sm flex items-center gap-2">
          <ArrowLeft size={18} /> {t.buttons.back}
        </button>
        <button type="submit" disabled={loading || isCheckingUser || usernameError !== null || usernameAvailable === false} className="flex-1 bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-sm hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
          {loading ? <Loader2 className="animate-spin" /> : step < 3 ? <>{t.buttons.next} <ArrowRight size={18} /></> : t.buttons.complete}
        </button>
      </div>
    </form>
  );
}
