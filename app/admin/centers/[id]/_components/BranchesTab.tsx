"use client";

/**
 * Multi-branch owner view — the admin side (docs/MANAGER.md § "Multi-branch
 * owner view"). Super-admin-only, exactly like StaffTab: attaching a branch
 * to an existing owner is a privileged action a manager cannot self-serve.
 * Shows this center's manager's OTHER branches, plus a form to attach a new
 * one (`POST /api/admin/centers` with `attachToOwnerUid` — the mode-2 branch
 * of that route, which skips Auth-user creation entirely).
 */

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Building2, GitBranch, Loader2, Plus } from "lucide-react";
import { adminApiFetch } from "@/lib/adminApi";
import { fetchMyBranches } from "@/services/branchService";
import type { CenterDetailData } from "@/services/centerAdminService";
import type { BranchSummary } from "@/types/branch";

interface Props {
  data: CenterDetailData;
}

const inputClass = "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400 placeholder:font-medium";
const labelClass = "block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2";

export default function BranchesTab({ data }: Props) {
  const managerUid = data.manager?.uid;
  const [branches, setBranches] = useState<BranchSummary[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ centerName: "", centerSlug: "", size: "" });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!managerUid) return;
    try {
      setBranches(await fetchMyBranches(managerUid, data.center.id));
    } catch (err) {
      console.error("BranchesTab load error:", err);
    }
  }, [managerUid, data.center.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!managerUid) {
    return <p className="text-sm text-slate-500 p-6">This center has no manager account yet.</p>;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.centerName.trim() || !form.centerSlug.trim() || !form.size) {
      toast.error("All fields are required.");
      return;
    }
    setSubmitting(true);
    try {
      await adminApiFetch("/api/admin/centers", {
        method: "POST",
        body: { ...form, attachToOwnerUid: managerUid },
      });
      toast.success("Branch attached.");
      setForm({ centerName: "", centerSlug: "", size: "" });
      setShowForm(false);
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to attach branch.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
          <GitBranch size={20} className="text-indigo-600" /> Branches ({branches?.length ?? "…"})
        </h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} /> Attach branch
        </button>
      </div>

      <p className="text-sm text-slate-500">
        Every branch this manager can operate — the one directly owned plus any attached via this form.
        The manager switches between them from <span className="font-mono">/manager/branches</span>.
      </p>

      {branches === null ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-400" size={24} /></div>
      ) : (
        <div className="space-y-2">
          {branches.map((b) => (
            <div key={b.centerId} className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
              <Building2 size={16} className="text-slate-400" />
              <span className="text-sm font-bold text-slate-900 flex-1">{b.centerName}</span>
              {b.centerId === data.center.id && (
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-emerald-100 text-emerald-700">This center</span>
              )}
              <span className="text-xs font-mono text-slate-400">{b.centerId}</span>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} className="space-y-4 border-t border-slate-200 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Center Name</label>
              <input
                value={form.centerName}
                onChange={(e) => setForm((p) => ({ ...p, centerName: e.target.value }))}
                placeholder="Everest Learning Center — Branch 2"
                className={inputClass}
                disabled={submitting}
              />
            </div>
            <div>
              <label className={labelClass}>Slug</label>
              <input
                value={form.centerSlug}
                onChange={(e) => setForm((p) => ({ ...p, centerSlug: e.target.value.toLowerCase() }))}
                placeholder="everest-branch-2"
                className={`${inputClass} font-mono`}
                disabled={submitting}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Center Size</label>
              <select
                value={form.size}
                onChange={(e) => setForm((p) => ({ ...p, size: e.target.value }))}
                className={inputClass}
                disabled={submitting}
              >
                <option value="" disabled>Select expected student count</option>
                <option value="1-50">1-50 students</option>
                <option value="51-200">51-200 students</option>
                <option value="200-500">200-500 students</option>
                <option value="500+">500+ students</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Attach branch
          </button>
        </form>
      )}
    </div>
  );
}
