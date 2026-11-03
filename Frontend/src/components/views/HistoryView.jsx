import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { apiClient } from '../../api/client';
import {
  Search,
  FolderGit2,
  Calendar,
  MessageSquare,
  Trash2,
  Edit2,
  FolderInput,
  ArrowRight,
  Filter
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

export function HistoryView() {
  const {
    threads,
    projects,
    setActiveThread,
    setActiveView,
    updateThreadTitle,
    deleteThread,
    moveThreadToProject,
  } = useAppStore();

  const [search, setSearch] = useState('');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('all');

  const filteredThreads = threads.filter((t) => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase());
    const matchesProject = !apiClient.isMock
      || selectedProjectFilter === 'all'
      || t.projectId === selectedProjectFilter;
    return matchesSearch && matchesProject;
  });

  // Group threads by date
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const groups = {
    Today: [],
    Yesterday: [],
    'This week': [],
    Older: [],
  };

  filteredThreads.forEach((thread) => {
    const time = new Date(thread.updatedAt || Date.now()).getTime();
    const diffDays = Math.floor((now - time) / dayMs);

    if (diffDays <= 0) {
      groups.Today.push(thread);
    } else if (diffDays === 1) {
      groups.Yesterday.push(thread);
    } else if (diffDays <= 7) {
      groups['This week'].push(thread);
    } else {
      groups.Older.push(thread);
    }
  });

  return (
    <div className="flex-1 h-[calc(100vh-3.5rem)] overflow-y-auto p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-xl font-semibold text-text">Conversation History</h2>
          <p className="text-xs text-muted mt-1">
            Browse and organize conversations across internal projects
          </p>
        </div>

        {/* Search & Project Filter */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="bg-surface border border-border rounded-control pl-8 pr-3 py-1.5 text-xs text-text placeholder-faint focus:outline-none focus:border-primary w-48 sm:w-60"
            />
          </div>

          {apiClient.isMock && (
            <select
              value={selectedProjectFilter}
              onChange={(e) => setSelectedProjectFilter(e.target.value)}
              className="bg-surface border border-border rounded-control px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-primary font-mono"
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Date Groups */}
      {filteredThreads.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare className="w-10 h-10 text-faint mx-auto mb-2 opacity-50" />
          <h4 className="text-sm font-medium text-text">No conversations match your filter</h4>
          <p className="text-xs text-muted mt-1">Try resetting the search keyword or project selector.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([groupTitle, items]) => {
            if (items.length === 0) return null;
            return (
              <div key={groupTitle}>
                <h3 className="text-xs font-semibold text-faint uppercase font-mono tracking-wider mb-2.5">
                  {groupTitle} ({items.length})
                </h3>

                <div className="space-y-1.5">
                  {items.map((thread) => (
                    <div
                      key={thread.id}
                      onClick={() => {
                        setActiveThread(thread.id);
                        setActiveView('chat');
                      }}
                      className="group flex items-center justify-between p-3 rounded-card bg-surface border border-border hover:border-border-strong hover:bg-elevated cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <MessageSquare className="w-4 h-4 text-primary flex-shrink-0" />
                        <div className="min-w-0">
                          <h4 className="text-xs font-medium text-text truncate group-hover:text-primary transition-colors">
                            {thread.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-faint font-mono">
                            <span>{thread.projectId || 'Scope not recorded'}</span>
                            {(apiClient.isMock || thread.messagesLoaded) && (
                              <>
                                <span>•</span>
                                <span>{thread.messages.length} messages</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[11px] text-faint font-mono mr-2">
                          {thread.displayTime || 'recent'}
                        </span>

                        {apiClient.isMock && <div
                          className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              const title = prompt('Enter new conversation title:', thread.title);
                              if (title && title.trim()) updateThreadTitle(thread.id, title.trim());
                            }}
                            title="Rename"
                            className="p-1 rounded hover:bg-hover text-muted hover:text-text"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              if (confirm('Delete this conversation?')) deleteThread(thread.id);
                            }}
                            title="Delete"
                            className="p-1 rounded hover:bg-danger/20 text-muted hover:text-danger"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
