import React, { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, Loader2, Sparkles, AlertTriangle } from 'lucide-react';

export function ActivityTimeline({ steps = [], isStreaming = false }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!steps || steps.length === 0) return null;

  const totalMs = steps.reduce((acc, s) => acc + (s.ms || 0), 0);
  const totalSec = (totalMs / 1000).toFixed(1);
  const isAllDone = !isStreaming && steps.every((s) => s.status === 'done');

  // Summary label when collapsed
  const summaryLabel = isAllDone
    ? `Completed ${steps.length} steps in ${totalSec}s`
    : `Processing request (${steps.filter((s) => s.status === 'done').length}/${steps.length})`;

  return (
    <div className="mb-3 text-xs select-none">
      {/* Collapsed One-Line Summary */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 py-1 px-2.5 rounded-full bg-surface border border-border hover:border-border-strong text-muted hover:text-text transition-colors"
      >
        {isStreaming ? (
          <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5 text-success" />
        )}
        <span className="font-mono text-[11px]">{summaryLabel}</span>
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 text-faint" />
        ) : (
          <ChevronRight className="w-3 h-3 text-faint" />
        )}
      </button>

      {/* Expanded Timeline Steps */}
      {isExpanded && (
        <div className="mt-2 ml-2 pl-3 border-l border-border space-y-1.5 animate-in fade-in-50 duration-150">
          {steps.map((step, idx) => {
            const isDone = step.status === 'done';
            return (
              <div key={step.id || idx} className="flex items-start justify-between gap-2 py-0.5">
                <div className="flex items-center gap-2 min-w-0">
                  {isDone ? (
                    <CheckCircle2 className="w-3 h-3 text-success flex-shrink-0" />
                  ) : (
                    <Loader2 className="w-3 h-3 text-primary animate-spin flex-shrink-0" />
                  )}
                  <span className={`text-[11px] truncate ${isDone ? 'text-text' : 'text-primary'}`}>
                    {step.label}
                  </span>
                </div>
                {step.ms > 0 && (
                  <span className="text-[10px] font-mono text-faint flex-shrink-0">
                    {step.ms}ms
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
