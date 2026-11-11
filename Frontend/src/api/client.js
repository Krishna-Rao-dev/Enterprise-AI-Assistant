import { runSimulationStream, resumeSimulationStream } from '../mock/simulationEngine';
import { MOCK_USERS } from '../mock/users';
import { MOCK_PROJECTS } from '../mock/projects';
import { getStoredTickets } from '../mock/ticketsData';

const IS_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const API_USER_ID = import.meta.env.VITE_API_USER_ID;
const BACKEND_PROJECTS = [
  { id: 'api-gateway', name: 'api-gateway' },
  { id: 'auth-service', name: 'auth-service' },
  { id: 'infra-terraform', name: 'infra-terraform' },
  { id: 'notification-svc', name: 'notification-svc' },
  { id: 'data-pipeline', name: 'data-pipeline' },
];

const apiUrl = (path) => `${API_BASE_URL}${path}`;

function getApiUserId() {
  if (!API_USER_ID) {
    throw new Error('VITE_API_USER_ID must be set to an active backend user when mock mode is disabled.');
  }
  return API_USER_ID;
}

async function readResponse(response) {
  if (response.ok) return response;
  let message = `HTTP ${response.status}: ${response.statusText}`;
  try {
    const body = await response.json();
    message = body.detail || body.message || message;
  } catch {
    // Keep the HTTP status message when the response is not JSON.
  }
  throw new Error(message);
}

function threadStubToFrontend(thread) {
  const firstMessage = thread.messages?.[0];
  const title = firstMessage?.content?.trim() || 'New conversation';
  const timestamp = firstMessage?.ts || thread.created_at || new Date().toISOString();
  return {
    id: thread.thread_id,
    projectId: null,
    title: title.length > 38 ? `${title.slice(0, 38)}...` : title,
    updatedAt: timestamp,
    displayTime: 'Recent',
    hasUnread: false,
    messages: firstMessage
      ? [{
          id: `${thread.thread_id}-message-0`,
          role: firstMessage.role === 'human' ? 'user' : firstMessage.role,
          content: firstMessage.content,
          timestamp,
        }]
      : [],
    messagesLoaded: false,
  };
}

function messagesToFrontend(threadId, messages) {
  return messages.map((message, index) => ({
    id: `${threadId}-message-${index}`,
    role: message.role === 'human' ? 'user' : message.role,
    content: message.content,
    timestamp: message.ts || new Date().toISOString(),
  }));
}

async function* readSse(response, onEvent) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('The backend returned an empty event stream.');

  const decoder = new TextDecoder();
  let buffer = '';
  let activeStepId = null;

  const dispatchBlock = (block) => {
    let eventName = 'message';
    const data = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
    }
    if (!data.length) return [];

    const payload = data.join('\n');
    let event;
    if (eventName === 'step') {
      const id = `backend-${payload}`;
      const events = [];
      if (activeStepId) {
        events.push({ type: 'step', id: activeStepId, status: 'done' });
      }
      activeStepId = id;
      events.push({
        type: 'step',
        id,
        label: payload[0]?.toUpperCase() + payload.slice(1),
        status: 'running',
        ms: 0,
      });
      return events;
    }
    if (eventName === 'token') event = { type: 'token', text: payload };
    else if (eventName === 'sources') {
      let sources;
      try {
        sources = JSON.parse(payload);
      } catch {
        throw new Error('The backend returned invalid source metadata.');
      }
      event = { type: 'sources', items: sources };
    } else if (eventName === 'interrupt' || eventName === 'result') {
      let value;
      try {
        value = JSON.parse(payload);
      } catch {
        throw new Error(`The backend returned invalid ${eventName} data.`);
      }
      event = { type: eventName, ...value };
    } else if (eventName === 'done') {
      const events = [];
      if (activeStepId) {
        events.push({ type: 'step', id: activeStepId, status: 'done' });
        activeStepId = null;
      }
      let threadId = payload;
      try {
        threadId = JSON.parse(payload).thread_id || payload;
      } catch {
        // Older backend versions emitted the thread ID as plain text.
      }
      events.push({ type: 'done', thread_id: threadId });
      return events;
    } else if (eventName === 'error') {
      let message = payload;
      try {
        message = JSON.parse(payload).message || payload;
      } catch {
        // Keep plain-text errors from older backend versions.
      }
      const error = new Error(message || 'The backend failed while processing the request.');
      error.code = 'BACKEND_STREAM_ERROR';
      throw error;
    } else {
      return [];
    }
    return [event];
  };

  const emit = (event) => {
    if (onEvent) onEvent(event);
    return event;
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || '';
    for (const block of blocks) {
      for (const event of dispatchBlock(block)) yield emit(event);
    }
    if (done) break;
  }

  if (buffer.trim()) {
    for (const event of dispatchBlock(buffer)) yield emit(event);
  }
}

export const apiClient = {
  isMock: IS_MOCK,
  apiUserId: API_USER_ID || null,

  async *chatStream({
    threadId,
    message,
    project,
    user,
    previousMessages = [],
    speedMultiplier = 1,
    forceError = false,
    onEvent = null,
    signal,
  }) {
    if (IS_MOCK) {
      for await (const event of runSimulationStream({
        message,
        threadId,
        user,
        project,
        previousMessages,
        speedMultiplier,
        forceError,
        onEvent,
      })) {
        yield event;
      }
      return;
    }

    const response = await readResponse(await fetch(apiUrl('/api/chat/stream'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        thread_id: threadId,
        user_id: getApiUserId(),
        question: message,
        repo: project || null,
      }),
    }));
    yield* readSse(response, onEvent);
  },

  async *chatResume({
    threadId,
    approvalId,
    decision,
    args,
    action,
    speedMultiplier = 1,
    onEvent = null,
  }) {
    if (!IS_MOCK) {
      const response = await readResponse(await fetch(
        apiUrl(`/api/chat/${encodeURIComponent(threadId)}/resume`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: getApiUserId(),
            approval_id: approvalId,
            decision,
            args: args || null,
          }),
        }
      ));
      yield* readSse(response, onEvent);
      return;
    }
    for await (const event of resumeSimulationStream({
      decision,
      args,
      action,
      speedMultiplier,
      onEvent,
    })) {
      yield event;
    }
  },

  async getChatHistory() {
    const userId = getApiUserId();
    const response = await readResponse(await fetch(
      apiUrl(`/api/chat/history?user_id=${encodeURIComponent(userId)}`)
    ));
    const data = await response.json();
    return (data.threads || []).map(threadStubToFrontend);
  },

  async getHealth() {
    const response = await readResponse(await fetch(apiUrl('/health')));
    return response.json();
  },

  async getThreadMessages(threadId) {
    const response = await readResponse(await fetch(
      apiUrl(`/api/chat/${encodeURIComponent(threadId)}/messages?user_id=${encodeURIComponent(getApiUserId())}`)
    ));
    const data = await response.json();
    return messagesToFrontend(threadId, data.messages || []);
  },

  async getPendingActions(threadId) {
    if (IS_MOCK) return [];
    const response = await readResponse(await fetch(
      apiUrl(`/api/chat/${encodeURIComponent(threadId)}/pending?user_id=${encodeURIComponent(getApiUserId())}`)
    ));
    const data = await response.json();
    return data.approvals || [];
  },

  async submitFeedback({
    messageId,
    threadId,
    messageIndex,
    userId,
    rating,
    reasons = [],
    comment = '',
  }) {
    const feedbackItem = {
      id: `fb-${Date.now()}`,
      messageId,
      rating,
      reasons,
      comment,
      timestamp: new Date().toISOString(),
    };

    if (IS_MOCK) {
      try {
        const existing = JSON.parse(localStorage.getItem('northwind_assistant_feedback') || '[]');
        existing.unshift(feedbackItem);
        localStorage.setItem('northwind_assistant_feedback', JSON.stringify(existing));
      } catch (error) {
        console.error('Failed to store feedback locally', error);
      }
      return feedbackItem;
    }

    const report = [...reasons, comment].filter(Boolean).join('\n');
    await readResponse(await fetch(apiUrl('/api/feedback'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thread_id: threadId,
        user_id: userId || getApiUserId(),
        message_index: messageIndex,
        rating,
        report: report || null,
      }),
    }));
    return feedbackItem;
  },

  getUsers: () => MOCK_USERS,
  getProjects: () => IS_MOCK ? MOCK_PROJECTS : BACKEND_PROJECTS,
  getTickets: () => getStoredTickets(),
};
