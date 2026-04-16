"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Link from "next/link";

export default function AuthPage() {
  const [view, setView] = useState<"signin" | "signup" | "confirm-email">("signin");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const supabase = createBrowserClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        if (!name.trim()) throw new Error("Name is required");
        if (password.length < 8) throw new Error("Password must be at least 8 characters");
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
          },
        });
        if (signUpError) {
          setError(signUpError.message);
          return;
        }
        
        if (data.session) {
          router.push("/onboarding");
        } else if (data.user && !data.session) {
          setView("confirm-email");
        }
      } else {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        
        const { data: seller } = await supabase.from('sellers').select('id').eq('user_id', signInData.user.id).single();
        if (seller) {
            router.push("/dashboard");
        } else {
            router.push("/onboarding");
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-surface flex selection:bg-saffron selection:text-surface-raised">
      {/* Left Panel - Hidden on mobile */}
      <div className="hidden lg:flex w-1/2 bg-saffron-light relative flex-col justify-between p-12 overflow-hidden border-r border-border">
        {/* Subtle mesh background element illustration */}
        <div className="absolute top-[-20%] left-[-10%] w-[120%] h-[120%] opacity-20 pointer-events-none" 
             style={{ 
               background: "radial-gradient(circle at 50% 50%, var(--color-saffron) 0%, transparent 60%)",
               filter: "blur(60px)"
             }} 
        />
        
        <div className="relative z-10">
          <h1 className="font-syne text-3xl font-bold tracking-tight text-ink">
            Crevis <span className="text-saffron italic">v2</span>
          </h1>
        </div>
        
        <div className="relative z-10 max-w-md">
          <h2 className="font-syne text-3xl font-extrabold text-ink leading-tight mb-4">
            Your shop starts here.
          </h2>
          <p className="font-dm-sans text-base text-ink-secondary">
            Sell everywhere. Manage your conversational commerce with quiet luxury and elegant simplicity.
          </p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-8">
          
          <div className="lg:hidden mb-12">
            <h1 className="font-syne text-3xl font-bold tracking-tight text-ink text-center">
              Crevis <span className="text-saffron italic">v2</span>
            </h1>
          </div>

          <div className="space-y-2 text-center lg:text-left">
            <h2 className="font-syne text-xl font-bold text-ink">
              {view === "confirm-email" 
                ? "Check your email"
                : isSignUp ? "Create your account" : "Welcome back"}
            </h2>
            <p className="font-dm-sans text-sm text-ink-muted">
              {view === "confirm-email" 
                ? `We sent a confirmation link to ${email}. Click the link to activate your account. You can close this tab.`
                : isSignUp ? "Enter your details to get your shop running." : "Enter your credentials to access your dashboard."}
            </p>
            {view === "confirm-email" && (
              <p className="font-dm-sans text-xs text-ink-muted mt-2">
                Didn&apos;t receive it? Check your spam folder or contact support.
              </p>
            )}
          </div>

          {error && (
            <div className="p-3 bg-error-bg border border-error/20 rounded-md text-error text-sm font-dm-sans animate-in fade-in slide-in-from-top-2 duration-fast relative z-20">
              {error}
            </div>
          )}

          {view === "confirm-email" ? (
            <button
              type="button"
              onClick={() => setView("signin")}
              className="w-full h-[44px] mt-6 flex items-center justify-center bg-saffron text-surface-raised rounded-md font-dm-sans font-medium hover:bg-saffron-dark transition-all"
            >
              Back to sign in
            </button>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-1">
                <label className="text-xs font-dm-sans font-medium text-ink-secondary ml-1" htmlFor="name">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  className="w-full h-[44px] px-3 bg-surface-raised border border-border rounded-md font-dm-sans text-base text-ink placeholder:text-ink-muted focus:outline-none focus:border-saffron focus:ring-1 focus:ring-saffron transition-all duration-fast"
                  placeholder="Rahul Singh"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-dm-sans font-medium text-ink-secondary ml-1" htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full h-[44px] px-3 bg-surface-raised border border-border rounded-md font-dm-sans text-base text-ink placeholder:text-ink-muted focus:outline-none focus:border-saffron focus:ring-1 focus:ring-saffron transition-all duration-fast"
                placeholder="rahul@example.com"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-dm-sans font-medium text-ink-secondary ml-1" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={loading}
                className="w-full h-[44px] px-3 bg-surface-raised border border-border rounded-md font-dm-sans text-base text-ink placeholder:text-ink-muted focus:outline-none focus:border-saffron focus:ring-1 focus:ring-saffron transition-all duration-fast"
                placeholder="••••••••"
              />
            </div>

            {!isSignUp && (
              <div className="flex justify-end pt-1 -mt-2 mb-2">
                <Link 
                  href="/auth/forgot-password"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-[44px] mt-6 flex items-center justify-center bg-saffron text-surface-raised rounded-md font-dm-sans font-medium hover:bg-saffron-dark hover:shadow-saffron active:scale-[0.98] transition-all duration-base disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isSignUp ? (
                "Create Account"
              ) : (
                "Sign In"
              )}
            </button>
          </form>
          )}

          {view !== "confirm-email" && (
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setIsSignUp(!isSignUp);
                setView(isSignUp ? "signin" : "signup");
              }}
              disabled={loading}
              className="text-sm font-dm-sans text-ink-secondary hover:text-ink transition-colors duration-fast"
            >
              {isSignUp
                ? "Already have an account? Sign in"
                : "Don't have an account? Sign up"}
            </button>
          </div>
          )}

        </div>
      </div>
    </main>
  );
}
