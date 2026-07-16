import Link from "next/link";

function IconPeople() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconBolt() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function IconHistory() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 3v6h6" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

const logoShapes = [
  <svg key="1" width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 3 7v10l9 5 9-5V7z" /></svg>,
  <svg key="2" width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18z" fill="var(--color-paper)" /></svg>,
  <svg key="3" width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3 2 20h20zM12 9l5.5 9.5h-11z" fillRule="evenodd" /></svg>,
  <svg key="4" width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="3" /><circle cx="12" cy="19" r="3" /><circle cx="5" cy="12" r="3" /><circle cx="19" cy="12" r="3" /></svg>,
  <svg key="5" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 8c2-3 4-3 6 0s4 3 6 0 4-3 6 0" /><path d="M2 16c2-3 4-3 6 0s4 3 6 0 4-3 6 0" /></svg>,
  <svg key="6" width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><g>{Array.from({ length: 12 }).map((_, i) => (
    <rect key={i} x="11" y="2" width="2" height="6" rx="1" transform={`rotate(${i * 30} 12 12)`} />
  ))}</g></svg>,
];

const features = [
  {
    icon: <IconPeople />,
    color: "bg-indigo",
    tint: "bg-indigo/5",
    title: "Live presence",
    description: "See who is viewing a task in real time and keep context moving.",
  },
  {
    icon: <IconBolt />,
    color: "bg-signal",
    tint: "bg-signal/5",
    title: "Instant sync",
    description: "Changes appear across every screen the moment they happen.",
  },
  {
    icon: <IconShield />,
    color: "bg-indigo",
    tint: "bg-indigo/5",
    title: "Conflict-free editing",
    description: "Avoid overwrite chaos with shared, live task context.",
  },
  {
    icon: <IconHistory />,
    color: "bg-indigo",
    tint: "bg-indigo/5",
    title: "Full history",
    description: "Every update is traceable, so nothing gets lost in the shuffle.",
  },
];

const primaryCtaClasses = "btn-primary";

export default function LandingPage() {
  return (
    <main className="min-h-screen relative overflow-x-hidden bg-paper text-ink">
      <div className="pointer-events-none absolute -top-28 -left-16 h-[520px] w-[520px] rounded-full bg-indigo/15 blur-3xl" />
      <div className="pointer-events-none absolute top-24 right-0 h-[520px] w-[520px] rounded-full bg-signal/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-indigo/8 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <nav className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-8 lg:px-12">
        <Link href="/" className="inline-flex items-center gap-3 font-display text-lg font-semibold tracking-tight">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-signal text-sm font-bold text-white">
            FD
          </span>
          <span>FlowDesk</span>
        </Link>
        <Link
          href="/login"
          className="inline-flex items-center rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface-sunken"
        >
          Sign in
        </Link>
      </nav>

      <section className="relative z-10 px-6 pb-12 pt-4 sm:px-8 lg:px-12 lg:pb-16 lg:pt-6">
        <div className="mx-auto max-w-7xl rounded-[32px] border border-border bg-surface/90 p-6 shadow-sm backdrop-blur sm:p-8 lg:p-10">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="flex max-w-2xl flex-col gap-6">
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-indigo/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-indigo">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo" />
                Real-time collaboration
              </span>
              <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                See the work as it happens, not just the update.
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-ink-secondary sm:text-lg">
                FlowDesk keeps every move visible so your team can respond in real time without missing context.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link href="/login?tab=signup" className={primaryCtaClasses}>
                  Get started
                </Link>
                <Link
                  href="/login"
                  className="rounded-2xl border border-border bg-paper px-5 py-3 text-sm font-semibold text-ink transition hover:bg-surface-sunken"
                >
                  Sign in
                </Link>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
              <div className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-indigo/15 via-transparent to-signal/15 blur-2xl" />
              <div className="relative rounded-[28px] border border-border bg-paper p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-indigo">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                    Design system
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-paper px-3 py-1 text-[11px] font-medium text-ink-secondary">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo" />
                    Live now
                  </div>
                </div>

                <div className="mt-4 rounded-[24px] border border-border bg-surface p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-body text-lg font-semibold text-ink">Create new onboarding flow</h2>
                      <p className="mt-1 text-sm text-ink-secondary">May 15 • Onboarding • 3 comments</p>
                    </div>
                    <div className="flex -space-x-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-signal text-[10px] font-semibold text-white">A</div>
                      <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-indigo text-[10px] font-semibold text-white">M</div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-border bg-paper p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-ink">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20.59 13.41 13 21l-9-9V4h8z" />
                        <circle cx="7" cy="7" r="1" />
                      </svg>
                      2 people viewing this task
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-sm text-ink-secondary">
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo/10 px-2.5 py-1 text-[11px] font-medium text-indigo">Ready for review</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-signal/10 px-2.5 py-1 text-[11px] font-medium text-signal">Needs feedback</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 text-sm">
                    <span className="text-ink-secondary">Last update: 2 mins ago</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-teal/10 px-2.5 py-1 text-[11px] font-medium text-teal">
                      <span className="h-1.5 w-1.5 rounded-full bg-teal" />
                      Syncing
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-6 pb-16 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 rounded-[28px] border border-border bg-surface/70 px-6 py-8 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-ink-secondary">
            Trusted by teams at
          </span>
          <div className="flex flex-wrap items-center justify-center gap-8 text-ink-secondary/70">
            {logoShapes.map((shape) => shape)}
          </div>
        </div>
      </section>

      <section className="relative z-10 px-6 pb-20 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-2 md:items-stretch">
          {features.map((f) => (
            <div key={f.title} className={`${f.tint} rounded-[24px] border border-border p-6 shadow-sm`}>
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${f.color} text-white`}>
                {f.icon}
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-ink">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{f.description}</p>
              <span className="mt-4 inline-flex text-indigo">
                <IconArrow />
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 px-6 pb-8 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 rounded-[28px] border border-indigo/10 bg-indigo/5 px-8 py-16 text-center shadow-sm">
          <h2 className="relative font-display text-3xl font-semibold sm:text-4xl">
            Start seeing work clearly
          </h2>
          <p className="relative max-w-xl text-sm leading-relaxed text-ink-secondary sm:text-base">
            Bring the same clarity and live context from the dashboard into every task and collaboration moment.
          </p>
          <Link href="/login?tab=signup" className={`relative ${primaryCtaClasses}`}>
            Get started
          </Link>
        </div>
      </section>

      <footer className="relative z-10 flex flex-col gap-4 border-t border-border px-6 py-8 text-sm text-ink-secondary sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-signal text-sm font-semibold text-[var(--color-surface)]">
            FD
          </span>
          <span className="font-display font-semibold text-ink">FlowDesk</span>
        </div>
        <div className="flex flex-wrap gap-4">
          <Link href="#" className="transition hover:text-ink">Privacy</Link>
          <Link href="#" className="transition hover:text-ink">Terms</Link>
          <Link href="#" className="transition hover:text-ink">Contact</Link>
        </div>
      </footer>
    </main>
  );
}