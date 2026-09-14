import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { POLICIES } from '../policies';

// One page per policy in POLICIES (e.g. /privacy/manager). Adding an app's
// policy = one new entry in policies.ts, nothing here changes.

export function generateStaticParams() {
  return Object.keys(POLICIES).map((slug) => ({ slug }));
}

// Only slugs present in POLICIES exist — unknown ones 404 at the routing layer.
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const policy = POLICIES[slug];
  if (!policy) return { title: 'Privacy Policy — Edify' };
  return {
    title: `${policy.appName} — Privacy Policy`,
    description: `Privacy policy for the ${policy.appName} application (${policy.packageId}).`,
  };
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const policy = POLICIES[slug];
  if (!policy) notFound();

  return (
    <div className="min-h-screen bg-[#FAFAFA] px-4 py-16 sm:py-24">
      <article className="mx-auto w-full max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100 px-4 py-1.5 text-sm font-bold text-blue-700">
          <ShieldCheck className="h-4 w-4" />
          Privacy Policy
        </div>
        <h1 className="mt-4 text-3xl sm:text-4xl font-black text-slate-900">{policy.appName}</h1>
        <p className="mt-2 text-sm font-bold text-slate-500">
          {policy.packageId} · Last updated: {policy.lastUpdated}
        </p>
        <p className="mt-6 text-[16px] leading-relaxed text-slate-600">{policy.intro}</p>

        {policy.sections.map((section) => (
          <section key={section.title} className="mt-10">
            <h2 className="text-xl font-bold text-slate-900">{section.title}</h2>
            {section.paragraphs?.map((text, i) => (
              <p key={i} className="mt-3 text-[15px] leading-relaxed text-slate-600">
                {text}
              </p>
            ))}
            {section.bullets && (
              <ul className="mt-3 space-y-2">
                {section.bullets.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-[15px] leading-relaxed text-slate-600">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <p className="mt-12 border-t border-slate-200 pt-6 text-sm text-slate-500">
          All Edify policies: <Link href="/privacy" className="font-bold text-blue-600 hover:underline">edify.uz/privacy</Link>
        </p>
      </article>
    </div>
  );
}
