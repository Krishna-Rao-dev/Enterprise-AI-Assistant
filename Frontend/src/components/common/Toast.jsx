import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { CheckCircle2, Info, AlertCircle, X } from 'lucide-react';

export function Toast() {
  const { toast, dismissToast } = useAppStore();

  if (!toast) return null;

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-3.5 py-2.5 rounded-card bg-surface border border-border-strong shadow-2xl text-xs text-text animate-in slide-in-from-bottom duration-200">
      {isSuccess && <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />}
      {isError && <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />}
      {!isSuccess && !isError && <Info className="w-4 h-4 text-primary flex-shrink-0" />}

      <span className="font-medium pr-1">{toast.message}</span>

      <button
        onClick={dismissToast}
        className="p-1 rounded text-muted hover:text-text hover:bg-hover transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
