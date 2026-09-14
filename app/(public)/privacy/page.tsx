import Link from 'next/link';
import { ShieldCheck, ChevronRight } from 'lucide-react';
import { POLICIES } from './policies';

export const metadata = {
  title: 'Privacy Policies — Edify',
  description: 'Privacy policies for the Edify platform and its applications.',
};

// Index of all policies. New entries in policies.ts appear here automatically.
export default function PrivacyIndexPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] px-4 py-16 sm:py-24">
      <div className="mx-auto w-full max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100 px-4 py-1.5 text-sm font-bold text-blue-700">
          <ShieldCheck className="h-4 w-4" />
          Privacy
        </div>
        <h1 className="mt-4 text-3xl sm:text-4xl font-black text-slate-900">Edify Privacy Policies</h1>
        <p className="mt-4 text-[16px] leading-relaxed text-slate-600">
          Edify (edify.uz) is an education platform operated by Wasp2AI. Each of our
          applications has its own privacy policy describing exactly what data that
          application handles. Choose an application below.
        </p>

        <div className="mt-8 space-y-3">
          {Object.values(POLICIES).map((policy) => (
            <Link
              key={policy.slug}
              href={`/privacy/${policy.slug}`}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:border-blue-200 hover:shadow-sm"
            >
              <div>
                <div className="font-bold text-slate-900">{policy.appName}</div>
                <div className="mt-0.5 text-sm text-slate-500">
                  For {policy.audience} · Updated {policy.lastUpdated}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
            </Link>
          ))}
        </div>

        <p className="mt-8 text-sm text-slate-500">
          Want to delete your account?{' '}
          <Link href="/delete-account" className="font-bold text-blue-600 hover:underline">
            Account deletion instructions
          </Link>
          .
        </p>
        <p className="mt-3 text-sm text-slate-500">
          Questions? Contact us at{' '}
          <a href="mailto:ilonmask0339@gmail.com" className="font-bold text-blue-600 hover:underline">
            ilonmask0339@gmail.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
