"use client";

/**
 * ADMIN → Center → Office staff (docs/OFFICE.md).
 *
 * Provision and revoke the center's **director** and **buxgalter** accounts.
 * This is the ONLY place either account can be created: a director outranks the
 * center manager, so the manager must not be able to appoint their own
 * oversight. Everything here goes through `/api/admin/centers/{id}/staff`
 * (Admin SDK, `requireSuperAdmin`) — `center_staff` is `write: if false` for
 * every client, god mode included in practice.
 *
 * ⚠️ The generated login email is synthetic (`f.surname@edify.uz`) and has NO
 * INBOX, so a password-reset email can never arrive. That is why the password
 * is stored in `center_staff_credentials` and shown here: the super admin is
 * the recovery path, exactly as the manager is for center-created teachers.
 */

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Briefcase, Check, Copy, Eye, EyeOff, KeyRound, Loader2, Plus,
  ShieldCheck, Trash2, UserCog, X,
} from "lucide-react";
import { adminApiFetch } from "@/lib/adminApi";
import type { CenterDetailData } from "@/services/centerAdminService";
import {
  generateFriendlyPassword,
  suggestTeacherEmail,
  suggestTeacherUsername,
} from "@/lib/teacherProvision";
import { OFFICE_ROLES, type OfficeRole } from "@/types/office";

interface StaffRow {
  uid: string;
  centerId: string;
  staffRole: OfficeRole;
  name: string;
  email: string;
  username: string;
  password: string | null;
  createdAt: number | null;
}

const ROLE_META: Record<OfficeRole, { label: string; blurb: string; icon: React.ElementType; tint: string }> = {
  director: {
    label: "Director",
    blurb: "Read-only. Sees payments, expenses, debtors, teachers, attendance and salaries.",
    icon: ShieldCheck,
    tint: "bg-indigo-50 text-indigo-600 border-indigo-100",
  },
  accountant: {
    label: "Accountant (buxgalter)",
    blurb: "Everything the director sees, plus recording and cancelling payments and expenses.",
    icon: Briefcase,
    tint: "bg-emerald-50 text-emerald-600 border-emerald-100",
  },
};

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-sm font-mono font-bold text-slate-900 truncate">{value}</p>
      </div>
      <button
        onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="shrink-0 p-1.5 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-200 transition-colors"
        aria-label={`Copy ${label}`}
      >
        {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
      </button>
    </div>
  );
}

export default function StaffTab({ data }: { data: CenterDetailData }) {
  const centerId = data.center.id;

  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [busyUid, setBusyUid] = useState<string | null>(null);

  // Create form. Email/username auto-derive from the name until the admin
  // types their own — same live-preview contract as CreateTeacherModal, so
  // what is previewed is what the server generates (lib/teacherProvision.ts).
  const [fullName, setFullName] = useState("");
  const [staffRole, setStaffRole] = useState<OfficeRole>("director");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<StaffRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApiFetch<{ staff: StaffRow[] }>(`/api/admin/centers/${centerId}/staff`);
      setStaff(res.staff || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load office staff.");
    } finally {
      setLoading(false);
    }
  }, [centerId]);

  useEffect(() => {
    load();
  }, [load]);

  const onNameChange = (v: string) => {
    setFullName(v);
    if (!emailTouched) setEmail(suggestTeacherEmail(v));
    if (!usernameTouched) setUsername(suggestTeacherUsername(v));
    if (!password) setPassword(generateFriendlyPassword(v));
  };

  const resetForm = () => {
    setFullName("");
    setStaffRole("director");
    setEmail("");
    setUsername("");
    setPassword("");
    setPhone("");
    setEmailTouched(false);
    setUsernameTouched(false);
  };

  const handleCreate = async () => {
    if (fullName.trim().length < 3) return toast.error("Full name must be at least 3 characters.");
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    setCreating(true);
    try {
      const res = await adminApiFetch<{ uid: string; email: string; username: string; password: string }>(
        `/api/admin/centers/${centerId}/staff`,
        {
          method: "POST",
          body: {
            fullName: fullName.trim(),
            staffRole,
            password,
            phone: phone.trim() || undefined,
            // Only send explicit values — an untouched field lets the server
            // run its own collision-walking generator.
            ...(emailTouched && email ? { email } : {}),
            ...(usernameTouched && username ? { username } : {}),
          },
        },
      );
      setCreated({
        uid: res.uid,
        centerId,
        staffRole,
        name: fullName.trim(),
        email: res.email,
        username: res.username,
        password: res.password,
        createdAt: Date.now(),
      });
      toast.success("Office account created");
      resetForm();
      setShowForm(false);
      await load();
    } catch (error: any) {
      toast.error(error.message || "Failed to create the account.");
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (row: StaffRow) => {
    const next = generateFriendlyPassword(row.name);
    setBusyUid(row.uid);
    try {
      await adminApiFetch(`/api/admin/centers/${centerId}/staff`, {
        method: "PATCH",
        body: { uid: row.uid, password: next },
      });
      toast.success("New password set");
      setRevealed((r) => ({ ...r, [row.uid]: true }));
      await load();
    } catch (error: any) {
      toast.error(error.message || "Failed to reset the password.");
    } finally {
      setBusyUid(null);
    }
  };

  const handleRemove = async (row: StaffRow) => {
    if (!confirm(`Delete ${row.name}'s ${ROLE_META[row.staffRole].label} account? They lose access immediately.`)) {
      return;
    }
    setBusyUid(row.uid);
    try {
      await adminApiFetch(`/api/admin/centers/${centerId}/staff`, {
        method: "DELETE",
        body: { uid: row.uid, deleteAccount: true },
      });
      toast.success("Office account removed");
      await load();
    } catch (error: any) {
      toast.error(error.message || "Failed to remove the account.");
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* Freshly created credentials — the one moment they are handed over. */}
      {created && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-emerald-900">
                {created.name} · {ROLE_META[created.staffRole].label}
              </h3>
              <p className="text-xs font-medium text-emerald-700 mt-0.5">
                Hand these over now — the email has no inbox, so there is no self-service reset.
              </p>
            </div>
            <button
              onClick={() => setCreated(null)}
              className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-100 transition-colors"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid sm:grid-cols-3 gap-2 mt-4">
            <CopyField label="Username" value={created.username} />
            <CopyField label="Email" value={created.email} />
            <CopyField label="Password" value={created.password || ""} />
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between gap-3 p-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-black text-slate-900">Office staff</h2>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              Director and buxgalter accounts for this center. Created here only — the manager cannot make one.
            </p>
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors shrink-0"
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? "Cancel" : "New account"}
          </button>
        </div>

        {showForm && (
          <div className="p-5 border-b border-slate-100 bg-slate-50/60 space-y-4">
            <div className="grid sm:grid-cols-2 gap-2">
              {OFFICE_ROLES.map((role) => {
                const meta = ROLE_META[role];
                const active = staffRole === role;
                return (
                  <button
                    key={role}
                    onClick={() => setStaffRole(role)}
                    className={`text-left p-3.5 rounded-xl border-2 transition-colors ${
                      active ? "border-slate-900 bg-white" : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-black uppercase tracking-wider ${meta.tint}`}>
                      <meta.icon size={12} /> {meta.label}
                    </span>
                    <p className="text-xs font-medium text-slate-500 mt-2 leading-relaxed">{meta.blurb}</p>
                  </button>
                );
              })}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Full name" value={fullName} onChange={onNameChange} placeholder="Alisher Karimov" />
              <Field label="Phone (optional)" value={phone} onChange={setPhone} placeholder="+998 90 123 45 67" />
              <Field
                label="Login email"
                value={email}
                onChange={(v) => {
                  setEmail(v);
                  setEmailTouched(true);
                }}
                placeholder="a.karimov@edify.uz"
                mono
              />
              <Field
                label="Username"
                value={username}
                onChange={(v) => {
                  setUsername(v);
                  setUsernameTouched(true);
                }}
                placeholder="alisher"
                mono
              />
              <Field label="Password" value={password} onChange={setPassword} placeholder="min 8 characters" mono />
            </div>

            <button
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-60 transition-colors"
            >
              {creating ? <Loader2 size={16} className="animate-spin" /> : <UserCog size={16} />}
              Create account
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-16 flex justify-center text-slate-400">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : staff.length === 0 ? (
          <div className="py-16 text-center">
            <Briefcase size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-bold text-slate-600">No office accounts yet</p>
            <p className="text-xs font-medium text-slate-400 mt-1">
              This center is run by its manager alone.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {staff.map((row) => {
              const meta = ROLE_META[row.staffRole];
              const busy = busyUid === row.uid;
              return (
                <div key={row.uid} className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-black text-slate-900 truncate">{row.name}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider ${meta.tint}`}>
                        <meta.icon size={11} /> {meta.label}
                      </span>
                    </div>
                    <p className="text-xs font-mono font-medium text-slate-500 mt-1 truncate">
                      @{row.username} · {row.email}
                    </p>
                    {row.password && (
                      <p className="text-xs font-mono font-bold text-slate-700 mt-1.5 flex items-center gap-2">
                        {revealed[row.uid] ? row.password : "••••••••"}
                        <button
                          onClick={() => setRevealed((r) => ({ ...r, [row.uid]: !r[row.uid] }))}
                          className="text-slate-400 hover:text-slate-900 transition-colors"
                          aria-label={revealed[row.uid] ? "Hide password" : "Show password"}
                        >
                          {revealed[row.uid] ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleResetPassword(row)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 disabled:opacity-60 transition-colors"
                    >
                      {busy ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
                      New password
                    </button>
                    <button
                      onClick={() => handleRemove(row)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-50 disabled:opacity-60 transition-colors"
                    >
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 placeholder:text-slate-300 placeholder:font-medium focus:outline-none focus:border-slate-900 transition-colors ${
          mono ? "font-mono" : ""
        }`}
      />
    </label>
  );
}
