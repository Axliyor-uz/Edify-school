"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import { 
  ArrowLeft, ShieldCheck, ShieldAlert, Loader2, 
  Trash2, Ban, CheckCircle, Copy, GraduationCap, School
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

import OverviewTab from "./_components/OverviewTab";
import ClassesTab from "./_components/ClassesTab";

// 🟢 NEW: Reusable Click-to-Copy Component for Admin IDs
function CopyIdButton({ id, label = "ID" }: { id: string, label?: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopied(true);
    toast.success(`${label} copied!`, { id: 'copy-toast', duration: 2000 });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-1.5 mt-1 group w-fit cursor-pointer" onClick={handleCopy} title={`Copy ${label}`}>
      <span className="text-[10px] font-mono text-slate-400 group-hover:text-slate-600 transition-colors">{label}: {id}</span>
      {copied ? <CheckCircle size={12} className="text-emerald-500" /> : <Copy size={12} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />}
    </div>
  );
}

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  // Profile State
  const [student, setStudent] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'classes'>('overview');
  
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);

  // 1. Fetch Profile ONLY
  const fetchStudentProfile = useCallback(async () => {
    try {
      const docRef = doc(db, "users", id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists() && docSnap.data().role === "student") {
        setStudent({ id: docSnap.id, ...docSnap.data() });
      } else {
        setStudent(null); 
      }
    } catch (error) {
      toast.error("Failed to fetch student profile.");
    } finally {
      setLoadingProfile(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchStudentProfile();
  }, [id, fetchStudentProfile]);


  const handleToggleAccountStatus = async () => {
    if (!student) return;
    // Assuming if isActive is undefined, it means active.
    const currentStatus = student.isActive !== false;
    const newStatus = !currentStatus;
    const action = newStatus ? "activate" : "BAN";
    if(!confirm(`Are you sure you want to ${action} this student?`)) return;
    
    try {
      await updateDoc(doc(db, "users", id), { isActive: newStatus });
      setStudent((prev: any) => ({ ...prev, isActive: newStatus }));
      toast.success(`Account ${newStatus ? 'activated' : 'banned'} successfully!`);
    } catch (error) { toast.error("Failed to update account status."); }
  };

  const handleDeleteStudentAccount = async () => {
    if (!student) return;
    if (!confirm(`DANGER: Are you sure you want to COMPLETELY WIPE ${student.displayName}'s account and ALL their data? This CANNOT be undone.`)) return;
    
    const securityCheck = prompt(`To confirm deletion, type the word "DELETE" below:`);
    if (securityCheck !== "DELETE") {
      toast.error("Deletion cancelled. You did not type DELETE.");
      return;
    }

    setIsDeletingStudent(true);
    const toastId = toast.loading("Wiping student account and all data securely...");

    try {
      const functions = getFunctions();
      const deleteAccountAPI = httpsCallable(functions, 'deleteAccountAPI');
      await deleteAccountAPI({ targetUid: id });
      toast.success("Student account successfully purged.", { id: toastId });
      router.push('/admin/students'); 
    } catch (error: any) {
      toast.error(error?.message || "Deletion failed. Make sure you are a Super Admin.", { id: toastId });
      setIsDeletingStudent(false); 
    }
  };

  if (loadingProfile) return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="animate-spin text-emerald-600 w-12 h-12" /></div>;
  if (!student) return <div className="text-center py-20"><h2 className="text-2xl font-bold text-slate-900 mb-4">Student not found.</h2><Link href="/admin/students" className="text-emerald-600 hover:underline font-bold">Return to Directory</Link></div>;

  const isActive = student.isActive !== false;

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-6 pb-20">
      
      {/* Top Nav & God Mode */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <Link href="/admin/students" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition font-bold text-sm w-fit bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm">
          <ArrowLeft size={16} /> Back to Directory
        </Link>
        <div className="flex items-center gap-3">
          <button onClick={handleToggleAccountStatus} disabled={isDeletingStudent} className={`px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95 border ${isActive ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'} disabled:opacity-50`}>
            {isActive ? <><Ban size={18}/> Suspend Account</> : <><CheckCircle size={18}/> Activate Account</>}
          </button>
          <button onClick={handleDeleteStudentAccount} disabled={isDeletingStudent} className="px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 disabled:opacity-50">
            {isDeletingStudent ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />} Delete Student
          </button>
        </div>
      </div>

      {/* Profile Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 flex flex-col md:flex-row gap-8 items-start md:items-center shadow-sm relative overflow-hidden">
        <div className="relative shrink-0 z-10">
          {student.photoURL ? <img src={student.photoURL} alt="Profile" className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-md" /> : <div className="w-28 h-28 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-4xl font-black border-4 border-white shadow-md">{student.displayName?.charAt(0).toUpperCase() || 'S'}</div>}
          <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1.5 border border-slate-200 shadow-sm">
            {isActive ? <ShieldCheck className="text-emerald-500" size={24} /> : <ShieldAlert className="text-amber-500" size={24} />}
          </div>
        </div>
        <div className="flex-1 relative z-10">
          <h1 className="text-3xl font-black text-slate-900 mb-1">{student.displayName}</h1>
          <p className="text-slate-500 font-medium text-lg mb-2">@{student.username}</p>
          
          {/* 🟢 STUDENT ID COPY BADGE */}
          <div className="mb-4">
             <CopyIdButton id={student.id} label="Student ID" />
          </div>

          <div className="flex flex-wrap gap-2.5">
            <span className={`px-3 py-1 rounded-md text-xs font-black uppercase tracking-wider ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              {isActive ? 'Status: Active' : 'Status: Suspended'}
            </span>
            <span className="px-3 py-1 rounded-md text-xs font-black uppercase tracking-wider bg-slate-100 text-slate-600">Joined {student.createdAt ? new Date(student.createdAt).toLocaleDateString() : 'Unknown'}</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-2 p-1.5 bg-white rounded-2xl border border-slate-200 overflow-x-auto hide-scrollbar shadow-sm">
        {[
          { id: 'overview', label: 'Overview', icon: GraduationCap },
          { id: 'classes', label: 'Enrolled Classes & IELTS', icon: School },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[13px] font-black uppercase tracking-wider transition-colors whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
            {tab.icon && <tab.icon size={16} className={activeTab === tab.id ? 'text-white' : 'text-slate-400'} />}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="pt-2">
        {activeTab === 'overview' && <OverviewTab student={student} onUpdated={fetchStudentProfile} />}
        {activeTab === 'classes' && <ClassesTab studentId={student.id} />}
      </div>
    </div>
  );
}
