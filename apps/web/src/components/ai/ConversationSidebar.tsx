import { MessageSquarePlus, Trash2, Bot } from 'lucide-react';
import type { AIConversationSummary } from '../../types';

interface ConversationSidebarProps {
  conversations: AIConversationSummary[];
  activeId: string | null;
  isLoading: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

function formatRelative(value: string): string {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  if (Number.isNaN(diffMs)) return '';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ConversationSidebar({
  conversations,
  activeId,
  isLoading,
  onSelect,
  onNew,
  onDelete,
}: ConversationSidebarProps) {
  return (
    <aside className="w-full lg:w-72 shrink-0 flex flex-col border-r border-slate-800 bg-slate-950/50">
      <div className="p-4 border-b border-slate-800">
        <button
          type="button"
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
        >
          <MessageSquarePlus className="w-4 h-4" />
          New conversation
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading && (
          <p className="text-xs text-slate-500 px-3 py-2">Loading conversations…</p>
        )}
        {!isLoading && conversations.length === 0 && (
          <div className="px-3 py-6 text-center">
            <Bot className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500">No conversations yet</p>
          </div>
        )}
        {conversations.map((conv) => {
          const active = conv.id === activeId;
          return (
            <div
              key={conv.id}
              className={`group flex items-start gap-1 rounded-lg transition-colors ${
                active ? 'bg-slate-800' : 'hover:bg-slate-800/60'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(conv.id)}
                className="flex-1 text-left px-3 py-2.5 min-w-0"
              >
                <p className="text-sm font-medium text-slate-200 truncate">{conv.title}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {conv.messageCount} messages · {formatRelative(conv.updatedAt)}
                </p>
              </button>
              <button
                type="button"
                onClick={() => onDelete(conv.id)}
                className="p-2 mr-1 mt-1 rounded opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                aria-label="Delete conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
