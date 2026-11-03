import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { apiClient } from '../../api/client';
import { MOCK_USERS } from '../../mock/users';
import { Shield, ChevronDown, Check, UserCheck, Key } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';

export function UserCard({ collapsed }) {
  const { currentUser, setCurrentUser } = useAppStore();
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          aria-label="User profile and permissions"
          className={`w-full flex items-center gap-3 p-2 rounded-control transition-all duration-150 text-left border border-transparent ${
            open ? 'bg-hover border-border-strong' : 'hover:bg-hover'
          } ${collapsed ? 'justify-center' : ''}`}
        >
          <div className="relative flex-shrink-0">
            {apiClient.isMock ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-8 h-8 rounded-full object-cover border border-border"
              />
            ) : (
              <div className="w-8 h-8 rounded-full border border-border bg-elevated flex items-center justify-center text-[9px] font-mono text-primary">
                {apiClient.apiUserId ? apiClient.apiUserId.slice(0, 5) : '?'}
              </div>
            )}
            <span
              className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-bg ${
                currentUser.isContractor ? 'bg-warning' : 'bg-success'
              }`}
            />
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text truncate">
                  {apiClient.isMock ? currentUser.name : apiClient.apiUserId || 'Backend identity not configured'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-muted opacity-60" />
              </div>
              <p className="text-xs text-muted truncate">
                {apiClient.isMock ? currentUser.role : 'Backend identity'}
              </p>
            </div>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="top"
          align={collapsed ? 'start' : 'center'}
          sideOffset={8}
          className="z-50 w-72 bg-surface border border-border-strong rounded-card p-3.5 shadow-2xl animate-in fade-in-50 zoom-in-95"
        >
          {/* Identity header */}
          <div className="flex items-center gap-3 pb-3 border-b border-border">
            {apiClient.isMock ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-10 h-10 rounded-full object-cover border border-border"
              />
            ) : (
              <div className="w-10 h-10 rounded-full border border-border bg-elevated flex items-center justify-center text-xs font-mono text-primary">
                {apiClient.apiUserId ? apiClient.apiUserId.slice(0, 5) : '?'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-text truncate">
                {apiClient.isMock ? currentUser.name : apiClient.apiUserId || 'Backend identity not configured'}
              </h4>
              {apiClient.isMock ? (
                <>
                  <p className="text-xs text-muted truncate">{currentUser.email}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-faint font-mono">{currentUser.department}</span>
                  </div>
                </>
              ) : (
                  <p className="text-xs text-muted truncate">Identity supplied by VITE_API_USER_ID</p>
              )}
            </div>
          </div>

          {/* Active Permission Groups (Permissions-aware product) */}
          {apiClient.isMock ? <div className="py-2.5 border-b border-border">
            <div className="flex items-center gap-1.5 mb-2">
              <Key className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-text">Access Groups</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {currentUser.groups.map((group) => (
                <span
                  key={group}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-elevated text-purple-300 border border-border"
                >
                  {group}
                </span>
              ))}
            </div>
          </div> : (
            <div className="py-2.5 border-b border-border text-[11px] text-muted">
              Access groups are validated by the backend; frontend persona groups are not used for authorization.
            </div>
          )}

          {/* Switch User (Dev Affordance) */}
          {apiClient.isMock && <div className="pt-2.5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-secondary" />
                <span className="text-xs font-medium text-text">Switch Persona</span>
              </div>
              <span className="text-[10px] text-primary/80 font-mono uppercase bg-primary/10 px-1.5 py-0.5 rounded">Dev</span>
            </div>

            <div className="space-y-1 max-h-48 overflow-y-auto">
              {MOCK_USERS.map((user) => {
                const isSelected = user.id === currentUser.id;
                return (
                  <button
                    key={user.id}
                    onClick={() => {
                      setCurrentUser(user.id);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-control text-xs transition-colors ${
                      isSelected
                        ? 'bg-elevated text-text font-medium border border-border-strong'
                        : 'text-muted hover:text-text hover:bg-hover'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <img src={user.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                      <div className="text-left truncate">
                        <span className="text-text">{user.name}</span>
                        <span className="text-[10px] text-faint ml-1.5">({user.role.split(' ')[0]})</span>
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
