"use client";

import { Users } from "lucide-react";
import Link from "next/link";

export type TeamMember = {
  user_id: string;
  display_name: string;
  role: string;
  activity_count: number;
};

function roleLabel(role: string) {
  switch (role) {
    case "manager":        return "Manager";
    case "sales_agent":    return "Sales Agent";
    case "delivery_agent": return "Delivery Agent";
    default:               return role;
  }
}

export function TeamActivity({ members }: { members: TeamMember[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Users className="w-5 h-5 text-ink-muted" />
        <h2 className="font-syne font-bold text-2xl text-ink">Team Activity Today</h2>
      </div>

      <div className="bg-surface-raised border border-border rounded-xl overflow-hidden shadow-sm">
        {members.length === 0 ? (
          <div className="py-12 text-center text-sm text-ink-secondary">
            No team members yet — <Link href="/team" className="text-saffron hover:underline">add members</Link> to see their activity here.
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface text-ink-muted border-b border-border">
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider">Member</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-center">Orders Today</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id} className="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-saffron/10 flex items-center justify-center text-saffron text-xs font-bold">
                        {m.display_name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-ink">{m.display_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-surface border border-border text-ink-secondary">
                      {roleLabel(m.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`font-jetbrains-mono font-bold text-lg ${m.activity_count > 0 ? "text-saffron" : "text-ink-muted"}`}>
                      {m.activity_count}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
