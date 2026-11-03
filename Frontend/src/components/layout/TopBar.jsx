import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { apiClient } from '../../api/client';
import {
  BookOpen,
  ChevronDown,
  Check,
  Layers,
  Circle,
  Edit2,
  CheckCheck
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

export function TopBar() {
  const {
    activeThreadId,
    threads,
    selectedProject,
    setSelectedProject,
    projects,
    updateThreadTitle,
    sourcesDrawerOpen,
    toggleSourcesDrawer,
  } = useAppStore();

  const currentThread = threads.find((t) => t.id === activeThreadId);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [backendAvailable, setBackendAvailable] = useState(null);

  useEffect(() => {
    if (apiClient.isMock) return undefined;
    let cancelled = false;
    apiClient.getHealth()
      .then((health) => {
        if (!cancelled) setBackendAvailable(health.status === 'ok');
      })
      .catch((error) => {
        console.warn('Backend health check failed', error);
        if (!cancelled) setBackendAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const displayTitle = currentThread?.title || 'New conversation';

  const handleStartEdit = () => {
    setTitleValue(displayTitle);
    setIsEditingTitle(true);
  };

  const handleSaveTitle = () => {
    if (currentThread && titleValue.trim()) {
      updateThreadTitle(currentThread.id, titleValue.trim());
    }
    setIsEditingTitle(false);
  };

  return (
    <header className="h-14 border-b border-border bg-bg/80 backdrop-blur-md px-4 flex items-center justify-between z-20 flex-shrink-0">
      {/* Left: Editable Conversation Title */}
      <div className="flex items-center gap-2 min-w-0 max-w-[420px]">
        {isEditingTitle && currentThread ? (
          <div className="flex items-center gap-1.5 w-full">
            <input
              type="text"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTitle();
                if (e.key === 'Escape') setIsEditingTitle(false);
              }}
              autoFocus
              className="bg-surface border border-primary/50 text-text px-2 py-0.5 rounded text-sm font-medium w-full focus:outline-none"
            />
            <button onClick={handleSaveTitle} className="text-muted hover:text-success p-1">
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div
            onClick={currentThread ? handleStartEdit : undefined}
            className={`group flex items-center gap-2 truncate ${
              currentThread ? 'cursor-pointer' : ''
            }`}
          >
            <h1 className="text-sm font-medium text-text truncate max-w-xs md:max-w-sm">
              {displayTitle}
            </h1>
            {currentThread && (
              <Edit2 className="w-3.5 h-3.5 text-faint opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        )}
      </div>

      {/* Right Controls: Scope Chip, Integrations, Environment, Drawer toggle */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Scope chip with dropdown */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-control text-xs bg-surface border border-border hover:border-border-strong text-text transition-colors">
              <Layers className="w-3.5 h-3.5 text-primary" />
              <span className="text-muted hidden sm:inline">Scope:</span>
              <span className="font-mono text-[11px] text-text font-medium">{selectedProject}</span>
              <ChevronDown className="w-3 h-3 text-muted ml-0.5" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="z-50 w-56 bg-surface border border-border-strong rounded-control p-1 text-xs shadow-xl animate-in fade-in-50"
            >
              <div className="px-2 py-1.5 text-[10px] uppercase font-semibold text-faint tracking-wider">
                Select Documentation Catalog
              </div>
              {projects.map((proj) => (
                <DropdownMenu.Item
                  key={proj.id}
                  onClick={() => setSelectedProject(proj.id)}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded cursor-pointer outline-none transition-colors ${
                    selectedProject === proj.id
                      ? 'bg-elevated text-primary font-medium'
                      : 'text-muted hover:text-text hover:bg-hover'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-mono">{proj.name}</span>
                    <span className="text-[10px] text-faint truncate">{proj.description}</span>
                  </div>
                  {selectedProject === proj.id && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0 ml-1" />}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {/* Integration Status Chips */}
        {apiClient.isMock ? (
          <div className="hidden md:flex items-center gap-1.5 text-[11px] font-mono text-muted bg-surface/50 px-2 py-1 rounded-control border border-border">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              <span>Jira</span>
            </span>
            <span className="text-border">|</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              <span>HR</span>
            </span>
          </div>
        ) : (
          <div className="hidden md:flex items-center gap-1.5 text-[11px] font-mono text-muted bg-surface/50 px-2 py-1 rounded-control border border-border">
            <span className={`w-1.5 h-1.5 rounded-full ${
              backendAvailable === null ? 'bg-warning' : backendAvailable ? 'bg-success' : 'bg-danger'
            }`} />
            <span>
              {backendAvailable === null ? 'Checking API' : backendAvailable ? 'Backend API' : 'API offline'}
            </span>
          </div>
        )}

        {/* Environment Badge */}
        <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-primary/10 text-primary border border-primary/20">
          {apiClient.isMock ? 'Simulation' : 'Backend'}
        </span>

        {/* Toggle Sources Drawer */}
        <button
          onClick={() => toggleSourcesDrawer('sources')}
          title="Toggle sources and activity drawer"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-control text-xs border transition-colors ${
            sourcesDrawerOpen
              ? 'bg-elevated text-primary border-primary/40'
              : 'bg-surface text-muted border-border hover:text-text hover:bg-hover'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sources</span>
        </button>
      </div>
    </header>
  );
}
