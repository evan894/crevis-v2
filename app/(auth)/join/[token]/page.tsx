"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { Loader2, UserPlus, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "react-hot-toast";

export default function JoinTeamPage() {
  const { token } = useParams();
  const router = useRouter();
  const supabase = createBrowserClient();

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<{
    email: string;
    role: string;
    sellers?: { shop_name: string };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [user, setUser] = useState<{
    email?: string;
  } | null>(null);

  useEffect(() => {
    const checkInvite = async () => {
      // 1. Check invite token
      const inviteToken = Array.isArray(token) ? token[0] : token;
      
      const { data: inviteData, error: inviteError } = await supabase
        .from("store_invites")
        .select("*, sellers(shop_name)")
        .eq("token", inviteToken)
        .eq("status", "pending")
        .maybeSingle();

      if (inviteError || !inviteData) {
        setError("This invitation link is invalid or has expired.");
        setLoading(false);
        return;
      }

      setInvite(inviteData);

      // 2. Check current user
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      // 3. If logged in but email doesn't match invite, warn but maybe allow?
      // Usually better to enforce email match if we want security.
      if (currentUser && currentUser.email?.toLowerCase() !== inviteData.email.toLowerCase()) {
        console.warn("Logged in user email does not match invite email");
      }

      setLoading(false);
    };

    if (token) checkInvite();
  }, [token, supabase]);

  const handleAccept = async () => {
    if (!user) {
      // Redirect to login with return URL
      const returnUrl = encodeURIComponent(`/join/${token}`);
      router.push(`/auth?redirectTo=${returnUrl}`);
      return;
    }

    setAccepting(true);
    try {
      const res = await fetch(`/api/team/invites/${token}/accept`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Welcome to the team!");
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error");
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-saffron animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-surface-raised border border-border rounded-2xl p-8 text-center shadow-sm">
          <AlertCircle className="w-12 h-12 text-error mx-auto mb-4" />
          <h1 className="font-syne text-2xl font-bold text-ink mb-2">Invalid Invitation</h1>
          <p className="text-ink-secondary mb-6">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="w-full h-11 bg-ink text-surface-raised font-bold rounded hover:bg-ink-secondary transition-all"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-saffron animate-spin" />
      </div>
    );
  }

  const shopName = invite.sellers?.shop_name || "a Crevis shop";

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-surface-raised border border-border rounded-2xl p-8 shadow-sm">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-saffron/10 flex items-center justify-center">
            <UserPlus className="w-8 h-8 text-saffron" />
          </div>
        </div>

        <h1 className="font-syne text-2xl font-bold text-ink text-center mb-2">Team Invitation</h1>
        <p className="text-ink-secondary text-center mb-8">
          You&apos;ve been invited to join <span className="font-bold text-ink">{(shopName as string)}</span> as a <span className="text-saffron font-medium">{invite.role.replace("_", " ")}</span>.
        </p>

        {user && user.email?.toLowerCase() !== invite.email.toLowerCase() && (
          <div className="bg-warning-bg/50 border border-warning/20 p-4 rounded-lg mb-6 flex gap-3">
            <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-warning-content font-medium">
              You&apos;re logged in as <span className="font-bold">{user.email}</span>, but this invite was sent to <span className="font-bold">{invite.email}</span>.
            </p>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full h-12 bg-saffron hover:bg-saffron/90 text-white font-bold rounded-lg flex items-center justify-center gap-3 shadow-sm hover:shadow-md active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100"
          >
            {accepting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            {user ? "Accept Invitation" : "Sign in to Accept"}
          </button>

          {!user && (
            <p className="text-xs text-center text-ink-muted">
              Already have an account? Sign in to join the team.
            </p>
          )}

          <button
            onClick={() => router.push("/")}
            disabled={accepting}
            className="w-full text-sm text-ink-muted hover:text-ink transition-colors font-medium py-2"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
