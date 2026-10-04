"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileCheck2, Gauge, GitBranch, Menu, PlayCircle, ScrollText, Settings, SquarePen, Target, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/client";
import { BrandMark } from "./brand";
import { broadcastRefresh, useExperience } from "./experience-provider";
import { useHealth } from "./health-provider";

type Convo = { id: string; title: string; updatedAt: string; status: "idle" | "running" | "waiting" };

const UNDER_THE_HOOD = [
  { href: "/dashboard", label: "Live monitor", icon: Gauge },
  { href: "/simulation", label: "Simulations", icon: PlayCircle },
  { href: "/trajectories", label: "Trajectories", icon: GitBranch },
  { href: "/intents", label: "Intents", icon: Target },
  { href: "/policies", label: "Policies", icon: ScrollText },
];

function groupLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const days = Math.floor((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "Previous 7 days";
  return "Older";
}

function NavLink({ href, label, icon: Icon, active, onNavigate }: { href: string; label: string; icon: typeof Settings; active: boolean; onNavigate: () => void }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn("flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors", active ? "bg-side-active text-fog" : "text-fog-dim hover:bg-side-hover hover:text-fog")}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { experience } = useExperience();
  const { health } = useHealth();
  const [convos, setConvos] = useState<Convo[] | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setConvos((await api<{ conversations: Convo[] }>("/api/conversations")).conversations);
    } catch {
      setConvos((c) => c ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 8000);
    const onRefresh = () => void load();
    window.addEventListener("ig:refresh", onRefresh);
    return () => {
      clearInterval(t);
      window.removeEventListener("ig:refresh", onRefresh);
    };
  }, [load]);

  useEffect(() => setOpen(false), [pathname]);

  const remove = async (c: Convo) => {
    if (!window.confirm(`Delete “${c.title}”? Its action receipts stay in the audit log.`)) return;
    try {
      await api(`/api/conversations/${c.id}`, { method: "DELETE" });
      setConvos((list) => list?.filter((x) => x.id !== c.id) ?? null);
      if (pathname === `/chat/${c.id}`) router.push("/chat");
      broadcastRefresh();
    } catch {
      /* ignore */
    }
  };

  const groups: [string, Convo[]][] = [];
  for (const c of convos ?? []) {
    const label = groupLabel(c.updatedAt);
    const g = groups.find(([l]) => l === label);
    if (g) g[1].push(c);
    else groups.push([label, [c]]);
  }

  const close = () => setOpen(false);
  const agentLine = !health
    ? "Checking agent…"
    : health.demoMode
      ? "Demo agent (no model connected)"
      : `Agent model: ${health.model}`;

  const panel = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 pb-2 pt-4">
        <Link href="/chat" onClick={close} className="flex items-center gap-2 rounded-md px-1.5 py-1">
          <BrandMark className="size-7" />
          <span className="font-display text-[19px] font-semibold tracking-tight text-fog">IntentGuard</span>
        </Link>
        <button type="button" className="rounded-md p-1.5 text-fog-dim hover:bg-side-hover md:hidden" aria-label="Close menu" onClick={close}>
          <X className="size-5" />
        </button>
      </div>
      <div className="px-3">
        <Link
          href="/chat"
          onClick={close}
          className="flex items-center gap-2.5 rounded-md border border-steel-soft bg-ink-2 px-2.5 py-2 text-sm font-medium text-fog shadow-card hover:bg-ink"
        >
          <SquarePen className="size-4 text-signal" aria-hidden />
          New chat
        </Link>
      </div>

      <nav aria-label="Recent chats" className="mt-4 min-h-0 flex-1 overflow-y-auto px-3">
        {convos === null ? (
          <p className="px-2.5 text-xs text-fog-mute">Loading…</p>
        ) : convos.length === 0 ? (
          <p className="px-2.5 text-xs leading-relaxed text-fog-mute">Your chats will show up here.</p>
        ) : (
          groups.map(([label, list]) => (
            <div key={label} className="mb-3">
              <h3 className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-fog-mute">{label}</h3>
              <ul>
                {list.map((c) => {
                  const active = pathname === `/chat/${c.id}`;
                  return (
                    <li key={c.id} className="group relative">
                      <Link
                        href={`/chat/${c.id}`}
                        onClick={close}
                        aria-current={active ? "page" : undefined}
                        className={cn("flex items-center gap-2 rounded-md py-1.5 pl-2.5 pr-8 text-sm", active ? "bg-side-active text-fog" : "text-fog-dim hover:bg-side-hover hover:text-fog")}
                      >
                        <span className="truncate">{c.title}</span>
                        {c.status === "waiting" ? <span className="ml-auto size-2 shrink-0 rounded-full bg-warn" aria-label="Needs your approval" title="Needs your approval" /> : null}
                        {c.status === "running" ? <span className="ml-auto size-2 shrink-0 animate-pulse rounded-full bg-signal motion-reduce:animate-none" aria-label="Working" title="Working" /> : null}
                      </Link>
                      <button
                        type="button"
                        aria-label={`Delete ${c.title}`}
                        onClick={() => remove(c)}
                        className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 rounded p-1 text-fog-mute hover:bg-side-active hover:text-block group-hover:block group-focus-within:block"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </nav>

      <div className="space-y-0.5 border-t border-steel-line px-3 py-3">
        {experience.showWorking ? (
          <div className="mb-2">
            <h3 className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-fog-mute">Under the hood</h3>
            {UNDER_THE_HOOD.map((n) => (
              <NavLink key={n.href} {...n} active={pathname.startsWith(n.href)} onNavigate={close} />
            ))}
          </div>
        ) : null}
        <NavLink href="/receipts" label="Action receipts" icon={FileCheck2} active={pathname.startsWith("/receipts")} onNavigate={close} />
        <NavLink href="/settings" label="Settings" icon={Settings} active={pathname.startsWith("/settings")} onNavigate={close} />
        <p className="truncate px-2.5 pt-2 text-[11px] text-fog-mute" title={agentLine}>
          {agentLine}
        </p>
      </div>
    </div>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-steel-line bg-ink/90 px-3 py-2 backdrop-blur md:hidden">
        <button type="button" className="rounded-md p-1.5 text-fog-dim hover:bg-ink-3" aria-label="Open menu" onClick={() => setOpen(true)}>
          <Menu className="size-5" />
        </button>
        <BrandMark className="size-6" />
        <span className="font-display text-base font-semibold">IntentGuard</span>
        <Link href="/chat" className="ml-auto rounded-md p-1.5 text-fog-dim hover:bg-ink-3" aria-label="New chat">
          <SquarePen className="size-5" />
        </Link>
      </div>
      <aside className="hidden h-screen w-[264px] shrink-0 border-r border-steel-line bg-side md:sticky md:top-0 md:block">{panel}</aside>
      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-fog/30" onClick={close} />
          <aside className="absolute inset-y-0 left-0 w-[280px] bg-side shadow-pop">{panel}</aside>
        </div>
      ) : null}
    </>
  );
}
