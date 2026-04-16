"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { Loader2, Mail } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createBrowserClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!email.trim()) throw new Error("Email is required");

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`
        }
      );

      // By default Supabase won't tell if email exists for security
      // We check for generic or rate-limit errors
      if (resetError) {
         if (resetError.status === 429) {
           throw new Error("Too many requests. Please wait a few minutes.");
         }
         throw new Error("Something went wrong. Please try again.");
      }

      setIsSuccess(true);
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
            Reset your password.
          </h2>
          <p className="font-dm-sans text-base text-ink-secondary">
            Get back to managing your conversational commerce experience.
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

          {isSuccess ? (
             <div className="space-y-6 text-center animate-in fade-in slide-in-from-bottom-2 duration-base">
               <div className="mx-auto w-16 h-16 bg-saffron/10 text-saffron rounded-full flex items-center justify-center mb-4">
                 <Mail className="w-8 h-8" />
               </div>
               <div className="space-y-2">
                 <h2 className="font-syne text-xl font-bold text-ink">Check your email</h2>
                 <p className="font-dm-sans text-sm text-ink-muted">
                   We sent a reset link to <span className="font-medium text-ink-secondary">{email}</span>.
                   <br />It may take a minute to arrive. Check your spam folder if you don&apos;t see it.
                 </p>
               </div>
               <Link
                 href="/auth"
                 className="block w-full h-[44px] mt-6 flex items-center justify-center bg-transparent border border-border-strong text-ink hover:border-ink rounded-md font-dm-sans font-medium transition-all duration-base"
               >
                 Back to sign in
               </Link>
             </div>
          ) : (
            <>
              <div className="space-y-2 text-center lg:text-left">
                <h2 className="font-syne text-xl font-bold text-ink">
                  Forgot your password?
                </h2>
                <p className="font-dm-sans text-sm text-ink-muted">
                  Enter your email and we&apos;ll send you a link to reset it.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-error-bg border border-error/20 rounded-md text-error text-sm font-dm-sans flex items-center animate-in fade-in slide-in-from-top-2 duration-fast relative z-20">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
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
                    placeholder="your@email.com"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading || !email}
                    className="w-full h-[44px] mt-2 flex items-center justify-center bg-saffron text-surface-raised rounded-md font-dm-sans font-medium hover:bg-saffron-dark hover:shadow-saffron active:scale-[0.98] transition-all duration-base disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" /> Sending...
                      </span>
                    ) : (
                      "Send Reset Link"
                    )}
                  </button>
                </div>
              </form>

              <div className="text-center pt-4">
                <Link
                  href="/auth"
                  className="text-sm font-dm-sans text-ink-secondary hover:text-ink transition-colors duration-fast"
                >
                  &larr; Back to sign in
                </Link>
              </div>
            </>
          )}

        </div>
      </div>
    </main>
  );
}
