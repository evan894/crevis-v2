"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { Loader2, ArrowLeft, UploadCloud, Image as ImageIcon, Wallet, RefreshCcw } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "react-hot-toast";

export default function NewProductPage() {
  const router = useRouter();
  const supabase = createBrowserClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);

  const [creditBalance, setCreditBalance] = useState<number>(0);
  
  // Form State
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Clothing");

  useEffect(() => {
    const fetchBalance = async () => {
       const { data: { user } } = await supabase.auth.getUser();
       if (user) {
          const { data } = await supabase.from('sellers').select('credit_balance').eq('user_id', user.id).single();
          if (data) setCreditBalance(data.credit_balance);
       }
       setInitLoading(false);
    };
    fetchBalance();
  }, [supabase]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (!selected.type.startsWith('image/')) {
         toast.error("Please select an image file.");
         return;
      }
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selected = e.dataTransfer.files[0];
      if (!selected.type.startsWith('image/')) {
         toast.error("Please drop an image file.");
         return;
      }
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error("Product image is required");
    if (!name.trim()) return toast.error("Product name is required");
    if (!price || isNaN(Number(price)) || Number(price) <= 0) return toast.error("Valid price is required");
    if (creditBalance < 2) return toast.error("Insufficient credits. Please recharge your wallet.");

    setLoading(true);

    try {
      // 1. Upload Image
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw new Error("Image upload failed: " + uploadError.message);

      // Extract public URL
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName);

      // 2. Call API to insert and deduct credits
      const res = await fetch("/api/products/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          price: Number(price),
          category,
          photo_url: publicUrl
        })
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to publish product");

      // 3. Success state
      toast.success(`Your ${name} is now live on the Crevis network.`);
      
      setTimeout(() => {
        router.push("/products");
      }, 1500);

    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message);
      else toast.error("An unexpected error occurred");
      setLoading(false);
    }
  };

  if (initLoading) {
    return <div className="min-h-screen bg-surface flex items-center justify-center"><Loader2 className="w-8 h-8 text-saffron animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-surface selection:bg-saffron selection:text-surface-raised font-dm-sans pb-20">
      
      {/* Navbar Minimal */}
      <nav className="h-16 border-b border-border bg-surface-raised px-6 flex items-center sticky top-0 z-50">
        <Link href="/products" className="text-ink-secondary hover:text-ink transition-colors flex items-center gap-2 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Back to Inventory
        </Link>
      </nav>

      {/* Main Content */}
      <main className="max-w-[560px] mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="font-syne text-3xl font-bold text-ink mb-2">New Product</h1>
          <p className="text-ink-secondary text-sm">Add details to list this item immediately on your storefront.</p>
        </div>

        {/* Credit Cost Notice Section */}
        <div className={`mb-8 p-4 rounded-lg flex items-start gap-3 border ${creditBalance < 5 && creditBalance >= 2 ? 'bg-warning-bg border-warning/30 text-warning-content' : creditBalance < 2 ? 'bg-error-bg border-error/30 text-error' : 'bg-surface-raised border-border text-ink-secondary'}`}>
           <Wallet className={`w-5 h-5 shrink-0 ${creditBalance < 5 && creditBalance >= 2 ? 'text-warning' : creditBalance < 2 ? 'text-error' : 'text-saffron'}`} />
           <div className="flex-1">
             <p className="font-medium text-sm mb-1 text-ink">Publishing deducts 2 credits.</p>
             <p className="text-sm">Your balance: <strong className="font-jetbrains-mono">{creditBalance}</strong> credits</p>
           </div>
           {creditBalance < 2 && (
             <Link href="/wallet" className="shrink-0 h-[36px] px-4 inline-flex items-center justify-center bg-error text-surface-raised rounded-md font-medium text-sm shadow-sm opacity-90 hover:opacity-100 transition-opacity">
               <RefreshCcw className="w-4 h-4 mr-2" /> Recharge
             </Link>
           )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Photo Dropzone */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-ink block">Product Photo <span className="text-error">*</span></label>
            
            <div 
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className={`relative bg-surface-raised border-2 border-dashed ${previewUrl ? 'border-border' : 'border-border-strong hover:border-saffron'} rounded-xl aspect-square sm:aspect-[4/3] flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-colors duration-fast group`}
            >
              {previewUrl ? (
                <>
                  <Image src={previewUrl} alt="Preview" fill className="object-cover" />
                  <div className="absolute inset-0 bg-ink/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                     <span className="bg-surface-raised text-ink px-4 py-2 rounded-md font-medium text-sm shadow-sm flex items-center gap-2">
                        <UploadCloud className="w-4 h-4" /> Replace Image
                     </span>
                  </div>
                </>
              ) : (
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-saffron/10 transition-colors">
                    <ImageIcon className="w-6 h-6 text-ink-muted group-hover:text-saffron transition-colors" />
                  </div>
                  <p className="font-medium text-ink mb-1">Click or drag image to upload</p>
                  <p className="text-xs text-ink-muted">High quality JPG, PNG, WEBP (max 5MB)</p>
                </div>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleFileChange}
              />
            </div>
          </div>

          {/* Product Details */}
          <div className="space-y-5 bg-surface-raised p-6 rounded-xl border border-border">
             <div className="space-y-1">
               <label className="text-xs font-medium text-ink-secondary ml-1">Product Name <span className="text-error">*</span></label>
               <input
                 type="text"
                 value={name}
                 onChange={(e) => setName(e.target.value)}
                 disabled={loading}
                 className="w-full h-[44px] px-3 bg-surface border border-border rounded-md text-base text-ink focus:border-saffron focus:ring-1 focus:ring-saffron outline-none transition-all duration-fast"
                 placeholder="e.g. Vintage Leather Jacket"
               />
             </div>

             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                 <label className="text-xs font-medium text-ink-secondary ml-1">Price <span className="text-error">*</span></label>
                 <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <span className="text-ink-muted font-jetbrains-mono">₹</span>
                   </div>
                   <input
                     type="number"
                     min="1"
                     value={price}
                     onChange={(e) => setPrice(e.target.value)}
                     disabled={loading}
                     className="w-full h-[44px] pl-8 pr-3 bg-surface border border-border rounded-md font-jetbrains-mono text-base text-ink focus:border-saffron focus:ring-1 focus:ring-saffron outline-none transition-all duration-fast"
                     placeholder="2999"
                   />
                 </div>
               </div>

               <div className="space-y-1">
                 <label className="text-xs font-medium text-ink-secondary ml-1">Category <span className="text-error">*</span></label>
                 <select
                   value={category}
                   onChange={(e) => setCategory(e.target.value)}
                   disabled={loading}
                   className="w-full h-[44px] px-3 bg-surface border border-border rounded-md text-base text-ink focus:border-saffron focus:ring-1 focus:ring-saffron outline-none transition-all duration-fast appearance-none"
                 >
                   <option value="Clothing">Clothing</option>
                   <option value="Footwear">Footwear</option>
                   <option value="Accessories">Accessories</option>
                   <option value="Home Textiles">Home Textiles</option>
                   <option value="Other">Other</option>
                 </select>
               </div>
             </div>

             <div className="space-y-1">
               <label className="text-xs font-medium text-ink-secondary ml-1">Description (Optional)</label>
               <textarea
                 value={description}
                 onChange={(e) => setDescription(e.target.value)}
                 disabled={loading}
                 rows={4}
                 className="w-full p-3 bg-surface border border-border rounded-md text-base text-ink focus:border-saffron focus:ring-1 focus:ring-saffron outline-none transition-all duration-fast resize-none"
                 placeholder="Describe the condition, sizing, material, etc."
               />
             </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || creditBalance < 2}
            className="w-full h-[54px] flex items-center justify-center bg-saffron text-surface-raised rounded-md font-medium hover:bg-saffron-dark hover:shadow-saffron active:scale-[0.98] transition-all duration-base disabled:opacity-70 disabled:cursor-not-allowed text-lg"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Publish Listing"}
          </button>
        </form>

      </main>
    </div>
  );
}
