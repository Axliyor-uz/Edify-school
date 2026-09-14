"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  ChevronRight, Loader2, ShieldCheck, ArrowLeft, 
  MapPin, Search, ShieldAlert, GraduationCap, School, Coins, Zap
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // 1. 🟢 FETCH ALL STUDENTS (NO PAGINATION FOR DIRECTORY)
  useEffect(() => {
    const fetchAllStudents = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "users"), where("role", "==", "student"));
        const querySnapshot = await getDocs(q);
        
        const studentList: any[] = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Client-side sorting by name
        studentList.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
        
        setStudents(studentList);
      } catch (error: any) {
        console.error("Error fetching students:", error);
        toast.error("Failed to load students.");
      } finally {
        setLoading(false);
      }
    };

    fetchAllStudents();
  }, []);

  // 2. 🟢 CLIENT-SIDE SEARCH FILTER
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    
    const lowerQ = searchQuery.toLowerCase();
    return students.filter(s => {
      const name = (s.displayName || "").toLowerCase();
      const email = (s.email || "").toLowerCase();
      const username = (s.username || "").toLowerCase();
      return name.includes(lowerQ) || email.includes(lowerQ) || username.includes(lowerQ);
    });
  }, [searchQuery, students]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 p-6 md:p-10">
      
      {/* 🟢 HEADER & SEARCH BAR */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        
        <div className="relative z-10 flex-1">
          <Link href="/admin" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-bold mb-4 text-sm">
            <ArrowLeft size={16} /> Back to Hub
          </Link>
          <h1 className="text-3xl font-black text-slate-900 mb-2">Students Directory</h1>
          <p className="text-slate-500 font-medium text-sm">
            Managing <strong className="text-slate-900">{filteredStudents.length}</strong> students out of {students.length} total.
          </p>
        </div>

        <div className="relative w-full lg:w-80 shrink-0 z-10">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by name, email, or @username..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow placeholder:text-slate-400 placeholder:font-medium"
          />
        </div>
      </div>

      {/* 🟢 DATA TABLE */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="p-5 pl-6">Student Profile</th>
                <th className="p-5">Location</th>
                <th className="p-5 text-center">Status</th>
                <th className="p-5 text-center">Gamification</th>
                <th className="p-5 text-right pr-6">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center text-slate-500">
                    <Loader2 className="animate-spin mx-auto text-emerald-600 mb-4" size={32} />
                    <span className="font-bold tracking-wide">Loading student database...</span>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-16 text-center text-slate-500 font-bold">
                    {searchQuery ? `No students found matching "${searchQuery}"` : "No students registered yet."}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const safeId = student.id || student.uid;
                  
                  return (
                    <tr key={safeId} className="hover:bg-slate-50/50 transition-colors group">
                      
                      {/* 1. Name & Avatar & Email */}
                      <td className="p-5 pl-6">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            {student.photoURL ? (
                              <img src={student.photoURL} alt={student.displayName} className="w-12 h-12 rounded-full object-cover border border-slate-200 group-hover:border-emerald-300 transition-colors" />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-black text-xl border border-slate-200">
                                {student.displayName?.charAt(0).toUpperCase() || "S"}
                              </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 border border-slate-100">
                              <GraduationCap size={14} className="text-emerald-500" />
                            </div>
                          </div>
                          <div>
                            <p className="text-slate-900 font-bold flex items-center gap-1.5 text-[14px] mb-0.5">
                              {student.displayName || "Unknown Student"}
                            </p>
                            <p className="text-xs text-slate-500 font-bold font-mono">@{student.username || "no_username"}</p>
                            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{student.email}</p>
                          </div>
                        </div>
                      </td>
                      
                      {/* 2. Location */}
                      <td className="p-5">
                        <div className="flex items-center gap-1.5 text-slate-600 font-bold text-xs bg-slate-50 w-fit px-3 py-1.5 rounded-lg border border-slate-200">
                          <MapPin size={14} className="text-emerald-500" />
                          {student.location?.district ? `${student.location.district}, ${student.location.region}` : (student.location?.region || "Unknown")}
                        </div>
                      </td>

                      {/* 3. Status Badge */}
                      <td className="p-5 text-center">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${student.isActive === false ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {student.isActive === false ? 'Suspended' : 'Account Active'}
                        </span>
                      </td>

                      {/* 4. Gamification (XP & Coins) */}
                      <td className="p-5">
                        <div className="flex items-center justify-center gap-4 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 w-fit mx-auto">
                           <div className="text-center">
                             <p className="text-slate-900 font-black text-lg leading-none mb-1">
                               {student.xp || 0}
                             </p>
                             <p className="text-slate-400 text-[9px] uppercase font-bold flex items-center justify-center gap-1"><Zap size={10} className="text-amber-400"/> XP</p>
                           </div>
                           <div className="w-px h-8 bg-slate-200"></div>
                           <div className="text-center">
                             <p className="text-slate-900 font-black text-lg leading-none mb-1">
                               {student.coins || 0}
                             </p>
                             <p className="text-slate-400 text-[9px] uppercase font-bold flex items-center justify-center gap-1"><Coins size={10} className="text-amber-500"/> Coins</p>
                           </div>
                        </div>
                      </td>
                      
                      {/* 5. Action Link */}
                      <td className="p-5 text-right pr-6">
                        <Link 
                          href={`/admin/students/${safeId}`} 
                          className="inline-flex px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700 font-bold hover:bg-emerald-600 hover:text-white transition-all items-center gap-2 text-[13px] shadow-sm opacity-0 group-hover:opacity-100"
                        >
                          View Details <ChevronRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
