import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center text-center px-6">
      <div className="w-20 h-20 rounded-full bg-surface-raised border border-border flex items-center justify-center mb-6">
        <span className="text-3xl">🛍️</span>
      </div>
      <h1 className="font-syne text-2xl font-bold text-ink mb-3">
        Product not available
      </h1>
      <p className="text-ink-secondary text-sm mb-8 max-w-xs">
        This product is no longer available on Crevis. It may have been removed or sold out.
      </p>
      <Link
        href="https://t.me/Crevis_shop_bot"
        className="h-[44px] px-8 inline-flex items-center justify-center bg-saffron text-white rounded-lg font-medium text-sm hover:bg-saffron-dark transition-all duration-200 shadow-sm"
        target="_blank"
        rel="noopener noreferrer"
      >
        Browse all products on Telegram
      </Link>
    </div>
  );
}
