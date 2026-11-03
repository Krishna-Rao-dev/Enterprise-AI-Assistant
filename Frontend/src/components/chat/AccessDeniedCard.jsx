import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Shield, Lock, Send, Check } from 'lucide-react';

export function AccessDeniedCard({ accessDenied }) {
  const { showToast } = useAppStore();
  const [requested, setRequested] = useState(false);

  const handleRequest = () => {
    setRequested(true);
    showToast('Access request submitted to your organization administrator', 'success');
  };

  return (
    <div className="my-4 p-4 rounded-card bg-surface border border-border flex items-start gap-3.5 animate-in fade-in-50 duration-200">
      <div className="w-8 h-8 rounded-full bg-elevated border border-border flex items-center justify-center text-muted flex-shrink-0 mt-0.5">
        <Lock className="w-4 h-4 text-faint" />
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-semibold text-text">
          Access Governed Search
        </h4>
        <p className="text-xs text-muted mt-1 leading-relaxed">
          I couldn't find anything you have access to on that.
        </p>

        <div className="mt-3">
          {requested ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-success font-medium">
              <Check className="w-3.5 h-3.5" />
              Access request pending review
            </span>
          ) : (
            <button
              onClick={handleRequest}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-medium bg-elevated hover:bg-hover border border-border text-text transition-colors"
            >
              <Send className="w-3 h-3 text-primary" />
              <span>Request access</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
