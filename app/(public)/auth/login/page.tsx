"use client";

import { useState, useContext, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithEmailAndPassword, signInWithCustomToken, sendPasswordResetEmail, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { getSsoReturnTo, completeSsoRedirect } from "@/lib/sso";
import { Loader2, Mail, User, ChevronRight, Eye, EyeOff, BookOpen } from "lucide-react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { LanguageContext } from "@/app/(public)/layout";
import GoogleAuthButton from "../_components/GoogleAuthButton";
import React from "react";

// --- 1. TRANSLATION DICTIONARY ---
const LOGIN_TRANSLATIONS = {
  uz: {
    welcomeHeader: "Xush kelibsiz",
    subHeader: "TestEdify hisobingizga kiring.",
    emailLabel: "Email yoki username",
    passwordLabel: "Parol",
    signInBtn: "Kirish",
    forgotPassLink: "Parolni unutdingizmi?",
    sending: "Yuborilmoqda...",
    noAccount: "Hisobingiz yo'qmi?",
    createOne: "Bepul hisob yarating",
    welcomeBack: "Xush kelibsiz, {name}!",
    invalidCred: "Email/username yoki parol noto'g'ri.",
    noUser: "Bu email bilan hisob topilmadi.",
    loginFail: "Kirishda xatolik. Qaytadan urinib ko'ring.",
    accNotFound: "Hisob topilmadi. Iltimos, avval ro'yxatdan o'ting.",
    enterEmail: "Parolni tiklash uchun email yoki username kiriting.",
    resetSent: "Tiklash havolasi yuborildi! Emailingizni tekshiring.",
    invalidEmail: "Noto'g'ri email manzili.",
    resetFail: "Havola yuborishda xatolik yuz berdi.",
    tooManyAttempts: "Urinishlar soni juda ko'p. Birozdan so'ng qayta urinib ko'ring.",
    heroTitle: "Ta'limni yangi bosqichga olib chiqing",
    heroSub: "TestEdify — zamonaviy ta'lim platformasi. O'qituvchi va o'quvchilar uchun yagona raqamli muhit.",
  },
  en: {
    welcomeHeader: "Welcome Back",
    subHeader: "Access your TestEdify account.",
    emailLabel: "Email or Username",
    passwordLabel: "Password",
    signInBtn: "Sign In",
    forgotPassLink: "Forgot Password?",
    sending: "Sending...",
    noAccount: "Don't have an account?",
    createOne: "Create one for free",
    welcomeBack: "Welcome back, {name}!",
    invalidCred: "Invalid email/username or password.",
    noUser: "No account found with this email.",
    loginFail: "Login failed. Please try again.",
    accNotFound: "Account not found. Please Sign Up first to create your profile.",
    enterEmail: "Please enter your email or username to reset your password.",
    resetSent: "Password reset link sent! Check your email.",
    invalidEmail: "Invalid email address.",
    resetFail: "Failed to send reset link.",
    tooManyAttempts: "Too many attempts. Please try again later.",
    heroTitle: "Elevate your learning experience",
    heroSub: "Edify — a modern education platform. A seamless digital environment for teachers and students.",
  },
  ru: {
    welcomeHeader: "С возвращением",
    subHeader: "Войдите в свой аккаунт Edify.",
    emailLabel: "Email или имя пользователя",
    passwordLabel: "Пароль",
    signInBtn: "Войти",
    forgotPassLink: "Забыли пароль?",
    sending: "Отправка...",
    noAccount: "Нет аккаунта?",
    createOne: "Создать бесплатно",
    welcomeBack: "С возвращением, {name}!",
    invalidCred: "Неверный email/логин или пароль.",
    noUser: "Аккаунт с таким email не найден.",
    loginFail: "Ошибка входа. Попробуйте снова.",
    accNotFound: "Аккаунт не найден. Пожалуйста, сначала зарегистрируйтесь.",
    enterEmail: "Введите email или имя пользователя для сброса пароля.",
    resetSent: "Ссылка для сброса отправлена! Проверьте почту.",
    invalidEmail: "Неверный формат email.",
    resetFail: "Не удалось отправить ссылку.",
    tooManyAttempts: "Слишком много попыток. Попробуйте позже.",
    heroTitle: "Поднимите обучение на новый уровень",
    heroSub: "Edify — современная образовательная платформа. Единая цифровая среда для учителей и учеников.",
  }
};

// ─────────────────────────────────────────────────────────────────
//  IMPROVED SVG: PC Monitor + Open Book Stack + Floating Tablet
// ─────────────────────────────────────────────────────────────────
function EcosystemSVG() {
  return (
    <svg
      viewBox="0 0 560 600"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full max-h-[600px] select-none pointer-events-none"
    >
      <defs>
        {/* Dot grid */}
        <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="12" cy="12" r="0.75" fill="rgba(255,255,255,0.1)" />
        </pattern>

        {/* Glow filters */}
        <filter id="glow" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="softGlow" x="-12%" y="-12%" width="124%" height="124%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>

        {/* Monitor screen */}
        <linearGradient id="screen" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0C1F4A" />
          <stop offset="100%" stopColor="#060E20" />
        </linearGradient>

        {/* Tablet screen */}
        <linearGradient id="tabScreen" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#112060" />
          <stop offset="100%" stopColor="#080F28" />
        </linearGradient>

        {/* Monitor bezel */}
        <linearGradient id="bezel" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2A3C52" />
          <stop offset="100%" stopColor="#18273A" />
        </linearGradient>

        {/* Book left page */}
        <linearGradient id="pageL" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#BDC9D7" />
          <stop offset="100%" stopColor="#F1F5F9" />
        </linearGradient>

        {/* Book right page */}
        <linearGradient id="pageR" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F1F5F9" />
          <stop offset="100%" stopColor="#BDC9D7" />
        </linearGradient>

        {/* Book cover gradient */}
        <linearGradient id="cover1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>
        <linearGradient id="cover2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6D28D9" />
          <stop offset="100%" stopColor="#4C1D95" />
        </linearGradient>
      </defs>

      {/* Background dot grid */}
      <rect width="560" height="600" fill="url(#dots)" />

      {/* Ambient center glow */}
      <ellipse cx="280" cy="300" rx="200" ry="170" fill="#2563EB" opacity="0.07" filter="url(#glow)" />

      {/* ═══════════════════════════════════════════════ */}
      {/*  1. PC MONITOR — center stage                  */}
      {/* ═══════════════════════════════════════════════ */}
      <g transform="translate(255, 210)">

        {/* Stand neck */}
        <rect x="-7" y="108" width="14" height="40" rx="3" fill="#1F2E40" />
        {/* Stand base */}
        <ellipse cx="0" cy="150" rx="48" ry="6" fill="#141E2B" opacity="0.7" />
        <rect x="-44" y="146" width="88" height="9" rx="4" fill="#1F2E40" />

        {/* Monitor outer frame */}
        <rect x="-185" y="-118" width="370" height="238" rx="14" fill="url(#bezel)" stroke="#3A526B" strokeWidth="1.5" filter="url(#softGlow)" />
        {/* Screen */}
        <rect x="-174" y="-108" width="348" height="218" rx="9" fill="url(#screen)" />

        {/* — Browser chrome bar — */}
        <rect x="-174" y="-108" width="348" height="26" rx="9" fill="#091628" />
        <rect x="-174" y="-96" width="348" height="14" fill="#091628" />
        {/* Window dots */}
        <circle cx="-155" cy="-95" r="4" fill="#EF4444" />
        <circle cx="-141" cy="-95" r="4" fill="#F59E0B" />
        <circle cx="-127" cy="-95" r="4" fill="#10B981" />
        {/* URL bar */}
        <rect x="-100" y="-103" width="140" height="14" rx="7" fill="rgba(255,255,255,0.05)" />

        {/* — App layout — */}
        {/* Left sidebar */}
        <rect x="-174" y="-82" width="56" height="192" fill="#080F1E" />
        {/* Sidebar logo */}
        <rect x="-165" y="-74" width="36" height="36" rx="8" fill="#1565C0" opacity="0.8" />
        <circle cx="-147" cy="-56" r="8" fill="rgba(255,255,255,0.15)" />
        {/* Sidebar nav items */}
        <rect x="-168" y="-26" width="42" height="10" rx="5" fill="#1565C0" />
        <rect x="-168" y="-10" width="42" height="10" rx="5" fill="rgba(255,255,255,0.07)" />
        <rect x="-168" y="6" width="42" height="10" rx="5" fill="rgba(255,255,255,0.07)" />
        <rect x="-168" y="22" width="42" height="10" rx="5" fill="rgba(255,255,255,0.07)" />
        <rect x="-168" y="38" width="42" height="10" rx="5" fill="rgba(255,255,255,0.07)" />
        {/* Sidebar bottom avatar */}
        <circle cx="-147" cy="96" r="14" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />

        {/* Top header area */}
        <rect x="-110" y="-78" width="130" height="10" rx="3" fill="rgba(255,255,255,0.1)" />
        <rect x="36" y="-78" width="60" height="10" rx="3" fill="#1565C0" opacity="0.7" />
        <rect x="106" y="-78" width="58" height="10" rx="3" fill="rgba(255,255,255,0.06)" />

        {/* Divider */}
        <line x1="-110" y1="-60" x2="164" y2="-60" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

        {/* Main chart card */}
        <rect x="-110" y="-54" width="168" height="100" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        {/* Chart label */}
        <rect x="-102" y="-46" width="60" height="7" rx="3" fill="rgba(255,255,255,0.12)" />
        <rect x="-102" y="-35" width="30" height="12" rx="2" fill="rgba(255,255,255,0.06)" />
        {/* Line chart */}
        <polyline
          points="-100,22 -75,6 -50,14 -25,-8 0,4 25,-10 50,2 75,-12 100,8 130,-6 155,10"
          fill="none"
          stroke="#60A5FA"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polygon
          points="-100,22 -75,6 -50,14 -25,-8 0,4 25,-10 50,2 75,-12 100,8 130,-6 155,10 155,38 -100,38"
          fill="rgba(96,165,250,0.08)"
        />
        {/* Chart dots */}
        <circle cx="-25" cy="-8" r="3.5" fill="#60A5FA" filter="url(#softGlow)" />
        <circle cx="25" cy="-10" r="3.5" fill="#60A5FA" filter="url(#softGlow)" />

        {/* Right panel */}
        <rect x="66" y="-54" width="98" height="100" rx="8" fill="#1565C0" opacity="0.15" stroke="#2563EB" strokeWidth="1" strokeOpacity="0.4" />
        <rect x="74" y="-44" width="50" height="8" rx="3" fill="rgba(255,255,255,0.15)" />
        <circle cx="115" cy="-14" r="18" stroke="#60A5FA" strokeWidth="3" fill="none" strokeDasharray="70 42" />
        <circle cx="115" cy="-14" r="10" fill="rgba(96,165,250,0.15)" />
        <rect x="74" y="16" width="80" height="6" rx="3" fill="rgba(255,255,255,0.1)" />
        <rect x="74" y="26" width="55" height="5" rx="2.5" fill="rgba(255,255,255,0.06)" />

        {/* Bottom stat cards */}
        <rect x="-110" y="54" width="78" height="48" rx="7" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        <rect x="-102" y="62" width="38" height="6" rx="3" fill="rgba(255,255,255,0.1)" />
        <rect x="-102" y="73" width="24" height="14" rx="4" fill="#10B981" opacity="0.6" />
        <rect x="-102" y="91" width="48" height="5" rx="2.5" fill="rgba(255,255,255,0.07)" />

        <rect x="-24" y="54" width="78" height="48" rx="7" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        <rect x="-16" y="62" width="38" height="6" rx="3" fill="rgba(255,255,255,0.1)" />
        <rect x="-8" y="72" width="8" height="22" rx="3" fill="#F59E0B" opacity="0.7" />
        <rect x="4" y="78" width="8" height="16" rx="3" fill="#60A5FA" opacity="0.7" />
        <rect x="16" y="74" width="8" height="20" rx="3" fill="#10B981" opacity="0.7" />
        <rect x="-16" y="91" width="48" height="5" rx="2.5" fill="rgba(255,255,255,0.07)" />

        <rect x="62" y="54" width="102" height="48" rx="7" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        <rect x="70" y="62" width="38" height="6" rx="3" fill="rgba(255,255,255,0.1)" />
        <rect x="70" y="73" width="20" height="7" rx="2" fill="#1565C0" opacity="0.8" />
        <rect x="96" y="73" width="14" height="7" rx="2" fill="rgba(255,255,255,0.1)" />
        <rect x="70" y="85" width="60" height="5" rx="2.5" fill="rgba(255,255,255,0.07)" />
        <rect x="70" y="94" width="40" height="4" rx="2" fill="rgba(255,255,255,0.05)" />
      </g>

      {/* ═══════════════════════════════════════════════ */}
      {/*  2. TABLET — right side, floating              */}
      {/* ═══════════════════════════════════════════════ */}
      <g>
        <animateTransform attributeName="transform" type="translate" values="0,0; 0,-9; 0,0" dur="5.5s" repeatCount="indefinite" />
        <g transform="translate(488, 330) rotate(8)">

          {/* Tablet body */}
          <rect x="-48" y="-88" width="96" height="168" rx="12" fill="#162236" stroke="#2B3F58" strokeWidth="1.5" filter="url(#softGlow)" />
          {/* Tablet screen */}
          <rect x="-40" y="-80" width="80" height="152" rx="8" fill="url(#tabScreen)" />
          {/* Home indicator */}
          <rect x="-16" y="74" width="32" height="4" rx="2" fill="rgba(255,255,255,0.18)" />
          {/* Front camera */}
          <circle cx="0" cy="-83" r="2" fill="#0A1020" />

          {/* Tablet UI */}
          {/* Status bar */}
          <rect x="-34" y="-74" width="68" height="10" rx="3" fill="rgba(255,255,255,0.04)" />
          <rect x="-30" y="-71" width="20" height="4" rx="2" fill="rgba(255,255,255,0.12)" />

          {/* Header card */}
          <rect x="-34" y="-58" width="68" height="30" rx="6" fill="#1565C0" opacity="0.25" stroke="#2563EB" strokeWidth="0.8" strokeOpacity="0.5" />
          <circle cx="-18" cy="-43" r="9" fill="#1565C0" opacity="0.6" />
          <rect x="-4" y="-49" width="28" height="5" rx="2.5" fill="rgba(255,255,255,0.25)" />
          <rect x="-4" y="-40" width="18" height="4" rx="2" fill="rgba(255,255,255,0.12)" />

          {/* Progress ring card */}
          <rect x="-34" y="-22" width="68" height="52" rx="6" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          <circle cx="-10" cy="4" r="16" stroke="#10B981" strokeWidth="3" fill="none" strokeDasharray="60 40" strokeLinecap="round" />
          <circle cx="-10" cy="4" r="8" fill="rgba(16,185,129,0.15)" />
          <rect x="12" y="-4" width="22" height="5" rx="2.5" fill="rgba(255,255,255,0.2)" />
          <rect x="12" y="5" width="14" height="4" rx="2" fill="rgba(255,255,255,0.1)" />
          <rect x="12" y="13" width="18" height="4" rx="2" fill="#10B981" opacity="0.4" />

          {/* Quiz list */}
          <rect x="-34" y="36" width="68" height="16" rx="5" fill="rgba(255,255,255,0.07)" />
          <rect x="-28" y="40" width="30" height="4" rx="2" fill="rgba(255,255,255,0.18)" />
          <rect x="16" y="40" width="14" height="4" rx="2" fill="#60A5FA" opacity="0.5" />

          <rect x="-34" y="58" width="68" height="14" rx="5" fill="#1565C0" opacity="0.35" />
          <rect x="-28" y="62" width="36" height="4" rx="2" fill="rgba(255,255,255,0.3)" />

          {/* Animated sync dashed line to monitor */}
          <path d="M-48,-10 C-90,-20 -150,-60 -210,-80" fill="none" stroke="#60A5FA" strokeWidth="1.5" strokeDasharray="5 5" opacity="0.4">
            <animate attributeName="stroke-dashoffset" values="20;0" dur="2.5s" repeatCount="indefinite" />
          </path>
        </g>
      </g>

      {/* ═══════════════════════════════════════════════ */}
      {/* ═══════════════════════════════════════════════ */}
      {/*  3. BOOK STACK — bottom center                  */}
      {/* ═══════════════════════════════════════════════ */}
      <g transform="translate(240, 534)">

        {/* Bottom closed book */}
        <path d="M-115,-10 L105,-10 A5,5 0 0 1 110,-5 L110,5 A5,5 0 0 1 105,10 L-115,10 Z" fill="url(#cover2)" />
        <rect x="98" y="-7" width="8" height="14" rx="2" fill="#CBD5E1" opacity="0.5" />
        <rect x="-115" y="-10" width="12" height="20" fill="#2E1065" opacity="0.5" />

        {/* Middle closed book */}
        <g transform="rotate(-1.5 0 -20)">
          <path d="M-105,-28 L110,-28 A5,5 0 0 1 115,-23 L115,-13 A5,5 0 0 1 110,-8 L-105,-8 Z" fill="url(#cover1)" />
          <rect x="103" y="-25" width="8" height="14" rx="2" fill="#CBD5E1" opacity="0.4" />
          <rect x="-105" y="-28" width="10" height="20" fill="#1E3A8A" opacity="0.6" />
        </g>

        {/* Open book on top */}
        <g transform="translate(0, -50)">
          {/* Book shadow */}
          <path d="M-120,20 C-60,0 -20,-10 0,-10 C20,-10 60,0 120,20 L0,30 Z" fill="#000" opacity="0.25" filter="url(#glow)" />

          {/* Book Cover */}
          <path d="M-115,12 L0,22 L115,12 L115,18 L0,30 L-115,18 Z" fill="#1E3A8A" />
          
          {/* Book Pages Block (Thickness) */}
          <path d="M-110,0 C-50,-5 -20,8 0,15 C20,8 50,-5 110,0 L110,12 C50,7 20,18 0,25 C-20,18 -50,7 -110,12 Z" fill="#CBD5E1" />
          
          {/* Left Page Surface */}
          <path d="M-105,-10 C-50,-15 -20,0 0,10 L0,22 C-20,12 -50,-3 -105,2 Z" fill="url(#pageL)" />
          
          {/* Right Page Surface */}
          <path d="M105,-10 C50,-15 20,0 0,10 L0,22 C20,12 50,-3 105,2 Z" fill="url(#pageR)" />

          {/* Left page content lines */}
          <g stroke="#64748B" strokeWidth="1.2" strokeLinecap="round" opacity="0.4">
            <line x1="-85" y1="-2" x2="-25" y2="4" />
            <line x1="-80" y1="2" x2="-25" y2="8" />
            <line x1="-75" y1="6" x2="-25" y2="12" opacity="0.3" />
            <line x1="-70" y1="10" x2="-25" y2="16" opacity="0.2" />
          </g>
          {/* Highlight left */}
          <line x1="-80" y1="2" x2="-40" y2="6" stroke="#60A5FA" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" filter="url(#softGlow)" />

          {/* Right page content lines */}
          <g stroke="#64748B" strokeWidth="1.2" strokeLinecap="round" opacity="0.4">
            <line x1="85" y1="-2" x2="25" y2="4" />
            <line x1="80" y1="2" x2="25" y2="8" />
            <line x1="75" y1="6" x2="25" y2="12" opacity="0.3" />
            <line x1="70" y1="10" x2="25" y2="16" opacity="0.2" />
          </g>
          {/* Highlight right */}
          <line x1="80" y1="2" x2="40" y2="6" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" filter="url(#softGlow)" />

          {/* Bookmark ribbon */}
          <path d="M-15,10 L-10,40 L-15,35 L-20,40 Z" fill="#F59E0B" />

          {/* Center Glowing Knowledge Orb */}
          <ellipse cx="0" cy="15" rx="16" ry="6" fill="#60A5FA" opacity="0.6" filter="url(#glow)" />
          <circle cx="0" cy="13" r="4" fill="#FFFFFF" filter="url(#softGlow)" />
          
          {/* Light beam from the book */}
          <path d="M-15,15 L15,15 L60,-200 L-60,-200 Z" fill="url(#beamGrad)" opacity="0.4" />

          {/* Floating Data Particles from Book */}
          <g fill="#93C5FD">
            <circle cx="-15" cy="5" r="2.5">
              <animate attributeName="cy" values="5;-250" dur="4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0.9;0" dur="4s" repeatCount="indefinite" />
            </circle>
            <circle cx="15" cy="0" r="2">
              <animate attributeName="cy" values="0;-230" dur="3.5s" repeatCount="indefinite" begin="1s" />
              <animate attributeName="opacity" values="0;0.8;0" dur="3.5s" repeatCount="indefinite" begin="1s" />
            </circle>
            <circle cx="0" cy="-5" r="3" fill="#FCD34D">
              <animate attributeName="cy" values="-5;-270" dur="5s" repeatCount="indefinite" begin="0.5s" />
              <animate attributeName="opacity" values="0;1;0" dur="5s" repeatCount="indefinite" begin="0.5s" />
            </circle>
            <circle cx="-30" cy="10" r="1.5" fill="#10B981">
              <animate attributeName="cy" values="10;-200" dur="4.2s" repeatCount="indefinite" begin="2s" />
              <animate attributeName="opacity" values="0;0.7;0" dur="4.2s" repeatCount="indefinite" begin="2s" />
            </circle>
            <circle cx="30" cy="10" r="2">
              <animate attributeName="cy" values="10;-210" dur="4.8s" repeatCount="indefinite" begin="1.5s" />
              <animate attributeName="opacity" values="0;0.6;0" dur="4.8s" repeatCount="indefinite" begin="1.5s" />
            </circle>
          </g>
        </g>
      </g>

      {/* ═══════════════════════════════════════════════ */}
      {/*  FLOATING BADGES                               */}
      {/* ═══════════════════════════════════════════════ */}

      {/* LIVE SYNC indicator — top right */}
      <g>
        <animateTransform attributeName="transform" type="translate" values="0,0; 0,-5; 0,0" dur="7s" repeatCount="indefinite" />
        <g transform="translate(458, 168)" filter="url(#softGlow)">
          <rect x="-46" y="-15" width="92" height="30" rx="15" fill="#0F172A" stroke="#10B981" strokeWidth="1.5" />
          <circle cx="-26" cy="0" r="5" fill="#10B981">
            <animate attributeName="opacity" values="1;0.2;1" dur="1.4s" repeatCount="indefinite" />
          </circle>
          <text x="8" y="4" fill="white" fontSize="11" fontWeight="700" fontFamily="'Inter',sans-serif" textAnchor="middle" letterSpacing="0.5">LIVE SYNC</text>
        </g>
      </g>

    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  
  const context = useContext(LanguageContext) as { lang?: 'uz' | 'en' | 'ru'; setLang?: (l: 'uz'|'en'|'ru') => void };
  const lang = context?.lang || 'uz';
  const setLang = context?.setLang || (() => {});
  const t = LOGIN_TRANSLATIONS[lang] || LOGIN_TRANSLATIONS['uz'];

  const identifierRef = useRef<HTMLInputElement>(null);

  // One smart field: contains '@' → email login, otherwise username login
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [identifierFocused, setIdentifierFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);

  const handleKeyEvent = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockActive(e.getModifierState("CapsLock"));
  };

  // SSO hand-off (see lib/sso.ts): a partner app sent the user here with
  // ?returnTo=. If a session is already restored, bounce straight back with
  // a custom token — the user never sees this page. The listener detaches
  // after the first emission so a manual login below isn't double-handled.
  const [ssoReturnTo, setSsoReturnTo] = useState<string | null>(null);
  useEffect(() => {
    const returnTo = getSsoReturnTo();
    if (!returnTo) return;
    setSsoReturnTo(returnTo);
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (user) completeSsoRedirect(returnTo);
    });
    return () => unsub();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const id = identifier.trim();
      let user;
      if (id.includes("@")) {
        user = (await signInWithEmailAndPassword(auth, id, password)).user;
      } else {
        // Username login: /api/auth/login resolves the username and verifies
        // the password server-side, returning a custom token (docs/AUTH.md).
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: id, password }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.token) {
          const err = new Error("Username login failed") as Error & { code?: string };
          err.code = res.status === 429 ? "auth/too-many-requests" : "auth/invalid-credential";
          throw err;
        }
        user = (await signInWithCustomToken(auth, data.token)).user;
      }
      // SSO: send the user back to the partner app instead of a dashboard
      if (ssoReturnTo && (await completeSsoRedirect(ssoReturnTo))) return;
      const tokenResult = await user.getIdTokenResult(true);
      if (tokenResult.claims.super_admin) {
        toast.dismiss();
        toast.success("Welcome to the Admin Console", { duration: 4000 });
        router.push("/admin");
        return;
      }
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) {
        // Auth account exists but onboarding never finished (e.g. a Google
        // sign-in abandoned mid-profile) — resume it instead of erroring.
        router.push("/auth/complete-profile");
        return;
      }
      const profile = userDoc.data();
      toast.dismiss();
      toast.success(t.welcomeBack.replace("{name}", profile.displayName || "User"), { duration: 4000 });
      if (profile.role === "teacher") {
        router.push("/teacher/dashboard");
      } else if (profile.role === "manager") {
        router.push("/manager/dashboard");
      } else {
        router.push("/dashboard");
      }
    } catch (error: any) {
      console.error(error);
      setLoading(false);
      if (error.code === "auth/invalid-credential") toast.error(t.invalidCred);
      else if (error.code === "auth/too-many-requests") toast.error(t.tooManyAttempts);
      else if (error.code === "auth/user-not-found") toast.error(t.noUser);
      else toast.error(t.loginFail);
    }
  };

  const handleForgotPassword = async () => {
    const id = identifier.trim();
    if (!id) {
      identifierRef.current?.focus();
      toast.error(t.enterEmail, {
        icon: '💡',
        style: { border: '1px solid #F59E0B', padding: '14px', color: '#B45309', fontWeight: 600, fontSize: '14px' }
      });
      return;
    }
    setResetLoading(true);
    try {
      if (id.includes("@")) {
        await sendPasswordResetEmail(auth, id);
      } else {
        // Resolved server-side; the response never says whether the username
        // exists (docs/AUTH.md), so success here means "sent if it exists".
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: id }),
        });
        if (!res.ok) {
          const err = new Error("Reset failed") as Error & { code?: string };
          if (res.status === 429) err.code = "auth/too-many-requests";
          throw err;
        }
      }
      toast.success(t.resetSent);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') toast.error(t.noUser);
      else if (error.code === 'auth/invalid-email') toast.error(t.invalidEmail);
      else if (error.code === 'auth/too-many-requests') toast.error(t.tooManyAttempts);
      else toast.error(t.resetFail);
    } finally {
      setResetLoading(false);
    }
  };

  const identifierActive = identifierFocused || identifier.length > 0;
  const isUsernameInput = identifier.length > 0 && !identifier.includes("@");
  const passwordActive = passwordFocused || password.length > 0;

  return (
    <div className="min-h-screen flex font-['Inter',sans-serif]">
      
      {/* LEFT PANEL — 55% */}
      <div className="hidden lg:flex w-[55%] bg-gradient-to-br from-[#0A2540] via-[#1E3A8A] to-[#1565C0] relative overflow-hidden items-center justify-center p-10">
        
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[480px] h-[480px] bg-blue-500/8 rounded-full blur-[100px] pointer-events-none" />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="relative z-10 w-full max-w-[520px]"
        >
          <EcosystemSVG />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="absolute bottom-10 left-10 right-10 z-10"
        >
          <h2 className="text-white text-[26px] font-black leading-tight tracking-tight mb-2">
            {t.heroTitle}
          </h2>
          <p className="text-blue-100/55 text-[14px] font-medium leading-relaxed max-w-md">
            {t.heroSub}
          </p>
        </motion.div>

        {/* Brand watermark */}
        <div className="absolute top-8 left-9 z-10 flex items-center gap-2.5 opacity-90">
          <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-white border border-white/15">
            <BookOpen size={17} />
          </div>
          <span className="text-white font-extrabold text-[19px] tracking-tight">
            TestEdify<span className="text-blue-400">.</span>
          </span>
        </div>
      </div>

      {/* RIGHT PANEL — 45% */}
      <div className="flex-1 flex items-center justify-center bg-white px-6 sm:px-12 py-12 relative">
        
        {/* Mobile logo */}
        <div className="absolute top-6 left-6 flex items-center gap-2 lg:hidden">
          <div className="w-8 h-8 bg-[#1565C0] rounded-lg flex items-center justify-center text-white">
            <BookOpen size={16} />
          </div>
          <span className="font-extrabold text-[18px] text-[#1C1B1F] tracking-tight">
            TestEdify<span className="text-[#1565C0]">.</span>
          </span>
        </div>

        {/* Language toggle */}
        <div className="absolute top-6 right-6 flex items-center bg-[#F1F5F9] p-1 rounded-full border border-[#E2E8F0]">
          {(['uz', 'en', 'ru'] as const).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code)}
              className={`px-3 py-1 text-[11px] font-black tracking-wider rounded-full transition-all uppercase ${
                lang === code ? 'bg-[#1565C0] text-white shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              {code}
            </button>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-[400px]"
        >
          <div className="mb-8">
            <h1 className="text-[32px] font-black text-[#0F172A] tracking-tight leading-tight">
              {t.welcomeHeader}
            </h1>
            <p className="text-[#64748B] mt-1.5 text-[15px] font-normal leading-relaxed">
              {t.subHeader}
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            
            {/* Email or username */}
            <div className="relative">
              <input
                ref={identifierRef}
                id="login-identifier"
                type="text"
                autoComplete="username"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                onFocus={() => setIdentifierFocused(true)}
                onBlur={() => setIdentifierFocused(false)}
                className={`peer w-full px-4 pt-5 pb-2 rounded-xl border-2 bg-transparent text-[#0F172A] text-[15px] font-medium outline-none transition-all duration-200 ${
                  identifierFocused ? 'border-[#1565C0] caret-[#1565C0]' : 'border-[#CBD5E1] hover:border-[#94A3B8]'
                }`}
              />
              <label
                htmlFor="login-identifier"
                className={`absolute left-3 px-1 bg-white pointer-events-none transition-all duration-200 ${
                  identifierActive
                    ? 'top-0 -translate-y-1/2 text-[12px] font-bold text-[#1565C0]'
                    : 'top-1/2 -translate-y-1/2 text-[15px] font-normal text-[#64748B]'
                }`}
              >
                {t.emailLabel}
              </label>
              {isUsernameInput ? (
                <User className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors ${identifierFocused ? 'text-[#1565C0]' : 'text-[#94A3B8]'}`} size={18} />
              ) : (
                <Mail className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors ${identifierFocused ? 'text-[#1565C0]' : 'text-[#94A3B8]'}`} size={18} />
              )}
            </div>

            {/* Password */}
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                onKeyDown={handleKeyEvent}
                onKeyUp={handleKeyEvent}
                className={`peer w-full px-4 pt-5 pb-2 rounded-xl border-2 bg-transparent text-[#0F172A] text-[15px] font-medium outline-none transition-all duration-200 ${
                  passwordFocused ? 'border-[#1565C0] caret-[#1565C0]' : 'border-[#CBD5E1] hover:border-[#94A3B8]'
                }`}
              />
              <label
                htmlFor="login-password"
                className={`absolute left-3 px-1 bg-white pointer-events-none transition-all duration-200 ${
                  passwordActive
                    ? 'top-0 -translate-y-1/2 text-[12px] font-bold text-[#1565C0]'
                    : 'top-1/2 -translate-y-1/2 text-[15px] font-normal text-[#64748B]'
                }`}
              >
                {t.passwordLabel}
              </label>

              {capsLockActive && (
                <span className="absolute right-12 top-1/2 -translate-y-1/2 bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded tracking-tighter animate-pulse pointer-events-none select-none">
                  CAPS
                </span>
              )}

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors ${passwordFocused ? 'text-[#1565C0]' : 'text-[#94A3B8]'} hover:text-[#0F172A]`}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Forgot password */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetLoading}
                className="text-[13px] font-bold text-[#1565C0] hover:text-[#0D47A1] transition-colors disabled:opacity-50"
              >
                {resetLoading ? t.sending : t.forgotPassLink}
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1565C0] hover:bg-[#114E93] text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 text-[15px] shadow-sm shadow-[#1565C0]/25 mt-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <>{t.signInBtn} <ChevronRight size={18} /></>}
            </button>
          </form>

          {/* New Google users are routed to /auth/complete-profile to pick a
              role and username — no password is ever asked for them */}
          <GoogleAuthButton lang={lang} />

          <div className="mt-10 pt-6 border-t border-[#E2E8F0] text-center text-[14px] text-[#64748B]">
            {t.noAccount}{' '}
            <Link href={ssoReturnTo ? `/auth/signup?returnTo=${encodeURIComponent(ssoReturnTo)}` : "/auth/signup"} className="text-[#1565C0] font-bold hover:underline">
              {t.createOne}
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}