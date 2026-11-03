import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useChatStream } from '../../hooks/useChatStream';
import { MentionMenu } from './MentionMenu';
import { SlashMenu } from './SlashMenu';
import {
  ArrowUp,
  Square,
  Plus,
  Mic,
  ChevronDown,
  Cpu,
  Layers,
  Sparkles,
  Paperclip,
  X
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

const MODELS = [
  { id: 'llama-3.3-70b', name: 'Llama 3.3 70B (Default)', tag: 'Fast • Enterprise' },
  { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', tag: 'Accurate • Reasoning' },
  { id: 'gpt-4o', name: 'GPT-4o Enterprise', tag: 'Multimodal' },
];

export function Composer({ isFloating = false, ambientGlow = false }) {
  const {
    selectedProject,
    currentUser,
    isStreaming,
    activeThreadId,
    showToast,
  } = useAppStore();

  const { sendMessage, stopStreaming } = useChatStream();

  const [text, setText] = useState('');
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [mentions, setMentions] = useState([]);
  const [environment, setEnvironment] = useState('Staging');
  const [isRecording, setIsRecording] = useState(false);

  // Autocomplete menu states
  const [mentionMenuOpen, setMentionMenuOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');

  const textareaRef = useRef(null);

  // Auto-resize textarea up to 8 lines
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 8 * 24; // ~192px
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [text]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setText(val);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);

    // Check for @ trigger
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setMentionMenuOpen(true);
      setSlashMenuOpen(false);
    } else {
      setMentionMenuOpen(false);
    }

    // Check for / trigger at line start
    const slashMatch = textBeforeCursor.match(/(?:^|\n)\/(\w*)$/);
    if (slashMatch) {
      setSlashQuery(slashMatch[1]);
      setSlashMenuOpen(true);
      setMentionMenuOpen(false);
    } else {
      setSlashMenuOpen(false);
    }
  };

  const handleSelectMention = (item) => {
    // Replace @query with mention chip
    const cursorPos = textareaRef.current ? textareaRef.current.selectionStart : text.length;
    const textBeforeCursor = text.slice(0, cursorPos).replace(/@\w*$/, '');
    const textAfterCursor = text.slice(cursorPos);

    setText(textBeforeCursor + textAfterCursor);
    if (!mentions.some((m) => m.id === item.id)) {
      setMentions([...mentions, item]);
    }
    setMentionMenuOpen(false);
    textareaRef.current?.focus();
  };

  const handleSelectSlash = (item) => {
    if (item.cmd === '/clear') {
      const { activeThreadId, deleteThread } = useAppStore.getState();
      if (activeThreadId) deleteThread(activeThreadId);
      setText('');
      setSlashMenuOpen(false);
      return;
    }

    // Prefill prompt or command
    setText(item.cmd + ' ');
    setSlashMenuOpen(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (mentionMenuOpen || slashMenuOpen) {
      // Let menus handle arrows, enter, esc
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!text.trim() || isStreaming) return;

    sendMessage(text, { mentions });
    setText('');
    setMentions([]);
    setMentionMenuOpen(false);
    setSlashMenuOpen(false);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const removeMention = (id) => {
    setMentions(mentions.filter((m) => m.id !== id));
  };

  const handleSimulateAttach = () => {
    showToast('Mock attachment added: "architecture-diagram-v2.pdf"', 'info');
    if (!mentions.some((m) => m.id === 'att-doc')) {
      setMentions([
        ...mentions,
        { type: 'doc', id: 'att-doc', label: 'architecture-diagram-v2.pdf' },
      ]);
    }
  };

  const toggleMic = () => {
    if (!isRecording) {
      setIsRecording(true);
      showToast('Listening... Speak your prompt', 'info');
      setTimeout(() => {
        setText('Use payments-service docs, I changed retry logic to 3 attempts, raise a Jira ticket');
        setIsRecording(false);
        showToast('Voice transcribed', 'success');
      }, 1800);
    } else {
      setIsRecording(false);
    }
  };

  return (
    <div className={`relative w-full ${isFloating ? 'max-w-3xl mx-auto' : ''}`}>
      {/* Ambient glow behind empty-state composer */}
      {ambientGlow && <div className="ambient-composer-glow" />}

      {/* Main Composer Box */}
      <div className="relative z-10 bg-elevated border border-border-strong rounded-card p-3 shadow-2xl transition-all focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
        {/* Mention and Slash Menus */}
        {mentionMenuOpen && (
          <MentionMenu
            query={mentionQuery}
            onSelect={handleSelectMention}
            onClose={() => setMentionMenuOpen(false)}
          />
        )}

        {slashMenuOpen && (
          <SlashMenu
            query={slashQuery}
            onSelect={handleSelectSlash}
            onClose={() => setSlashMenuOpen(false)}
          />
        )}

        {/* Inline Mention Chips */}
        {mentions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2 pb-2 border-b border-border">
            {mentions.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono bg-surface border border-border text-primary"
              >
                <span>@{item.label}</span>
                <button
                  onClick={() => removeMention(item.id)}
                  className="hover:text-danger p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything, @ to mention, / for actions"
          rows={1}
          className="w-full bg-transparent text-text placeholder-muted resize-none focus:outline-none text-sm leading-relaxed max-h-48 overflow-y-auto font-sans"
        />

        {/* Controls Bar */}
        <div className="mt-2 pt-2 border-t border-border flex items-center justify-between gap-2">
          {/* Left Controls: Attach, Model Selector, Mic */}
          <div className="flex items-center gap-1.5">
            {/* Attach */}
            <button
              onClick={handleSimulateAttach}
              aria-label="Attach context or file"
              title="Attach context or file"
              className="p-1.5 rounded-control text-muted hover:text-text hover:bg-hover transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Model Selector Dropdown */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex items-center gap-1.5 px-2 py-1 rounded-control text-xs bg-surface border border-border hover:border-border-strong text-muted hover:text-text transition-colors">
                  <Cpu className="w-3.5 h-3.5 text-primary" />
                  <span className="font-mono text-[11px] truncate max-w-[120px] sm:max-w-none">
                    {selectedModel.name.split(' ')[0]}
                  </span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="start"
                  sideOffset={6}
                  className="z-50 w-64 bg-surface border border-border-strong rounded-control p-1 text-xs shadow-xl animate-in fade-in-50"
                >
                  <div className="px-2 py-1 text-[10px] uppercase font-semibold text-faint">
                    Inference Engine
                  </div>
                  {MODELS.map((m) => (
                    <DropdownMenu.Item
                      key={m.id}
                      onClick={() => setSelectedModel(m)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded cursor-pointer outline-none ${
                        selectedModel.id === m.id
                          ? 'bg-elevated text-primary font-medium'
                          : 'text-muted hover:text-text hover:bg-hover'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-text">{m.name}</span>
                        <span className="text-[10px] text-faint">{m.tag}</span>
                      </div>
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Mic voice input */}
            <button
              onClick={toggleMic}
              aria-label="Voice input"
              title="Transcribe voice prompt"
              className={`p-1.5 rounded-control transition-colors ${
                isRecording
                  ? 'bg-danger/20 text-danger animate-pulse'
                  : 'text-muted hover:text-text hover:bg-hover'
              }`}
            >
              <Mic className="w-4 h-4" />
            </button>
          </div>

          {/* Right Controls: Send / Stop button */}
          <div className="flex items-center gap-2">
            {isStreaming ? (
              <button
                onClick={stopStreaming}
                aria-label="Stop generating"
                title="Stop generation"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-medium bg-elevated hover:bg-hover border border-border-strong text-text transition-colors"
              >
                <Square className="w-3.5 h-3.5 fill-current text-primary" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!text.trim()}
                aria-label="Send message"
                title="Send (Enter)"
                className="btn-primary-gradient flex items-center justify-center w-8 h-8 rounded-control shadow-sm"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Row Below Composer: Mode/Env Dropdown and Acting As user */}
      <div className="mt-2 px-1 flex items-center justify-between text-[11px] text-faint font-sans select-none">
        <div className="flex items-center gap-1.5">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex items-center gap-1 text-muted hover:text-text transition-colors">
                <span>Mode:</span>
                <span className="font-mono text-text underline decoration-faint underline-offset-2">
                  {environment}
                </span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="start"
                sideOffset={4}
                className="z-50 w-36 bg-surface border border-border-strong rounded-control p-1 text-xs shadow-xl"
              >
                <DropdownMenu.Item
                  onClick={() => setEnvironment('Staging')}
                  className="px-2 py-1 rounded text-muted hover:text-text hover:bg-hover cursor-pointer"
                >
                  Staging (Sandbox)
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onClick={() => setEnvironment('Production')}
                  className="px-2 py-1 rounded text-muted hover:text-text hover:bg-hover cursor-pointer"
                >
                  Production (Guarded)
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        <div className="flex items-center gap-1 truncate">
          <span>Acting as</span>
          <span className="font-medium text-text truncate max-w-[150px]">
            {currentUser.name}
          </span>
          <span className="font-mono text-[10px] text-primary/80">({currentUser.groups[0]})</span>
        </div>
      </div>
    </div>
  );
}
