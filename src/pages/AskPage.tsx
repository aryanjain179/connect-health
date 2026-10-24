import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bot, Send, ShieldCheck, User } from 'lucide-react';
import { Badge, Button, Card, Notice, PageHeader, cx, inputClass } from '../components/ui';
import { useAnalysis, useHealthData } from '../store/HealthDataContext';
import { SUGGESTED_QUESTIONS, answerQuestion, type AssistantAnswer } from '../assistant/answer';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  answer?: AssistantAnswer;
}

export function AskPage() {
  const { state } = useHealthData();
  const bundle = useAnalysis();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages]);

  const ask = (question: string) => {
    const q = question.trim();
    if (!q) return;
    const answer = answerQuestion(q, {
      data: state.data,
      window: bundle.window,
      findingsByOutcome: bundle.findingsByOutcome,
      flags: bundle.flags,
      insufficient: bundle.insufficient,
      connections: bundle.connections,
      completeness: bundle.completeness,
      seizures: bundle.seizures,
      sleepThreshold: state.settings.sleepThresholdHours,
    });
    setMessages((m) => [...m, { id: nextId.current++, role: 'user', text: q }, { id: nextId.current++, role: 'assistant', text: answer.text, answer }]);
    setInput('');
  };

  return (
    <>
      <PageHeader
        title="Ask My Health Data"
        description="Ask about your own records. Answers come from your stored data and calculations, with the sources listed."
        actions={<Badge tone="amber">Prototype assistant · rule-based · no AI model connected</Badge>}
      />
      <Notice tone="slate" icon={<ShieldCheck size={16} />}>
        This assistant matches your question to a set of supported topics and answers from your records using fixed rules. It does not use a language model, cannot diagnose or prescribe, and will say when your data can’t answer a question. Conversations are not saved.
      </Notice>

      <Card className="mt-4 flex min-h-[420px] flex-col p-0">
        <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {!messages.length && (
            <div>
              <p className="text-sm text-slate-600">Try one of these:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button key={q} type="button" onClick={() => ask(q)} className="rounded-full bg-teal-50 px-3 py-1.5 text-left text-sm text-teal-900 ring-1 ring-teal-200 ring-inset hover:bg-teal-100">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={cx('flex gap-2', m.role === 'user' && 'justify-end')}>
              {m.role === 'assistant' && (
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-700 text-white" aria-hidden="true">
                  <Bot size={15} />
                </span>
              )}
              <div className={cx('max-w-[46rem] rounded-2xl px-4 py-3 text-sm', m.role === 'user' ? 'bg-slate-800 text-white' : m.answer?.kind === 'emergency' ? 'border border-rose-200 bg-rose-50 text-rose-950' : 'border border-slate-200 bg-white text-slate-800')}>
                <span className="sr-only">{m.role === 'user' ? 'You asked:' : 'Assistant:'}</span>
                {m.answer?.kind === 'emergency' && <AlertTriangle size={16} className="mb-1 text-rose-700" aria-hidden="true" />}
                <p>{m.text}</p>
                {m.answer && <AnswerDetails a={m.answer} />}
              </div>
              {m.role === 'user' && (
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700" aria-hidden="true">
                  <User size={15} />
                </span>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <form
          className="flex gap-2 border-t border-slate-200 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <label htmlFor="ask-input" className="sr-only">Ask a question about your health data</label>
          <input id="ask-input" className={inputClass} placeholder="e.g. Have my symptoms changed since my medication was adjusted?" value={input} onChange={(e) => setInput(e.target.value)} />
          <Button type="submit" variant="primary" disabled={!input.trim()} aria-label="Ask">
            <Send size={16} aria-hidden="true" />
          </Button>
        </form>
      </Card>
    </>
  );
}

function AnswerDetails({ a }: { a: AssistantAnswer }) {
  return (
    <div className="mt-2 space-y-2">
      {a.bullets.length > 0 && (
        <ul className="list-disc space-y-1 pl-5">
          {a.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
      {a.missing.length > 0 && (
        <div className="rounded-md bg-slate-50 p-2 text-xs text-slate-600">
          <p className="font-semibold">Missing or limiting information</p>
          <ul className="list-disc pl-4">
            {a.missing.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      {a.questions.length > 0 && (
        <div className="rounded-md bg-teal-50 p-2 text-xs text-teal-900">
          <p className="font-semibold">Questions you could ask a clinician</p>
          <ul className="list-disc pl-4">
            {a.questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}
      {a.sources.length > 0 && (
        <p className="text-xs text-slate-500">
          Based on:{' '}
          {a.sources.map((s, i) => (
            <span key={i}>
              {i > 0 && ' · '}
              {s.href ? (
                <a href={s.href} className="font-medium text-teal-800 underline" target={s.href.startsWith('http') ? '_blank' : undefined} rel={s.href.startsWith('http') ? 'noreferrer noopener' : undefined}>
                  {s.label}
                </a>
              ) : (
                s.label
              )}
            </span>
          ))}
        </p>
      )}
      <p className="text-[11px] text-slate-400">Answer type: {a.kind === 'answer' ? `records summary (${a.intent})` : a.kind}</p>
    </div>
  );
}
