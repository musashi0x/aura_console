"use client";

import { useCallback, useEffect, useRef, useState, useId } from "react";
import {
  Check,
  Plus,
  X,
  ArrowRight,
  ArrowLeft,
  Briefcase,
  Code,
  Palette,
  Activity,
  Search,
  Share2,
  Users,
  Sparkles,
  Building2,
  Globe,
  Mail,
  CheckCircle2,
  Layers,
  FileText,
  Workflow,
  BarChart3,
} from "lucide-react";

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

function useScrollEdges() {
  const containerRef = useRef<HTMLFormElement | null>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const update = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setEdges({
      start: scrollTop > 2,
      end: scrollTop + clientHeight < scrollHeight - 2,
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    update();
    const RO = el.ownerDocument.defaultView?.ResizeObserver;
    const ro = RO ? new RO(update) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [update]);

  return { containerRef, edges, onScroll: update };
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 dark:focus-visible:ring-white dark:focus-visible:ring-offset-neutral-950";

const transitionSmooth =
  "transition-all duration-200 ease-out";

export interface OnboardingWizardProps {
  onFinish?: (data: OnboardingWizardData) => void;
  onSkip?: () => void;
}

export interface OnboardingWizardData {
  name: string;
  title: string;
  role: string;
  source: string;
  workspace: string;
  goals: string[];
  invites: string[];
}

const STEPS = [
  { id: "profile", label: "Profile", blurb: "Basic profile details" },
  { id: "role", label: "Role", blurb: "Tune starter views" },
  { id: "source", label: "Source", blurb: "Optional discovery signal" },
  { id: "workspace", label: "Workspace", blurb: "Name your workspace" },
  { id: "goals", label: "Goals", blurb: "Pick first workflows" },
  { id: "invite", label: "Invite", blurb: "Bring your team in" },
] as const;

const ROLES = [
  {
    id: "Engineering",
    label: "Engineering",
    description: "Code repositories, CI/CD pipelines, and agent automation",
    icon: Code,
  },
  {
    id: "Product",
    label: "Product",
    description: "Feature specs, roadmap prioritization, and team handoffs",
    icon: Briefcase,
  },
  {
    id: "Design",
    label: "Design",
    description: "Design systems, UI kits, and visual assets",
    icon: Palette,
  },
  {
    id: "Operations",
    label: "Operations",
    description: "Resource scheduling, guardrail policies, and delivery reports",
    icon: Activity,
  },
];

const SOURCES = [
  { id: "Search", label: "Search engine", icon: Search },
  { id: "Social", label: "Social media / X", icon: Share2 },
  { id: "Colleague", label: "Colleague / Friend", icon: Users },
  { id: "Conference", label: "Conference / Event", icon: Sparkles },
];

const GOALS = [
  {
    id: "Track work across teams",
    label: "Track work across teams",
    description: "Real-time visibility into multi-agent and cross-functional tasks",
    icon: Layers,
  },
  {
    id: "Automate handoffs",
    label: "Automate handoffs",
    description: "Connect workflows so tickets progress without manual pinging",
    icon: Workflow,
  },
  {
    id: "Report on delivery",
    label: "Report on delivery",
    description: "Live progress reports and historical delivery velocity",
    icon: BarChart3,
  },
  {
    id: "Centralise documents",
    label: "Centralise documents",
    description: "Keep specs, architecture decision records, and docs unified",
    icon: FileText,
  },
];

const HEADINGS: Record<string, { title: string; blurb: string }> = {
  profile: {
    title: "Set up your profile",
    blurb: "Add the details your team will see across the workspace.",
  },
  role: {
    title: "What is your primary focus?",
    blurb: "We tailor your default navigation and starter views based on your role.",
  },
  source: {
    title: "How did you hear about us?",
    blurb: "Optional signal that helps shape our roadmap.",
  },
  workspace: {
    title: "Name your workspace",
    blurb: "Your shared environment where runs, counterparties, and missions live.",
  },
  goals: {
    title: "What would you like to set up first?",
    blurb: "Select as many as apply. You can customize these at any time.",
  },
  invite: {
    title: "Invite your teammates",
    blurb: "Collaborate together. You can always invite more people later.",
  },
};

export function OnboardingWizard({ onFinish, onSkip }: OnboardingWizardProps) {
  const { containerRef, edges, onScroll } = useScrollEdges();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("Sam Rivera");
  const [title, setTitle] = useState("Product Lead");
  const [role, setRole] = useState("Product");
  const [source, setSource] = useState("");
  const [workspace, setWorkspace] = useState("Northwind");
  const [goals, setGoals] = useState<string[]>([GOALS[0]?.id ?? "Track work across teams"]);
  const [invites, setInvites] = useState([""]);
  const [isCompleted, setIsCompleted] = useState(false);

  const nameInputId = useId();
  const titleInputId = useId();
  const workspaceInputId = useId();

  const current = STEPS[step] ?? STEPS[0]!;
  const heading = HEADINGS[current.id] ?? HEADINGS.profile!;
  const isLast = step === STEPS.length - 1;

  const toggleGoal = (id: string) => {
    setGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  };

  const handleAddInvite = () => {
    setInvites((prev) => [...prev, ""]);
  };

  const handleRemoveInvite = (index: number) => {
    setInvites((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateInvite = (index: number, val: string) => {
    setInvites((prev) => prev.map((v, i) => (i === index ? val : v)));
  };

  const cleanSlug =
    workspace.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") ||
    "my-workspace";

  const getInitials = (n: string) => {
    const parts = n.trim().split(/\s+/).filter(Boolean);
    const first = parts[0];
    const second = parts[1];
    if (first && second) {
      return `${first[0] ?? ""}${second[0] ?? ""}`.toUpperCase();
    }
    return (n.trim().slice(0, 2) || "OP").toUpperCase();
  };

  const canProceed = () => {
    if (current.id === "profile") return name.trim().length > 0;
    if (current.id === "workspace") return workspace.trim().length > 0;
    return true;
  };

  const handleNext = () => {
    if (!canProceed()) return;
    if (!isLast) {
      setStep((s) => s + 1);
    } else {
      setIsCompleted(true);
      onFinish?.({
        name,
        title,
        role,
        source,
        workspace,
        goals,
        invites: invites.filter((email) => email.trim().length > 0),
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && (e.metaKey || e.ctrlKey || e.target instanceof HTMLInputElement)) {
      e.preventDefault();
      handleNext();
    }
  };

  if (isCompleted) {
    return (
      <div className="flex h-full min-h-[640px] w-full items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-950">
        <div className="flex w-full max-w-md flex-col items-center text-center rounded-2xl border border-neutral-200 bg-white p-10 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h3 className="mt-5 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            You are all set!
          </h3>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Welcome, <span className="font-medium text-neutral-900 dark:text-neutral-200">{name}</span>. Workspace{" "}
            <span className="font-medium text-neutral-900 dark:text-neutral-200">{workspace}</span> is ready for your team.
          </p>

          <div className="mt-6 w-full rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-left text-xs dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex justify-between py-1">
              <span className="text-neutral-500">Focus Area</span>
              <span className="font-medium text-neutral-800 dark:text-neutral-200">{role}</span>
            </div>
            <div className="flex justify-between py-1 border-t border-neutral-200 dark:border-neutral-800">
              <span className="text-neutral-500">Workspace URL</span>
              <span className="font-mono text-neutral-800 dark:text-neutral-200">northwind.app/{cleanSlug}</span>
            </div>
            <div className="flex justify-between py-1 border-t border-neutral-200 dark:border-neutral-800">
              <span className="text-neutral-500">Selected Goals</span>
              <span className="font-medium text-neutral-800 dark:text-neutral-200">{goals.length} active</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onFinish?.({
              name,
              title,
              role,
              source,
              workspace,
              goals,
              invites: invites.filter((email) => email.trim().length > 0),
            })}
            className={cx(
              "mt-8 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-5 text-sm font-medium text-white hover:bg-neutral-800 active:scale-[0.98] dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100",
              transitionSmooth,
              focusRing
            )}
          >
            Go to Console
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onKeyDown={handleKeyDown}
      className="relative flex h-full min-h-[700px] w-full overflow-hidden bg-neutral-50/75 dark:bg-neutral-950"
    >
      {/* Sidebar Stepper - Desktop */}
      <aside className="hidden w-72 shrink-0 flex-col justify-between border-r border-neutral-200 bg-white/60 p-6 backdrop-blur lg:flex dark:border-neutral-800/80 dark:bg-neutral-950/40">
        <div>
          <div className="flex items-center gap-2.5 pb-8">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white font-semibold text-sm dark:bg-white dark:text-neutral-950">
              A
            </div>
            <span className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              Aura Setup
            </span>
          </div>

          <ol className="space-y-1">
            {STEPS.map((item, i) => {
              const isDone = i < step;
              const isActive = i === step;
              const isAccessible = i <= step;

              return (
                <li key={item.id} className="relative">
                  <button
                    type="button"
                    disabled={!isAccessible}
                    onClick={() => setStep(i)}
                    aria-current={isActive ? "step" : undefined}
                    className={cx(
                      "group flex w-full items-start gap-3.5 rounded-xl px-2.5 py-2.5 text-left text-xs",
                      isActive
                        ? "bg-neutral-100/90 dark:bg-neutral-800/60 font-medium"
                        : isAccessible
                        ? "hover:bg-neutral-100/50 dark:hover:bg-neutral-900/50 cursor-pointer"
                        : "opacity-40 cursor-not-allowed",
                      transitionSmooth,
                      focusRing
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cx(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
                        isDone
                          ? "bg-emerald-500 text-white dark:bg-emerald-400 dark:text-neutral-950"
                          : isActive
                          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm"
                          : "border border-neutral-300 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400",
                        transitionSmooth
                      )}
                    >
                      {isDone ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                    </span>

                    <span className="min-w-0 flex-1 pt-0.5">
                      <span
                        className={cx(
                          "block truncate text-[13px]",
                          isActive || isDone
                            ? "text-neutral-900 dark:text-neutral-100 font-medium"
                            : "text-neutral-500 dark:text-neutral-400"
                        )}
                      >
                        {item.label}
                      </span>
                      <span className="block truncate text-[11px] text-neutral-400 dark:text-neutral-500">
                        {item.blurb}
                      </span>
                    </span>
                  </button>

                  {i < STEPS.length - 1 && (
                    <span
                      aria-hidden="true"
                      className={cx(
                        "ml-[21px] block h-2.5 w-px my-0.5",
                        i < step ? "bg-emerald-500/50 dark:bg-emerald-400/50" : "bg-neutral-200 dark:bg-neutral-800"
                      )}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors py-2 text-left"
          >
            Skip setup for now &rarr;
          </button>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-6 lg:p-10">
        {/* Mobile Stepper Header */}
        <div className="mb-4 lg:hidden">
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1.5">
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              Step {step + 1} of {STEPS.length}: {current.label}
            </span>
            <span>{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
            <div
              className="h-full bg-neutral-900 dark:bg-white transition-all duration-300 ease-out"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="relative mx-auto flex h-full w-full max-w-xl flex-1 flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <form
            ref={containerRef}
            onScroll={onScroll}
            onSubmit={(e) => {
              e.preventDefault();
              handleNext();
            }}
            className="flex h-full w-full flex-col justify-between overflow-y-auto p-6 sm:p-10"
          >
            <div className="mx-auto w-full max-w-md flex-1">
              {/* Header */}
              <div className="border-b border-neutral-100 pb-5 dark:border-neutral-800/60">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                  Step {step + 1} &bull; {current.label}
                </span>
                <h2 className="mt-2 text-xl sm:text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
                  {heading.title}
                </h2>
                <p className="mt-1 text-xs sm:text-[13px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  {heading.blurb}
                </p>
              </div>

              {/* Step Forms */}
              <div className="mt-6 space-y-4">
                {/* STEP 1: Profile */}
                {current.id === "profile" && (
                  <div className="space-y-4">
                    {/* Live Avatar Preview */}
                    <div className="flex items-center gap-4 rounded-xl border border-neutral-100 bg-neutral-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-950/50">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neutral-900 font-semibold text-sm text-white dark:bg-white dark:text-neutral-900 shadow-sm">
                        {getInitials(name)}
                      </div>
                      <div className="min-w-0 flex-1 text-xs">
                        <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                          {name.trim() || "Your Name"}
                        </p>
                        <p className="text-neutral-400 dark:text-neutral-500 truncate">
                          {title.trim() || "Your Role"}
                        </p>
                      </div>
                      <span className="text-[11px] text-neutral-400 font-medium">Preview</span>
                    </div>

                    <div>
                      <label htmlFor={nameInputId} className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id={nameInputId}
                        autoFocus
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Alex Chen"
                        className={cx(
                          "mt-1.5 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500",
                          transitionSmooth,
                          focusRing
                        )}
                      />
                    </div>

                    <div>
                      <label htmlFor={titleInputId} className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        Job Title
                      </label>
                      <input
                        id={titleInputId}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Staff Engineer or Product Lead"
                        className={cx(
                          "mt-1.5 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500",
                          transitionSmooth,
                          focusRing
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* STEP 2: Role */}
                {current.id === "role" && (
                  <div role="radiogroup" aria-label="Role" className="space-y-2.5">
                    {ROLES.map((item) => {
                      const isSelected = item.id === role;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => setRole(item.id)}
                          className={cx(
                            "flex w-full items-start gap-3.5 rounded-xl border p-3 text-left active:scale-[0.99]",
                            isSelected
                              ? "border-neutral-900 bg-neutral-50/80 shadow-xs dark:border-white dark:bg-neutral-800/80"
                              : "border-neutral-200/80 hover:border-neutral-300 bg-white hover:bg-neutral-50/50 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-800/40",
                            transitionSmooth,
                            focusRing
                          )}
                        >
                          <div
                            className={cx(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                              isSelected
                                ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                                : "border-neutral-200 bg-neutral-100 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                {item.label}
                              </span>
                              <span
                                className={cx(
                                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                                  isSelected
                                    ? "border-neutral-900 dark:border-neutral-100"
                                    : "border-neutral-300 dark:border-neutral-700"
                                )}
                              >
                                {isSelected && (
                                  <span className="h-2 w-2 rounded-full bg-neutral-900 dark:bg-neutral-100" />
                                )}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* STEP 3: Source (Optional Discovery) */}
                {current.id === "source" && (
                  <div className="space-y-3">
                    <div role="radiogroup" aria-label="Source" className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {SOURCES.map((item) => {
                        const isSelected = item.id === source;
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => setSource(item.id)}
                            className={cx(
                              "flex flex-col items-start gap-2.5 rounded-xl border p-3.5 text-left active:scale-[0.99]",
                              isSelected
                                ? "border-neutral-900 bg-neutral-50 dark:border-white dark:bg-neutral-800"
                                : "border-neutral-200 hover:border-neutral-300 bg-white hover:bg-neutral-50/50 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-850",
                              transitionSmooth,
                              focusRing
                            )}
                          >
                            <div
                              className={cx(
                                "flex h-8 w-8 items-center justify-center rounded-lg border",
                                isSelected
                                  ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                                  : "border-neutral-200 bg-neutral-100 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"
                              )}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                              {item.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-2 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setSource("");
                          setStep((s) => s + 1);
                        }}
                        className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 underline underline-offset-4"
                      >
                        Skip this optional question
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 4: Workspace */}
                {current.id === "workspace" && (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor={workspaceInputId} className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        Workspace Name <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative mt-1.5 flex items-center">
                        <Building2 className="absolute left-3.5 h-4 w-4 text-neutral-400" />
                        <input
                          id={workspaceInputId}
                          autoFocus
                          required
                          value={workspace}
                          onChange={(e) => setWorkspace(e.target.value)}
                          placeholder="e.g. Acme Corp"
                          className={cx(
                            "h-10 w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500",
                            transitionSmooth,
                            focusRing
                          )}
                        />
                      </div>
                    </div>

                    {/* Live Domain Preview */}
                    <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-3.5 dark:border-neutral-800 dark:bg-neutral-950/60">
                      <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                        <Globe className="h-3.5 w-3.5 text-neutral-400" />
                        <span>Console Access URL:</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 font-mono text-xs font-medium text-neutral-800 dark:text-neutral-200">
                        <span className="text-neutral-400">https://</span>
                        <span className="rounded bg-white px-1.5 py-0.5 border border-neutral-200 dark:border-neutral-800 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100">
                          northwind.app/{cleanSlug}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 5: Goals (Multi-select) */}
                {current.id === "goals" && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
                      <span>{goals.length} selected</span>
                      <button
                        type="button"
                        onClick={() => setGoals(GOALS.map((g) => g.id))}
                        className="text-xs text-neutral-600 dark:text-neutral-400 hover:underline"
                      >
                        Select all
                      </button>
                    </div>

                    {GOALS.map((item) => {
                      const isSelected = goals.includes(item.id);
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => toggleGoal(item.id)}
                          className={cx(
                            "flex w-full items-start gap-3.5 rounded-xl border p-3 text-left active:scale-[0.99]",
                            isSelected
                              ? "border-neutral-900 bg-neutral-50/90 dark:border-white dark:bg-neutral-800"
                              : "border-neutral-200 hover:border-neutral-300 bg-white hover:bg-neutral-50/40 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-850",
                            transitionSmooth,
                            focusRing
                          )}
                        >
                          <div
                            className={cx(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                              isSelected
                                ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                                : "border-neutral-200 bg-neutral-100 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs sm:text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
                                {item.label}
                              </span>
                              <span
                                className={cx(
                                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                  isSelected
                                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                                    : "border-neutral-300 text-transparent dark:border-neutral-700"
                                )}
                              >
                                <Check className="h-3 w-3 stroke-[3]" />
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* STEP 6: Invites */}
                {current.id === "invite" && (
                  <div className="space-y-3">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Team members will receive an invite to join <strong className="text-neutral-800 dark:text-neutral-200">{workspace}</strong>.
                    </p>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {invites.map((email, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                            <input
                              type="email"
                              value={email}
                              onChange={(e) => handleUpdateInvite(idx, e.target.value)}
                              placeholder="colleague@company.com"
                              className={cx(
                                "h-10 w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-3.5 text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500",
                                transitionSmooth,
                                focusRing
                              )}
                            />
                          </div>

                          {invites.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveInvite(idx)}
                              title="Remove invite"
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 text-neutral-400 hover:border-rose-300 hover:text-rose-500 dark:border-neutral-800 dark:hover:border-rose-900 dark:hover:text-rose-400 transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={handleAddInvite}
                        className={cx(
                          "inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-3 text-xs font-medium text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50 active:scale-[0.98] dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800",
                          transitionSmooth
                        )}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add another teammate
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setInvites([]);
                          handleNext();
                        }}
                        className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 underline underline-offset-4"
                      >
                        I&apos;ll invite later
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-8 flex items-center justify-between border-t border-neutral-100 pt-5 dark:border-neutral-800/80">
                <div>
                  {step > 0 && (
                    <button
                      type="button"
                      onClick={() => setStep((s) => s - 1)}
                      className={cx(
                        "inline-flex h-10 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-4 text-xs sm:text-sm font-medium text-neutral-700 hover:bg-neutral-50 active:scale-[0.98] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800",
                        transitionSmooth,
                        focusRing
                      )}
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Back
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={!canProceed()}
                    className={cx(
                      "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-5 text-xs sm:text-sm font-medium shadow-xs active:scale-[0.98]",
                      canProceed()
                        ? "bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 cursor-pointer"
                        : "bg-neutral-200 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-600 cursor-not-allowed",
                      transitionSmooth,
                      focusRing
                    )}
                  >
                    {isLast ? "Complete Setup" : "Continue"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Fade overlays */}
          <div
            aria-hidden="true"
            className={cx(
              "pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-white to-transparent dark:from-neutral-900 transition-opacity duration-150",
              edges.start ? "opacity-100" : "opacity-0"
            )}
          />
          <div
            aria-hidden="true"
            className={cx(
              "pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-white to-transparent dark:from-neutral-900 transition-opacity duration-150",
              edges.end ? "opacity-100" : "opacity-0"
            )}
          />
        </div>
      </div>
    </div>
  );
}
