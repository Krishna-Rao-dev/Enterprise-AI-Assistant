import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useChatStream } from '../../hooks/useChatStream';
import { Composer } from '../composer/Composer';
import {
  FolderGit2,
  ChevronDown,
  BookOpen,
  Ticket,
  Search,
  Calendar,
  Sparkles,
  Check
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

export function EmptyState() {
  const {
    currentUser,
    selectedProject,
    setSelectedProject,
    projects,
  } = useAppStore();

  const { sendMessage } = useChatStream();

  // Time-aware greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const currentProjectObj = projects.find((p) => p.id === selectedProject) || projects[0];

  const quickActions = [
    {
      id: 'ask-docs',
      title: 'Ask the docs',
      desc: 'Search policy guidelines and architecture specs with verified citations',
      icon: BookOpen,
      prompt: 'How many annual leave days do regular full-time employees receive under HR-POL-001?',
      disabled: false,
    },
    {
      id: 'raise-ticket',
      title: 'Raise a Jira ticket',
      desc: 'Propose an issue drafted from repository docs with human approval',
      icon: Ticket,
      prompt: 'Use payments-service docs, I changed retry logic to 3 attempts, raise a Jira ticket',
      disabled: false,
    },
    {
      id: 'check-status',
      title: 'Check ticket status',
      desc: 'Query active Jira tickets, assignees, and resolution progress',
      icon: Search,
      prompt: 'Check status of PAY-141 and show open tickets',
      disabled: false,
    },
    {
      id: 'schedule-meeting',
      title: 'Schedule a meeting',
      desc: 'Calendar conflict sync with attendee notification and agenda drafting',
      icon: Calendar,
      prompt: 'Schedule a meeting with the platform team tomorrow 4pm',
      badge: 'Soon',
      disabled: false, // Let user click or use scenario 7 for high-risk modal flow!
    },
  ];

  const handleActionClick = (action) => {
    sendMessage(action.prompt);
  };

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center justify-center min-h-[calc(100vh-14rem)] py-8 px-4">
      {/* Serif Greeting */}
      <div className="text-center mb-7 select-none animate-in fade-in-50 duration-200">
        <h2 className="font-serif text-3xl md:text-4xl font-normal text-text tracking-tight">
          {getGreeting()}, <span className="text-primary italic font-medium">{currentUser.firstName}</span>.
        </h2>
        <p className="text-sm text-muted mt-2 max-w-md mx-auto">
          Explore internal policies, inspect architecture specs, or trigger governed Jira workflows.
        </p>
      </div>

      {/* Scope picker chip above composer */}
      <div className="mb-3">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs bg-surface border border-border hover:border-border-strong text-text transition-colors">
              <FolderGit2 className="w-3.5 h-3.5 text-primary" />
              <span className="text-muted">Repository:</span>
              <span className="font-mono font-medium text-text">{currentProjectObj.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-muted opacity-70" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="center"
              sideOffset={6}
              className="z-50 w-60 bg-surface border border-border-strong rounded-control p-1 text-xs shadow-xl animate-in fade-in-50"
            >
              <div className="px-2 py-1.5 text-[10px] uppercase font-semibold text-faint">
                Target Scope
              </div>
              {projects.map((proj) => (
                <DropdownMenu.Item
                  key={proj.id}
                  onClick={() => setSelectedProject(proj.id)}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded cursor-pointer outline-none ${
                    selectedProject === proj.id
                      ? 'bg-elevated text-primary font-medium'
                      : 'text-muted hover:text-text hover:bg-hover'
                  }`}
                >
                  <span className="font-mono">{proj.name}</span>
                  {selectedProject === proj.id && <Check className="w-3.5 h-3.5 text-primary" />}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Center Composer with Ambient Glow */}
      <div className="w-full mb-8">
        <Composer ambientGlow={true} />
      </div>

      {/* Quick Action Cards in 2x2 Grid */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in-50 duration-300">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => handleActionClick(action)}
              className="group text-left p-4 rounded-card bg-surface border border-border hover:border-border-strong hover:bg-elevated transition-all duration-150 relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-control bg-elevated border border-border flex items-center justify-center text-primary group-hover:text-white group-hover:border-primary/40 transition-colors">
                  <Icon className="w-4 h-4" />
                </div>
                {action.badge && (
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {action.badge}
                  </span>
                )}
              </div>
              <h4 className="text-xs font-semibold text-text group-hover:text-primary transition-colors">
                {action.title}
              </h4>
              <p className="text-[11px] text-muted mt-1 leading-relaxed line-clamp-2">
                {action.desc}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
