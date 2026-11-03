import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ConversationItem } from './ConversationItem';
import { ChevronRight, Folder, FolderOpen, Plus } from 'lucide-react';

export function ProjectFolder({ project, threads = [], collapsed }) {
  const { createNewThread, setActiveView } = useAppStore();
  const [isOpen, setIsOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const projectThreads = threads.filter((t) => t.projectId === project.id);
  const visibleThreads = showAll ? projectThreads : projectThreads.slice(0, 4);

  if (collapsed) {
    return (
      <div className="py-1">
        <button
          onClick={() => createNewThread(project.id)}
          title={`New chat in ${project.name}`}
          className="w-10 h-10 mx-auto flex items-center justify-center rounded-control text-muted hover:text-text hover:bg-hover transition-colors"
        >
          <Folder className="w-4 h-4 text-primary/70" />
        </button>
      </div>
    );
  }

  return (
    <div className="mb-2">
      {/* Folder Header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center justify-between px-2 py-1.5 rounded-control text-xs font-medium text-muted hover:text-text hover:bg-hover cursor-pointer select-none transition-colors"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <ChevronRight
            className={`w-3.5 h-3.5 text-faint transition-transform duration-150 ${
              isOpen ? 'rotate-90 text-text' : ''
            }`}
          />
          {isOpen ? (
            <FolderOpen className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-muted flex-shrink-0" />
          )}
          <span className="truncate text-text font-mono text-[11px]">{project.name}</span>
          <span className="text-[10px] text-faint font-mono">({projectThreads.length})</span>
        </div>

        {/* Hover icon: new chat in this project */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            createNewThread(project.id);
          }}
          title={`New chat in ${project.name}`}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-elevated hover:text-primary transition-all duration-150"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Folder Content */}
      {isOpen && (
        <div className="ml-3 pl-2 border-l border-border space-y-0.5 mt-0.5 animate-in fade-in-50">
          {visibleThreads.length === 0 ? (
            <div className="px-2 py-2 text-[11px] text-faint italic">
              No conversations yet
            </div>
          ) : (
            visibleThreads.map((thread) => (
              <ConversationItem key={thread.id} thread={thread} collapsed={collapsed} />
            ))
          )}

          {projectThreads.length > 4 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full text-left px-2 py-1 text-[11px] text-primary/80 hover:text-primary transition-colors font-medium"
            >
              See all ({projectThreads.length})
            </button>
          )}

          {showAll && projectThreads.length > 4 && (
            <button
              onClick={() => setShowAll(false)}
              className="w-full text-left px-2 py-1 text-[11px] text-muted hover:text-text transition-colors"
            >
              Show less
            </button>
          )}
        </div>
      )}
    </div>
  );
}
