"use client";

export function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: React.ElementType; color: string;
}) {
  return (
    <div className={`flex-1 rounded-2xl p-3.5 border text-center ${value > 0 ? `${color} shadow-sm` : "bg-surface-raised border-border"}`}>
      <Icon className={`w-5 h-5 mx-auto mb-1.5 ${value > 0 ? "text-current opacity-70" : "text-ink-muted"}`} />
      <p className="font-syne font-bold text-2xl">{value}</p>
      <p className="text-[10px] uppercase tracking-wider mt-0.5 opacity-70">{label}</p>
    </div>
  );
}
