"use client";

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Phone, Mail, Calendar, Edit2, Save, Loader2, MapPin, User, Coins, Zap, Trophy } from "lucide-react";
import toast from "react-hot-toast";

export default function OverviewTab({ student, onUpdated }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [editForm, setEditForm] = useState({
    phone: student.phone || '',
    gender: student.gender || '',
    bio: student.bio || '',
    xp: student.xp || 0,
    coins: student.coins || 0,
  });

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "users", student.id), {
        phone: editForm.phone,
        gender: editForm.gender,
        bio: editForm.bio,
        xp: Number(editForm.xp),
        coins: Number(editForm.coins)
      });
      toast.success("Profile updated successfully!");
      setIsEditing(false);
      onUpdated();
    } catch (error) {
      toast.error("Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      {/* LEFT COLUMN: STATS & LOCATIONS */}
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
           <h3 className="text-slate-900 font-bold mb-5 flex items-center gap-2 text-lg"><Trophy size={20} className="text-amber-500"/> Gamification Stats</h3>
           <div className="space-y-4">
              
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[13px] font-bold text-slate-600 pl-2 flex items-center gap-2">
                  <Zap size={14} className="text-amber-400"/> XP Points
                </span>
                {isEditing ? (
                  <input type="number" min="0" value={editForm.xp} onChange={(e) => setEditForm({...editForm, xp: Number(e.target.value)})} className="w-24 p-1.5 bg-white border border-slate-300 text-slate-900 rounded-lg text-sm font-black text-center outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
                ) : (
                  <span className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-slate-900 font-black">{student.xp || 0}</span>
                )}
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[13px] font-bold text-slate-600 pl-2 flex items-center gap-2">
                  <Coins size={14} className="text-amber-500"/> Coins
                </span>
                {isEditing ? (
                  <input type="number" min="0" value={editForm.coins} onChange={(e) => setEditForm({...editForm, coins: Number(e.target.value)})} className="w-24 p-1.5 bg-white border border-slate-300 text-slate-900 rounded-lg text-sm font-black text-center outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
                ) : (
                  <span className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-slate-900 font-black">{student.coins || 0}</span>
                )}
              </div>

           </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
           <h3 className="text-slate-900 font-bold mb-4 flex items-center gap-2 text-lg"><MapPin size={20} className="text-emerald-600"/> Location</h3>
           <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
             <p className="text-slate-900 font-bold text-lg mb-1">{student.location?.district || "N/A"}</p>
             <p className="text-slate-500 font-medium">{student.location?.region || "N/A"}, {student.location?.country || "Uzbekistan"}</p>
           </div>
        </div>
      </div>

      {/* RIGHT COLUMN: PROFESSIONAL DETAILS & CONTACT */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Profile Editor */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-slate-900 font-bold text-xl">Personal Details</h3>
            {!isEditing ? (
              <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-100 transition-all">
                <Edit2 size={16}/> Edit Profile
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button onClick={() => setIsEditing(false)} className="text-slate-500 hover:text-slate-900 text-sm font-bold px-3">Cancel</button>
                <button onClick={handleSaveProfile} disabled={isSaving} className="bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-50">
                  {isSaving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Save Changes
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoBlock icon={<Mail/>} label="Email Address" value={student.email} />
            <InfoBlock 
              icon={<Phone/>} label="Phone Number" 
              value={isEditing ? <input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all" placeholder="+998..."/> : student.phone} 
            />
            <InfoBlock icon={<Calendar/>} label="Date of Birth" value={student.birthDate} />
            <InfoBlock 
              icon={<User/>} label="Gender" 
              value={isEditing ? (
                <select value={editForm.gender} onChange={e => setEditForm({...editForm, gender: e.target.value})} className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all">
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              ) : <span className="capitalize">{student.gender || "Not set"}</span>} 
            />
          </div>

          <div className="mt-6">
            <label className="text-[11px] uppercase font-bold text-slate-400 mb-2 block">Biography / Notes</label>
            {isEditing ? (
              <textarea rows={4} value={editForm.bio} onChange={e => setEditForm({...editForm, bio: e.target.value})} className="w-full bg-white border border-slate-300 text-slate-900 rounded-xl p-4 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all resize-none" placeholder="Student's biography or admin notes..."/>
            ) : (
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                <p className="text-slate-700 text-[14px] leading-relaxed font-medium">{student.bio || <span className="text-slate-400 italic">No biography provided.</span>}</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// Sub-components for Overview Tab
function InfoBlock({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | React.ReactNode | null | undefined }) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
      <div className="text-emerald-600 mt-1 p-2 bg-white rounded-lg border border-slate-200 shadow-sm">{icon}</div>
      <div className="flex-1 w-full">
        <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-wider">{label}</p>
        <div className="text-slate-900 font-bold text-[14px]">{value || <span className="text-slate-400">N/A</span>}</div>
      </div>
    </div>
  );
}
