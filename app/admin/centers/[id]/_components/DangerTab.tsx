"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import toast from "react-hot-toast";
import { Archive, ArchiveRestore, Loader2, Trash2, X, AlertTriangle } from "lucide-react";
import { adminApiFetch } from "@/lib/adminApi";
import type { CenterDetailData } from "@/services/centerAdminService";

export default function DangerTab({ data, onUpdated }: { data: CenterDetailData; onUpdated: () => void }) {
  const router = useRouter();
  const { center, manager, teachers } = data;
  const archived = center.adminStatus === "archived";
  // Accounts THIS center provisioned (create-teacher flow) — deletable with it.
  const createdTeacherCount = teachers.filter((t) => t.profile?.accountType === "center-managed").length;

  const [archiving, setArchiving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteManagerAccount, setDeleteManagerAccount] = useState(true);
  const [deleteClasses, setDeleteClasses] = useState(true);
  const [deleteCreatedTeacherAccounts, setDeleteCreatedTeacherAccounts] = useState(true);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleToggleArchive = async () => {
    setArchiving(true);
    try {
      await updateDoc(doc(db, "centers", center.id), {
        adminStatus: archived ? "active" : "archived",
      });
      toast.success(archived ? "Center unarchived" : "Center archived");
      onUpdated();
    } catch (error: any) {
      toast.error(error.message || "Failed to update archive status.");
    } finally {
      setArchiving(false);
    }
  };

  const handleDelete = async () => {
    if (confirmText !== "DELETE") return toast.error('Type "DELETE" to confirm.');
    setDeleting(true);
    const loadingToast = toast.loading("Deleting center and related data...");
    try {
      const res = await adminApiFetch<{ deletedCounts: Record<string, number> }>(
        `/api/admin/centers/${center.id}`,
        { method: "DELETE", body: { deleteManagerAccount, deleteClasses, deleteCreatedTeacherAccounts } }
      );
      // Only report non-zero buckets — the full list is long and mostly empty.
      const removed = Object.entries(res.deletedCounts || {})
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${v} ${k}`)
        .join(", ");
      toast.success(`Center deleted.${removed ? ` Removed: ${removed}` : ""}`, {
        id: loadingToast,
        duration: 8000,
      });
      router.push("/admin/centers");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete center.", { id: loadingToast });
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 max-w-3xl">

      {/* ARCHIVE */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Archive size={20} className="text-slate-500" /> {archived ? "Unarchive Center" : "Archive Center"}
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Admin-only flag: archived centers are dimmed in the directory. Nothing changes for the manager, teachers, or students.
          </p>
        </div>
        <button
          onClick={handleToggleArchive}
          disabled={archiving}
          className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          {archiving ? <Loader2 size={14} className="animate-spin" /> : archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
          {archived ? "Unarchive" : "Archive"}
        </button>
      </div>

      {/* DELETE */}
      <div className="bg-white rounded-2xl border border-rose-200 p-6 md:p-8 shadow-sm">
        <h2 className="text-lg font-black text-rose-600 flex items-center gap-2">
          <Trash2 size={20} /> Delete Center Permanently
        </h2>
        <p className="text-sm text-slate-500 font-medium mt-1 mb-4">
          Removes the center and everything it owns — teacher links &amp; credentials, rooms, CRM leads,
          all attendance history, face enrollments, the complete finance ledger (charges, payments,
          expenses, payouts) — and, optionally, its groups, center-created teacher accounts, and the
          manager account. This cannot be undone.
        </p>
        <button
          onClick={() => { setShowDeleteModal(true); setConfirmText(""); }}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 transition-colors"
        >
          <Trash2 size={14} /> Delete Center...
        </button>
      </div>

      {/* DELETE CONFIRM MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-rose-600 flex items-center gap-2">
                <AlertTriangle size={20} /> Delete &quot;{center.name}&quot;
              </h3>
              <button onClick={() => !deleting && setShowDeleteModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 mb-5">
              <p className="text-sm text-slate-600 font-medium leading-relaxed">
                This permanently deletes the center document, all <strong>teacher links &amp; stored credentials</strong>,
                all <strong>rooms</strong> and <strong>CRM leads</strong>, the complete <strong>student &amp; staff
                attendance history</strong> (incl. summaries and face enrollments), and the entire
                <strong> finance ledger</strong>. Self-signup teacher accounts are never deleted.
              </p>

              <label className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteClasses}
                  onChange={(e) => setDeleteClasses(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="text-sm font-medium text-slate-700 leading-relaxed">
                  <strong>Delete center groups</strong> ({data.classes.length}) and their assignments, exams, and
                  materials. Teachers&apos; personal classes are never touched. If unchecked, groups are detached
                  and stay with their teachers.
                </span>
              </label>

              <label className={`flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4 ${createdTeacherCount > 0 ? "cursor-pointer" : "opacity-50"}`}>
                <input
                  type="checkbox"
                  checked={deleteCreatedTeacherAccounts}
                  onChange={(e) => setDeleteCreatedTeacherAccounts(e.target.checked)}
                  disabled={createdTeacherCount === 0}
                  className="mt-0.5 w-5 h-5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="text-sm font-medium text-slate-700 leading-relaxed">
                  <strong>Delete center-created teacher accounts</strong> ({createdTeacherCount}) — accounts this
                  center provisioned itself. Without the center they cannot log in or recover a password
                  (synthetic email, manager-held credentials). Self-signup teachers are unaffected.
                </span>
              </label>

              <label className={`flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4 ${manager ? "cursor-pointer" : "opacity-50"}`}>
                <input
                  type="checkbox"
                  checked={deleteManagerAccount}
                  onChange={(e) => setDeleteManagerAccount(e.target.checked)}
                  disabled={!manager}
                  className="mt-0.5 w-5 h-5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="text-sm font-medium text-slate-700 leading-relaxed">
                  <strong>Delete the manager account</strong> ({manager?.email || "not found"}) — removes the login,
                  profile, contact details, and username reservation.
                </span>
              </label>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Type <span className="font-mono text-rose-600">DELETE</span> to confirm
                </label>
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || confirmText !== "DELETE"}
                className="flex-1 px-4 py-3 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
