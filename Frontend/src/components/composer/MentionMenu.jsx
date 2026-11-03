import React, { useState, useEffect } from 'react';
import { MOCK_PROJECTS } from '../../mock/projects';
import { MOCK_DOCS } from '../../mock/docsData';
import { getStoredTickets } from '../../mock/ticketsData';
import { FolderGit2, FileText, Ticket, Search } from 'lucide-react';

export function MentionMenu({ query = '', onSelect, onClose }) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const cleanQuery = query.toLowerCase().trim();

  // Repos
  const repos = MOCK_PROJECTS.filter((p) =>
    p.name.toLowerCase().includes(cleanQuery)
  ).map((p) => ({
    type: 'repo',
    id: p.id,
    label: p.name,
    sub: 'Repository / Scope',
    icon: FolderGit2,
  }));

  // Docs
  const docs = MOCK_DOCS.filter(
    (d) =>
      d.doc_id.toLowerCase().includes(cleanQuery) ||
      d.title.toLowerCase().includes(cleanQuery)
  ).map((d) => ({
    type: 'doc',
    id: d.doc_id,
    label: `${d.doc_id}: ${d.title}`,
    sub: `${d.department.toUpperCase()} • v${d.version}`,
    icon: FileText,
  }));

  // Tickets
  const tickets = getStoredTickets()
    .filter(
      (t) =>
        t.key.toLowerCase().includes(cleanQuery) ||
        t.summary.toLowerCase().includes(cleanQuery)
    )
    .map((t) => ({
      type: 'ticket',
      id: t.key,
      label: `${t.key}: ${t.summary}`,
      sub: `Jira • ${t.status}`,
      icon: Ticket,
    }));

  const allItems = [...repos, ...docs, ...tickets];

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, allItems.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev === 0 ? Math.max(0, allItems.length - 1) : prev - 1
        );
      } else if (e.key === 'Enter') {
        if (allItems[selectedIndex]) {
          e.preventDefault();
          onSelect(allItems[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allItems, selectedIndex, onSelect, onClose]);

  if (allItems.length === 0) {
    return (
      <div className="absolute bottom-full mb-2 left-0 w-80 bg-surface border border-border-strong rounded-card p-3 shadow-2xl z-50 text-xs text-muted">
        No matching repos, documents, or tickets found.
      </div>
    );
  }

  return (
    <div className="absolute bottom-full mb-2 left-0 w-84 bg-surface border border-border-strong rounded-card p-1.5 shadow-2xl z-50 text-xs max-h-72 overflow-y-auto animate-in fade-in-50 zoom-in-95">
      <div className="px-2.5 py-1 text-[10px] font-semibold text-faint uppercase tracking-wider flex items-center justify-between border-b border-border mb-1">
        <span>Mention in prompt (@)</span>
        <span className="font-mono">{allItems.length} matches</span>
      </div>

      <div className="space-y-0.5">
        {allItems.map((item, idx) => {
          const Icon = item.icon;
          const isSelected = idx === selectedIndex;
          return (
            <button
              key={`${item.type}-${item.id}`}
              onClick={() => onSelect(item)}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-control text-left transition-colors ${
                isSelected
                  ? 'bg-elevated text-text border border-border-strong font-medium'
                  : 'text-muted hover:text-text hover:bg-hover border border-transparent'
              }`}
            >
              <div className="w-6 h-6 rounded bg-elevated flex items-center justify-center text-primary flex-shrink-0">
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-text font-medium">{item.label}</p>
                <p className="text-[10px] text-faint truncate">{item.sub}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
