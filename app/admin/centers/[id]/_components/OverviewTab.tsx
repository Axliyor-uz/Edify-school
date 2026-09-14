"use client";

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import toast from "react-hot-toast";
import {
  Users, School, GraduationCap, DoorOpen, Save, Loader2, StickyNote, CalendarClock,
  ShieldCheck, ShieldX, ShieldAlert
} from "lucide-react";
import { centerStatusOf, toMillis, type CenterDetailData } from "@/services/centerAdminService";

export default function OverviewTab({ data, onUpdated }: { data: CenterDetailData; onUpdated: () => void }) {
  const { center } = data;
  const [form, setForm] = useState({
    name: center.name || "",
    slug: center.slug || "",
    size: center.size || "",
    adminNotes: center.adminNotes || "",
  });
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);

  const status = centerStatusOf(center);

  const handleSetStatus = async (next: "active" | "suspended") => {
    setStatusSaving(true);
    try {
      await updateDoc(doc(db, "centers", center.id), { status: next });
      toast.success(`Center ${next === "active" ? "activated" : "deactivated"}`);
      onUpdated();
    } catch (error: any) {
      toast.error(error.message || "Failed to update status.");
    } finally {
      setStatusSaving(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error("Center name cannot be empty.");
    if (!/^[a-z0-9-]+$/.test(form.slug)) return toast.error("Slug may only contain a-z, 0-9 and dashes.");
    setSaving(true);
    try {
      await updateDoc(doc(db, "centers", center.id), {
        name: form.name.trim(),
        slug: form.slug.trim(),
        size: form.size,
        adminNotes: form.adminNotes.trim(),
      });
      toast.success("Center updated");
      onUpdated();
    } catch (error: any) {
      console.error("Update center error:", error);
      toast.error(error.message || "Failed to update center.");
    } finally {
      setSaving(false);
    }
  };

  const stats = [
    { label: "Teachers", value: data.teachers.length, icon: Users, color: "text-indigo-600 bg-indigo-50 border-indigo-100" },
    { label: "Groups", value: data.classes.length, icon: School, color: "text-blue-600 bg-blue-50 border-blue-100" },
    { label: "Students", value: data.uniqueStudentCount, icon: GraduationCap, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
    { label: "Rooms", value: data.roomCount, icon: DoorOpen, color: "text-amber-600 bg-amber-50 border-amber-100" },
  ];

  const formatDate = (value?: any) => {
    const millis = toMillis(value);
    if (!millis) return "—";
    return new Date(millis).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${s.color}`}>
              <s.icon size={22} />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 leading-none">{s.value}</p>
              <p className="text-[11px] uppercase font-bold text-slate-400 tracking-wider mt-1">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* EDIT CENTER INFO */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-5">
          <h2 className="text-lg font-black text-slate-900">Center Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Center Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Slug</label>
              <input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Center Size</label>
              <select
                value={form.size}
                onChange={(e) => setForm({ ...form, size: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="" disabled>Select size</option>
                <option value="1-50">1-50 students</option>
                <option value="51-200">51-200 students</option>
                <option value="200-500">200-500 students</option>
                <option value="500+">500+ students</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Created</label>
              <div className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-sm font-bold flex items-center gap-2">
                <CalendarClock size={16} /> {formatDate(center.createdAt)}
              </div>
            </div>
          </div>

          {/* ADMIN NOTES */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <StickyNote size={14} /> Internal Notes (visible only in admin)
            </label>
            <textarea
              value={form.adminNotes}
              onChange={(e) => setForm({ ...form, adminNotes: e.target.value })}
              rows={3}
              placeholder="Payment agreements, contact history, anything for the admin team..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
            />
          </div>

          <div className="pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Changes
            </button>
          </div>
        </div>

        <div className="space-y-6">

        {/* APPROVAL STATUS */}
        <div className={`rounded-2xl border p-6 shadow-sm space-y-4 ${
          status === "active" ? "bg-white border-emerald-200"
          : status === "suspended" ? "bg-white border-rose-200"
          : "bg-amber-50/50 border-amber-300"
        }`}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">Approval Status</h2>
            {status === "active" ? <ShieldCheck size={22} className="text-emerald-500" />
              : status === "suspended" ? <ShieldX size={22} className="text-rose-500" />
              : <ShieldAlert size={22} className="text-amber-500" />}
          </div>
          <p className="text-sm font-medium leading-relaxed text-slate-500">
            {status === "active" && "This center is approved — the manager has full access."}
            {status === "pending" && "Awaiting approval. The manager can log in and look around, but every action is blocked (enforced by security rules) until you activate the center."}
            {status === "suspended" && "Suspended by admin. The manager keeps read access but cannot use any features until reactivated."}
          </p>
          <div className="flex flex-wrap gap-2">
            {status !== "active" && (
              <button
                onClick={() => handleSetStatus("active")}
                disabled={statusSaving}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {statusSaving ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                {status === "pending" ? "Approve & Activate" : "Reactivate"}
              </button>
            )}
            {status === "active" && (
              <button
                onClick={() => handleSetStatus("suspended")}
                disabled={statusSaving}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 text-rose-600 text-sm font-bold hover:bg-rose-600 hover:text-white transition-colors disabled:opacity-50"
              >
                {statusSaving ? <Loader2 size={14} className="animate-spin" /> : <ShieldX size={14} />}
                Deactivate Center
              </button>
            )}
          </div>
        </div>

        {/* SUBSCRIPTION INFO (read-only bookkeeping) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 h-fit">
          <h2 className="text-lg font-black text-slate-900">Subscription Record</h2>
          <p className="text-xs text-slate-400 font-medium leading-relaxed">
            Informational only — nothing is enforced or shown to the center. Centers currently operate without limits.
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-slate-50 rounded-xl border border-slate-200 px-4 py-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Plan</span>
              <span className="text-sm font-black text-slate-900">{center.subscription?.plan || "—"}</span>
            </div>
            <div className="flex items-center justify-between bg-slate-50 rounded-xl border border-slate-200 px-4 py-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Valid Until</span>
              <span className="text-sm font-black text-slate-900">{formatDate(center.subscription?.validUntil)}</span>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
