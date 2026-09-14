"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs, updateDoc, doc, arrayRemove } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { School, Loader2, Users, Unplug, BookOpen, Clock } from "lucide-react";
import toast from "react-hot-toast";

export default function ClassesTab({ studentId }: { studentId: string }) {
  const [classes, setClasses] = useState<any[]>([]);
  const [ieltsGroups, setIeltsGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch Regular Classes
        const classesQ = query(collection(db, "classes"), where("studentIds", "array-contains", studentId));
        const classesSnap = await getDocs(classesQ);
        setClasses(classesSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch IELTS Groups
        const ieltsQ = query(collection(db, "ielts_groups"), where("studentIds", "array-contains", studentId));
        const ieltsSnap = await getDocs(ieltsQ);
        setIeltsGroups(ieltsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      } catch (error) {
        toast.error("Failed to fetch student enrollments.");
      } finally {
        setLoading(false);
      }
    };
    if (studentId) fetchData();
  }, [studentId]);

  const handleRemoveFromClass = async (classId: string, className: string, isIelts: boolean) => {
    if (!confirm(`Are you sure you want to force-remove the student from ${isIelts ? 'IELTS Group' : 'Class'} "${className}"?`)) return;
    
    try {
      const colName = isIelts ? "ielts_groups" : "classes";
      await updateDoc(doc(db, colName, classId), {
        studentIds: arrayRemove(studentId)
      });
      
      if (isIelts) {
        setIeltsGroups(prev => prev.filter(g => g.id !== classId));
      } else {
        setClasses(prev => prev.filter(c => c.id !== classId));
      }
      toast.success("Student removed successfully.");
    } catch (error) {
      toast.error("Failed to remove student.");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="animate-spin text-emerald-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      {/* REGULAR CLASSES */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
           <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
             <School size={20} />
           </div>
           <h2 className="text-lg font-black text-slate-900">Regular Classes ({classes.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="p-5 pl-6">Class Info</th>
                <th className="p-5">Join Code</th>
                <th className="p-5 text-center">Class Size</th>
                <th className="p-5 text-right pr-6">Admin Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {classes.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-slate-500 font-medium">Not enrolled in any regular classes.</td></tr>
              ) : (
                classes.map(cls => (
                  <tr key={cls.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-5 pl-6">
                      <p className="text-slate-900 font-bold mb-0.5">{cls.title}</p>
                      <p className="text-[11px] text-slate-400 font-medium font-mono">ID: {cls.id}</p>
                    </td>
                    <td className="p-5">
                      <span className="bg-slate-50 text-indigo-600 font-mono font-bold px-3 py-1.5 rounded-lg border border-slate-200">
                        {cls.joinCode}
                      </span>
                    </td>
                    <td className="p-5 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-slate-700 font-bold">
                        <Users size={16} className="text-slate-400"/> {cls.studentIds?.length || 0}
                      </div>
                    </td>
                    <td className="p-5 text-right pr-6">
                      <button 
                        onClick={() => handleRemoveFromClass(cls.id, cls.title, false)}
                        className="inline-flex px-4 py-2 rounded-lg bg-rose-50 text-rose-700 font-bold hover:bg-rose-600 hover:text-white transition-all items-center gap-2 text-[13px] border border-rose-100"
                      >
                        <Unplug size={14} /> Remove Student
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* IELTS GROUPS */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
           <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
             <BookOpen size={20} />
           </div>
           <h2 className="text-lg font-black text-slate-900">IELTS Groups ({ieltsGroups.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="p-5 pl-6">Group Name</th>
                <th className="p-5">Schedule</th>
                <th className="p-5 text-center">Group Size</th>
                <th className="p-5 text-right pr-6">Admin Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ieltsGroups.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-slate-500 font-medium">Not enrolled in any IELTS groups.</td></tr>
              ) : (
                ieltsGroups.map(grp => (
                  <tr key={grp.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-5 pl-6">
                      <p className="text-slate-900 font-bold mb-0.5">{grp.name}</p>
                      <p className="text-[11px] text-slate-400 font-medium font-mono">ID: {grp.id}</p>
                    </td>
                    <td className="p-5">
                      <div className="flex items-center gap-1.5 text-slate-600 font-medium text-[13px] bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 w-fit">
                        <Clock size={14} className="text-amber-500"/> {grp.schedule || "Not set"}
                      </div>
                    </td>
                    <td className="p-5 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-slate-700 font-bold">
                        <Users size={16} className="text-slate-400"/> {grp.studentIds?.length || 0}
                      </div>
                    </td>
                    <td className="p-5 text-right pr-6">
                      <button 
                        onClick={() => handleRemoveFromClass(grp.id, grp.name, true)}
                        className="inline-flex px-4 py-2 rounded-lg bg-rose-50 text-rose-700 font-bold hover:bg-rose-600 hover:text-white transition-all items-center gap-2 text-[13px] border border-rose-100"
                      >
                        <Unplug size={14} /> Remove Student
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
