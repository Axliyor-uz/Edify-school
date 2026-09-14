"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase"; 
import Link from "next/link";
import { ShieldCheck, LogOut, LayoutDashboard, Users, CreditCard, Loader2, Building2, Globe } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isChecking, setIsChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const tokenResult = await user.getIdTokenResult(true);
          if (tokenResult.claims.super_admin) {
            setIsAdmin(true);
          } else {
            router.push("/"); 
          }
        } catch (error) {
          router.push("/"); 
        }
      } else {
        router.push("/"); 
      }
      setIsChecking(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  if (!isAdmin) return null; // Prevent flicker before redirect

  const navLinks = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/centers', label: 'Centers', icon: Building2 },
    { href: '/admin/teachers', label: 'Teachers', icon: Users },
    { href: '/admin/membership', label: 'Memberships', icon: CreditCard },
    { href: '/admin/ielts', label: 'IELTS', icon: Globe },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      {/* 🟢 TOP NAVIGATION BAR */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100">
              <ShieldCheck size={24} />
            </div>
            <span className="text-xl font-black text-slate-900 tracking-tight hidden sm:block">Edify Admin</span>
          </div>
          
          <nav className="flex items-center gap-1 md:gap-4 overflow-x-auto hide-scrollbar">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== '/admin' && pathname.startsWith(link.href));
              return (
                <Link 
                  key={link.href} 
                  href={link.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <link.icon size={16} />
                  <span className="hidden sm:inline">{link.label}</span>
                </Link>
              );
            })}
          </nav>

          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm font-bold text-rose-500 hover:text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-2 rounded-lg transition-colors"
          >
            <LogOut size={16} /> <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* 🟢 MAIN CONTENT */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}