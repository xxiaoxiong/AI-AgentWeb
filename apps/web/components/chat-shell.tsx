'use client';

import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  createSession,
  getSession,
  listSessions,
  streamChat,
  type Message,
  type RunMode,
  type SessionSummary,
} from '@/lib/api';

type RunState = {
  runId: string | null;
  stage: string;
  streaming: boolean;
  error: string | null;
};

const defaultRunState: RunState = {
  runId: null,
  stage: 'idle',
  streaming: false,
  error: null,
};

const modeDescriptions: Record<RunMode, string> = {
  fast: '优先快速回答，尽量减少工具调用。',
  deep: '搜索网页、读取正文、综合证据、输出引用答案。',
  background: '适合长任务，后续会展示后台进度与结果。',
};

export function ChatShell() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<RunMode>('deep');
  const [runState, setRunState] = useState<RunState>(defaultRunState);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<null | (() => void)>(null);

  const canSend = useMemo(
    () => Boolean(activeSessionId && input.trim()) && !runState.streaming,
    [activeSessionId, input, runState.streaming],
  );

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const existingSessions = await listSessions();
        if (existingSessions.length > 0) {
          setSessions(existingSessions);
          setActiveSessionId(existingSessions[0].id);
          const detail = await getSession(existingSessions[0].id);
          setMessages(detail.messages);
          return;
        }

        const created = await createSession('默认研究会话');
        setSessions([created]);
        setActiveSessionId(created.id);
        setMessages([]);
      } catch (error) {
        setRunState({
          runId: null,
          stage: 'bootstrap_failed',
          streaming: false,
          error: error instanceof Error ? error.message : '初始化失败',
        });
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, []);

  const refreshSession = async (sessionId: string) => {
    const detail = await getSession(sessionId);
    setMessages(detail.messages);
    setSessions((current: SessionSummary[]) =>
      current
        .map((item: SessionSummary) =>
          item.id === sessionId
            ? {
                ...item,
                updated_at: detail.updated_at,
                message_count: detail.message_count,
                title: detail.title,
              }
            : item,
        )
        .sort((a: SessionSummary, b: SessionSummary) => b.updated_at.localeCompare(a.updated_at)),
    );
  };

  const handleCreateSession = async () => {
    const created = await createSession(`研究会话 ${sessions.length + 1}`);
    setSessions((current: SessionSummary[]) => [created, ...current]);
    setActiveSessionId(created.id);
    setMessages([]);
    setRunState(defaultRunState);
  };

  const handleSelectSession = async (sessionId: string) => {
    setActiveSessionId(sessionId);
    await refreshSession(sessionId);
    setRunState(defaultRunState);
  };

  const handleSubmit = async () => {
    if (!canSend || !activeSessionId) {
      return;
    }

    const userContent = input.trim();
    const tempAssistantId = `assistant-temp-${Date.now()}`;

    setInput('');
    setRunState({ runId: null, stage: 'queued', streaming: true, error: null });
    setMessages((current: Message[]) => [
      ...current,
      {
        id: `user-temp-${Date.now()}`,
        session_id: activeSessionId,
        role: 'user',
        content: userContent,
        created_at: new Date().toISOString(),
      },
      {
        id: tempAssistantId,
        session_id: activeSessionId,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
      },
    ]);

    abortRef.current?.();
    abortRef.current = streamChat(
      { sessionId: activeSessionId, message: userContent, mode },
      {
        onEvent: (event, data) => {
          if (event === 'run_started') {
            const run = data.run as { id: string; stage: string };
            setRunState({ runId: run.id, stage: run.stage, streaming: true, error: null });
            return;
          }

          if (event === 'stage_changed') {
            setRunState((current: RunState) => ({
              ...current,
              stage: String(data.stage ?? current.stage),
            }));
            return;
          }

          if (event === 'token') {
            setMessages((current: Message[]) =>
              current.map((message: Message) =>
                message.id === tempAssistantId
                  ? { ...message, content: `${message.content}${String(data.delta ?? '')}` }
                  : message,
              ),
            );
            return;
          }

          if (event === 'answer_completed') {
            setMessages((current: Message[]) =>
              current.map((message: Message) =>
                message.id === tempAssistantId
                  ? {
                      ...message,
                      id: String(data.message_id ?? tempAssistantId),
                      content: String(data.content ?? message.content),
                    }
                  : message,
              ),
            );
            setRunState((current: RunState) => ({ ...current, stage: 'done', streaming: false }));
            void refreshSession(activeSessionId);
            return;
          }

          if (event === 'run_failed') {
            setRunState((current: RunState) => ({
              ...current,
              streaming: false,
              error: String(data.error ?? '运行失败'),
            }));
          }
        },
        onError: (message) => {
          setRunState((current: RunState) => ({ ...current, streaming: false, error: message }));
        },
      },
    );
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl gap-6 px-6 py-8">
      <aside className="w-80 rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-300">会话列表</p>
            <p className="mt-1 text-xs text-slate-500">先做会话，再逐步扩展为研究任务面板。</p>
          </div>
          <button
            type="button"
            onClick={() => void handleCreateSession()}
            className="rounded-full bg-emerald-500 px-3 py-2 text-xs font-medium text-slate-950"
          >
            新建会话
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {sessions.map((session: SessionSummary) => (
            <button
              key={session.id}
              type="button"
              onClick={() => void handleSelectSession(session.id)}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                activeSessionId === session.id
                  ? 'border-emerald-500/50 bg-emerald-500/10'
                  : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
              }`}
            >
              <p className="text-sm font-medium text-white">{session.title}</p>
              <p className="mt-2 text-xs text-slate-400">消息数：{session.message_count}</p>
              <p className="mt-1 truncate text-xs text-slate-500">{session.id}</p>
            </button>
          ))}
          {!loading && sessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 p-4 text-sm text-slate-500">
              当前没有会话，请先创建一个。
            </div>
          ) : null}
        </div>
      </aside>

      <main className="flex flex-1 flex-col rounded-3xl border border-slate-800 bg-slate-900/70">
        <header className="border-b border-slate-800 px-6 py-5">
          <h1 className="text-2xl font-semibold text-white">中文网页智能体平台</h1>
          <p className="mt-2 text-sm text-slate-400">
            本阶段已打通：会话列表、消息历史、模拟流式回复、run 阶段展示。下一阶段将继续接入持久化与真实工具链。
          </p>
        </header>

        <section className="grid gap-4 border-b border-slate-800 px-6 py-4 lg:grid-cols-4">
          {(Object.keys(modeDescriptions) as RunMode[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={`rounded-2xl border p-4 text-left ${
                mode === item
                  ? 'border-emerald-500/50 bg-emerald-500/10'
                  : 'border-slate-800 bg-slate-950/60'
              }`}
            >
              <p className="text-sm font-medium uppercase text-white">{item}</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">{modeDescriptions[item]}</p>
            </button>
          ))}
        </section>

        <section className="flex items-center justify-between border-b border-slate-800 px-6 py-3 text-xs text-slate-400">
          <div className="flex gap-4">
            <span>run_id: {runState.runId ?? '-'}</span>
            <span>stage: {runState.stage}</span>
            <span>streaming: {runState.streaming ? 'yes' : 'no'}</span>
          </div>
          {runState.error ? <span className="text-rose-400">{runState.error}</span> : null}
        </section>

        <section className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
          {messages.map((message: Message) => (
            <div
              key={message.id}
              className={`max-w-3xl rounded-2xl px-4 py-3 text-sm leading-6 ${
                message.role === 'user'
                  ? 'ml-auto bg-emerald-500 text-slate-950'
                  : 'bg-slate-950 text-slate-100'
              }`}
            >
              {message.content || '正在生成中...'}
            </div>
          ))}
          {!loading && messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-500">
              先输入一个任务，当前接口会通过 SSE 返回模拟 assistant 回复。
            </div>
          ) : null}
        </section>

        <footer className="border-t border-slate-800 p-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-3 shadow-2xl shadow-slate-950/50">
            <textarea
              value={input}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setInput(event.target.value)}
              placeholder="输入你的研究任务，例如：只使用官方来源，帮我分析某款 AI 产品。"
              className="min-h-28 w-full resize-none bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
            <div className="mt-3 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                当前为 mock pipeline；下一阶段将接入数据库持久化、SSE 协议细化与真实模型调用。
              </div>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={!canSend}
                className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
              >
                {runState.streaming ? '生成中...' : '发送'}
              </button>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
