"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowLeft, Building2, Loader2, Copy, Check, LayoutDashboard,
  Users, School, UserCog, AlertTriangle, Archive, Briefcase, GitBranch
} from "lucide-react";
import { fetchCenterDetailData, centerStatusOf, type CenterDetailData } from "@/services/centerAdminService";
import OverviewTab from "./_components/OverviewTab";
import TeachersTab from "./_components/TeachersTab";
import GroupsTab from "./_components/GroupsTab";
import ManagerTab from "./_components/ManagerTab";
import StaffTab from "./_components/StaffTab";
import BranchesTab from "./_components/BranchesTab";
import DangerTab from "./_components/DangerTab";

function CopyIdButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    toast.success("Center ID copied");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 px-2 py-1 rounded-md border border-slate-200 transition-colors"
    >
      {id} {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
    </button>
  );
}

type TabKey = "overview" | "teachers" | "groups" | "manager" | "staff" | "branches" | "danger";

export default function AdminCenterDetailPage() {
  const params = useParams();
  const centerId = params.id as string;

  const [data, setData] = useState<CenterDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const load = useCallback(async () => {
    try {
      const detail = await fetchCenterDetailData(centerId);
      if (!detail) {
        setNotFound(true);
      } else {
        setData(detail);
      }
    } catch (error) {
      console.error("Error loading center:", error);
      toast.error("Failed to load center data.");
    } finally {
      setLoading(false);
    }
  }, [centerId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={36} />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="max-w-3xl mx-auto p-10 text-center">
        <div className="bg-white rounded-2xl border border-slate-200 p-12 shadow-sm">
          <Building2 size={40} className="mx-auto text-slate-300 mb-4" />
          <h1 className="text-2xl font-black text-slate-900 mb-2">Center not found</h1>
          <p className="text-slate-500 font-medium mb-6">This center does not exist or has been deleted.</p>
          <Link href="/admin/centers" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors">
            <ArrowLeft size={16} /> Back to Centers
          </Link>
        </div>
      </div>
    );
  }

  const { center } = data;
  const archived = center.adminStatus === "archived";
  const status = centerStatusOf(center);
  const statusBadge = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    active: "bg-emerald-100 text-emerald-700 border-emerald-200",
    suspended: "bg-rose-100 text-rose-700 border-rose-200",
  }[status];

  const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "teachers", label: `Teachers (${data.teachers.length})`, icon: Users },
    { key: "groups", label: `Groups (${data.classes.length})`, icon: School },
    { key: "manager", label: "Manager", icon: UserCog },
    // Director / buxgalter accounts — super-admin-only provisioning, docs/OFFICE.md.
    { key: "staff", label: "Office staff", icon: Briefcase },
    // Multi-branch owner view — super-admin-only provisioning, docs/MANAGER.md.
    { key: "branches", label: "Branches", icon: GitBranch },
    { key: "danger", label: "Danger Zone", icon: AlertTriangle },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 p-6 md:p-10">

      {/* HEADER */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
        <Link href="/admin/centers" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-bold mb-4 text-sm">
          <ArrowLeft size={16} /> Back to Centers
        </Link>
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Building2 size={30} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-3 flex-wrap">
              {center.name}
              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${statusBadge}`}>
                {status}
              </span>
              {archived && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
                  <Archive size={12} /> Archived
                </span>
              )}
            </h1>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="text-sm text-slate-500 font-bold font-mono">/{center.slug}</span>
              <CopyIdButton id={center.id} />
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-sm flex gap-1 overflow-x-auto hide-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? tab.key === "danger" ? "bg-rose-600 text-white" : "bg-slate-900 text-white"
                : tab.key === "danger" ? "text-rose-500 hover:bg-rose-50" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      {activeTab === "overview" && <OverviewTab data={data} onUpdated={load} />}
      {activeTab === "teachers" && <TeachersTab data={data} onUpdated={load} />}
      {activeTab === "groups" && <GroupsTab data={data} />}
      {activeTab === "manager" && <ManagerTab data={data} onUpdated={load} />}
      {activeTab === "staff" && <StaffTab data={data} />}
      {activeTab === "branches" && <BranchesTab data={data} />}
      {activeTab === "danger" && <DangerTab data={data} onUpdated={load} />}
    </div>
  );
}
