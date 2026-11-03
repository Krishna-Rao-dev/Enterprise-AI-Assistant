import React, { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { apiClient } from '../../api/client';
import { ProjectFolder } from './ProjectFolder';
import { ConversationItem } from './ConversationItem';
import { UserCard } from './UserCard';
import {
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Clock,
  CalendarCheck2,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  FolderGit2
} from 'lucide-react';

export function Sidebar() {
  const {
    sidebarCollapsed,
    toggleSidebar,
    createNewThread,
    threads,
    projects,
    activeView,
    setActiveView,
    activeThreadId,
    setActiveThread,
  } = useAppStore();

  // Keyboard shortcut: Cmd/Ctrl+Shift+O for New conversation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        createNewThread();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createNewThread]);

  return (
    <aside
      className={`relative h-screen flex flex-col bg-surface border-r border-border transition-all duration-200 select-none z-30 ${
        sidebarCollapsed ? 'w-16' : 'w-72'
      }`}
    >
      {/* Top Header */}
      <div className="h-14 flex items-center justify-between px-3.5 border-b border-border flex-shrink-0">
        {!sidebarCollapsed ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-xs tracking-tight text-text truncate">
                NORTHWIND
              </span>
              <span className="text-[10px] text-faint font-mono tracking-wider uppercase">
                AI Assistant
              </span>
            </div>
          </div>
        ) : (
          <div className="w-7 h-7 mx-auto rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
            <Sparkles className="w-4 h-4" />
          </div>
        )}

        <div className="flex items-center gap-1">
          {!sidebarCollapsed && (
            <div className="flex items-center text-faint mr-1">
              <button
                onClick={() => {
                  const idx = threads.findIndex((t) => t.id === activeThreadId);
                  if (idx > 0) setActiveThread(threads[idx - 1].id);
                }}
                title="Previous conversation"
                className="p-1 rounded hover:text-text hover:bg-hover transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  const idx = threads.findIndex((t) => t.id === activeThreadId);
                  if (idx >= 0 && idx < threads.length - 1) setActiveThread(threads[idx + 1].id);
                }}
                title="Next conversation"
                className="p-1 rounded hover:text-text hover:bg-hover transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded-control text-muted hover:text-text hover:bg-hover transition-colors"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Primary Action Button: New Conversation */}
      <div className="p-3 flex-shrink-0">
        <button
          onClick={() => createNewThread()}
          title="New conversation (Ctrl+Shift+O)"
          className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-control text-xs font-medium text-white transition-all duration-150 ${
            sidebarCollapsed
              ? 'bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30'
              : 'bg-primary hover:bg-primary/90 shadow-sm active:scale-[0.98]'
          }`}
        >
          <Plus className="w-4 h-4" />
          {!sidebarCollapsed && (
            <div className="flex items-center justify-between flex-1">
              <span>New conversation</span>
              <kbd className="text-[10px] bg-black/25 text-white/70 px-1.5 py-0.5 rounded font-mono">
                ⌘⇧O
              </kbd>
            </div>
          )}
        </button>
      </div>

      {/* Main Navigation Items */}
      <div className="px-2 pb-2 space-y-0.5 border-b border-border flex-shrink-0">
        <button
          onClick={() => setActiveView('history')}
          title="Conversation history"
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-control text-xs transition-colors ${
            activeView === 'history'
              ? 'bg-elevated text-primary font-medium border border-border-strong'
              : 'text-muted hover:text-text hover:bg-hover'
          } ${sidebarCollapsed ? 'justify-center' : ''}`}
        >
          <Clock className="w-4 h-4 text-muted flex-shrink-0" />
          {!sidebarCollapsed && <span>History</span>}
        </button>

        <button
          onClick={() => setActiveView('tasks')}
          title="Scheduled tasks"
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-control text-xs transition-colors ${
            activeView === 'tasks'
              ? 'bg-elevated text-primary font-medium border border-border-strong'
              : 'text-muted hover:text-text hover:bg-hover'
          } ${sidebarCollapsed ? 'justify-center' : ''}`}
        >
          <CalendarCheck2 className="w-4 h-4 text-muted flex-shrink-0" />
          {!sidebarCollapsed && <span>Scheduled tasks</span>}
        </button>
      </div>

      {/* Projects and Folders Section */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {!sidebarCollapsed && (
          <div className="px-2 mb-2 flex items-center justify-between text-[11px] font-semibold text-faint uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <FolderGit2 className="w-3.5 h-3.5" />
              Projects
            </span>
            <span className="font-mono text-[10px]">{projects.length}</span>
          </div>
        )}

        <div className="space-y-1">
          {projects.map((project) => (
            <ProjectFolder
              key={project.id}
              project={project}
              threads={threads}
              collapsed={sidebarCollapsed}
            />
          ))}
          {!apiClient.isMock && threads.some((thread) => !thread.projectId) && (
            <div className="pt-2">
              {!sidebarCollapsed && (
                <div className="px-2 mb-1 text-[10px] font-semibold text-faint uppercase tracking-wider">
                  Scope not recorded
                </div>
              )}
              {threads.filter((thread) => !thread.projectId).map((thread) => (
                <ConversationItem key={thread.id} thread={thread} collapsed={sidebarCollapsed} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Footer: Settings & User Card */}
      <div className="p-2 border-t border-border flex-shrink-0 space-y-1 bg-surface/50">
        <button
          onClick={() => setActiveView('settings')}
          title="Settings"
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-control text-xs transition-colors ${
            activeView === 'settings'
              ? 'bg-elevated text-primary font-medium border border-border-strong'
              : 'text-muted hover:text-text hover:bg-hover'
          } ${sidebarCollapsed ? 'justify-center' : ''}`}
        >
          <SettingsIcon className="w-4 h-4 text-muted flex-shrink-0" />
          {!sidebarCollapsed && <span>Settings</span>}
        </button>

        <UserCard collapsed={sidebarCollapsed} />
      </div>
    </aside>
  );
}
