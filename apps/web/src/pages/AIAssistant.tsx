import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Send, AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';
import { Breadcrumb } from '../components/ui/Breadcrumb';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { ChatMessage } from '../components/ai/ChatMessage';
import { ConversationSidebar } from '../components/ai/ConversationSidebar';
import {
  useAIConversation,
  useAIConversations,
  useAIStatus,
  useDeleteAIConversation,
  useSendAIMessage,
} from '../hooks/useAI';
import type { AIMessage, AISourceReference } from '../types';

const QUICK_PROMPTS = [
  "Show today's campus alerts",
  'Which buildings have the highest operational risk?',
  'Which assets should be inspected soon?',
  'Why is electricity consumption abnormal?',
  'Which rooms are underutilized?',
  'Give me the top five campus operational risks',
  'What is the campus health score?',
];

type DisplayMessage = AIMessage & { sources?: AISourceReference[]; pending?: boolean };

export function AIAssistant() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [localMessages, setLocalMessages] = useState<DisplayMessage[]>([]);
  const [lastSources, setLastSources] = useState<AISourceReference[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const statusQuery = useAIStatus();
  const conversationsQuery = useAIConversations(1, 30);
  const conversationQuery = useAIConversation(activeConversationId);
  const sendMutation = useSendAIMessage();
  const deleteMutation = useDeleteAIConversation();

  const configured = statusQuery.data?.data.configured ?? true;

  useEffect(() => {
    if (conversationQuery.data?.data.messages) {
      setLocalMessages(conversationQuery.data.data.messages);
    }
  }, [conversationQuery.data]);

  useEffect(() => {
    if (!activeConversationId) {
      setLocalMessages([]);
    }
  }, [activeConversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [localMessages, sendMutation.isPending]);

  const conversations = useMemo(
    () => conversationsQuery.data?.data ?? [],
    [conversationsQuery.data],
  );

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setLocalMessages([]);
    setLastSources([]);
    setDraft('');
  };

  const handleSend = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || sendMutation.isPending) return;

      const optimisticUser: DisplayMessage = {
        role: 'user',
        content: message,
        createdAt: new Date().toISOString(),
      };
      setLocalMessages((prev) => [...prev, optimisticUser]);
      setDraft('');

      try {
        const response = await sendMutation.mutateAsync({
          conversationId: activeConversationId ?? undefined,
          message,
        });
        const { conversationId, message: assistantMessage, sources } = response.data;
        if (!activeConversationId) {
          setActiveConversationId(conversationId);
        }
        setLastSources(sources);
        setLocalMessages((prev) => [
          ...prev.filter((m) => !m.pending),
          {
            ...assistantMessage,
            sources,
          },
        ]);
      } catch {
        setLocalMessages((prev) => prev.filter((m) => m !== optimisticUser));
      }
    },
    [activeConversationId, sendMutation],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend(draft);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    if (activeConversationId === id) {
      handleNewConversation();
    }
  };

  const showEmpty = !activeConversationId && localMessages.length === 0 && !sendMutation.isPending;

  return (
    <div className="flex flex-col h-[calc(100vh-0px)]">
      <div className="px-6 pt-6 pb-4 border-b border-slate-800">
        <Breadcrumb />
        <div className="flex items-center gap-3 mt-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">CampusVerse AI</h1>
            <p className="text-sm text-slate-400">
              Ask questions about campus operations using live application data
            </p>
          </div>
        </div>
        {!configured && !statusQuery.isLoading && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Gemini is not configured in this environment. Set <code className="text-amber-100">GEMINI_API_KEY</code>{' '}
              to enable full AI responses. You can still view retrieved campus context in replies.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        <ConversationSidebar
          conversations={conversations}
          activeId={activeConversationId}
          isLoading={conversationsQuery.isLoading}
          onSelect={setActiveConversationId}
          onNew={handleNewConversation}
          onDelete={(id) => void handleDelete(id)}
        />

        <div className="flex-1 flex flex-col min-w-0 bg-slate-900">
          {conversationQuery.isError && activeConversationId && (
            <div className="p-4">
              <ErrorState
                title="Failed to load conversation"
                message="This conversation may have been deleted or you may not have access."
                onRetry={() => void conversationQuery.refetch()}
              />
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
            {showEmpty && (
              <EmptyState
                icon={Sparkles}
                title="How can I help with campus operations?"
                description="Ask about buildings, maintenance, utilities, parking, analytics, or alerts. Answers are grounded in live campus data."
              />
            )}

            {showEmpty && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-3xl mx-auto">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void handleSend(prompt)}
                    className="text-left text-sm px-4 py-3 rounded-xl border border-slate-700 bg-slate-800/50 text-slate-300 hover:border-emerald-500/40 hover:bg-slate-800 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {localMessages.map((msg, idx) => (
              <ChatMessage
                key={`${msg.createdAt}-${idx}`}
                message={msg}
                sources={
                  msg.role === 'assistant' && idx === localMessages.length - 1
                    ? msg.sources ?? lastSources
                    : undefined
                }
              />
            ))}

            {sendMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Retrieving campus data and generating response…
                  </div>
                </div>
              </div>
            )}
          </div>

          {sendMutation.isError && (
            <div className="px-6 pb-2">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">
                <span>{sendMutation.error.message || 'Failed to send message. Please try again.'}</span>
                <button
                  type="button"
                  onClick={() => void handleSend(draft || localMessages.at(-1)?.content || '')}
                  className="shrink-0 text-xs font-medium px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          <div className="p-4 border-t border-slate-800 bg-slate-950/50">
            <div className="flex gap-2 max-w-4xl mx-auto">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                placeholder="Ask about campus operations… (Enter to send, Shift+Enter for newline)"
                className="flex-1 resize-none rounded-xl border border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-500 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                disabled={sendMutation.isPending}
              />
              <button
                type="button"
                onClick={() => void handleSend(draft)}
                disabled={!draft.trim() || sendMutation.isPending}
                className="self-end px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
                aria-label="Send message"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
