import React, { useState, useEffect } from 'react';
import {
  Ticket,
  Search,
  CheckCircle2,
  FileText,
  Trash2,
  Bug,
  Activity,
  WifiOff,
  Clock,
  Sparkles
} from 'lucide-react';

export const SLASH_COMMANDS = [
  {
    cmd: '/ticket',
    title: 'Raise Jira ticket',
    desc: 'Draft an issue with human approval workflow',
    icon: Ticket,
  },
  {
    cmd: '/search-docs',
    title: 'Search docs',
    desc: 'Query verified knowledge documents with citations',
    icon: Search,
  },
  {
    cmd: '/ticket-status',
    title: 'Check ticket status',
    desc: 'Inspect open issues or specific Jira key',
    icon: CheckCircle2,
  },
  {
    cmd: '/summarize',
    title: 'Summarize context',
    desc: 'Synthesize thread discussion into concise takeaways',
    icon: FileText,
  },
  {
    cmd: '/clear',
    title: 'Clear conversation',
    desc: 'Reset messages in current thread',
    icon: Trash2,
  },
  {
    cmd: '/simulate error',
    title: 'Simulate API error',
    desc: 'Trigger error card with retry button',
    icon: Bug,
    isSim: true,
  },
  {
    cmd: '/simulate ratelimit',
    title: 'Simulate rate limit',
    desc: 'Display 24s countdown cooldown state',
    icon: Activity,
    isSim: true,
  },
  {
    cmd: '/simulate offline',
    title: 'Simulate offline mode',
    desc: 'Demonstrate network disconnect handling',
    icon: WifiOff,
    isSim: true,
  },
  {
    cmd: '/simulate slow',
    title: 'Simulate slow streaming',
    desc: 'Demonstrate token-by-token stream with Stop button',
    icon: Clock,
    isSim: true,
  },
];

export function SlashMenu({ query = '', onSelect, onClose }) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const cleanQuery = query.toLowerCase().trim();
  const filtered = SLASH_COMMANDS.filter(
    (c) =>
      c.cmd.toLowerCase().includes(cleanQuery) ||
      c.title.toLowerCase().includes(cleanQuery)
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev === 0 ? Math.max(0, filtered.length - 1) : prev - 1
        );
      } else if (e.key === 'Enter') {
        if (filtered[selectedIndex]) {
          e.preventDefault();
          onSelect(filtered[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filtered, selectedIndex, onSelect, onClose]);

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full mb-2 left-0 w-84 bg-surface border border-border-strong rounded-card p-1.5 shadow-2xl z-50 text-xs max-h-72 overflow-y-auto animate-in fade-in-50 zoom-in-95">
      <div className="px-2.5 py-1 text-[10px] font-semibold text-faint uppercase tracking-wider flex items-center justify-between border-b border-border mb-1">
        <span>Actions & Commands (/)</span>
        <span className="font-mono text-primary">{filtered.length} available</span>
      </div>

      <div className="space-y-0.5">
        {filtered.map((item, idx) => {
          const Icon = item.icon;
          const isSelected = idx === selectedIndex;
          return (
            <button
              key={item.cmd}
              onClick={() => onSelect(item)}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-control text-left transition-colors ${
                isSelected
                  ? 'bg-elevated text-text border border-border-strong font-medium'
                  : 'text-muted hover:text-text hover:bg-hover border border-transparent'
              }`}
            >
              <div
                className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${
                  item.isSim
                    ? 'bg-warning/10 text-warning'
                    : 'bg-elevated text-primary'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-text font-semibold">{item.cmd}</span>
                  <span className="text-muted text-[11px] truncate">{item.title}</span>
                </div>
                <p className="text-[10px] text-faint truncate">{item.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
