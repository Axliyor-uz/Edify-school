"use client";

import { auth } from "@/lib/firebase";
import Link from "next/link";
import {
  Users, GraduationCap, School, BookOpen,
  BarChart, ShieldCheck, ChevronRight, CreditCard, Building2
} from "lucide-react";

export default function AdminDashboardPage() {
  const adminEmail = auth.currentUser?.email;

  // 🟢 Array of all our ecosystem modules
  const adminModules = [
    {
      title: "Memberships & Plans",
      description: "Manage teacher subscriptions, plan limits, and AI overrides.",
      icon: <CreditCard size={28} className="text-amber-500" />,
      href: "/admin/membership",
      bgColor: "bg-amber-50",
      iconBg: "bg-white",
      borderColor: "border-amber-200"
    },
    {
      title: "Learning Centers",
      description: "Manage centers, their managers, teachers, and groups.",
      icon: <Building2 size={28} className="text-blue-600" />,
      href: "/admin/centers",
      bgColor: "bg-blue-50",
      iconBg: "bg-white",
      borderColor: "border-blue-200"
    },
    {
      title: "Teachers",
      description: "Manage teacher profiles, verifications, and subjects.",
      icon: <Users size={28} className="text-indigo-600" />,
      href: "/admin/teachers",
      bgColor: "bg-indigo-50",
      iconBg: "bg-white",
      borderColor: "border-indigo-200"
    },
    {
      title: "Students",
      description: "View student progress, XP, and accounts.",
      icon: <GraduationCap size={28} className="text-emerald-600" />,
      href: "/admin/students", 
      bgColor: "bg-emerald-50",
      iconBg: "bg-white",
      borderColor: "border-emerald-200"
    },
    {
      title: "Active Classes",
      description: "Monitor class sizes and teacher assignments.",
      icon: <School size={28} className="text-purple-600" />,
      href: "#", // Coming soon
      bgColor: "bg-purple-50",
      iconBg: "bg-white",
      borderColor: "border-purple-200"
    },
    {
      title: "Test Library",
      description: "Review system-wide tests and questions.",
      icon: <BookOpen size={28} className="text-cyan-600" />,
      href: "#", // Coming soon
      bgColor: "bg-cyan-50",
      iconBg: "bg-white",
      borderColor: "border-cyan-200"
    },
    {
      title: "System Stats",
      description: "Platform analytics and user growth.",
      icon: <BarChart size={28} className="text-rose-600" />,
      href: "#", // Coming soon
      bgColor: "bg-rose-50",
      iconBg: "bg-white",
      borderColor: "border-rose-200"
    }
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-8">
      {/* HEADER */}
      <div className="rounded-2xl bg-white p-8 md:p-10 shadow-sm border border-slate-200 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="relative z-10 flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100 shadow-sm">
              <ShieldCheck size={28} />
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Ecosystem Hub</h1>
          </div>
          <p className="text-slate-500 text-lg font-medium ml-[60px]">
            Welcome back, <span className="text-slate-900 font-bold">{adminEmail}</span>.
          </p>
        </div>
      </div>

      {/* MODULE GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminModules.map((module) => (
          <Link href={module.href} key={module.title} className={`block group ${module.href === '#' ? 'opacity-60 cursor-not-allowed' : ''}`}>
            <div className={`h-full rounded-2xl bg-white border border-slate-200 p-6 transition-all duration-300 hover:shadow-md hover:border-slate-300 ${module.href !== '#' ? 'hover:-translate-y-1' : ''} relative overflow-hidden flex flex-col`}>
              
              <div className="relative z-10 flex-1">
                <div className={`w-14 h-14 rounded-xl ${module.bgColor} border ${module.borderColor} flex items-center justify-center mb-6 shadow-sm transition-transform group-hover:scale-110`}>
                  {module.icon}
                </div>
                
                <h2 className="text-lg font-black text-slate-900 mb-2 flex items-center justify-between">
                  {module.title}
                  {module.href !== '#' && <ChevronRight size={20} className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />}
                </h2>
                <p className="text-slate-500 text-[13px] font-medium leading-relaxed mb-4">
                  {module.description}
                </p>
              </div>

              {module.href === '#' && (
                <div className="mt-auto">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
                    Coming Soon
                  </span>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}