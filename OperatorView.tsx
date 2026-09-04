import { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, Sparkles, X, Square } from 'lucide-react';
import { useAuth } from '@/lib/auth';

type OperatorAction = { type: string; label: string; data?: Record<string, unknown> };

type SpeechRecognitionEvent = { results: { [key: number]: { [key: number]: { transcript: string } } } };
type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: () => void;
  onend: () => void;
};

export function OperatorView({ onAction }: { onAction: (action: OperatorAction) => void }) {
  const { profile, session } = useAuth();
  const [mode, setMode] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const firstName = (profile?.full_name || 'Nathan').split(' ')[0];
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const conversationActiveRef = useRef(false);
  const askOperatorRef = useRef<(msg: string) => void>(() => {});
  const startListeningRef = useRef<() => void>(() => {});

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis?.getVoices() || [];
      voicesRef.current = voices;
    };
    loadVoices();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  const speak = useCallback((text: string) => {
    setAiResponse(text);
    if (!('speechSynthesis' in window)) {
      setMode('idle');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = voicesRef.current.length > 0
      ? voicesRef.current
      : window.speechSynthesis?.getVoices() || [];

    const frVoices = voices.filter((v) => v.lang.startsWith('fr'));
    const preferred = frVoices.find((v) => /google/i.test(v.name))
      || frVoices.find((v) => /natural|amelie|audrey|marie|celine|thomas|julie/i.test(v.name))
      || frVoices.find((v) => v.lang === 'fr-FR')
      || frVoices[0];
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => setMode('speaking');
    utterance.onend = () => {
      if (conversationActiveRef.current) {
        startListeningRef.current();
      } else {
        setMode('idle');
      }
    };
    utterance.onerror = () => {
      if (conversationActiveRef.current) {
        startListeningRef.current();
      } else {
        setMode('idle');
      }
    };
    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSession = () => {
    conversationActiveRef.current = false;
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
    setMode('idle');
  };

  const askOperator = useCallback(async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setTranscript(trimmed);
    setError(null);
    setMode('thinking');

    try {
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error('no-session');
      const responseData = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-operator`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: trimmed }),
      });
      if (!responseData.ok) throw new Error('request-failed');
      const data: { response?: string; action?: OperatorAction } = await responseData.json();
      if (!data.response) throw new Error('invalid-response');
      speak(data.response);
      if (data.action) {
        window.setTimeout(() => onAction(data.action as OperatorAction), 800);
      }
    } catch {
      setMode('idle');
      setError("Je n'ai pas pu joindre l'opérateur. Vérifiez votre connexion puis réessayez.");
    }
  }, [session, speak, onAction]);
  askOperatorRef.current = askOperator;

  const startListening = () => {
    if (mode === 'speaking' || mode === 'thinking') {
      stopSession();
      return;
    }
    if (mode === 'idle') conversationActiveRef.current = true;
    const SpeechRecognition = (window as Window & { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("La commande vocale n'est pas disponible dans ce navigateur. Utilisez Chrome ou Edge.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      setMode('thinking');
      void askOperatorRef.current(event.results[0][0].transcript);
    };
    recognition.onerror = () => {
      if (conversationActiveRef.current) {
        setMode('idle');
        setTimeout(() => {
          if (conversationActiveRef.current) startListeningRef.current();
        }, 500);
      } else {
        setMode('idle');
      }
    };
    recognition.onend = () => {
      if (modeRef.current === 'listening') setMode('idle');
    };
    recognitionRef.current = recognition;
    setError(null);
    setAiResponse('');
    setMode('listening');
    recognition.start();
  };
  startListeningRef.current = startListening;

  const statusText = mode === 'listening' ? 'Je vous écoute...' : mode === 'thinking' ? 'Je réfléchis...' : mode === 'speaking' ? 'Je vous réponds...' : (conversationActiveRef.current ? 'Appuyez pour continuer' : 'Appuyez pour parler');
  const subtitle = aiResponse
    ? ''
    : `Bonjour ${firstName}, qu'est-ce que je peux faire pour vous aujourd'hui ?`;
  const quickActions = ['Crée un devis', 'Crée une facture', 'Quels sont mes mails non lus ?', 'Montre-moi mon CA'];

  return (
    <div className="voice-operator anim-fade-in">
      <div className="voice-topbar">
        <div className="voice-brand"><div className="operator-logo"><Sparkles size={17} /></div><div><strong>IA Operator</strong><span><i className="status-dot" /> En ligne</span></div></div>
        <span className="voice-privacy"><Sparkles size={12} /> Session privée</span>
      </div>
      <div className="voice-stage">
        <div className="voice-copy">
          <span className="eyebrow">VOTRE ASSISTANT VOCAL</span>
          <h1>{subtitle || '\u00A0'}</h1>
          {transcript && mode !== 'speaking' && <p className="heard-text">« {transcript} »</p>}
          {aiResponse && mode === 'speaking' && <p className="ai-response-text">{aiResponse}</p>}
        </div>
        <button className={`voice-orb orb-${mode}`} onClick={startListening} aria-label={statusText}>
          <span className="orb-halo halo-one" /><span className="orb-halo halo-two" />
          <span className="orb-core">
            {mode === 'speaking' ? <Square size={28} /> : mode === 'thinking' ? <Sparkles size={34} className="orb-spin-icon" /> : <Mic size={34} />}
          </span>
        </button>
        <div className={`voice-status status-${mode}`}><span className="voice-status-dot" /> {statusText}</div>
        {error && <div className="voice-error"><X size={14} /> {error}</div>}
        {mode === 'idle' && !error && (
          <div className="quick-actions">
            <span>Suggestions — cliquez pour parler</span>
            {quickActions.map((action) => (
              <button key={action} onClick={() => void askOperator(action)}>{action}</button>
            ))}
          </div>
        )}
      </div>
      <div className="voice-controls">
        <div className="voice-control-row">
          <button className={`voice-mic-btn mic-${mode}`} onClick={startListening} aria-label={statusText}>
            {mode === 'speaking' || mode === 'thinking' ? <Square size={18} /> : <Mic size={18} />}
          </button>
          {mode === 'speaking' && <button className="stop-voice" onClick={stopSession}>Arrêter</button>}
        </div>
        <div className="voice-hint">
          <Mic size={14} /> {mode === 'listening' ? 'Parlez naturellement, je m\u2019occupe du reste.' : 'Votre voix reste privée et n\u2019est pas enregistrée.'}
        </div>
      </div>
    </div>
  );
}
