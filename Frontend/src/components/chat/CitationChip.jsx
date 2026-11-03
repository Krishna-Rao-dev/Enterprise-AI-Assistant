import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ExternalLink, BookOpen, ShieldCheck } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';

export function CitationChip({ citation, label }) {
  const { setSelectedCitation } = useAppStore();
  const [open, setOpen] = useState(false);

  if (!citation) {
    return <span className="text-primary font-mono text-xs">{label}</span>;
  }

  const isCurrent = citation.status === 'current';

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          onClick={() => setSelectedCitation(citation)}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded text-[11px] font-mono bg-elevated border border-border-strong text-primary hover:border-primary/50 hover:bg-hover transition-colors align-baseline"
        >
          <BookOpen className="w-3 h-3 opacity-70" />
          <span>{citation.doc_id}</span>
          {citation.section && (
            <span className="text-muted text-[10px] hidden sm:inline">
              {citation.section.split(' ')[0]}
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="top"
          align="center"
          sideOffset={6}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className="z-50 w-76 bg-surface border border-border-strong rounded-card p-3 shadow-2xl text-xs animate-in fade-in-50 zoom-in-95 pointer-events-auto"
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-border">
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-semibold text-primary">{citation.doc_id}</span>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-semibold ${
                  isCurrent
                    ? 'bg-success/15 text-success border border-success/30'
                    : 'bg-warning/15 text-warning border border-warning/30'
                }`}
              >
                {citation.status}
              </span>
              <span className="text-[10px] text-faint font-mono">v{citation.version}</span>
            </div>

            <button
              onClick={() => setSelectedCitation(citation)}
              className="text-[10px] text-secondary hover:underline flex items-center gap-0.5"
            >
              <span>View in drawer</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </button>
          </div>

          <h5 className="font-medium text-text text-xs mt-2 leading-snug">
            {citation.title}
          </h5>
          {citation.section && (
            <p className="text-[11px] font-mono text-faint mt-0.5">{citation.section}</p>
          )}

          {citation.excerpt && (
            <div className="mt-2 p-2 rounded bg-elevated border border-border text-[11px] text-muted line-clamp-3 leading-relaxed">
              "{citation.excerpt}"
            </div>
          )}

          {(citation.classification || citation.department) && (
            <div className="mt-2 pt-1.5 border-t border-border flex items-center justify-between text-[10px] text-faint font-mono">
              {citation.classification && (
                <span>Classification: <span className="text-text capitalize">{citation.classification}</span></span>
              )}
              {citation.department && (
                <span>Dept: <span className="text-text uppercase">{citation.department}</span></span>
              )}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
