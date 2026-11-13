import { useCallback, useEffect, useRef, useState } from 'react';

const Ctor: any = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : undefined;
/** Chrome, Edge and Safari support it; Firefox doesn't. It needs https (or localhost) and microphone permission. */
export const voiceSupported = !!Ctor;

const ERRORS: Record<string, string> = {
    'not-allowed': "Microphone access is blocked. Allow it in your browser's site settings.",
    'service-not-allowed': "Microphone access is blocked. Allow it in your browser's site settings.",
    'no-speech': "Didn't hear anything. Try again.",
    'audio-capture': 'No microphone found.',
    network: 'Voice input needs an internet connection.',
    aborted: '',
};

/** Push-to-talk speech input. `onResult` gets the final text once the user stops speaking. */
export const useVoice = (onResult: (text: string) => void) => {
    const [listening, setListening] = useState(false);
    const [heard, setHeard] = useState('');
    const [error, setError] = useState('');
    const rec = useRef<any>(null);
    const cb = useRef(onResult);
    cb.current = onResult;

    const start = useCallback(() => {
        if (!Ctor || rec.current) return;
        setError('');
        setHeard('');
        const r = new Ctor();
        rec.current = r;
        r.lang = navigator.language?.toLowerCase().startsWith('en') ? navigator.language : 'en-US';
        r.interimResults = true;
        r.continuous = false;
        r.maxAlternatives = 1;
        let finalText = '';
        r.onresult = (e: any) => {
            let interim = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const res = e.results[i];
                if (res.isFinal) finalText += res[0].transcript;
                else interim += res[0].transcript;
            }
            setHeard((finalText + interim).trim());
        };
        r.onerror = (e: any) => setError(ERRORS[e.error] ?? 'Voice input failed. Try again.');
        r.onend = () => {
            rec.current = null;
            setListening(false);
            setHeard('');
            if (finalText.trim()) cb.current(finalText.trim());
        };
        try {
            r.start();
            setListening(true);
        } catch {
            rec.current = null;
            setError('Voice input could not start. Try again.');
        }
    }, []);
    const stop = useCallback(() => rec.current?.stop(), []);
    useEffect(() => () => rec.current?.abort?.(), []);
    return { supported: voiceSupported, listening, heard, error, start, stop };
};
