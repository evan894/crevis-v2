"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { Loader2, Image as ImageIcon, Wallet, RefreshCcw, X, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { CATEGORIES, CREDIT_COST_LISTING } from "@/lib/constants";
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
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [category, setCategory] = useState("Clothing");

  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState<{label: string, stock: number}[]>([]);

  useEffect(() => {
    if (hasVariants && variants.length === 0) {
      if (category === "Clothing") {
        setVariants(["XS", "S", "M", "L", "XL", "XXL"].map(label => ({ label, stock: 0 })));
      } else if (category === "Footwear") {
        setVariants(["5", "6", "7", "8", "9", "10", "11"].map(label => ({ label, stock: 0 })));
      } else {
        setVariants([{ label: "One Size", stock: 0 }]);
      }
    }
  }, [hasVariants, category, variants.length]);

  const totalVariantStock = variants.reduce((sum, v) => sum + v.stock, 0);

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

  const addFiles = (newFiles: File[]) => {
    const imageFiles = newFiles.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length < newFiles.length) {
      toast.error("Only image files are allowed.");
    }
    const combined = [...files, ...imageFiles].slice(0, 5);
    setFiles(combined);
    setPreviewUrls(combined.map(f => URL.createObjectURL(f)));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
    // reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    setFiles(updated);
    setPreviewUrls(updated.map(f => URL.createObjectURL(f)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    if (files.length === 0) return toast.error("At least one product image is required");
    if (!name.trim()) return toast.error("Product name is required");
    if (!price || isNaN(Number(price)) || Number(price) <= 0) return toast.error("Valid price is required");
    
    if (hasVariants) {
      if (variants.length === 0) return toast.error("Please add at least one variant");
      if (variants.some(v => !v.label.trim())) return toast.error("All variants must have a label");
      if (totalVariantStock < 1) return toast.error("Total variant stock must be at least 1");
    } else {
      if (!stock || isNaN(Number(stock)) || Number(stock) < 1) return toast.error("Stock must be at least 1");
    }

    if (creditBalance < CREDIT_COST_LISTING) return toast.error("Insufficient credits. Please recharge your wallet.");

    setLoading(true);

    try {
      // Upload all photos
      const uploadedUrls: string[] = [];
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, file, { cacheControl: '3600', upsert: false });

        if (uploadError) throw new Error("Image upload failed: " + uploadError.message);

        const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName);
        uploadedUrls.push(publicUrl);
      }

      const coverPhoto = uploadedUrls[0];

      const res = await fetch("/api/products/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          price: Number(price),
          category,
          stock: hasVariants ? totalVariantStock : Number(stock),
          photo_url: coverPhoto,
          photo_urls: uploadedUrls,
          has_variants: hasVariants,
          variants: hasVariants ? { type: "size", options: variants.filter(v => v.stock > 0 || v.label) } : null,
        })
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to publish product");

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

      {/* Main Content */}
      <main className="max-w-[560px] mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="font-syne text-3xl font-bold text-ink mb-2">New Product</h1>
          <p className="text-ink-secondary text-sm">Add details to list this item immediately on your storefront.</p>
        </div>

        {/* Credit Cost Notice Section */}
         <div className={`mb-8 p-4 rounded-lg flex items-start gap-3 border ${creditBalance < 5 && creditBalance >= CREDIT_COST_LISTING ? 'bg-warning-bg border-warning/30 text-warning-content' : creditBalance < CREDIT_COST_LISTING ? 'bg-error-bg border-error/30 text-error' : 'bg-surface-raised border-border text-ink-secondary'}`}>
           <Wallet className={`w-5 h-5 shrink-0 ${creditBalance < 5 && creditBalance >= CREDIT_COST_LISTING ? 'text-warning' : creditBalance < CREDIT_COST_LISTING ? 'text-error' : 'text-saffron'}`} />
           <div className="flex-1">
             <p className="font-medium text-sm mb-1 text-ink">Publishing deducts {CREDIT_COST_LISTING} credits.</p>
             <p className="text-sm">Your balance: <strong className="font-jetbrains-mono">{creditBalance}</strong> credits</p>
           </div>
           {creditBalance < CREDIT_COST_LISTING && (
             <Link href="/wallet" className="shrink-0 h-[36px] px-4 inline-flex items-center justify-center bg-error text-surface-raised rounded-md font-medium text-sm shadow-sm opacity-90 hover:opacity-100 transition-opacity">
               <RefreshCcw className="w-4 h-4 mr-2" /> Recharge
             </Link>
           )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* Photo Upload — up to 5 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-ink block">
              Product Photos <span className="text-error">*</span>
              <span className="text-ink-muted font-normal ml-2">({files.length}/5)</span>
            </label>

            {/* Thumbnails row */}
            {previewUrls.length > 0 && (
              <div className="flex gap-3 flex-wrap mb-3">
                {previewUrls.map((url, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border group">
                    <Image src={url} alt={`Photo ${i + 1}`} fill className="object-cover" />
                    {i === 0 && (
                      <div className="absolute bottom-0 left-0 right-0 bg-saffron/80 text-surface-raised text-[9px] font-bold text-center py-0.5">
                        Cover
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="absolute top-1 right-1 w-5 h-5 bg-ink/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Dropzone — only show if under 5 */}
            {files.length < 5 && (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="relative bg-surface-raised border-2 border-dashed border-border-strong hover:border-saffron rounded-xl aspect-[4/3] flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-colors duration-fast group"
              >
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-saffron/10 transition-colors">
                    <ImageIcon className="w-6 h-6 text-ink-muted group-hover:text-saffron transition-colors" />
                  </div>
                  <p className="font-medium text-ink mb-1">
                    {files.length === 0 ? "Click or drag images to upload" : "Add more photos"}
                  </p>
                  <p className="text-xs text-ink-muted">Up to 5 photos · JPG, PNG, WEBP</p>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                />
              </div>
            )}
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
                   onChange={(e) => {
                     setCategory(e.target.value);
                     if (hasVariants) setVariants([]); // Reset variations when category changes
                   }}
                   disabled={loading}
                   className="w-full h-[44px] px-3 bg-surface border border-border rounded-md text-base text-ink focus:border-saffron focus:ring-1 focus:ring-saffron outline-none transition-all duration-fast appearance-none"
                 >
                   {CATEGORIES.map(cat => (
                     <option key={cat} value={cat}>{cat}</option>
                   ))}
                 </select>
               </div>

               {/* Variant Toggle */}
               <div className="pt-2 border-t border-border">
                 <label className="flex items-center gap-3 cursor-pointer group">
                   <div className="relative inline-flex items-center cursor-pointer">
                     <input type="checkbox" className="sr-only peer" checked={hasVariants} onChange={(e) => setHasVariants(e.target.checked)} disabled={loading} />
                     <div className="w-11 h-6 bg-surface border border-border peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-saffron rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-ink-muted peer-checked:after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-saffron peer-checked:border-saffron"></div>
                   </div>
                   <span className="text-sm font-medium text-ink group-hover:text-saffron transition-colors">This product has size variants</span>
                 </label>
               </div>

               {/* Stock Input (Conditionally rendered) */}
               {!hasVariants ? (
                 <div className="space-y-1">
                   <label className="text-xs font-medium text-ink-secondary ml-1">Stock quantity <span className="text-error">*</span></label>
                   <input
                     type="number"
                     min="1"
                     value={stock}
                     onChange={(e) => setStock(e.target.value)}
                     disabled={loading}
                     className="w-full h-[44px] px-3 bg-surface border border-border rounded-md font-jetbrains-mono text-base text-ink focus:border-saffron focus:ring-1 focus:ring-saffron outline-none transition-all duration-fast"
                     placeholder="1"
                   />
                 </div>
               ) : (
                 <div className="space-y-3 p-4 bg-surface rounded-lg border border-border">
                   <div className="flex items-center justify-between mb-2">
                     <label className="text-xs font-medium text-ink-secondary">Size Variants</label>
                     <span className="text-xs font-medium text-ink bg-surface-raised px-2 py-1 rounded">Total stock: <strong className="font-jetbrains-mono">{totalVariantStock}</strong></span>
                   </div>
                   <div className="space-y-2">
                     {variants.map((v, i) => (
                       <div key={i} className="flex items-center gap-2">
                         <input 
                           type="text" 
                           value={v.label}
                           onChange={(e) => {
                             const updated = [...variants];
                             updated[i].label = e.target.value;
                             setVariants(updated);
                           }}
                           className="flex-1 h-[40px] px-3 bg-surface-raised border border-border rounded-md font-jetbrains-mono text-sm uppercase text-ink focus:border-saffron focus:ring-1 outline-none"
                           placeholder="Size"
                         />
                         <input 
                           type="number" 
                           min="0"
                           value={v.stock}
                           onChange={(e) => {
                             const updated = [...variants];
                             updated[i].stock = parseInt(e.target.value) || 0;
                             setVariants(updated);
                           }}
                           className="w-24 h-[40px] px-3 bg-surface-raised border border-border rounded-md font-jetbrains-mono text-sm text-ink focus:border-saffron focus:ring-1 outline-none"
                           placeholder="Stock"
                         />
                         <button 
                           type="button" 
                           onClick={() => setVariants(variants.filter((_, idx) => idx !== i))}
                           className="p-2 text-ink-muted hover:text-error hover:bg-error-bg rounded-md transition-colors"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                       </div>
                     ))}
                   </div>
                   <button 
                     type="button"
                     onClick={() => setVariants([...variants, {label: '', stock: 0}])}
                     className="mt-2 flex items-center text-sm text-saffron font-medium hover:text-saffron-dark transition-colors"
                   >
                     <Plus className="w-4 h-4 mr-1" /> Add custom size
                   </button>
                 </div>
               )}
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
            disabled={loading || creditBalance < CREDIT_COST_LISTING}
            className="w-full h-[54px] flex items-center justify-center bg-saffron text-surface-raised rounded-md font-medium hover:bg-saffron-dark hover:shadow-saffron active:scale-[0.98] transition-all duration-base disabled:opacity-70 disabled:cursor-not-allowed text-lg"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Publish Listing"}
          </button>
        </form>

      </main>
    </div>
  );
}
