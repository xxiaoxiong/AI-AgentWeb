export type SessionSummary = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
};

export type Message = {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  created_at: string;
};

export type SessionDetail = SessionSummary & {
  messages: Message[];
};

export type RunMode = 'fast' | 'deep' | 'background';

const API_BASE_URL = 'http://localhost:8000/api/v1';

export async function createSession(title: string): Promise<SessionSummary> {
  const response = await fetch(`${API_BASE_URL}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    throw new Error('创建会话失败');
  }

  return (await response.json()) as SessionSummary;
}

export async function listSessions(): Promise<SessionSummary[]> {
  const response = await fetch(`${API_BASE_URL}/sessions`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('加载会话列表失败');
  }

  return (await response.json()) as SessionSummary[];
}

export async function getSession(sessionId: string): Promise<SessionDetail> {
  const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('加载会话详情失败');
  }

  return (await response.json()) as SessionDetail;
}

export function streamChat(
  input: { sessionId: string; message: string; mode: RunMode },
  handlers: {
    onEvent: (event: string, data: Record<string, unknown>) => void;
    onError: (message: string) => void;
  },
) {
  const controller = new AbortController();

  const run = async () => {
    const response = await fetch(`${API_BASE_URL}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: input.sessionId,
        message: input.message,
        mode: input.mode,
      }),
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      handlers.onError('流式请求失败');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() ?? '';

      chunks.forEach((chunk) => {
        const eventLine = chunk.split('\n').find((line) => line.startsWith('event: '));
        const dataLine = chunk.split('\n').find((line) => line.startsWith('data: '));
        if (!eventLine || !dataLine) {
          return;
        }

        try {
          const event = eventLine.replace('event: ', '').trim();
          const data = JSON.parse(dataLine.replace('data: ', '').trim()) as Record<string, unknown>;
          handlers.onEvent(event, data);
        } catch {
          handlers.onError('解析 SSE 数据失败');
        }
      });
    }
  };

  void run().catch(() => handlers.onError('流式请求异常中断'));

  return () => controller.abort();
}
