"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ScanFace, Settings, Wifi, WifiOff, Shield, Key, Server, Users,
  Check, X, Loader2, RefreshCw, ChevronLeft, AlertTriangle, Zap,
  Globe, Hash, Camera, UserCheck, GraduationCap
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { useCenterClasses } from "@/hooks/useCenterClasses";
import { buildCenterRoster, type RosterStudent } from "@/services/checkInService";
import {
  saveHikConfig, getHikStatus, testHik, enrollFace,
  type HikStatus, type HikTestResult, type HikEnrollResult,
} from "@/services/hikvisionService";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";

const TRANSLATIONS = {
  uz: {
    title: "Face ID sozlamalari",
    subtitle: "Hikvision yuz terminali ulanishi va xodimlar ro'yxatdan o'tkazish",
    back: "Xodimlar davomati",
    configTitle: "Terminal sozlamalari",
    configDesc: "Hikvision HikCentral Connect API kalitlari",
    appKey: "App Key",
    secretKey: "Secret Key",
    centerId: "Markaz ID",
    baseUrl: "Asosiy URL",
    save: "Saqlash",
    saving: "Saqlanmoqda...",
    testTitle: "Ulanishni tekshirish",
    testBtn: "Tekshirish",
    testing: "Tekshirilmoqda...",
    statusTitle: "Holat",
    enabled: "Yoqilgan",
    disabled: "O'chirilgan",
    lastPoll: "Oxirgi tekshiruv",
    lastEvent: "Oxirgi hodisa",
    lastError: "Oxirgi xato",
    linkedStaff: "Bog'langan xodimlar",
    enrollTitle: "Xodimlarni ro'yxatdan o'tkazish",
    enrollDesc: "Xodim rasmini terminalga yuborish — terminal uni taniy boshlaydi",
    enrollBtn: "Ro'yxatdan o'tkazish",
    enrolling: "Yuklanmoqda...",
    noPhoto: "Rasmisiz",
    noEmployeeNo: "Terminal raqamisiz",
    never: "hali yo'q",
    none: "yo'q",
    tabStaff: "Xodimlar",
    tabStudents: "O'quvchilar",
  },
  en: {
    title: "Face ID settings",
    subtitle: "Hikvision face terminal connection and staff enrollment",
    back: "Staff attendance",
    configTitle: "Terminal settings",
    configDesc: "Hikvision HikCentral Connect API keys",
    appKey: "App Key",
    secretKey: "Secret Key",
    centerId: "Center ID",
    baseUrl: "Base URL",
    save: "Save",
    saving: "Saving...",
    testTitle: "Test connection",
    testBtn: "Test",
    testing: "Testing...",
    statusTitle: "Status",
    enabled: "Enabled",
    disabled: "Disabled",
    lastPoll: "Last poll",
    lastEvent: "Last event",
    lastError: "Last error",
    linkedStaff: "Linked staff",
    enrollTitle: "Staff enrollment",
    enrollDesc: "Send staff photos to the terminal — it will start recognizing them",
    enrollBtn: "Enroll",
    enrolling: "Enrolling...",
    noPhoto: "No photo",
    noEmployeeNo: "No terminal number",
    never: "never",
    none: "none",
    tabStaff: "Staff",
    tabStudents: "Students",
  },
  ru: {
    title: "Настройки Face ID",
    subtitle: "Подключение терминала Hikvision и регистрация сотрудников",
    back: "Посещаемость сотрудников",
    configTitle: "Настройки терминала",
    configDesc: "API ключи Hikvision HikCentral Connect",
    appKey: "App Key",
    secretKey: "Secret Key",
    centerId: "ID центра",
    baseUrl: "Базовый URL",
    save: "Сохранить",
    saving: "Сохранение...",
    testTitle: "Проверить подключение",
    testBtn: "Проверить",
    testing: "Проверка...",
    statusTitle: "Статус",
    enabled: "Включено",
    disabled: "Отключено",
    lastPoll: "Последний опрос",
    lastEvent: "Последнее событие",
    lastError: "Последняя ошибка",
    linkedStaff: "Привязанные сотрудники",
    enrollTitle: "Регистрация сотрудников",
    enrollDesc: "Отправка фото сотрудников на терминал — он начнет их распознавать",
    enrollBtn: "Зарегистрировать",
    enrolling: "Регистрация...",
    noPhoto: "Нет фото",
    noEmployeeNo: "Нет номера терминала",
    never: "никогда",
    none: "нет",
    tabStaff: "Сотрудники",
    tabStudents: "Студенты",
  },
};
type PageT = typeof TRANSLATIONS.uz;

function getInitials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function FaceConfigPage() {
  const { user } = useAuth();
  const { lang } = useManagerLanguage();
  const t: PageT = TRANSLATIONS[lang];
  const [centerId, setCenterId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((p) => { if (p?.centerId) setCenterId(p.centerId); });
  }, [user]);

  const { teachers, classes, isLoading: loadingStaff } = useCenterClasses(centerId);

  // ── Students Roster ──────────────────────────────────────────────────────
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  
  useEffect(() => {
    if (!classes.length) return;
    setLoadingStudents(true);
    buildCenterRoster(classes).then((roster) => {
      setStudents(roster);
      setLoadingStudents(false);
    });
  }, [classes]);

  // ── Config form ──────────────────────────────────────────────────────────
  const [appKey, setAppKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://ieu.hikcentralconnect.com");
  const [formCenterId, setFormCenterId] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Status ───────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<HikStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // ── Test ──────────────────────────────────────────────────────────────────
  const [testResult, setTestResult] = useState<HikTestResult | null>(null);
  const [testing, setTesting] = useState(false);

  // ── Enrollment ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"staff" | "students">("staff");
  const [enrollingUid, setEnrollingUid] = useState<string | null>(null);
  const [enrollResults, setEnrollResults] = useState<Record<string, HikEnrollResult>>({});

  // Load status on mount
  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    setStatusLoading(true);
    try {
      const s = await getHikStatus();
      setStatus(s);
      if (s.centerId) setFormCenterId(s.centerId);
    } catch {
      // Function may not be deployed yet
    } finally {
      setStatusLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await saveHikConfig({
        ...(appKey.trim() ? { appKey: appKey.trim() } : {}),
        ...(secretKey.trim() ? { secretKey: secretKey.trim() } : {}),
        ...(formCenterId.trim() ? { centerId: formCenterId.trim() } : {}),
        ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
        enabled: true,
      });
      toast.success(res.info || "Saqlandi");
      setAppKey("");
      setSecretKey("");
      await loadStatus();
    } catch (e: unknown) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testHik();
      setTestResult(res);
      if (res.ok) toast.success(res.info || "Connected ✅");
      else toast.error(res.error || res.info || "Connection failed");
    } catch (e: unknown) {
      toast.error(String(e));
    } finally {
      setTesting(false);
    }
  };

  const handleEnroll = async (uid: string) => {
    setEnrollingUid(uid);
    try {
      const res = await enrollFace(uid);
      setEnrollResults((prev) => ({ ...prev, [uid]: res }));
      if (res.ok) toast.success(res.info || "Enrolled ✅");
      else toast.error(res.info || res.error || "Enrollment failed");
    } catch (e: unknown) {
      toast.error(String(e));
    } finally {
      setEnrollingUid(null);
    }
  };

  const staff = useMemo(
    () => teachers.map((tch) => ({
      uid: tch.teacherId,
      name: tch.teacherName || tch.teacherEmail || "Staff",
      photo: tch.teacherPhoto || null,
    })).sort((a, b) => a.name.localeCompare(b.name, "uz", { sensitivity: "base" })),
    [teachers]
  );

  const studentList = useMemo(
    () => students.map(s => ({
      uid: s.uid,
      name: s.displayName,
      photo: s.photoURL || null,
    })),
    [students]
  );

  const currentList = activeTab === "staff" ? staff : studentList;
  const currentLoading = activeTab === "staff" ? loadingStaff : loadingStudents;

  const fmtDate = (s: string | null) => {
    if (!s) return t.never;
    try { return new Date(s).toLocaleString("uz-UZ", { dateStyle: "short", timeStyle: "short" }); }
    catch { return s; }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <Link
          href="/manager/staff-attendance"
          className="inline-flex items-center gap-1 text-[13px] text-primary font-semibold hover:underline mb-3"
        >
          <ChevronLeft size={16} /> {t.back}
        </Link>
        <h1 className="text-xl md:text-2xl font-bold text-on-surface tracking-tight flex items-center gap-2">
          <ScanFace className="text-primary" size={24} /> {t.title}
        </h1>
        <p className="text-sm text-on-surface-variant mt-0.5">{t.subtitle}</p>
      </div>

      {/* ── Status Card ─────────────────────────────────────────────────── */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-on-surface flex items-center gap-2">
            <Shield size={16} className="text-primary" /> {t.statusTitle}
          </h2>
          <button onClick={loadStatus} className="p-1.5 rounded-full hover:bg-state-hover transition-colors" title="Yangilash">
            <RefreshCw size={14} className={`text-on-surface-variant ${statusLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {statusLoading && !status ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="animate-spin text-on-surface-variant" size={24} /></div>
        ) : status ? (
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${status.enabled ? "bg-emerald-500" : "bg-gray-300"}`} />
              <span className="text-on-surface-variant">{status.enabled ? t.enabled : t.disabled}</span>
            </div>
            <div className="flex items-center gap-2">
              <Key size={13} className="text-on-surface-variant" />
              <span className="text-on-surface-variant">
                {status.hasKeys ? `AK: ${status.appKey}` : "Kalitlar kiritilmagan"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <RefreshCw size={13} className="text-on-surface-variant" />
              <span className="text-on-surface-variant">{t.lastPoll}: {fmtDate(status.lastPollAt)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap size={13} className="text-on-surface-variant" />
              <span className="text-on-surface-variant">{t.lastEvent}: {fmtDate(status.lastEventAt)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users size={13} className="text-on-surface-variant" />
              <span className="text-on-surface-variant">{t.linkedStaff}: {status.linkedEmployees}</span>
            </div>
            {status.lastError && (
              <div className="col-span-2 flex items-start gap-2 text-rose-600">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                <span className="text-[12px] break-all">{status.lastError}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[13px] text-on-surface-variant">Face ID hali sozlanmagan. Quyidagi formadan API kalitlarini kiriting.</p>
        )}
      </div>

      {/* ── Config Form ─────────────────────────────────────────────────── */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl p-5 space-y-4">
        <div>
          <h2 className="text-[15px] font-bold text-on-surface flex items-center gap-2">
            <Settings size={16} className="text-primary" /> {t.configTitle}
          </h2>
          <p className="text-[12px] text-on-surface-variant mt-0.5">{t.configDesc}</p>
        </div>

        <div className="grid gap-3">
          <div>
            <label className="text-[12px] font-semibold text-on-surface-variant mb-1 flex items-center gap-1">
              <Key size={12} /> {t.appKey}
            </label>
            <input
              type="text"
              value={appKey}
              onChange={(e) => setAppKey(e.target.value)}
              placeholder={status?.appKey || "••••••••"}
              className="w-full px-3 py-2 bg-surface-container border border-outline-variant rounded-m3-md text-[13px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-[12px] font-semibold text-on-surface-variant mb-1 flex items-center gap-1">
              <Shield size={12} /> {t.secretKey}
            </label>
            <input
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder={status?.secretKey || "••••••••"}
              className="w-full px-3 py-2 bg-surface-container border border-outline-variant rounded-m3-md text-[13px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-semibold text-on-surface-variant mb-1 flex items-center gap-1">
                <Hash size={12} /> {t.centerId}
              </label>
              <input
                type="text"
                value={formCenterId}
                onChange={(e) => setFormCenterId(e.target.value)}
                placeholder={centerId || "center_id"}
                className="w-full px-3 py-2 bg-surface-container border border-outline-variant rounded-m3-md text-[13px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-on-surface-variant mb-1 flex items-center gap-1">
                <Globe size={12} /> {t.baseUrl}
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container border border-outline-variant rounded-m3-md text-[13px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary text-on-primary rounded-full text-[13px] font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 shadow-sm"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? t.saving : t.save}
          </button>
          <button
            onClick={handleTest}
            disabled={testing}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-surface-container text-on-surface border border-outline-variant rounded-full text-[13px] font-bold hover:bg-state-hover transition-colors disabled:opacity-60"
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
            {testing ? t.testing : t.testBtn}
          </button>
        </div>

        {/* Test result */}
        {testResult && (
          <div className={`rounded-m3-lg p-3 text-[13px] ${testResult.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
            <div className="flex items-start gap-2">
              {testResult.ok ? <Check size={14} className="mt-0.5 shrink-0" /> : <X size={14} className="mt-0.5 shrink-0" />}
              <div>
                <p className="font-semibold">{testResult.info || testResult.error}</p>
                {testResult.ok && (
                  <div className="mt-1 text-[12px] opacity-80 space-y-0.5">
                    {testResult.onlineTerminal && <p>Terminal: {testResult.onlineTerminal}</p>}
                    <p>Qurilmalar: {testResult.devices}, Terminallar: {testResult.terminals}</p>
                    {testResult.accessLevelName && <p>Access Level: «{testResult.accessLevelName}»</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Enrollment Section ────────────────────────────────────────────── */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl overflow-hidden flex flex-col">
        <div className="p-5 pb-4 border-b border-outline-variant/50">
          <h2 className="text-[15px] font-bold text-on-surface flex items-center gap-2">
            <Camera size={16} className="text-primary" /> {t.enrollTitle}
          </h2>
          <p className="text-[12px] text-on-surface-variant mt-0.5">{t.enrollDesc}</p>
          
          <div className="mt-4 flex bg-surface-container p-1 rounded-m3-lg w-fit">
            <button
              onClick={() => setActiveTab("staff")}
              className={`px-4 py-1.5 text-[13px] font-semibold rounded-m3-md transition-colors flex items-center gap-1.5 ${
                activeTab === "staff" 
                  ? "bg-surface-container-lowest text-on-surface shadow-sm" 
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <Users size={14} /> {t.tabStaff}
            </button>
            <button
              onClick={() => setActiveTab("students")}
              className={`px-4 py-1.5 text-[13px] font-semibold rounded-m3-md transition-colors flex items-center gap-1.5 ${
                activeTab === "students" 
                  ? "bg-surface-container-lowest text-on-surface shadow-sm" 
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <GraduationCap size={14} /> {t.tabStudents}
            </button>
          </div>
        </div>

        <div className="p-5 pt-4 min-h-[300px]">
          {currentLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-on-surface-variant" size={24} />
            </div>
          ) : currentList.length === 0 ? (
            <p className="text-[13px] text-on-surface-variant py-4 text-center">Hech kim topilmadi</p>
          ) : (
            <div className="space-y-2">
              {currentList.map((s) => {
                const res = enrollResults[s.uid];
                const isEnrolling = enrollingUid === s.uid;
                return (
                  <div
                    key={s.uid}
                    className="flex items-center gap-3 p-3 rounded-m3-lg bg-surface-container-low/50 border border-outline-variant/50 hover:bg-surface-container-low transition-colors"
                  >
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-[12px] font-bold shrink-0 overflow-hidden">
                      {s.photo ? (
                        <img src={s.photo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        getInitials(s.name)
                      )}
                    </div>
  
                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-on-surface truncate">{s.name}</p>
                      {res && (
                        <p className={`text-[11px] mt-0.5 ${res.ok ? "text-emerald-600" : "text-rose-500"}`}>
                          {res.info}
                        </p>
                      )}
                    </div>
  
                    {/* Status icon */}
                    {res?.ok && res.deviceApplied && (
                      <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                        <UserCheck size={13} />
                      </span>
                    )}
  
                    {/* Enroll button */}
                    <button
                      onClick={() => handleEnroll(s.uid)}
                      disabled={isEnrolling}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-on-primary rounded-full text-[11px] font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 shrink-0"
                    >
                      {isEnrolling ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <ScanFace size={12} />
                      )}
                      {isEnrolling ? t.enrolling : t.enrollBtn}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
