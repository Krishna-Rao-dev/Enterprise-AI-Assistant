import React from 'react';
import { useAppStore } from '../../store/useAppStore';

export function UserMessage({ message }) {
  const { currentUser } = useAppStore();

  return (
    <div className="flex justify-end my-4 animate-in fade-in-50 duration-150">
      <div className="max-w-2xl flex items-start gap-3">
        <div className="flex flex-col items-end">
          <div className="bg-elevated border border-border text-text px-4 py-3 rounded-card rounded-tr-sm text-sm leading-relaxed shadow-sm font-sans whitespace-pre-wrap break-words">
            {message.content}
          </div>
          <span className="text-[10px] text-faint mt-1 font-mono">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <img
          src={currentUser.avatar}
          alt={currentUser.name}
          className="w-7 h-7 rounded-full object-cover border border-border flex-shrink-0 mt-1"
        />
      </div>
    </div>
  );
}
