// app/(student)/dashboard/_components/AnnouncementCarousel.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';

import {
  ANNOUNCEMENTS, ANNOUNCEMENT_FALLBACK_ICON, activeAnnouncements, say,
  type Announcement,
} from '@/lib/announcements';
import { Button, Card, MOTION_ON, cn } from '@/components/student-ui';
import type { Lang } from '@/types/Math';

/**
 * **The dashboard's one announcement card.** It rotates through
 * [lib/announcements.ts](../../../../lib/announcements.ts) — that array is the
 * only thing to edit to announce the next feature; nothing here knows what an
 * announcement is *about*.
 *
 * It took the slot the hardcoded `MmsCard` held until 2026-07-30. A card welded
 * to one feature had to be rewritten (and re-reviewed, and re-translated) every
 * time the platform shipped something else, so the maths paper, biology and
 * chemistry are now three entries in a list instead of three components.
 *
 * ⚠️ **Zero Firestore reads.** The content is a bundled constant. That is what
 * makes it acceptable for the dashboard to spend its hero slot on news.
 *
 * ⚠️ It spends the student kit's **one `gradient` card** per screen
 * (`components/student-ui/Card.tsx`). On that card the text is white, so every
 * opacity modifier uses a plain palette colour (`border-white/25`) — never
 * `border-current/25` and never an M3 token, neither of which can take a Tailwind
 * opacity modifier (see the cross-cutting trap in CLAUDE.md).
 *
 * Accessibility / behaviour, all deliberate:
 * - **Auto-rotation is pausable** (APG requires it of any moving content) and
 *   pauses itself on hover, on keyboard focus and while the tab is hidden.
 * - **`prefers-reduced-motion` stops the rotation entirely** — the dots and
 *   arrows still work, so nothing becomes unreachable.
 * - **Every slide stays mounted** so the card's height is the tallest slide's and
 *   it cannot jump mid-rotation; inactive ones are `inert` + `aria-hidden`, or
 *   their buttons would be focusable while invisible.
 * - **The transition is a directional slide**, not a crossfade: `shortestDelta`
 *   parks each waiting slide on the side it will arrive from, so advancing always
 *   moves left→right and going back always moves right→left — including across the
 *   wrap from the last announcement to the first. It is transform + opacity only
 *   (no layout, no paint), so it stays on the compositor.
 * - Phones swipe (pointer events, 44px threshold) and get full-width buttons; the
 *   side arrows appear from `sm` up, where a pointer exists.
 */

const ROTATE_MS = 8_000;
/** A horizontal drag past this many pixels is a swipe, not a tap on a button. */
const SWIPE_PX = 44;
/** How far a neighbouring slide is parked to the side while it waits its turn. */
const SLIDE_PX = 44;

/**
 * The signed distance from the active slide **by the short way round**, so the
 * last announcement is parked to the LEFT of the first one instead of a full
 * list-width away. This one number gives the whole transition its direction:
 * advancing makes every slide's offset drop, so the outgoing one leaves left and
 * the incoming one arrives from the right — including across the wrap.
 */
function shortestDelta(i: number, active: number, count: number): number {
  const raw = i - active;
  if (raw > count / 2) return raw - count;
  if (raw < -count / 2) return raw + count;
  return raw;
}

// ─── browser-owned state ─────────────────────────────────────────────────────
// ⚠️ These three are read with `useSyncExternalStore`, never mirrored into state
// from an effect: the browser owns them, and a synchronous setState in an effect
// body is a lint error with the React Compiler on. Same rule the exam lockdown's
// `isFullscreen` follows (see hooks/useExamLockdown.ts).

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

const subscribeReducedMotion = (onChange: () => void) => {
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
};

const subscribeVisibility = (onChange: () => void) => {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
};

/** No-op store: the snapshot flips from the server value to the client one at hydration. */
const subscribeNever = () => () => {};

const UI: Record<Lang, Record<string, string>> = {
  uz: { region: 'Yangiliklar', prev: 'Oldingi', next: 'Keyingi', pause: "To'xtatish", play: 'Davom etish', of: '{i} / {n}' },
  ru: { region: 'Новости', prev: 'Назад', next: 'Далее', pause: 'Остановить', play: 'Продолжить', of: '{i} / {n}' },
  en: { region: 'Announcements', prev: 'Previous', next: 'Next', pause: 'Pause', play: 'Play', of: '{i} of {n}' },
};

export default function AnnouncementCarousel({
  lang,
  className = '',
}: {
  lang: Lang;
  className?: string;
}) {
  const t = UI[lang];

  // ⚠️ **The `from`/`until` filter is applied only after hydration.** Reading a
  // clock during render is server/client-divergent by nature, and `/dashboard` is
  // statically prerendered — its HTML is baked at BUILD time. Today nothing here
  // reaches that prerender (the student layout renders an auth gate until the
  // profile resolves), but a card that starts silently mismatching the moment that
  // changes is not worth two saved lines. Until the store flips, the full list
  // renders; the client narrows it to today's on the next commit, so at worst a
  // just-expired entry is on screen for one frame.
  const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false);
  const items = useMemo(() => (hydrated ? activeAnnouncements() : ANNOUNCEMENTS), [hydrated]);

  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hovered, setHovered] = useState(false); // pointer over / keyboard focus inside

  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
  const hiddenTab = useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === 'hidden',
    () => false,
  );

  const count = items.length;
  const go = useCallback(
    (delta: number) => setIndex((i) => (count === 0 ? 0 : (i + delta + count) % count)),
    [count],
  );

  // Rotation. ⚠️ A hidden tab must not burn through the whole list unseen, and
  // `hovered` is kept separate from `hiddenTab` — one flag for both would resume
  // the rotation under a stationary cursor as soon as the tab came back.
  const running = count > 1 && !userPaused && !hovered && !hiddenTab && !reduced;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => go(1), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [running, go]);

  // Swipe. `capture` is deliberately NOT used — a pointerdown on a CTA must still
  // reach the link; only a drag past the threshold navigates the carousel.
  const dragX = useRef<number | null>(null);
  const onPointerDown = (e: React.PointerEvent) => { dragX.current = e.clientX; };
  const onPointerUp = (e: React.PointerEvent) => {
    const from = dragX.current;
    dragX.current = null;
    if (from === null) return;
    const dx = e.clientX - from;
    if (Math.abs(dx) >= SWIPE_PX) go(dx < 0 ? 1 : -1);
  };

  if (count === 0) return null;

  const safeIndex = Math.min(index, count - 1);

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t.region}
      className={className}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={() => setHovered(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      }}
    >
      <Card variant="gradient" className="relative overflow-hidden">
        {/* Decoration only — plain white at low opacity, never a token. */}
        <div className="pointer-events-none absolute inset-0 opacity-10" aria-hidden>
          <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full border-8 border-white" />
          <div className="absolute -bottom-12 right-24 h-24 w-24 rounded-full border-8 border-white" />
        </div>

        <div
          className="relative grid"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { dragX.current = null; }}
        >
          {items.map((item, i) => (
            <Slide
              key={item.id}
              item={item}
              lang={lang}
              active={i === safeIndex}
              delta={shortestDelta(i, safeIndex, count)}
              animate={MOTION_ON && !reduced}
              position={`${i + 1}`}
              total={`${count}`}
              label={t.of}
            />
          ))}
        </div>

        {/* Controls. Hidden entirely for a single announcement — a carousel of one
            with dots and arrows reads as broken. */}
        {count > 1 && (
          <div className="relative mt-4 flex items-center gap-2">
            <div className="flex flex-1 items-center gap-1.5">
              {items.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={t.of.replace('{i}', `${i + 1}`).replace('{n}', `${count}`)}
                  aria-current={i === safeIndex}
                  onClick={() => setIndex(i)}
                  className={cn(
                    'h-2 rounded-full bg-white transition-all duration-m3-med',
                    i === safeIndex ? 'w-6 opacity-100' : 'w-2 opacity-45 hover:opacity-75',
                  )}
                />
              ))}
            </div>

            <CtrlButton
              label={userPaused || reduced ? t.play : t.pause}
              onClick={() => setUserPaused((p) => !p)}
              disabled={reduced}
            >
              {userPaused || reduced ? <Play size={14} strokeWidth={3} /> : <Pause size={14} strokeWidth={3} />}
            </CtrlButton>
            <CtrlButton label={t.prev} onClick={() => go(-1)} className="hidden sm:grid">
              <ChevronLeft size={16} strokeWidth={3} />
            </CtrlButton>
            <CtrlButton label={t.next} onClick={() => go(1)} className="hidden sm:grid">
              <ChevronRight size={16} strokeWidth={3} />
            </CtrlButton>
          </div>
        )}
      </Card>
    </section>
  );
}

/** A control on the gradient card — white on white-at-low-opacity, not a token. */
function CtrlButton({
  label, onClick, children, className, disabled,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-white/30 text-white',
        'hover:bg-white/15 disabled:opacity-40 s-press',
        className,
      )}
    >
      {children}
    </button>
  );
}

function Slide({
  item, lang, active, delta, animate, position, total, label,
}: {
  item: Announcement;
  lang: Lang;
  active: boolean;
  /** Signed distance from the active slide, the short way round (`shortestDelta`). */
  delta: number;
  /** False under `prefers-reduced-motion` or a `Motion_level: 'none'` design. */
  animate: boolean;
  position: string;
  total: string;
  label: string;
}) {
  const Icon = item.icon ?? ANNOUNCEMENT_FALLBACK_ICON;
  const meta = (item.meta ?? []).map((m) => say(m, lang));

  return (
    <div
      // ⚠️ All slides share ONE grid cell, so the card is as tall as the tallest
      // and the page cannot shift as it rotates. The inactive ones must be
      // `inert` — invisible content whose buttons still take Tab is worse than a
      // height jump.
      role="group"
      aria-roledescription="slide"
      aria-label={label.replace('{i}', position).replace('{n}', total)}
      aria-hidden={!active}
      inert={!active}
      className={cn(
        '[grid-area:1/1] min-w-0',
        // ⚠️ A bespoke duration/easing rather than the `duration-m3-med` token:
        // this is the one hero transition on the screen and the token's 200ms
        // reads as a flicker over a 44px travel. easeOutQuint — fast out of the
        // gate, long settle, which is what makes it feel like glass rather than
        // a slideshow. The tokens still own every other transition here.
        animate && 'transition-[transform,opacity] duration-[560ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
        active ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
      style={{
        // ⚠️ `translate3d` + `scale` in ONE transform string: two competing
        // transform utilities would overwrite each other, and promoting the layer
        // is what keeps a 4-slide crossfade off the main thread on a cheap phone.
        transform: `translate3d(${Math.sign(delta) * SLIDE_PX}px, 0, 0) scale(${active ? 1 : 0.965})`,
        willChange: animate ? 'transform, opacity' : undefined,
      }}
    >
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-m3-sm border-2 border-white/40">
          <Icon size={18} strokeWidth={2.5} />
        </span>
        {item.badge && (
          <span className="s-num rounded-m3-xs border-2 border-white/40 px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.14em]">
            {say(item.badge, lang)}
          </span>
        )}
      </div>

      <h3 className="s-display mt-3 text-[19px] font-bold leading-tight tracking-tight sm:text-[21px]">
        {say(item.title, lang)}
      </h3>
      <p className="mt-1.5 max-w-2xl text-[13px] font-bold leading-snug opacity-90">
        {say(item.body, lang)}
      </p>

      {meta.length > 0 && (
        <p className="s-num mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-black opacity-85">
          {meta.map((m, i) => (
            <span key={m} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden className="opacity-60">·</span>}
              {m}
            </span>
          ))}
        </p>
      )}

      {item.ctas && item.ctas.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {item.ctas.map((cta) => {
            const filled = cta.variant === 'filled';
            return (
              // A flex item in a column, so the anchor stretches and the button
              // fills the phone's width; from `sm` it shrinks to its label.
              <Link key={cta.href} href={cta.href} className="sm:flex-none">
                <Button
                  fullWidth
                  size="lg"
                  variant={filled ? 'filled' : 'outlined'}
                  tone={filled ? 'gold' : 'primary'}
                  className={filled ? undefined : 'border-white/60 text-white'}
                  trailingIcon={filled ? <ArrowRight size={17} strokeWidth={3} /> : undefined}
                >
                  {say(cta.label, lang)}
                </Button>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
