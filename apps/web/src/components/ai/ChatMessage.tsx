import type { AIMessage, AISourceReference } from '../../types';

interface ChatMessageProps {
  message: AIMessage;
  sources?: AISourceReference[];
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatMessage({ message, sources }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
          isUser
            ? 'bg-emerald-600 text-white rounded-br-md'
            : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-bl-md'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
        {!isUser && sources && sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-700/80">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1.5">Sources</p>
            <div className="flex flex-wrap gap-1.5">
              {sources.map((source, idx) => (
                <span
                  key={`${source.type}-${idx}`}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900/80 text-emerald-400 border border-slate-600"
                  title={source.period ?? undefined}
                >
                  {source.label}
                  {source.period ? ` · ${source.period}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}
        <p className={`text-[10px] mt-2 ${isUser ? 'text-emerald-100/70' : 'text-slate-500'}`}>
          {formatTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}
