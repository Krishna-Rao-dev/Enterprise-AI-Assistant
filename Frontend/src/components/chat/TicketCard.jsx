import React from 'react';
import { ExternalLink, AlertTriangle, ShieldCheck } from 'lucide-react';

export function TicketCard({ tickets = [] }) {
  if (!tickets || tickets.length === 0) return null;

  return (
    <div className="my-3 overflow-hidden rounded-card border border-border bg-surface text-xs">
      <div className="px-3 py-2 bg-elevated border-b border-border flex items-center justify-between">
        <span className="font-semibold text-text uppercase tracking-wider text-[11px] font-mono">
          Jira Search Results ({tickets.length})
        </span>
        <span className="text-[10px] text-faint font-mono">Synced from Jira Cloud</span>
      </div>

      <div className="divide-y divide-border">
        {tickets.map((t) => (
          <div key={t.key} className="p-3 hover:bg-hover/50 transition-colors">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-primary">{t.key}</span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-medium ${
                    t.status === 'Done'
                      ? 'bg-success/15 text-success'
                      : t.status === 'In Progress'
                      ? 'bg-secondary/15 text-secondary'
                      : 'bg-elevated text-muted'
                  }`}
                >
                  {t.status}
                </span>
                <span className="text-[10px] text-faint font-mono">Priority: {t.priority}</span>
              </div>

              <a
                href={t.url}
                target="_blank"
                rel="noreferrer"
                className="text-muted hover:text-text flex items-center gap-1 text-[11px] font-mono"
              >
                <span>Open</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <p className="text-text font-medium mt-1 leading-snug">{t.summary}</p>

            {t.isSuspicious && (
              <div className="mt-2 p-1.5 rounded bg-warning/10 border border-warning/20 flex items-center gap-1.5 text-warning text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Suspicious content detected in description. Directives neutralized.</span>
              </div>
            )}

            <div className="mt-2 flex items-center justify-between text-[11px] text-faint">
              <div className="flex items-center gap-1.5">
                <img
                  src={t.assignee?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                  alt=""
                  className="w-4 h-4 rounded-full object-cover"
                />
                <span className="text-muted">{t.assignee?.name || 'Unassigned'}</span>
              </div>
              <span>Reporter: <span className="text-muted">{t.reporter}</span></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
