"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile, deleteUser } from "firebase/auth";
import { doc, getDoc, writeBatch } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { checkUsernameUnique } from "@/services/userService";
import { suggestUsername } from "@/lib/googleAuth";
import { getSsoReturnTo, completeSsoRedirect } from "@/lib/sso";
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { Step1Auth, Step2Profile } from "./FormSteps";

const validatePassword = (pwd: string) => { if (pwd.length < 8) return "Parol kamida 8 ta belgidan iborat bo'lishi kerak."; return null; };
const validateUsernameFormat = (u: string) => { if (!u) return null; if (u.length < 5) return "Min 5ta belgi."; if (!/^[a-zA-Z]/.test(u)) return "Harf bilan boshlanishi kerak."; if (!/^[a-zA-Z0-9_]+$/.test(u)) return "Faqat a-z, 0-9, _ ruxsat etiladi."; return null; };

// googleMode: the user is already authenticated via Google (complete-profile
// page) — step 1 (email/password) is skipped entirely and the account comes
// from auth.currentUser instead of createUserWithEmailAndPassword.
export default function StudentSignupFlow({ onBack, t, googleMode = false }: any) {
  const router = useRouter();
  const [step, setStep] = useState(googleMode ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Enterprise Username Checking State
  const [isCheckingUser, setIsCheckingUser] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const cache = useRef(new Map<string, boolean>());

  const [formData, setFormData] = useState(() => ({
    email: "", password: "",
    fullName: (googleMode && auth.currentUser?.displayName) || "",
    username: googleMode ? suggestUsername(auth.currentUser?.email ?? null) : "",
    gradeLevel: ""
  }));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
      if (!formData.fullName || !formData.username || !formData.gradeLevel) return toast.error(t.validation.fillAll);
      if (usernameError || usernameAvailable === false) return toast.error(t.validation.userTaken);
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

      // 🚀 TURBO STUDENT PAYLOAD
      batch.set(doc(db, "users", user.uid), {
        uid: user.uid,
        email: email,
        username: lowerUsername,
        // Google avatar; optional fields are built conditionally — never write undefined
        ...(user.photoURL ? { photoURL: user.photoURL } : {}),
        displayName: formData.fullName, 
        role: "student", 
        grade: formData.gradeLevel,
        
        // Progressive Profiling Empty Fields (Ensures app doesn't crash on nulls)
        phone: "", 
        birthDate: "", 
        gender: "", 
        institution: "",
        location: { country: "Uzbekistan", region: "", district: "" },
        
        // App Logic Defaults
        totalXP: 0, 
        currentStreak: 0, 
        level: 1, 
        dailyHistory: {},
        progress: { completedTopicIndex: 0, completedChapterIndex: 0, completedSubtopicIndex: 0 },
        createdAt: new Date().toISOString(),
      });

      batch.set(doc(db, "usernames", lowerUsername), { uid: user.uid });

      // Contact details live in an owner-only subcollection — the parent users/{uid}
      // doc is readable by every signed-in user (docs/AUTH.md). The `email` above is
      // a migration mirror and goes away with DEPLOY 2.
      batch.set(doc(db, "users", user.uid, "private", "contact"), {
        email: email,
        phone: "",
      });

      // Execute Write
      await batch.commit();

      toast.success(t.validation.welcome.replace("{role}", "O'quvchi"));
      // SSO: a partner app sent this user here — bounce back signed in
      const ssoReturnTo = getSsoReturnTo();
      if (ssoReturnTo && (await completeSsoRedirect(ssoReturnTo))) return;
      router.push("/dashboard");
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
          {googleMode ? t.steps.google.title : t.steps[step].title}
        </h1>
        <p className="text-slate-500 mt-2 font-medium">{googleMode ? t.steps.google.sub : t.steps[step].sub}</p>
        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-6 overflow-hidden">
          <div className="bg-blue-600 h-full transition-all duration-500 ease-out" style={{ width: `${googleMode ? 100 : step * 50}%` }}></div>
        </div>
      </div>

      {step === 1 && <Step1Auth formData={formData} handleChange={handleChange} showPassword={showPassword} setShowPassword={setShowPassword} t={t} />}
      {step === 2 && <Step2Profile formData={formData} handleChange={handleChange} usernameError={usernameError} usernameAvailable={usernameAvailable} isCheckingUser={isCheckingUser} role="student" t={t} />}

      <div className="flex gap-3 mt-8 pt-6 border-t border-slate-100">
        <button type="button" onClick={() => (step === 1 || googleMode) ? onBack() : setStep(1)} className="px-6 py-3.5 rounded-xl font-bold text-slate-500 bg-white border border-slate-200 shadow-sm flex items-center gap-2">
          <ArrowLeft size={18} /> {t.buttons.back}
        </button>
        <button type="submit" disabled={loading || isCheckingUser || usernameError !== null || usernameAvailable === false} className="flex-1 bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-sm hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
          {loading ? <Loader2 className="animate-spin" /> : step === 1 ? <>{t.buttons.next} <ArrowRight size={18} /></> : t.buttons.complete}
        </button>
      </div>
    </form>
  );
}