"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowLeft, Building2, Loader2, Plus, RefreshCw, User,
  CheckCircle, XCircle, Eye, EyeOff
} from "lucide-react";
import { adminApiFetch } from "@/lib/adminApi";
import { checkUsernameUnique } from "@/services/userService";

const validateUsernameFormat = (u: string) => {
  if (u.length < 5) return "Min 5 characters.";
  if (!/^[a-zA-Z]/.test(u)) return "Must start with a letter.";
  if (!/^[a-zA-Z0-9_]+$/.test(u)) return "Only a-z, 0-9, _ allowed.";
  return null;
};
const PHONE_REGEX = /^\+998\s?\d{2}\s?\d{3}\s?\d{2}\s?\d{2}$/;

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let pwd = "";
  const array = new Uint32Array(12);
  crypto.getRandomValues(array);
  for (let i = 0; i < 12; i++) pwd += chars[array[i] % chars.length];
  return pwd;
}

export default function AdminNewCenterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    centerName: "", centerSlug: "", size: "",
    managerDisplayName: "", username: "", managerEmail: "", managerPassword: "", phone: "",
  });

  // Live username availability (same pattern as the public signup flow).
  const [isCheckingUser, setIsCheckingUser] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const cache = useRef(new Map<string, boolean>());

  useEffect(() => {
    const input = form.username.trim().toLowerCase();
    setUsernameAvailable(null);
    setUsernameError(null);
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
      } catch {
        setUsernameAvailable(true);
      } finally {
        setIsCheckingUser(false);
      }
    }, 600);
    return () => clearTimeout(timeoutId);
  }, [form.username]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "centerName") {
      setForm((prev) => ({
        ...prev,
        centerName: value,
        centerSlug: prev.centerSlug && prev.centerSlug !== slugify(prev.centerName)
          ? prev.centerSlug
          : slugify(value),
      }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const slugify = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.centerName.trim() || !form.centerSlug.trim() || !form.size ||
        !form.managerDisplayName.trim() || !form.username.trim() ||
        !form.managerEmail.trim() || !form.managerPassword || !form.phone.trim()) {
      return toast.error("Fill in all fields.");
    }
    if (form.managerPassword.length < 8) return toast.error("Password must be at least 8 characters.");
    if (usernameError) return toast.error(usernameError);
    if (usernameAvailable === false) return toast.error("Username is taken.");
    if (!PHONE_REGEX.test(form.phone.trim())) return toast.error("Phone format: +998 XX XXX XX XX");

    setLoading(true);
    const loadingToast = toast.loading("Creating center and manager account...");
    try {
      const res = await adminApiFetch<{ centerId: string }>("/api/admin/centers", {
        method: "POST",
        body: form,
      });
      toast.success("Center created", { id: loadingToast });
      router.push(`/admin/centers/${res.centerId}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to create center.", { id: loadingToast });
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400 placeholder:font-medium";
  const labelClass = "block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2";

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12 p-6 md:p-10">

      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
        <Link href="/admin/centers" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-bold mb-4 text-sm">
          <ArrowLeft size={16} /> Back to Centers
        </Link>
        <h1 className="text-3xl font-black text-slate-900 mb-2">New Learning Center</h1>
        <p className="text-slate-500 font-medium text-sm">
          Creates the center and its manager account in one step. Share the credentials with the manager afterwards.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* CENTER INFO */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-5">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Building2 size={20} className="text-blue-600" /> Center Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Center Name</label>
              <input name="centerName" value={form.centerName} onChange={handleChange} placeholder="Everest Learning Center" className={inputClass} autoFocus />
            </div>
            <div>
              <label className={labelClass}>Slug</label>
              <input name="centerSlug" value={form.centerSlug} onChange={(e) => setForm((p) => ({ ...p, centerSlug: e.target.value.toLowerCase() }))} placeholder="everest-learning-center" className={`${inputClass} font-mono`} />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Center Size</label>
              <select name="size" value={form.size} onChange={handleChange} className={inputClass}>
                <option value="" disabled>Select expected student count</option>
                <option value="1-50">1-50 students</option>
                <option value="51-200">51-200 students</option>
                <option value="200-500">200-500 students</option>
                <option value="500+">500+ students</option>
              </select>
            </div>
          </div>
        </div>

        {/* MANAGER ACCOUNT */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-5">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <User size={20} className="text-indigo-600" /> Manager Account
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Full Name</label>
              <input name="managerDisplayName" value={form.managerDisplayName} onChange={handleChange} placeholder="Aziz Karimov" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Username</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">@</span>
                <input name="username" value={form.username} onChange={handleChange} placeholder="azizkarimov" className={`${inputClass} pl-9 pr-10`} />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                  {isCheckingUser ? <Loader2 className="animate-spin text-slate-400" size={18} />
                    : usernameError ? <XCircle className="text-rose-500" size={18} />
                    : usernameAvailable === true ? <CheckCircle className="text-emerald-500" size={18} />
                    : usernameAvailable === false ? <XCircle className="text-amber-500" size={18} />
                    : null}
                </div>
              </div>
              {usernameError && <p className="text-[11px] text-rose-500 font-bold mt-1.5">{usernameError}</p>}
              {usernameAvailable === false && <p className="text-[11px] text-amber-500 font-bold mt-1.5">Username is taken.</p>}
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input name="managerEmail" type="email" value={form.managerEmail} onChange={handleChange} placeholder="manager@example.com" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input name="phone" value={form.phone} onChange={handleChange} placeholder="+998 90 123 45 67" className={inputClass} />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Password</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    name="managerPassword"
                    type={showPassword ? "text" : "password"}
                    value={form.managerPassword}
                    onChange={handleChange}
                    placeholder="Min 8 characters"
                    className={`${inputClass} pr-11`}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => { setForm((p) => ({ ...p, managerPassword: generatePassword() })); setShowPassword(true); }}
                  className="shrink-0 inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200 transition-colors"
                >
                  <RefreshCw size={14} /> Generate
                </button>
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-1.5">
                Save the password now — it cannot be viewed later (a reset link can be generated from the center page).
              </p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || isCheckingUser || usernameError !== null || usernameAvailable === false}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-4 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Create Center &amp; Manager
        </button>
      </form>
    </div>
  );
}
