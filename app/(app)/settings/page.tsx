"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { Loader2, CheckCircle2, Link2, Check, X, Copy, Pencil } from "lucide-react";
import { toast } from "react-hot-toast";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://crevis-v2.vercel.app";
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sellerId, setSellerId] = useState<string | null>(null);

  const [shopName, setShopName] = useState("");
  const [category, setCategory] = useState("Clothing");
  const [slackConnected, setSlackConnected] = useState(false);

  // Slug state
  const [shopSlug, setShopSlug] = useState("");
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugInput, setSlugInput] = useState("");
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugSaving, setSlugSaving] = useState(false);

  const supabase = createBrowserClient();

  useEffect(() => {
    const fetchSeller = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: seller } = await supabase
        .from("sellers")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (seller) {
        setSellerId(seller.id);
        setShopName(seller.shop_name);
        setCategory(seller.category);
        setSlackConnected(!!seller.slack_user_id);
        setShopSlug(seller.shop_slug || "");
        setSlugInput(seller.shop_slug || "");
      }
      setLoading(false);
    };
    fetchSeller();
  }, [supabase]);

  // Debounced slug availability check
  const checkSlugAvailability = useCallback(async (slug: string) => {
    if (slug === shopSlug) { setSlugAvailable(true); return; }
    if (!SLUG_REGEX.test(slug)) { setSlugAvailable(null); return; }

    setSlugChecking(true);
    try {
      const { data } = await supabase
        .from("sellers")
        .select("id")
        .eq("shop_slug", slug)
        .maybeSingle();
      setSlugAvailable(!data);
    } catch {
      setSlugAvailable(null);
    } finally {
      setSlugChecking(false);
    }
  }, [shopSlug, supabase]);

  useEffect(() => {
    if (!editingSlug) return;
    const timer = setTimeout(() => checkSlugAvailability(slugInput), 500);
    return () => clearTimeout(timer);
  }, [slugInput, editingSlug, checkSlugAvailability]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerId) return;
    setSaving(true);

    const { error } = await supabase
      .from("sellers")
      .update({ shop_name: shopName, category })
      .eq("id", sellerId);

    if (error) {
      toast.error("Failed to update settings");
    } else {
      toast.success("Settings saved successfully");
    }
    setSaving(false);
  };

  const handleSaveSlug = async () => {
    if (!sellerId || !slugAvailable || !SLUG_REGEX.test(slugInput)) return;
    setSlugSaving(true);
    const { error } = await supabase
      .from("sellers")
      .update({ shop_slug: slugInput })
      .eq("id", sellerId);

    if (error) {
      toast.error("Failed to update shop link");
    } else {
      setShopSlug(slugInput);
      setEditingSlug(false);
      toast.success("Shop link updated!");
    }
    setSlugSaving(false);
  };

  const handleCopyLink = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => toast.success("Copied!"))
      .catch(() => toast.error("Failed to copy"));
  };

  const slugError = (() => {
    if (!editingSlug || slugInput === shopSlug) return null;
    if (slugInput.length < 3) return "Min 3 characters";
    if (slugInput.length > 30) return "Max 30 characters";
    if (!/^[a-z0-9-]+$/.test(slugInput)) return "Only lowercase letters, numbers, hyphens";
    if (slugInput.startsWith("-") || slugInput.endsWith("-")) return "Cannot start or end with a hyphen";
    return null;
  })();

  if (loading) {
    return (
      <div className="w-full flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-saffron" />
      </div>
    );
  }

  const shopLink = `${APP_URL}/s/${shopSlug}`;

  return (
    <div className="w-full max-w-3xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="font-syne text-3xl font-bold text-ink">Settings</h1>
        <p className="font-dm-sans text-ink-secondary mt-1">
          Manage your shop details and integrations.
        </p>
      </div>

      <div className="space-y-8">

        {/* Section 1: Shop Link */}
        <div className="bg-surface-raised border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Link2 className="w-4 h-4 text-saffron" />
            <h2 className="font-syne text-xl font-bold text-ink">Shop Link</h2>
          </div>
          <p className="font-dm-sans text-xs text-ink-secondary mb-5">
            Share this link anywhere — it opens your store directly in Telegram.
          </p>

          {editingSlug ? (
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-ink-secondary text-sm font-dm-sans shrink-0">{APP_URL}/s/</span>
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={slugInput}
                      onChange={(e) => {
                        setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                        setSlugAvailable(null);
                      }}
                      placeholder="your-shop-name"
                      className="w-full h-[40px] px-3 pr-9 bg-surface border border-border rounded-md font-dm-sans text-sm text-ink focus:border-saffron focus:ring-1 focus:ring-saffron outline-none transition-all"
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      {slugChecking && <Loader2 className="w-4 h-4 animate-spin text-ink-muted" />}
                      {!slugChecking && slugAvailable === true && !slugError && (
                        <Check className="w-4 h-4 text-success" />
                      )}
                      {!slugChecking && (slugAvailable === false || slugError) && (
                        <X className="w-4 h-4 text-error" />
                      )}
                    </div>
                  </div>
                </div>
                {slugError && <p className="text-xs text-error mt-1 ml-1">{slugError}</p>}
                {!slugError && slugAvailable === false && (
                  <p className="text-xs text-error mt-1 ml-1">This slug is already taken</p>
                )}
                {!slugError && slugAvailable === true && slugInput !== shopSlug && (
                  <p className="text-xs text-success mt-1 ml-1">Available!</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveSlug}
                  disabled={!slugAvailable || !!slugError || slugSaving || slugInput === shopSlug}
                  className="h-[36px] px-4 bg-saffron text-white text-sm font-medium rounded-md hover:bg-saffron-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {slugSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save
                </button>
                <button
                  onClick={() => { setEditingSlug(false); setSlugInput(shopSlug); setSlugAvailable(null); }}
                  className="h-[36px] px-4 bg-surface border border-border text-ink-secondary text-sm font-medium rounded-md hover:text-ink transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Full shop link row */}
              <div className="flex items-center gap-2 bg-surface border border-border rounded-md px-3 py-2.5">
                <Link2 className="w-4 h-4 text-ink-muted shrink-0" />
                <span className="font-dm-sans text-sm text-ink flex-1 truncate">{shopLink}</span>
                <button
                  onClick={() => handleCopyLink(shopLink)}
                  className="shrink-0 p-1.5 rounded hover:bg-surface-raised text-ink-secondary hover:text-ink transition-colors"
                  title="Copy shop link"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setEditingSlug(true); setSlugAvailable(null); }}
                  className="shrink-0 p-1.5 rounded hover:bg-surface-raised text-ink-secondary hover:text-ink transition-colors"
                  title="Edit slug"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-ink-muted ml-1">
                Current slug: <code className="font-jetbrains-mono bg-surface px-1 py-0.5 rounded">{shopSlug}</code>
              </p>
            </div>
          )}
        </div>

        {/* Section 2: Shop Settings */}
        <div className="bg-surface-raised border border-border rounded-lg p-6 shadow-sm">
          <h2 className="font-syne text-xl font-bold text-ink mb-4">Shop Settings</h2>
          <form onSubmit={handleSave} className="space-y-4 max-w-md">
            <div className="space-y-1">
              <label className="text-xs font-dm-sans font-medium text-ink-secondary ml-1">Shop Name</label>
              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                disabled={saving}
                className="w-full h-[44px] px-3 bg-surface border border-border rounded-md font-dm-sans text-base text-ink focus:border-saffron focus:ring-1 focus:ring-saffron outline-none transition-all duration-fast"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-dm-sans font-medium text-ink-secondary ml-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={saving}
                className="w-full h-[44px] px-3 bg-surface border border-border rounded-md font-dm-sans text-base text-ink focus:border-saffron focus:ring-1 focus:ring-saffron outline-none transition-all duration-fast appearance-none"
              >
                <option value="Clothing">Clothing</option>
                <option value="Footwear">Footwear</option>
                <option value="Accessories">Accessories</option>
                <option value="Home Textiles">Home Textiles</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="h-[44px] px-6 mt-4 flex items-center justify-center bg-saffron text-surface-raised rounded-md font-dm-sans font-medium hover:bg-saffron-dark hover:shadow-saffron active:scale-[0.98] transition-all duration-base disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Changes"}
            </button>
          </form>
        </div>

        {/* Section 3: Slack Connection */}
        <div className="bg-surface-raised border border-border rounded-lg p-6 shadow-sm">
          <h2 className="font-syne text-xl font-bold text-ink mb-4">Slack Integration</h2>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-dm-sans text-sm text-ink-secondary mb-1">
                Receive instant notifications about new orders and customer queries.
              </p>
              {slackConnected ? (
                <div className="flex items-center text-success text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  Connected to Slack
                </div>
              ) : (
                <div className="text-ink-muted text-sm font-medium">
                  Not connected
                </div>
              )}
            </div>

            <a
              href={`/api/auth/slack?sellerId=${sellerId || ""}`}
              className="shrink-0 h-[44px] px-4 flex items-center justify-center bg-surface border border-border-strong text-ink rounded-md font-dm-sans font-medium hover:border-ink transition-all duration-base shadow-sm"
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52-2.523A2.528 2.528 0 0 1 5.042 10.12a2.528 2.528 0 0 1 2.52 2.522v2.522H5.042zm3.36 0a2.528 2.528 0 0 1 2.52-2.523 2.528 2.528 0 0 1 2.52 2.522v5.882a2.528 2.528 0 1 1-5.04 0v-5.88zM8.402 8.4A2.528 2.528 0 0 1 8.402 3.36a2.528 2.528 0 0 1 2.52 2.522v2.522H8.401zm0 3.361a2.528 2.528 0 0 1 2.52 2.523 2.528 2.528 0 0 1-2.52 2.522H2.52A2.528 2.528 0 1 1 2.522 11.76h5.88zM18.96 8.4a2.528 2.528 0 0 1 2.52 2.522 2.528 2.528 0 0 1-2.52 2.522h-2.52V10.92A2.528 2.528 0 0 1 18.96 8.4zm-3.36 0a2.528 2.528 0 0 1-2.52 2.522 2.528 2.528 0 0 1-2.52-2.522V2.518A2.528 2.528 0 1 1 15.6 2.518v5.88zM15.6 15.6a2.528 2.528 0 0 1-2.52 2.523 2.528 2.528 0 0 1-2.52-2.523v-2.521h2.52a2.528 2.528 0 0 1 2.52 2.521zm0-3.36A2.528 2.528 0 0 1-13.08 9.717a2.528 2.528 0 0 1 2.52-2.522h5.88a2.528 2.528 0 1 1 0 5.044h-5.88z"/>
              </svg>
              {slackConnected ? "Reconnect Slack" : "Connect Slack"}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
