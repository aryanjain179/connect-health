/**
 * Thin wrapper around the browser Web Speech API (SpeechRecognition / webkitSpeechRecognition).
 * When unsupported or denied, the Voice Journal falls back to typed input.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type SpeechStatus = 'idle' | 'requesting' | 'listening' | 'stopped' | 'denied' | 'error' | 'unsupported';

interface RecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => RecognitionLike;

export function getRecognitionCtor(): RecognitionCtor | null {
  const w = globalThis as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechRecognition(onFinal: (text: string) => void) {
  const Ctor = getRecognitionCtor();
  const [status, setStatus] = useState<SpeechStatus>(Ctor ? 'idle' : 'unsupported');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<RecognitionLike | null>(null);
  const finalCb = useRef(onFinal);
  finalCb.current = onFinal;

  useEffect(() => () => rec.current?.abort(), []);

  const start = useCallback(async () => {
    if (!Ctor) return;
    setError(null);
    setStatus('requesting');
    // Ask for microphone access explicitly so the permission prompt is transparent.
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      }
    } catch {
      setStatus('denied');
      setError('Microphone access was denied or is unavailable. You can type your journal entry instead.');
      return;
    }
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || 'en-US';
    r.onresult = (e) => {
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalCb.current(res[0].transcript.trim());
        else live += res[0].transcript;
      }
      setInterim(live);
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setStatus('denied');
        setError('Speech recognition is not allowed in this browser. You can type your journal entry instead.');
      } else if (e.error === 'no-speech') {
        setError('No speech was detected. Try again or type instead.');
      } else if (e.error !== 'aborted') {
        setStatus('error');
        setError(`Speech recognition error (${e.error}). You can type your journal entry instead.`);
      }
    };
    r.onend = () => {
      setInterim('');
      setStatus((s) => (s === 'listening' || s === 'requesting' ? 'stopped' : s));
    };
    rec.current = r;
    try {
      r.start();
      setStatus('listening');
    } catch {
      setStatus('error');
      setError('Could not start speech recognition. You can type your journal entry instead.');
    }
  }, [Ctor]);

  const stop = useCallback(() => {
    rec.current?.stop();
    setStatus('stopped');
  }, []);

  return { supported: !!Ctor, status, interim, error, start, stop };
}
