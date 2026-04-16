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
  const [googleLoading, setGoogleLoading] = useState(false);
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

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth
      .signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });
    if (error) {
      setError('Google sign in failed. Try again.');
      setGoogleLoading(false);
    }
  }

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
          <div className="space-y-4">
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

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-surface px-2 text-ink-muted">
                  or continue with
                </span>
              </div>
            </div>

            <button
              onClick={handleGoogleSignIn}
              type="button"
              disabled={googleLoading || loading}
              className="w-full flex items-center justify-center gap-3 border border-border rounded-md px-4 py-3 text-sm font-dm-sans font-medium hover:bg-surface-raised transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {googleLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-ink-muted" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-4 h-4">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              {googleLoading ? "Connecting..." : "Continue with Google"}
            </button>
          </div>
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
