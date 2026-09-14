'use client';

/**
 * DEV-ONLY teacher kit gallery — /theme-check-teacher
 *
 * Unguarded, data-free preview of the teacher design system so the switchboard
 * can be eyeballed (and headless-screenshotted) without logging in. Reads
 * overrides from the URL and stamps them on <html> exactly like
 * TeacherThemeProvider does:
 *
 *   /theme-check-teacher?palette=wine&mode=dark&shape=round&density=airy
 *
 * Anything not overridden falls back to design.teacher.config.ts. Safe to
 * delete at any time — nothing imports it.
 */

import { useEffect, useState } from 'react';
import '@/components/ui/theme.css';
import {
  Button, IconButton, Card, CardHeader, Chip, StatusChip,
  TextField, Select, SearchBar, Switch, Checkbox, Radio,
  ProgressBar, Spinner, Skeleton, Loader, Dialog, Banner, Tabs,
  Table, Th, TRow, Td, ListItem, Avatar, Badge, EmptyState, StatTile,
  PageHeader, cn, SIDE_STYLES, type SideStyle,
} from '@/components/ui';
import { teacherThemeAttributes } from '@/components/ui/config';
import { ALL_TEACHER_PALETTES } from '@/design.teacher.config';
import {
  Plus, Search, Inbox, Users, TrendingUp, Zap, BookOpen,
  LayoutDashboard, FilePlus, FolderOpen, LogOut, Menu,
} from 'lucide-react';

const MODES = ['light', 'dark'] as const;

/** Static miniature of one sidebar recipe — same class bundles the real shell
 *  uses (components/ui/shellStyles.ts), no framer/no auth needed. */
function MiniSidebar({ name, s }: { name: string; s: SideStyle }) {
  const items = [
    { icon: LayoutDashboard, label: 'Boshqaruv', active: false },
    { icon: FilePlus, label: 'Yaratish', active: true },
    { icon: Users, label: 'Sinflar', active: false },
  ];
  return (
    <div className="rounded-m3-lg border border-outline-variant overflow-hidden bg-surface">
      <div className={cn('p-3 h-[228px] flex flex-col', s.bg)}>
        <div className="flex items-center gap-2 mb-3">
          <span className={cn('w-7 h-7 rounded-m3-sm flex items-center justify-center shrink-0', s.brandBox)}><BookOpen size={14} /></span>
          <b className={cn('text-[12px] font-bold truncate', s.brandTitle)}>Edify<span className={s.brandAccent}>Teacher</span></b>
        </div>
        {items.map(({ icon: Icon, label, active }) => (
          <span
            key={label}
            className={cn(
              'relative flex items-center gap-2 h-9 px-3 mb-1 text-[11.5px] font-medium',
              s.itemShape,
              s.indicator === 'bar' && 'pl-3.5',
              active ? cn(s.active, s.activeRowBg, 'font-bold') : s.idle,
            )}
          >
            {active && s.indicator === 'pill' && <span className={cn('absolute inset-0 rounded-full', s.indicatorCls)} />}
            {active && s.indicator === 'bar' && <span className={cn('absolute left-0 top-[10px] h-4 w-1 rounded-r-full', s.indicatorCls)} />}
            {active && s.indicator === 'dot' && <span className={cn('absolute left-1 top-[15px] w-1.5 h-1.5 rounded-full', s.indicatorCls)} />}
            <Icon size={14} className={cn('relative z-10 shrink-0', active && s.iconActive)} />
            <span className="relative z-10 truncate">{label}</span>
          </span>
        ))}
        <div className={cn('mt-auto pt-2 border-t flex items-center gap-2', s.footerBorder)}>
          <span className="w-7 h-7 rounded-m3-sm bg-primary text-on-primary text-[10px] font-bold flex items-center justify-center shrink-0">AK</span>
          <span className="min-w-0 flex-1">
            <b className={cn('block text-[10.5px] truncate', s.name)}>Aziza Karimova</b>
            <small className={cn('block text-[8.5px] truncate', s.email)}>a.karimova@edify.uz</small>
          </span>
          {s.classicFooter && <LogOut size={13} className={cn('shrink-0', s.email)} />}
        </div>
      </div>
      <p className="px-3 py-2 text-[11px] font-bold text-on-surface border-t border-outline-variant">{name}</p>
    </div>
  );
}

const MOBILE_BAR_ITEMS = [
  { icon: LayoutDashboard, label: 'Boshqaruv', active: true },
  { icon: FilePlus, label: 'Yaratish', active: false },
  { icon: Users, label: 'Sinflar', active: false },
  { icon: FolderOpen, label: 'Kutubxona', active: false },
];

/** Static miniature of one mobile bottom-bar variant. */
function MiniBar({ name, variant }: { name: string; variant: 'dock' | 'floating' | 'iconic' | 'topline' }) {
  const bar = (
    <div className={cn(
      'flex bg-t-bar-blur backdrop-blur-xl',
      variant === 'floating' ? 'rounded-full border border-t-glass-border shadow-elev-2 px-2 py-1' : 'border-t border-outline-variant px-1 pt-1 pb-1.5',
    )}>
      {MOBILE_BAR_ITEMS.map(({ icon: Icon, label, active }) => (
        <span key={label} className={cn(
          'flex-1 flex flex-col items-center gap-[2px] relative',
          variant === 'iconic' ? 'justify-center h-10' : variant === 'topline' ? 'pt-1.5 pb-0.5' : 'py-0.5',
          active ? (variant === 'iconic' || variant === 'topline' ? 'text-primary' : 'text-on-secondary-container') : 'text-on-surface-variant',
        )}>
          {active && (variant === 'dock' || variant === 'floating') && <span className="absolute -top-0.5 inset-x-0 mx-auto w-[44px] h-[24px] bg-secondary-container rounded-full" />}
          {active && variant === 'iconic' && <span className="absolute inset-y-1 inset-x-0 mx-auto w-[44px] bg-secondary-container rounded-full" />}
          {active && variant === 'topline' && <span className="absolute top-0 inset-x-0 mx-auto w-8 h-[3px] rounded-b-full bg-primary" />}
          <Icon size={17} className={cn('relative z-10', active && (variant === 'dock' || variant === 'floating') && 'text-primary')} />
          {variant !== 'iconic' && <span className="relative z-10 text-[8px] font-semibold">{label}</span>}
        </span>
      ))}
      <span className={cn('flex-1 flex flex-col items-center gap-[2px] text-on-surface-variant', variant === 'iconic' ? 'justify-center h-10' : variant === 'topline' ? 'pt-1.5 pb-0.5' : 'py-0.5')}>
        <Menu size={17} />
        {variant !== 'iconic' && <span className="text-[8px] font-semibold">Menyu</span>}
      </span>
    </div>
  );
  return (
    <div className="rounded-m3-lg border border-outline-variant overflow-hidden bg-surface">
      <div className="p-3 t-canvas">{bar}</div>
      <p className="px-3 py-2 text-[11px] font-bold text-on-surface border-t border-outline-variant">{name}</p>
    </div>
  );
}

export default function ThemeCheckTeacher() {
  const [stamped, setStamped] = useState(false);
  const [params, setParams] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState('a');

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const overrides: Record<string, string> = {};
    for (const [k, v] of q.entries()) overrides[k] = v;
    setParams(overrides);

    const el = document.documentElement;
    const attrs: Record<string, string> = { ...teacherThemeAttributes(), 'data-t-mode': 'light' };
    if (overrides.palette) attrs['data-t-palette'] = overrides.palette;
    if (overrides.mode) attrs['data-t-mode'] = overrides.mode;
    if (overrides.shape) attrs['data-t-shape'] = overrides.shape;
    if (overrides.density) attrs['data-t-density'] = overrides.density;
    if (overrides.font) attrs['data-t-font'] = overrides.font;
    if (overrides.bg) attrs['data-t-bg'] = overrides.bg;
    if (overrides.motion) attrs['data-t-motion'] = overrides.motion;
    if (overrides.button) attrs['data-t-button'] = overrides.button;
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    el.style.colorScheme = attrs['data-t-mode'];
    setStamped(true);
    return () => {
      for (const k of Object.keys(attrs)) el.removeAttribute(k);
      el.style.colorScheme = '';
    };
  }, []);

  const link = (patch: Record<string, string>) => {
    const q = new URLSearchParams({ ...params, ...patch });
    return `/theme-check-teacher?${q.toString()}`;
  };

  if (!stamped) return null;

  return (
    <div className="min-h-screen bg-surface t-canvas font-t-body text-on-surface pb-24">
      <div className="max-w-5xl mx-auto px-t-page-x py-t-page-y space-y-t-gap-lg">

        {/* Switcher strip */}
        <Card className="p-t-card space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {ALL_TEACHER_PALETTES.map((p) => (
              <a key={p} href={link({ palette: p })}
                className={cn("px-3 py-1.5 rounded-m3-sm text-[12px] font-semibold border",
                  (params.palette || 'indigo') === p ? "bg-primary text-on-primary border-transparent" : "border-outline-variant text-on-surface-variant hover:bg-state-hover")}>
                {p}
              </a>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MODES.map((m) => (
              <a key={m} href={link({ mode: m })}
                className={cn("px-3 py-1.5 rounded-m3-sm text-[12px] font-semibold border",
                  (params.mode || 'light') === m ? "bg-secondary-container text-on-secondary-container border-transparent" : "border-outline-variant text-on-surface-variant hover:bg-state-hover")}>
                {m}
              </a>
            ))}
            {['sharp', 'compact', 'soft', 'round'].map((s) => (
              <a key={s} href={link({ shape: s })} className="px-3 py-1.5 rounded-m3-sm text-[12px] font-medium border border-outline-variant text-on-surface-variant hover:bg-state-hover">{s}</a>
            ))}
            {['compact', 'comfortable', 'airy'].map((d) => (
              <a key={d} href={link({ density: d })} className="px-3 py-1.5 rounded-m3-sm text-[12px] font-medium border border-outline-variant text-on-surface-variant hover:bg-state-hover">{d}</a>
            ))}
          </div>
        </Card>

        <PageHeader title="Teacher kit gallery" subtitle="Every component, current switchboard values" />

        {/* Stat tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-t-gap">
          <StatTile label="Students" value="128" icon={<Users />} />
          <StatTile label="Avg score" value="87%" icon={<TrendingUp />} tone="success" />
          <StatTile label="AI credits" value="46" icon={<Zap />} tone="warning" />
          <StatTile label="Tests" value="312" icon={<BookOpen />} tone="tertiary" />
        </div>

        {/* Shell variants — static previews of the real recipes */}
        <Card className="p-t-card space-y-3">
          <CardHeader title="Sidebar shells (App_shell_navigation)" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-t-gap">
            {(Object.entries(SIDE_STYLES) as [string, SideStyle][]).map(([name, s]) => (
              <MiniSidebar key={name} name={name} s={s} />
            ))}
          </div>
          <p className="text-[11px] text-on-surface-variant">rail / floating / topbar / toolbar retseptni o&apos;zgartirmaydi — konteyner farq qiladi (rail = yig&apos;ilgan, floating = shisha karta, top*lar = yon panelsiz).</p>
          <CardHeader title="Mobile bars (Mobile_navigation)" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-t-gap max-w-[680px]">
            {(['dock', 'floating', 'iconic', 'topline'] as const).map((v) => (
              <MiniBar key={v} name={v} variant={v} />
            ))}
          </div>
        </Card>

        {/* Buttons */}
        <Card className="p-t-card space-y-3">
          <CardHeader title="Buttons" />
          <div className="flex flex-wrap items-center gap-2">
            <Button icon={<Plus />}>Filled</Button>
            <Button variant="tonal">Tonal</Button>
            <Button variant="outlined">Outlined</Button>
            <Button variant="text">Text</Button>
            <Button variant="danger">Danger</Button>
            <Button disabled>Disabled</Button>
            <IconButton aria-label="Qidirish"><Search /></IconButton>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm">Small</Button>
            <Button>Medium</Button>
            <Button size="lg">Large</Button>
          </div>
        </Card>

        {/* Chips + banner */}
        <Card className="p-t-card space-y-3">
          <CardHeader title="Chips & status" />
          <div className="flex flex-wrap gap-2">
            <Chip>Default</Chip>
            <Chip selected>Selected</Chip>
            <StatusChip tone="success">Active</StatusChip>
            <StatusChip tone="warning">Pending</StatusChip>
            <StatusChip tone="error">Overdue</StatusChip>
            <StatusChip tone="info">Scheduled</StatusChip>
          </div>
          <Banner tone="info" title="Heads up">Switchboard preview — change one word in design.teacher.config.ts.</Banner>
        </Card>

        {/* Forms */}
        <Card className="p-t-card space-y-4">
          <CardHeader title="Forms" />
          <div className="grid md:grid-cols-2 gap-t-gap">
            <TextField label="Test nomi" placeholder="Algebra — 1-chorak" />
            <TextField label="Xato holat" error="Majburiy maydon" defaultValue="…" />
            <Select label="Sinf">
              <option>9-A</option><option>9-B</option>
            </Select>
            <SearchBar placeholder="Qidirish…" />
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-[13px]"><Switch defaultChecked /> Switch</label>
            <label className="flex items-center gap-2 text-[13px]"><Checkbox defaultChecked /> Checkbox</label>
            <label className="flex items-center gap-2 text-[13px]"><Radio name="r" defaultChecked /> Radio</label>
          </div>
        </Card>

        {/* Tabs + table */}
        <Card className="p-t-card space-y-4">
          <CardHeader title="Tabs & table" />
          <Tabs
            tabs={[{ id: 'a', label: 'Umumiy' }, { id: 'b', label: 'Baholar' }, { id: 'c', label: 'Davomat' }]}
            value={tab}
            onChange={setTab}
          />
          <Table>
            <thead><tr><Th>Student</Th><Th>Score</Th><Th>Status</Th></tr></thead>
            <tbody>
              <TRow><Td>Aziza K.</Td><Td>92</Td><Td><StatusChip tone="success">Graded</StatusChip></Td></TRow>
              <TRow><Td>Bekzod T.</Td><Td>77</Td><Td><StatusChip tone="warning">Pending</StatusChip></Td></TRow>
              <TRow><Td>Dilnoza R.</Td><Td>—</Td><Td><StatusChip tone="error">Missing</StatusChip></Td></TRow>
            </tbody>
          </Table>
        </Card>

        {/* List + progress */}
        <div className="grid md:grid-cols-2 gap-t-gap">
          <Card className="p-t-card space-y-1">
            <CardHeader title="List" />
            <ListItem leading={<Avatar>AK</Avatar>} title="Aziza Karimova" subtitle="9-A sinf" trailing={<Badge>3</Badge>} />
            <ListItem leading={<Avatar tone="tertiary">BT</Avatar>} title="Bekzod Toshmatov" subtitle="9-B sinf" trailing={<Badge tone="error">!</Badge>} />
          </Card>
          <Card className="p-t-card space-y-4">
            <CardHeader title="Progress & loading" />
            <ProgressBar value={64} />
            <div className="flex items-center gap-6">
              <Spinner />
              <Skeleton className="h-6 w-28" />
              <Loader className="flex-1" />
            </div>
          </Card>
        </div>

        {/* Card variants side by side */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-t-gap">
          {(['elevated', 'filled', 'outlined', 'glass', 'flat', 'tonal'] as const).map((v) => (
            <Card key={v} variant={v} className="p-t-card">
              <p className="text-[12px] font-bold">{v}</p>
              <p className="text-[11px] text-on-surface-variant mt-1">Card variant</p>
            </Card>
          ))}
        </div>

        {/* Dialog + empty state */}
        <Card className="p-t-card space-y-3">
          <CardHeader title="Dialog & empty state" />
          <Button variant="tonal" onClick={() => setDialogOpen(true)}>Open dialog</Button>
          <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Dialog sarlavhasi">
            <p className="text-[13.5px] text-on-surface-variant">Sheet on mobile, centered on desktop (per Dialog_style).</p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="text" onClick={() => setDialogOpen(false)}>Yopish</Button>
              <Button onClick={() => setDialogOpen(false)}>Saqlash</Button>
            </div>
          </Dialog>
          <EmptyState icon={<Inbox />} title="Hali test yo'q" description="Birinchi testingizni yarating." action={<Button size="sm" icon={<Plus />}>Yaratish</Button>} />
        </Card>

      </div>
    </div>
  );
}
