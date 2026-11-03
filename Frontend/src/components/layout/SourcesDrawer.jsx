import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  X,
  BookOpen,
  Activity,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Layers,
  FileText,
  Ticket,
  ChevronRight,
  Info
} from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';

export function SourcesDrawer() {
  const {
    sourcesDrawerOpen,
    setSourcesDrawerOpen,
    sourcesDrawerTab,
    toggleSourcesDrawer,
    selectedCitation,
    threads,
    activeThreadId,
    jiraTickets,
  } = useAppStore();

  const currentThread = threads.find((t) => t.id === activeThreadId);

  // Collect all sources and activity steps from messages in current thread
  const allCitations = [];
  const citationIds = new Set();
  const allSteps = [];

  if (currentThread) {
    currentThread.messages.forEach((msg) => {
      if (msg.citations) {
        msg.citations.forEach((cit) => {
          if (!citationIds.has(cit.doc_id)) {
            citationIds.add(cit.doc_id);
            allCitations.push(cit);
          }
        });
      }
      if (msg.steps) {
        msg.steps.forEach((step) => {
          allSteps.push({ ...step, timestamp: msg.timestamp });
        });
      }
    });
  }

  if (!sourcesDrawerOpen) return null;

  return (
    <aside
      className="fixed inset-y-0 right-0 z-40 w-full sm:w-[380px] bg-surface border-l border-border flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
    >
      {/* Drawer Header */}
      <div className="h-14 px-4 border-b border-border flex items-center justify-between flex-shrink-0">
        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-elevated p-1 rounded-control border border-border">
          <button
            onClick={() => toggleSourcesDrawer('sources')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
              sourcesDrawerTab === 'sources'
                ? 'bg-surface text-text font-medium shadow-sm'
                : 'text-muted hover:text-text'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Sources ({allCitations.length})</span>
          </button>

          <button
            onClick={() => toggleSourcesDrawer('activity')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
              sourcesDrawerTab === 'activity'
                ? 'bg-surface text-text font-medium shadow-sm'
                : 'text-muted hover:text-text'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Activity</span>
          </button>

          <button
            onClick={() => toggleSourcesDrawer('jira')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
              sourcesDrawerTab === 'jira'
                ? 'bg-surface text-text font-medium shadow-sm'
                : 'text-muted hover:text-text'
            }`}
          >
            <Ticket className="w-3.5 h-3.5" />
            <span>Jira ({jiraTickets.length})</span>
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={() => setSourcesDrawerOpen(false)}
          aria-label="Close drawer"
          className="p-1.5 rounded-control text-muted hover:text-text hover:bg-hover transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* TAB 1: SOURCES */}
        {sourcesDrawerTab === 'sources' && (
          <div className="space-y-3">
            {allCitations.length === 0 ? (
              <div className="text-center py-12 px-4">
                <FileText className="w-8 h-8 text-faint mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium text-text">No citations yet</p>
                <p className="text-xs text-muted mt-1">
                  Document metadata returned by the backend appears here.
                </p>
              </div>
            ) : (
              allCitations.map((cit) => {
                const isSelected = selectedCitation?.doc_id === cit.doc_id;
                const isCurrent = cit.status === 'current';
                return (
                  <div
                    key={cit.doc_id}
                    id={`source-card-${cit.doc_id}`}
                    className={`p-3.5 rounded-card border transition-all ${
                      isSelected
                        ? 'bg-elevated border-primary/60 ring-1 ring-primary/40'
                        : 'bg-surface border-border hover:border-border-strong'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-primary">
                          {cit.doc_id}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase font-medium ${
                            isCurrent
                              ? 'bg-success/15 text-success border border-success/30'
                              : 'bg-warning/15 text-warning border border-warning/30'
                          }`}
                        >
                          {cit.status}
                        </span>
                        <span className="text-[10px] text-faint font-mono">v{cit.version}</span>
                      </div>

                      {cit.url && (
                        <a
                          href={cit.url}
                          target="_blank"
                          rel="noreferrer"
                          title="Open original document"
                          className="text-muted hover:text-text p-1 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>

                    <h4 className="text-xs font-semibold text-text mt-1.5 leading-snug">
                      {cit.title}
                    </h4>
                    {cit.section && (
                      <p className="text-[11px] text-faint font-mono mt-0.5">{cit.section}</p>
                    )}

                    {cit.excerpt && (
                      <div className="mt-2.5 p-2 rounded bg-elevated/70 border border-border text-xs text-muted leading-relaxed font-sans">
                        <span className="text-text font-mono text-[10px] block mb-1 uppercase tracking-wider text-faint">
                          Referenced Excerpt:
                        </span>
                        "{cit.excerpt}"
                      </div>
                    )}

                    {(cit.classification || cit.department) && (
                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-faint">
                        {cit.classification && (
                          <span>Classification: <span className="text-text capitalize">{cit.classification}</span></span>
                        )}
                        {cit.department && (
                          <span>Department: <span className="text-text uppercase font-mono">{cit.department}</span></span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: ACTIVITY TIMELINE */}
        {sourcesDrawerTab === 'activity' && (
          <div className="space-y-3">
            {allSteps.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Activity className="w-8 h-8 text-faint mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium text-text">No activity logged</p>
                <p className="text-xs text-muted mt-1">
                  Query understanding, search reranking, and API executions will be tracked here.
                </p>
              </div>
            ) : (
              <div className="space-y-2 border-l border-border pl-3 ml-2">
                {allSteps.map((step, idx) => (
                  <div key={idx} className="relative group text-xs">
                    <span className="absolute -left-[19px] top-1.5 w-2 h-2 rounded-full bg-primary" />
                    <div className="p-2.5 rounded-control bg-elevated border border-border">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-text">{step.label}</span>
                        {step.ms > 0 && (
                          <span className="text-[11px] font-mono text-faint">{step.ms}ms</span>
                        )}
                      </div>
                      {step.warning && (
                        <div className="mt-1.5 p-1.5 rounded bg-warning/10 border border-warning/20 text-warning text-[11px]">
                          {step.warning}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: JIRA TICKETS */}
        {sourcesDrawerTab === 'jira' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted mb-1">
              <span>Synchronized Jira Issues</span>
              <span className="text-[10px] text-success font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success" /> Live Link
              </span>
            </div>

            {jiraTickets.map((ticket) => (
              <Popover.Root key={ticket.key}>
                <Popover.Trigger asChild>
                  <div className="group p-3 rounded-card bg-surface border border-border hover:border-border-strong cursor-pointer transition-all">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-primary group-hover:underline">
                        {ticket.key}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-medium ${
                          ticket.status === 'Done'
                            ? 'bg-success/15 text-success'
                            : ticket.status === 'In Progress'
                            ? 'bg-secondary/15 text-secondary'
                            : 'bg-elevated text-muted'
                        }`}
                      >
                        {ticket.status}
                      </span>
                    </div>
                    <p className="text-xs text-text font-medium mt-1.5 line-clamp-2">
                      {ticket.summary}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-faint">
                      <span>Priority: <span className="text-text">{ticket.priority}</span></span>
                      <span>Assignee: <span className="text-text">{ticket.assignee?.name || 'Unassigned'}</span></span>
                    </div>
                  </div>
                </Popover.Trigger>

                <Popover.Portal>
                  <Popover.Content
                    side="left"
                    sideOffset={10}
                    className="z-50 w-80 bg-elevated border border-border-strong rounded-card p-4 shadow-2xl animate-in fade-in-50"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-border">
                      <span className="font-mono text-xs font-bold text-primary">{ticket.key}</span>
                      <a
                        href={ticket.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[11px] text-secondary hover:underline"
                      >
                        <span>Open in Jira</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="py-2.5 space-y-2 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-mono text-faint">Summary</span>
                        <p className="text-text font-medium mt-0.5">{ticket.summary}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-mono text-faint">Description</span>
                        <p className="text-muted mt-0.5 text-[11px] leading-relaxed max-h-24 overflow-y-auto">
                          {ticket.description}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border text-[11px]">
                        <div>
                          <span className="text-faint">Reporter:</span>{' '}
                          <span className="text-text">{ticket.reporter}</span>
                        </div>
                        <div>
                          <span className="text-faint">Priority:</span>{' '}
                          <span className="text-text">{ticket.priority}</span>
                        </div>
                      </div>
                    </div>
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
