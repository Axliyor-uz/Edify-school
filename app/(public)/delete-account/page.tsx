import Link from 'next/link';
import { Trash2, Mail, Globe, Clock } from 'lucide-react';

export const metadata = {
  title: 'Delete Your Account — Edify',
  description:
    'How to request deletion of your Edify account and associated data (edify.uz and the Edify Android apps, including Edify Manager).',
};

// Account-deletion page required by Google Play's Data safety section.
// One page covers the whole platform: it is the "Delete account URL" for
// Edify Manager and for any future Edify app (docs/APP_DISTRIBUTION.md).
const DELETED = [
  'Your account profile: name, email address, username, phone number and profile photo',
  'Your sign-in account (Firebase Authentication, including Google sign-in linkage)',
  'Your personal settings and preferences',
];

const KEPT = [
  'Records that belong to a learning center as business records (for example attendance and payment history kept by the center) may be retained where required by law — they are unlinked from your deleted account',
  'Data we must keep to comply with legal obligations',
];

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] px-4 py-16 sm:py-24">
      <div className="mx-auto w-full max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100 px-4 py-1.5 text-sm font-bold text-blue-700">
          <Trash2 className="h-4 w-4" />
          Account deletion
        </div>
        <h1 className="mt-4 text-3xl sm:text-4xl font-black text-slate-900">Delete Your Edify Account</h1>
        <p className="mt-4 text-[16px] leading-relaxed text-slate-600">
          This page explains how to request deletion of your account and associated data on the
          Edify platform (edify.uz), operated by Wasp2AI. It applies to accounts used with the
          Edify website and the Edify Android applications, including <strong>Edify Manager</strong>{' '}
          (uz.wasp2ai.edifymanager).
        </p>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2 text-slate-900">
            <Globe className="h-5 w-5 text-blue-600" />
            <h2 className="font-bold">Option 1 — From your account settings</h2>
          </div>
          <ol className="mt-4 space-y-2 text-[15px] leading-relaxed text-slate-600 list-decimal list-inside">
            <li>Sign in to your account at <span className="font-bold">edify.uz</span></li>
            <li>Open your profile / account settings</li>
            <li>Choose account deletion and confirm</li>
          </ol>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2 text-slate-900">
            <Mail className="h-5 w-5 text-blue-600" />
            <h2 className="font-bold">Option 2 — By email</h2>
          </div>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
            Send an email to{' '}
            <a href="mailto:ilonmask0339@gmail.com" className="font-bold text-blue-600 hover:underline">
              ilonmask0339@gmail.com
            </a>{' '}
            with the subject <span className="font-bold">&quot;Delete my account&quot;</span>, sent from the email
            address registered to your Edify account (or include your username). You can also use
            this address to request deletion of <em>specific</em> data without deleting your whole
            account.
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2 text-slate-900">
            <Clock className="h-5 w-5 text-blue-600" />
            <h2 className="font-bold">What is deleted, what is kept</h2>
          </div>
          <p className="mt-3 text-sm font-bold text-slate-900">Deleted (within 30 days of your request):</p>
          <ul className="mt-2 space-y-2">
            {DELETED.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-[15px] leading-relaxed text-slate-600">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm font-bold text-slate-900">May be kept:</p>
          <ul className="mt-2 space-y-2">
            {KEPT.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-[15px] leading-relaxed text-slate-600">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-8 text-sm text-slate-500">
          See also the{' '}
          <Link href="/privacy" className="font-bold text-blue-600 hover:underline">
            Edify privacy policies
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
