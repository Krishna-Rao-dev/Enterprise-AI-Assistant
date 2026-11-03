import React, { useEffect } from 'react';
import { Command } from 'cmdk';
import { useAppStore } from '../../store/useAppStore';
import {
  MessageSquare,
  Plus,
  FolderGit2,
  Clock,
  Settings,
  PanelLeft,
  BookOpen,
  UserCheck,
  Sparkles,
  Search
} from 'lucide-react';

export function CommandPalette() {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    createNewThread,
    threads,
    projects,
    setSelectedProject,
    setActiveThread,
    setActiveView,
    toggleSidebar,
    toggleSourcesDrawer,
    setSimulatorOpen,
    setCurrentUser,
    showToast,
  } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  if (!commandPaletteOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center pt-20 p-4"
      onClick={() => setCommandPaletteOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-surface border border-border-strong rounded-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <Command
          label="Global Command Palette"
          className="w-full text-xs text-text focus:outline-none"
        >
          <div className="flex items-center gap-2.5 px-4 border-b border-border h-12">
            <Search className="w-4 h-4 text-muted" />
            <Command.Input
              autoFocus
              placeholder="Type a command or search conversations..."
              className="w-full bg-transparent text-sm text-text placeholder-muted focus:outline-none"
            />
            <kbd className="text-[10px] bg-elevated border border-border px-1.5 py-0.5 rounded text-faint font-mono">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2 space-y-1">
            <Command.Empty className="p-4 text-center text-muted">
              No matching commands or conversations found.
            </Command.Empty>

            {/* Quick Actions */}
            <Command.Group heading="Navigation & Actions" className="text-faint text-[10px] uppercase font-mono px-2 py-1">
              <Command.Item
                onSelect={() => {
                  createNewThread();
                  setCommandPaletteOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-control hover:bg-hover hover:text-text cursor-pointer transition-colors text-xs text-muted"
              >
                <Plus className="w-4 h-4 text-primary" />
                <span className="text-text font-medium">New conversation</span>
                <span className="ml-auto font-mono text-[10px] text-faint">⌘⇧O</span>
              </Command.Item>

              <Command.Item
                onSelect={() => {
                  toggleSidebar();
                  setCommandPaletteOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-control hover:bg-hover hover:text-text cursor-pointer transition-colors text-xs text-muted"
              >
                <PanelLeft className="w-4 h-4 text-muted" />
                <span>Toggle sidebar</span>
              </Command.Item>

              <Command.Item
                onSelect={() => {
                  toggleSourcesDrawer('sources');
                  setCommandPaletteOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-control hover:bg-hover hover:text-text cursor-pointer transition-colors text-xs text-muted"
              >
                <BookOpen className="w-4 h-4 text-muted" />
                <span>Toggle sources drawer</span>
              </Command.Item>

              <Command.Item
                onSelect={() => {
                  setSimulatorOpen(true);
                  setCommandPaletteOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-control hover:bg-hover hover:text-text cursor-pointer transition-colors text-xs text-muted"
              >
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Open Dev Simulator Panel</span>
                <span className="ml-auto font-mono text-[10px] text-faint">⌘⇧D</span>
              </Command.Item>
            </Command.Group>

            {/* Switch Project */}
            <Command.Group heading="Switch Project Scope" className="text-faint text-[10px] uppercase font-mono px-2 py-1 mt-2">
              {projects.map((proj) => (
                <Command.Item
                  key={proj.id}
                  onSelect={() => {
                    setSelectedProject(proj.id);
                    setCommandPaletteOpen(false);
                    showToast(`Scope switched to ${proj.name}`, 'info');
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-control hover:bg-hover hover:text-text cursor-pointer transition-colors text-xs text-muted"
                >
                  <FolderGit2 className="w-4 h-4 text-secondary" />
                  <span className="font-mono">{proj.name}</span>
                </Command.Item>
              ))}
            </Command.Group>

            {/* Recent Conversations */}
            <Command.Group heading="Recent Conversations" className="text-faint text-[10px] uppercase font-mono px-2 py-1 mt-2">
              {threads.slice(0, 5).map((thread) => (
                <Command.Item
                  key={thread.id}
                  onSelect={() => {
                    setActiveThread(thread.id);
                    setActiveView('chat');
                    setCommandPaletteOpen(false);
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-control hover:bg-hover hover:text-text cursor-pointer transition-colors text-xs text-muted"
                >
                  <MessageSquare className="w-4 h-4 text-primary/70" />
                  <span className="truncate flex-1">{thread.title}</span>
                  <span className="font-mono text-[10px] text-faint">{thread.projectId}</span>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
