"use client";


import { Suspense, useState } from "react";

import { useSearchParams, useRouter } from "next/navigation";

import Link from "next/link";


const trustedLogos = [

  <svg key="1" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 3 7v10l9 5 9-5V7z" /></svg>,

  <svg key="2" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9" /></svg>,

  <svg key="3" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3 2 20h20z" /></svg>,

  <svg key="4" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="3" /><circle cx="12" cy="19" r="3" /><circle cx="5" cy="12" r="3" /><circle cx="19" cy="12" r="3" /></svg>,

  <svg key="5" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 8c2-3 4-3 6 0s4 3 6 0 4-3 6 0" /><path d="M2 16c2-3 4-3 6 0s4 3 6 0 4-3 6 0" /></svg>,

  <svg key="6" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><g>{Array.from({ length: 12 }).map((_, i) => (

    <rect key={i} x="11" y="2" width="2" height="6" rx="1" transform={`rotate(${i * 30} 12 12)`} />

  ))}</g></svg>,

];


function LoginForm() {

  const searchParams = useSearchParams();

  const router = useRouter();

  const initialTab = searchParams.get("tab") === "signup" ? "signup" : "signin";

  const [tab, setTab] = useState<"signin" | "signup">(initialTab);


  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [name, setName] = useState("");

  const [error, setError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);


  async function handleSubmit(e: React.FormEvent) {

    e.preventDefault();

    setError(null);

    setIsSubmitting(true);


    try {

      let response;

      if (tab === "signin") {

        response = await fetch("/api/auth/login", {

          method: "POST",

          headers: { "Content-Type": "application/json" },

          body: JSON.stringify({ email, password }),

        });

      } else {

        response = await fetch("/api/auth/register", {

          method: "POST",

          headers: { "Content-Type": "application/json" },

          body: JSON.stringify({ email, password, name }),

        });

      }


      const data = await response.json();


      if (!response.ok) {

        setError(data.error || "Something went wrong");

        return;

      }


      const redirect = searchParams.get("redirect");

      router.push(redirect || "/workspaces");

    } catch (error) {

      setError("Network error. Please try again.");

    } finally {

      setIsSubmitting(false);

    }

  }


  return (

    <main className="min-h-screen relative overflow-hidden bg-paper flex flex-col">

      {/* Ambient gradient blobs */}

      <div className="pointer-events-none absolute -top-32 -left-20 w-[600px] h-[600px] bg-indigo/15 rounded-full blur-3xl" />

      <div className="pointer-events-none absolute -bottom-32 -right-20 w-[600px] h-[600px] bg-indigo/15 rounded-full blur-3xl" />

      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo/5 rounded-full blur-3xl" />


      {/* Subtle dot grid */}

      <div

        className="pointer-events-none absolute inset-0 opacity-[0.4]"

        style={{

          backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)",

          backgroundSize: "24px 24px",

        }}

      />


      {/* Top bar */}

      <header className="relative z-10 px-6 lg:px-10 py-5 flex items-center justify-between shrink-0">

        <Link href="/" className="inline-flex items-center gap-3 font-display text-lg font-semibold tracking-tight">

          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-signal text-white text-sm font-bold">
            FD
          </span>

          <span>FlowDesk</span>

        </Link>

        <Link

          href="/"

          className="text-sm text-ink-secondary hover:text-ink transition hidden sm:inline-flex items-center gap-1.5"

        >

          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">

            <path d="m15 18-6-6 6-6" />

          </svg>

          Back home

        </Link>

      </header>


      {/* Center stage */}

      <section className="relative z-10 flex-1 flex items-center justify-center px-6 py-4">

        <div className="w-full max-w-7xl grid lg:grid-cols-[1.1fr_0.95fr] gap-8 lg:gap-10 items-center">

          {/* LEFT: pitch */}

          <div className="flex flex-col gap-5 min-w-0">

            <span className="inline-flex items-center gap-2 self-start font-body text-[11px] font-semibold tracking-widest uppercase text-indigo bg-indigo/10 px-3 py-1 rounded-full">

              <span className="h-1.5 w-1.5 rounded-full bg-indigo" />

              REAL-TIME COLLABORATION

            </span>


            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold leading-[1.05] tracking-tight">

              {tab === "signin" ? (

                <>Welcome back.<br />Let&apos;s keep the work <span className="text-indigo">flowing.</span></>

              ) : (

                <>Get started.<br />See the work <span className="text-indigo">flowdesk.</span></>

              )}

            </h1>


            <p className="text-ink-secondary text-base leading-relaxed max-w-md">

              Colors blend the moment two people touch the same task — your team stays in sync without the meeting.

            </p>


            {/* Compact demo card */}

            <div className="relative">

              <div className="relative rounded-3xl border border-border bg-paper p-6 shadow-sm">

                <div className="flex items-center gap-2 mb-2.5">

                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo">

                    <circle cx="12" cy="12" r="10" />

                    <path d="m9 12 2 2 4-4" />

                  </svg>

                  <span className="text-indigo text-xs font-medium">Design system</span>

                  <span className="ml-auto inline-flex items-center gap-2 text-[10px] text-indigo font-medium">

                    <span className="inline-flex -space-x-2">

                      <span style={{ backgroundColor: "#4A5FD1" }} className="inline-flex h-6 w-6 rounded-full border-2 border-surface items-center justify-center text-[10px] font-semibold text-white">A</span>

                      <span style={{ backgroundColor: "#3F63C1" }} className="inline-flex h-6 w-6 rounded-full border-2 border-surface items-center justify-center text-[10px] font-semibold text-white">M</span>

                    </span>

                    <span className="inline-flex items-center gap-1">

                      <span className="h-1.5 w-1.5 rounded-full bg-indigo animate-pulse" />

                      2 viewing

                    </span>

                  </span>

                </div>


                <h3 className="font-body text-base font-semibold text-ink mb-2.5">

                  Create new onboarding flow

                </h3>


                <div className="flex items-center justify-between text-xs text-ink-secondary">

                  <div className="flex items-center gap-2.5">

                    <span>May 15</span>

                    <span className="px-2 py-0.5 rounded-full bg-surface-sunken">Onboarding</span>

                  </div>

                  <div className="flex -space-x-1.5">

                    <div style={{ backgroundColor: "#4A5FD1" }} className="w-6 h-6 rounded-full border-2 border-surface flex items-center justify-center text-white text-[10px] font-semibold">A</div>

                    <div style={{ backgroundColor: "#3F63C1" }} className="w-6 h-6 rounded-full border-2 border-surface flex items-center justify-center text-white text-[10px] font-semibold">M</div>

                  </div>

                </div>

              </div>

            </div>


            {/* Trusted by */}

            <div className="flex items-center gap-5 pt-3 mt-1 border-t border-border/60">

              <span className="text-[10px] font-semibold tracking-widest uppercase text-ink-secondary shrink-0">

                Trusted by teams at

              </span>

              <div className="flex items-center gap-5 text-ink-secondary/70">

                {trustedLogos.map((shape) => shape)}

              </div>

            </div>

          </div>


          {/* RIGHT: form card */}

          <div className="w-full flex justify-center lg:justify-end">

            <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 shadow-sm">

              <div className="mb-5 flex justify-center">

                <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-signal text-white text-lg font-bold shadow-sm">
                  FD
                </span>

              </div>

              <div className="mb-5">

                <p className="text-xs uppercase tracking-[0.3em] text-ink-secondary mb-3">Secure access</p>

                <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-0.5">

                  {tab === "signin" ? "Sign in" : "Create your account"}

                </h2>

                <p className="text-xs text-ink-secondary">

                  {tab === "signin"

                    ? "Welcome back — pick up where you left off."

                    : "Start collaborating with your team in minutes."}

                </p>

              </div>


              <div className="flex mb-5 rounded-full border border-border bg-paper p-1">

                <button

                  type="button"

                  onClick={() => setTab("signin")}

                  className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                    tab === "signin"
                      ? "bg-indigo shadow-sm text-ink"
                      : "text-ink-secondary hover:text-ink bg-paper/70 hover:bg-paper"
                  }`}

                >

                  Sign in

                </button>


                <button

                  type="button"

                  onClick={() => setTab("signup")}

                  className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                    tab === "signup"
                      ? "bg-indigo shadow-sm text-ink"
                      : "text-ink-secondary hover:text-ink bg-paper/80"
                  }`}

                >

                  Sign up

                </button>

              </div>


              <form onSubmit={handleSubmit} className="flex flex-col gap-3">

                {tab === "signup" && (

                  <div className="flex flex-col gap-1">

                    <label htmlFor="name" className="text-xs font-medium text-ink">

                      Name

                    </label>

                    <input

                      id="name"

                      type="text"

                      required

                      value={name}

                      onChange={(e) => setName(e.target.value)}

                      className="border border-border rounded-lg px-3 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-indigo/40 focus:border-indigo transition"

                      placeholder="Amara Singh"

                    />

                  </div>

                )}


                <div className="flex flex-col gap-1">

                  <label htmlFor="email" className="text-xs font-medium text-ink">

                    Email

                  </label>

                  <div className="relative">

                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-secondary">

                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">

                        <path d="M3 7v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7" />

                        <path d="M3 7l9 6 9-6" />

                      </svg>

                    </span>

                    <input

                      id="email"

                      type="email"

                      required

                      value={email}

                      onChange={(e) => setEmail(e.target.value)}

                      className="w-full border border-border rounded-lg bg-paper px-3 py-2 pl-10 pr-3 text-sm text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-indigo/40 focus:border-indigo transition"

                      placeholder="you@example.com"

                    />

                  </div>

                </div>


                <div className="flex flex-col gap-1">

                  <label htmlFor="password" className="text-xs font-medium text-ink">

                    Password

                  </label>

                  <div className="relative">

                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-secondary">

                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">

                        <path d="M6 10V7a6 6 0 0 1 12 0v3" />

                        <rect x="6" y="10" width="12" height="10" rx="2" />

                      </svg>

                    </span>

                    <input

                      id="password"

                      type={showPassword ? "text" : "password"}

                      required

                      minLength={8}

                      value={password}

                      onChange={(e) => setPassword(e.target.value)}

                      className="w-full border border-border rounded-lg bg-paper px-3 py-2 pl-10 pr-10 text-sm text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-indigo/40 focus:border-indigo transition"

                      placeholder="••••••••"

                    />

                    <button

                      type="button"

                      onClick={() => setShowPassword((current) => !current)}

                      className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-paper border border-border text-ink-secondary transition hover:bg-paper/90 hover:text-ink"

                      aria-label={showPassword ? "Hide password" : "Show password"}

                    >

                      {showPassword ? (

                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">

                          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-5 0-9.27-3-11-7 1.12-2.43 2.74-4.44 4.74-5.72" />

                          <path d="M1 1l22 22" />

                          <path d="M9.88 9.88a3 3 0 0 0 4.24 4.24" />

                          <path d="M12 7a5 5 0 0 1 5 5" />

                        </svg>

                      ) : (

                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">

                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />

                          <circle cx="12" cy="12" r="3" />

                        </svg>

                      )}

                    </button>

                  </div>

                </div>

                {/* Remember me removed per design */}


                {error && (

                  <p className="text-danger text-xs bg-danger/10 px-3 py-2 rounded-lg">

                    {error}

                  </p>

                )}


                <button

                  type="submit"

                  disabled={isSubmitting}

                  className="mt-1 text-white text-sm font-medium rounded-2xl py-3 active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                  style={{ backgroundColor: "#4A5FD1" }}

                >

                  {isSubmitting

                    ? "..."

                    : tab === "signin"

                    ? "Sign in"

                    : "Create account"}

                </button>

                <div className="text-center text-sm text-ink mt-4">

                  {tab === "signin" ? (

                    <span>

                      Don&apos;t have an account?{' '}

                      <button

                        type="button"

                        onClick={() => setTab("signup")}

                        className="font-semibold text-indigo-700 hover:text-indigo-600"

                      >

                        Sign up

                      </button>

                    </span>

                  ) : (

                    <span>

                      Already have an account?{' '}

                      <button

                        type="button"

                        onClick={() => setTab("signin")}

                        className="font-semibold text-indigo-700 hover:text-indigo-600"

                      >

                        Sign in

                      </button>

                    </span>

                  )}

                </div>

              </form>


              <p className="text-[11px] text-ink-secondary text-center mt-5 flex items-center justify-center gap-2">

                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">

                  <rect x="3" y="11" width="18" height="11" rx="2" />

                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />

                </svg>

                Your data is end-to-end encrypted

              </p>

            </div>

          </div>

        </div>

      </section>

    </main>

  );

}


export default function LoginPage() {

  return (

    <Suspense fallback={null}>

      <LoginForm />

    </Suspense>

  );

}