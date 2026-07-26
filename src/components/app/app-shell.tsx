import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard, TrendingUp, Megaphone, Factory, Package, Wallet,
  Users, UserSquare2, Sparkles, Search, Bell, Sun, Moon, Menu, Command as CmdIcon, Plug,
  Plus, LogOut,
} from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { AIAssistant } from "./ai-assistant";
import { notifications } from "@/lib/mock-data";
import { useRole, type AppRole } from "@/hooks/use-role";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; hint: string; roles?: AppRole[] };

export const NAV: readonly NavItem[] = [
  { to: "/",             label: "Executive",    icon: LayoutDashboard, hint: "Overview",           roles: ["ceo"] },
  { to: "/sales",        label: "Sales",        icon: TrendingUp,      hint: "Revenue & channels", roles: ["ceo"] },
  { to: "/marketing",    label: "Marketing",    icon: Megaphone,       hint: "Ads & campaigns",    roles: ["ceo"] },
  { to: "/production",   label: "Production",   icon: Factory,         hint: "Batches & yield",    roles: ["ceo"] },
  { to: "/inventory",    label: "Inventory",    icon: Package,         hint: "Stock & reorder",    roles: ["ceo"] },
  { to: "/finance",      label: "Finance",      icon: Wallet,          hint: "P&L & cash",         roles: ["ceo"] },
  { to: "/crm",          label: "CRM",          icon: UserSquare2,     hint: "Leads & pipeline",   roles: ["ceo"] },
  { to: "/team",         label: "Team",         icon: Users,           hint: "HR & KPIs",          roles: ["ceo"] },
  { to: "/ai",           label: "AI Advisor",   icon: Sparkles,        hint: "Ask anything",       roles: ["ceo", "salesperson"] },
  { to: "/entry",        label: "Add Sales",    icon: Plus,            hint: "Manual entry",       roles: ["ceo", "salesperson"] },
  { to: "/integrations", label: "Integrations", icon: Plug,            hint: "Shopify, Meta, Amazon…", roles: ["ceo", "salesperson"] },
];


function SidebarContent({ onNavigate, role }: { onNavigate?: () => void; role: AppRole | null }) {

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const visible = NAV.filter((n) => !n.roles || (role && n.roles.includes(role)));
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5 flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground grid place-items-center text-sm font-bold">C</div>
        <div>
          <div className="text-sm font-semibold tracking-tight">Company OS</div>
          <div className="text-[11px] text-muted-foreground -mt-0.5">Business Intelligence</div>
        </div>
      </div>
      <nav className="px-3 flex-1 space-y-0.5 overflow-y-auto">
        {visible.map(({ to, label, icon: Icon, hint }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
              title={hint}
            >
              <Icon className={cn("h-4 w-4", active ? "opacity-100" : "opacity-70 group-hover:opacity-100")} />
              <span className="flex-1">{label}</span>
              {to === "/ai" && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">new</Badge>}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t">
        <div className="rounded-xl p-3 bg-sidebar-accent/60">
          <div className="text-xs font-medium">
            {role === "ceo" ? "CEO workspace" : role === "salesperson" ? "Salesperson access" : "Loading…"}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {role === "ceo"
              ? "Full access to all dashboards & data."
              : "Add sales & pull data from Shopify and Amazon."}
          </div>
        </div>
      </div>
    </div>
  );
}


export function AppShell({ children }: { children: ReactNode }) {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { role, email, name, avatar } = useRole();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmdOpen((v) => !v); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") { e.preventDefault(); setAiOpen((v) => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  // Public routes render bare (no shell chrome)
  if (pathname === "/auth") {
    return <div className="min-h-screen bg-background text-foreground">{children}</div>;
  }

  const initials = (name ?? email ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 border-r bg-sidebar text-sidebar-foreground">
        <SidebarContent role={role} />
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 glass border-b">
          <div className="h-14 px-3 md:px-6 flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72">
                <SidebarContent role={role} />
              </SheetContent>
            </Sheet>

            <button
              onClick={() => setCmdOpen(true)}
              className="flex-1 max-w-md flex items-center gap-2 h-9 px-3 rounded-lg border bg-card text-sm text-muted-foreground hover:bg-accent transition-colors"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Search anything…</span>
              <span className="sm:hidden">Search</span>
              <span className="ml-auto hidden md:inline-flex items-center gap-1 text-[10px] font-medium">
                <kbd className="rounded border px-1.5 py-0.5">⌘K</kbd>
              </span>
            </button>

            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setDark((v) => !v)} aria-label="Toggle theme">
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-4 w-4" />
                    <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-destructive" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notifications.map((n) => (
                    <DropdownMenuItem key={n.id} className="flex-col items-start gap-0.5 py-2">
                      <div className="text-sm">{n.title}</div>
                      <div className="text-[11px] text-muted-foreground">{n.time} ago</div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {role === "ceo" && (
                <Button size="sm" variant="secondary" onClick={() => setAiOpen(true)} className="gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Ask AI</span>
                  <kbd className="hidden md:inline rounded border px-1 text-[10px]">⌘J</kbd>
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full ml-1">
                    <Avatar className="h-7 w-7">
                      {avatar && <AvatarImage src={avatar} alt={name ?? ""} />}
                      <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="flex-col items-start gap-0.5">
                    <div className="text-sm truncate max-w-full">{name ?? "Signed in"}</div>
                    <div className="text-[11px] font-normal text-muted-foreground truncate max-w-full">{email}</div>
                    {role && (
                      <Badge variant="secondary" className="mt-1 text-[10px] uppercase">
                        {role === "ceo" ? "CEO" : "Salesperson"}
                      </Badge>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={signOut} className="gap-2 text-destructive focus:text-destructive">
                    <LogOut className="h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="p-4 md:p-6 max-w-[1400px] mx-auto">{children}</main>
      </div>


      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Search modules, actions, reports…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Navigate">
            {NAV.map((n) => (
              <CommandItem
                key={n.to}
                onSelect={() => { setCmdOpen(false); window.history.pushState({}, "", n.to); window.dispatchEvent(new PopStateEvent("popstate")); }}
              >
                <n.icon className="h-4 w-4" />
                <span>{n.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">{n.hint}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Quick actions">
            <CommandItem onSelect={() => { setCmdOpen(false); setAiOpen(true); }}>
              <Sparkles className="h-4 w-4" /> Ask the AI advisor
            </CommandItem>
            <CommandItem><CmdIcon className="h-4 w-4" /> Generate weekly report</CommandItem>
            <CommandItem><CmdIcon className="h-4 w-4" /> Export CSV — Sales</CommandItem>
            <CommandItem><CmdIcon className="h-4 w-4" /> Add reorder alert</CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <AIAssistant open={aiOpen} onOpenChange={setAiOpen} />
    </div>
  );
}
