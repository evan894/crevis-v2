export default function Home() {
  return (
    <main className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-ink selection:bg-saffron selection:text-surface-raised">
      <div className="max-w-2xl w-full text-center space-y-12">
        <div className="space-y-6">
          <p className="font-jetbrains-mono text-saffron tracking-widest uppercase text-sm font-semibold">
            System Initialization
          </p>
          <h1 className="font-syne text-5xl md:text-8xl font-bold tracking-tight text-ink drop-shadow-xs">
            Crevis <span className="text-saffron italic">v2</span>
          </h1>
          <p className="font-dm-sans text-lg md:text-xl text-ink-secondary max-w-lg mx-auto leading-relaxed">
            Sell everywhere. Manage your conversational commerce with quiet luxury.
          </p>
        </div>
        
        <div className="flex gap-4 md:gap-6 justify-center font-dm-sans">
           <button className="px-8 py-4 bg-saffron text-surface-raised rounded-xl shadow-saffron font-semibold hover:bg-saffron-dark active:scale-95 transition-all duration-base ease-out-custom select-none">
             Engine Active
           </button>
           <button className="px-8 py-4 bg-surface-raised border border-border-strong text-ink rounded-xl shadow-sm font-semibold hover:border-ink active:scale-95 transition-all duration-base ease-out-custom select-none">
             Settings
           </button>
        </div>

        <div className="pt-24 opacity-80 hover:opacity-100 transition-opacity duration-base">
            <p className="font-jetbrains-mono text-ink-muted text-sm tracking-wide">
              CREDIT_BALANCE <span className="mx-2 text-border-strong">{"///"}</span> <span className="text-credit font-bold">100.00</span>
            </p>
        </div>
      </div>
    </main>
  );
}
