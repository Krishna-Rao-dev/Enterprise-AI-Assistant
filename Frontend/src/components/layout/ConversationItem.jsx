import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { apiClient } from '../../api/client';
import { MessageSquare, MoreHorizontal, Trash2, Edit2, FolderInput, Check, X } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

export function ConversationItem({ thread, collapsed }) {
  const {
    activeThreadId,
    setActiveThread,
    updateThreadTitle,
    deleteThread,
    moveThreadToProject,
    projects,
  } = useAppStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(thread.title);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const isActive = activeThreadId === thread.id;

  const handleSaveRename = (e) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      updateThreadTitle(thread.id, editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleCancelRename = (e) => {
    e.stopPropagation();
    setEditTitle(thread.title);
    setIsEditing(false);
  };

  if (collapsed) {
    return (
      <button
        onClick={() => setActiveThread(thread.id)}
        title={thread.title}
        className={`w-10 h-10 mx-auto flex items-center justify-center rounded-control relative transition-colors ${
          isActive ? 'bg-elevated text-primary border border-border-strong' : 'text-muted hover:text-text hover:bg-hover'
        }`}
      >
        <MessageSquare className="w-4 h-4" />
        {thread.hasUnread && (
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary animate-pulse" />
        )}
      </button>
    );
  }

  return (
    <div
      onClick={() => {
        if (!isEditing) setActiveThread(thread.id);
      }}
      className={`group relative flex items-center justify-between px-2.5 py-2 rounded-control text-xs cursor-pointer transition-all duration-150 border ${
        isActive
          ? 'bg-elevated text-text border-border-strong font-medium shadow-sm'
          : 'text-muted hover:text-text hover:bg-hover border-transparent'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1 mr-1">
        {thread.hasUnread ? (
          <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 animate-pulse" />
        ) : (
          <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-primary' : 'text-faint'}`} />
        )}

        {isEditing ? (
          <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveRename(e);
                if (e.key === 'Escape') handleCancelRename(e);
              }}
              autoFocus
              className="bg-surface border border-primary/50 text-text px-1.5 py-0.5 rounded text-xs w-full focus:outline-none"
            />
            <button onClick={handleSaveRename} className="p-0.5 hover:text-success text-muted">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleCancelRename} className="p-0.5 hover:text-danger text-muted">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <span className="truncate flex-1" title={thread.title}>
            {thread.title}
          </span>
        )}
      </div>

      {!isEditing && apiClient.isMock && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[11px] text-faint group-hover:hidden">
            {thread.displayTime || 'recent'}
          </span>

          {/* Action Menu */}
          <div className="hidden group-hover:block" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  aria-label="Thread actions"
                  className="p-1 rounded hover:bg-surface text-muted hover:text-text transition-colors"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </DropdownMenu.Trigger>

              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={4}
                  className="z-50 w-44 bg-surface border border-border-strong rounded-control p-1 text-xs shadow-xl animate-in fade-in-50 zoom-in-95"
                >
                  <DropdownMenu.Item
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-muted hover:text-text hover:bg-hover cursor-pointer outline-none"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Rename
                  </DropdownMenu.Item>

                  <DropdownMenu.Sub>
                    <DropdownMenu.SubTrigger className="flex items-center justify-between px-2 py-1.5 rounded text-muted hover:text-text hover:bg-hover cursor-pointer outline-none">
                      <div className="flex items-center gap-2">
                        <FolderInput className="w-3.5 h-3.5" />
                        Move to project
                      </div>
                    </DropdownMenu.SubTrigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.SubContent className="z-50 w-40 bg-surface border border-border-strong rounded-control p-1 text-xs shadow-xl">
                        {projects.map((p) => (
                          <DropdownMenu.Item
                            key={p.id}
                            onClick={() => moveThreadToProject(thread.id, p.id)}
                            className="flex items-center gap-2 px-2 py-1.5 rounded text-muted hover:text-text hover:bg-hover cursor-pointer outline-none"
                          >
                            <span className="truncate">{p.name}</span>
                          </DropdownMenu.Item>
                        ))}
                      </DropdownMenu.SubContent>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Sub>

                  <DropdownMenu.Separator className="h-px bg-border my-1" />

                  <DropdownMenu.Item
                    onClick={() => {
                      if (window.confirm('Delete this conversation? This action cannot be undone.')) {
                        deleteThread(thread.id);
                      }
                    }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-danger hover:bg-danger/10 cursor-pointer outline-none"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>
      )}
    </div>
  );
}
