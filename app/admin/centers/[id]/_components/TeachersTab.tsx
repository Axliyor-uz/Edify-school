"use client";

import { useState } from "react";
import Link from "next/link";
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import toast from "react-hot-toast";
import { lookupByEmail } from "@/lib/directory";
import {
  Loader2, Plus, Search, Trash2, Users, X, AlertTriangle, ChevronRight
} from "lucide-react";
import type { CenterDetailData } from "@/services/centerAdminService";

export default function TeachersTab({ data, onUpdated }: { data: CenterDetailData; onUpdated: () => void }) {
  const { center, teachers } = data;
  const [showAddModal, setShowAddModal] = useState(false);
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  // Set when the teacher already belongs to another center — admin may override.
  const [conflict, setConflict] = useState<{ uid: string; name: string; email: string; otherCenterId: string } | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const writeMembership = async (uid: string, name: string, teacherEmail: string) => {
    await setDoc(doc(db, "center_teachers", uid), {
      centerId: center.id,
      teacherId: uid,
      teacherName: name,
      teacherEmail: teacherEmail,
      addedAt: serverTimestamp(),
    });
    toast.success(`${name} added to ${center.name}`);
    setShowAddModal(false);
    setEmail("");
    setConflict(null);
    onUpdated();
  };

  const handleAddTeacher = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return toast.error("Enter the teacher's email.");
    setAdding(true);
    setConflict(null);
    try {
      // Resolved server-side: `users.email` is no longer client-queryable — contact
      // details live in the owner-only private subcollection (docs/AUTH.md).
      const userData = await lookupByEmail(trimmed).catch(() => null);
      if (!userData) {
        toast.error("No account found with this email.");
        return;
      }
      if (userData.role !== "teacher") {
        toast.error(`This account's role is "${userData.role || "unknown"}", not teacher.`);
        return;
      }

      // Steal-protection: doc ID == teacher uid, so one membership per teacher.
      const existing = await getDoc(doc(db, "center_teachers", userData.uid));
      if (existing.exists()) {
        const existingCenterId = existing.data().centerId;
        if (existingCenterId === center.id) {
          toast.error("This teacher is already in this center.");
          return;
        }
        setConflict({
          uid: userData.uid,
          name: userData.displayName || "Unknown",
          email: trimmed,
          otherCenterId: existingCenterId,
        });
        return;
      }

      await writeMembership(userData.uid, userData.displayName || "Unknown", trimmed);
    } catch (error: any) {
      console.error("Add teacher error:", error);
      toast.error(error.message || "Failed to add teacher.");
    } finally {
      setAdding(false);
    }
  };

  const handleForceMove = async () => {
    if (!conflict) return;
    setAdding(true);
    try {
      await writeMembership(conflict.uid, conflict.name, conflict.email);
    } catch (error: any) {
      toast.error(error.message || "Failed to move teacher.");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (teacherId: string, name: string) => {
    if (!confirm(`Remove ${name} from this center?\n\nTheir groups will disappear from the manager's views (the classes themselves are not deleted).`)) return;
    setRemovingId(teacherId);
    try {
      await deleteDoc(doc(db, "center_teachers", teacherId));
      toast.success(`${name} removed from center`);
      onUpdated();
    } catch (error: any) {
      console.error("Remove teacher error:", error);
      toast.error(error.message || "Failed to remove teacher.");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">

      {/* HEADER */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900">Center Teachers</h2>
          <p className="text-sm text-slate-500 font-medium">{teachers.length} teachers linked to this center.</p>
        </div>
        <button
          onClick={() => { setShowAddModal(true); setConflict(null); setEmail(""); }}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} /> Add Teacher
        </button>
      </div>

      {/* TABLE */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="p-5 pl-6">Teacher</th>
                <th className="p-5">Contact</th>
                <th className="p-5 text-center">Groups</th>
                <th className="p-5 text-center">Students</th>
                <th className="p-5 text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teachers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-16 text-center text-slate-500 font-bold">
                    <Users size={32} className="mx-auto text-slate-300 mb-3" />
                    No teachers in this center yet.
                  </td>
                </tr>
              ) : (
                teachers.map((t) => (
                  <tr key={t.teacherId} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-5 pl-6">
                      <div className="flex items-center gap-3">
                        {t.profile?.photoURL ? (
                          <img src={t.profile.photoURL} alt={t.teacherName} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-black border border-slate-200">
                            {(t.teacherName || "T").charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-slate-900 font-bold text-[13px] flex items-center gap-1.5">
                            {t.teacherName}
                            {t.profile?.accountType === "center-managed" && (
                              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-black uppercase tracking-wide" title="Account provisioned by this center — deleted with it by default">
                                center
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-400 font-bold font-mono">@{t.profile?.username || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      <p className="text-xs text-slate-600 font-medium">{t.teacherEmail}</p>
                      <p className="text-[11px] text-slate-400 font-medium">{t.profile?.phone || "no phone"}</p>
                    </td>
                    <td className="p-5 text-center">
                      <span className="text-sm font-black text-slate-900">{t.groupCount}</span>
                    </td>
                    <td className="p-5 text-center">
                      <span className="text-sm font-black text-indigo-600">{t.studentCount}</span>
                    </td>
                    <td className="p-5 text-right pr-6">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link
                          href={`/admin/teachers/${t.teacherId}`}
                          className="inline-flex px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-600 hover:text-white transition-all items-center gap-1.5 text-xs"
                        >
                          Profile <ChevronRight size={12} />
                        </Link>
                        <button
                          onClick={() => handleRemove(t.teacherId, t.teacherName)}
                          disabled={removingId === t.teacherId}
                          className="inline-flex px-3 py-2 rounded-lg bg-rose-50 text-rose-600 font-bold hover:bg-rose-600 hover:text-white transition-all items-center gap-1.5 text-xs disabled:opacity-50"
                        >
                          {removingId === t.teacherId ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD TEACHER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black text-slate-900">Add Teacher to Center</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>

            {conflict ? (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                  <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800 font-medium leading-relaxed">
                    <strong>{conflict.name}</strong> already belongs to another center
                    (<span className="font-mono text-xs">{conflict.otherCenterId}</span>).
                    Moving them here will <strong>remove them from that center</strong> and all
                    their groups will disappear from its manager&apos;s views.
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConflict(null)}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleForceMove}
                    disabled={adding}
                    className="flex-1 px-4 py-3 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {adding && <Loader2 size={14} className="animate-spin" />} Move Anyway
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-500 font-medium">
                  The teacher must already have an Edify account with the <strong>teacher</strong> role.
                </p>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="email"
                    placeholder="teacher@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTeacher()}
                    autoFocus
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  onClick={handleAddTeacher}
                  disabled={adding}
                  className="w-full px-4 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add Teacher
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
