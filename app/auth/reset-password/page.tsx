"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [ready, setReady] = useState(false);
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword1, setShowPassword1] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);

  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    const { data: { subscription } } =
      supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (event === 'PASSWORD_RECOVERY') {
            setReady(true);
            setLoading(false);
          } else if (event === 'SIGNED_OUT' || !session) {
            setIsExpired(true);
            setLoading(false);
          }
        }
      );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!ready && !isExpired && !isSuccess) {
        setIsExpired(true);
        setLoading(false);
      }
    }, 5000);
    return () => clearTimeout(timeout);
  }, [ready, isExpired, isSuccess]);

  // Password strength logic
  const getStrength = (pw: string) => {
    if (!pw) return { label: "", color: "" };
    if (pw.length < 8) return { label: "Too short", color: "text-error" };
    const hasNum = /\d/.test(pw);
    const hasSym = /[!@#$%^&*(),.?":{}|<>]/.test(pw);
    if (pw.length >= 12 && hasNum && hasSym) return { label: "Strong", color: "text-success" };
    if (hasNum || hasSym) return { label: "Good", color: "text-blue-500" };
    return { label: "Weak", color: "text-saffron-dark" };
  };

  const strength = getStrength(newPassword);
  const doPasswordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const isLengthValid = newPassword.length >= 8;
  const isSubmitDisabled = !newPassword || !confirmPassword || !doPasswordsMatch || !isLengthValid || submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitDisabled) return;
    setSubmitting(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        if (updateError.message.includes('New password should be different from the old password')) {
          throw new Error("Your new password must be different from your current password.");
        }
        throw new Error("Something went wrong. Please try again.");
      }

      setIsSuccess(true);
      setTimeout(() => {
        router.push("/auth");
      }, 3000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An error occurred");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-surface flex selection:bg-saffron selection:text-surface-raised">
      <div className="hidden lg:flex w-1/2 bg-saffron-light relative flex-col justify-between p-12 overflow-hidden border-r border-border">
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
            Create a new password.
          </h2>
          <p className="font-dm-sans text-base text-ink-secondary">
            Make sure it&apos;s strong and secure to keep your shop protected.
          </p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-8">
          
          <div className="lg:hidden mb-12">
            <h1 className="font-syne text-3xl font-bold tracking-tight text-ink text-center">
              Crevis <span className="text-saffron italic">v2</span>
            </h1>
          </div>

          {loading ? (
            <div className="space-y-4 text-center animate-in fade-in duration-base flex flex-col items-center">
              <Loader2 className="w-8 h-8 animate-spin text-saffron" />
              <p className="font-dm-sans text-sm text-ink-secondary">Verifying your link...</p>
            </div>
          ) : isExpired ? (
            <div className="space-y-6 text-center animate-in fade-in slide-in-from-bottom-2 duration-base">
               <div className="space-y-2">
                 <h2 className="font-syne text-xl font-bold text-ink">This link has expired</h2>
                 <p className="font-dm-sans text-sm text-ink-muted">
                   Password reset links expire after 1 hour for your security.
                 </p>
               </div>
               <Link
                 href="/auth/forgot-password"
                 className="block w-full h-[44px] mt-6 flex items-center justify-center bg-saffron text-surface-raised rounded-md font-dm-sans font-medium hover:bg-saffron-dark transition-all duration-base"
               >
                 Request a new link
               </Link>
             </div>
          ) : isSuccess ? (
             <div className="space-y-6 text-center animate-in fade-in slide-in-from-bottom-2 duration-base">
               <div className="mx-auto w-16 h-16 bg-success-bg text-success rounded-full flex items-center justify-center mb-4">
                 <CheckCircle2 className="w-8 h-8" />
               </div>
               <div className="space-y-2">
                 <h2 className="font-syne text-xl font-bold text-ink">Password updated</h2>
                 <p className="font-dm-sans text-sm text-ink-muted">
                   Your password has been changed successfully.
                 </p>
               </div>
               <Link
                 href="/auth"
                 className="block w-full h-[44px] mt-6 flex items-center justify-center bg-transparent border border-border-strong text-ink hover:border-ink rounded-md font-dm-sans font-medium transition-all duration-base"
               >
                 Sign in to Crevis
               </Link>
             </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-base">
              <div className="space-y-2 text-center lg:text-left mb-6">
                <h2 className="font-syne text-xl font-bold text-ink">
                  Set a new password
                </h2>
                <p className="font-dm-sans text-sm text-ink-muted">
                  Choose a strong password for your Crevis account.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-error-bg border border-error/20 rounded-md text-error text-sm font-dm-sans flex items-center animate-in fade-in slide-in-from-top-2 duration-fast relative z-20 mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-dm-sans font-medium text-ink-secondary ml-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword1 ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      disabled={submitting}
                      className="w-full h-[44px] px-3 pr-10 bg-surface-raised border border-border rounded-md font-dm-sans text-base text-ink placeholder:text-ink-muted focus:outline-none focus:border-saffron focus:ring-1 focus:ring-saffron transition-all duration-fast"
                      placeholder="New password"
                    />
                    <button type="button" onClick={() => setShowPassword1(!showPassword1)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-ink-muted hover:text-ink">
                      {showPassword1 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {newPassword && (
                    <p className={`text-xs ml-1 mt-1 ${strength.color}`}>
                      {strength.label}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-dm-sans font-medium text-ink-secondary ml-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword2 ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={submitting}
                      className="w-full h-[44px] px-3 pr-10 bg-surface-raised border border-border rounded-md font-dm-sans text-base text-ink placeholder:text-ink-muted focus:outline-none focus:border-saffron focus:ring-1 focus:ring-saffron transition-all duration-fast"
                      placeholder="Confirm new password"
                    />
                    <button type="button" onClick={() => setShowPassword2(!showPassword2)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-ink-muted hover:text-ink">
                      {showPassword2 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && newPassword && !doPasswordsMatch && (
                    <p className="text-xs ml-1 mt-1 text-error">
                      Passwords do not match
                    </p>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitDisabled}
                    className="w-full h-[44px] mt-2 flex items-center justify-center bg-saffron text-surface-raised rounded-md font-dm-sans font-medium hover:bg-saffron-dark hover:shadow-saffron active:scale-[0.98] transition-all duration-base disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" /> Updating...
                      </span>
                    ) : (
                      "Update Password"
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}
