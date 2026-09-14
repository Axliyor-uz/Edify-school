"use client";

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import toast from "react-hot-toast";
import {
  Loader2, Save, KeyRound, UserCog, ShieldOff, ShieldCheck,
  ArrowRightLeft, Copy, Check, AlertTriangle
} from "lucide-react";
import { adminApiFetch } from "@/lib/adminApi";
import type { CenterDetailData } from "@/services/centerAdminService";

export default function ManagerTab({ data, onUpdated }: { data: CenterDetailData; onUpdated: () => void }) {
  const { center, manager } = data;
  const [form, setForm] = useState({
    displayName: manager?.displayName || "",
    phone: manager?.phone || "",
  });
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  const [resetLink, setResetLink] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const [transferEmail, setTransferEmail] = useState("");
  const [oldOwnerAction, setOldOwnerAction] = useState<"demote-teacher" | "demote-student" | "keep">("demote-teacher");
  const [transferring, setTransferring] = useState(false);

  if (!manager) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 shadow-sm text-center animate-in fade-in">
        <AlertTriangle size={36} className="mx-auto text-amber-500 mb-4" />
        <h2 className="text-xl font-black text-slate-900 mb-2">No manager account found</h2>
        <p className="text-slate-500 font-medium text-sm">
          The owner account (<span className="font-mono text-xs">{center.ownerUid}</span>) does not exist in the users collection.
          Use the transfer form after recreating an account, or contact engineering.
        </p>
      </div>
    );
  }

  const isActive = manager.isActive !== false;

  const handleSaveProfile = async () => {
    if (!form.displayName.trim()) return toast.error("Name cannot be empty.");
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", manager.uid), {
        displayName: form.displayName.trim(),
        phone: form.phone.trim(),
      });
      toast.success("Manager profile updated");
      onUpdated();
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    const action = isActive ? "suspend" : "activate";
    if (!confirm(`Are you sure you want to ${action} this manager account?`)) return;
    setToggling(true);
    try {
      await updateDoc(doc(db, "users", manager.uid), { isActive: !isActive });
      toast.success(`Manager account ${action}d`);
      onUpdated();
    } catch (error: any) {
      toast.error(error.message || `Failed to ${action} account.`);
    } finally {
      setToggling(false);
    }
  };

  const handlePasswordReset = async () => {
    setResetting(true);
    setResetLink(null);
    try {
      const res = await adminApiFetch<{ link: string }>(`/api/admin/centers/${center.id}/manager`, {
        method: "POST",
        body: { action: "reset-password" },
      });
      setResetLink(res.link);
      toast.success("Password reset link generated");
    } catch (error: any) {
      toast.error(error.message || "Failed to generate reset link.");
    } finally {
      setResetting(false);
    }
  };

  const copyResetLink = () => {
    if (!resetLink) return;
    navigator.clipboard.writeText(resetLink);
    setLinkCopied(true);
    toast.success("Link copied");
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleTransfer = async () => {
    const email = transferEmail.trim().toLowerCase();
    if (!email) return toast.error("Enter the new owner's email.");
    if (email === (manager.email || "").toLowerCase()) return toast.error("That is already the current owner.");
    if (!confirm(
      `Transfer ownership of "${center.name}" to ${email}?\n\n` +
      `The new owner becomes the center manager. Current manager (${manager.displayName}) will be ` +
      (oldOwnerAction === "keep" ? "left untouched (manager role, no center)." : `converted to a ${oldOwnerAction === "demote-teacher" ? "teacher" : "student"} account.`)
    )) return;

    setTransferring(true);
    try {
      await adminApiFetch(`/api/admin/centers/${center.id}/manager`, {
        method: "POST",
        body: { action: "transfer-ownership", newOwnerEmail: email, oldOwnerAction },
      });
      toast.success("Ownership transferred");
      setTransferEmail("");
      onUpdated();
    } catch (error: any) {
      toast.error(error.message || "Transfer failed.");
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">

      {/* PROFILE CARD */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2"><UserCog size={20} /> Manager Account</h2>
          <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${isActive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
            {isActive ? "Active" : "Suspended"}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {manager.photoURL ? (
            <img src={manager.photoURL} alt={manager.displayName} className="w-14 h-14 rounded-full object-cover border border-slate-200" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-black text-xl border border-slate-200">
              {(manager.displayName || "M").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-slate-900 font-bold">{manager.displayName}</p>
            <p className="text-xs text-slate-500 font-medium truncate">{manager.email}</p>
            <p className="text-[11px] text-slate-400 font-bold font-mono">@{manager.username || "—"} · {manager.uid}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
            <input
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Phone</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+998 XX XXX XX XX"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
          </button>
          <button
            onClick={handleToggleActive}
            disabled={toggling}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 ${
              isActive ? "bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white"
            }`}
          >
            {toggling ? <Loader2 size={14} className="animate-spin" /> : isActive ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
            {isActive ? "Suspend Account" : "Activate Account"}
          </button>
        </div>
      </div>

      <div className="space-y-6">

        {/* PASSWORD RESET */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2"><KeyRound size={20} /> Password Reset</h2>
          <p className="text-sm text-slate-500 font-medium">
            Generates a one-time password reset link. Send it to the manager through a trusted channel.
          </p>
          <button
            onClick={handlePasswordReset}
            disabled={resetting}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            {resetting ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} Generate Reset Link
          </button>
          {resetLink && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-[11px] font-mono text-slate-600 truncate flex-1">{resetLink}</p>
              <button onClick={copyResetLink} className="shrink-0 p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors">
                {linkCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              </button>
            </div>
          )}
        </div>

        {/* TRANSFER OWNERSHIP */}
        <div className="bg-white rounded-2xl border border-amber-200 p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2"><ArrowRightLeft size={20} className="text-amber-500" /> Transfer Ownership</h2>
          <p className="text-sm text-slate-500 font-medium">
            Makes another existing account the owner and manager of this center.
          </p>
          <input
            type="email"
            placeholder="new-owner@example.com"
            value={transferEmail}
            onChange={(e) => setTransferEmail(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Current manager becomes</label>
            <select
              value={oldOwnerAction}
              onChange={(e) => setOldOwnerAction(e.target.value as any)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="demote-teacher">Teacher (recommended)</option>
              <option value="demote-student">Student</option>
              <option value="keep">Keep as manager (no center)</option>
            </select>
          </div>
          <button
            onClick={handleTransfer}
            disabled={transferring}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors disabled:opacity-50"
          >
            {transferring ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />} Transfer Ownership
          </button>
        </div>

        <p className="text-xs text-slate-400 font-medium px-1">
          Need to delete this manager entirely? Deleting the center in the <strong>Danger Zone</strong> tab offers to remove the account too.
        </p>
      </div>
    </div>
  );
}
