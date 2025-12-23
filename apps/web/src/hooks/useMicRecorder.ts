/**
 * Microphone Recorder Hook for Push-to-Talk
 * Records audio while pressed, returns blob on release
 * Implements VOICE-IN-013-R2 logging contract
 */

import { useRef, useState, useCallback } from 'react';
import { CONFIG } from '../config';

export interface UseMicRecorderResult {
    isRecording: boolean;
    isTranscribing: boolean;
    error: string | null;
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<string | null>;
}

/**
 * MIME type priority order for audio recording
 * Best quality first, with fallbacks
 */
const MIME_PRIORITY = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
] as const;

/**
 * Get best supported MIME type
 */
function getBestMimeType(): string {
    for (const mime of MIME_PRIORITY) {
        if (MediaRecorder.isTypeSupported(mime)) {
            return mime;
        }
    }
    return 'audio/webm'; // Fallback
}

/**
 * Hook for recording audio and transcribing via STT API
 */
export function useMicRecorder(): UseMicRecorderResult {
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const mimeTypeRef = useRef<string>('');

    /**
     * Start recording from microphone
     */
    const startRecording = useCallback(async () => {
        setError(null);

        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    echoCancellation: true,
                    noiseSuppression: true,
                }
            });

            // Contract log: [mic] permission granted
            console.log('[mic] permission granted');
            streamRef.current = stream;

            // Determine best supported mime type with negotiation
            const mimeType = getBestMimeType();
            mimeTypeRef.current = mimeType;

            // Contract log: [mic] recorder start mime=<...>
            console.log(`[mic] recorder start mime=${mimeType}`);

            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            mediaRecorder.start(100); // Collect chunks every 100ms
            setIsRecording(true);

        } catch (err) {
            const message = err instanceof Error ? err.message : 'Microphone access denied';
            // Contract log: [mic] permission denied
            console.error('[mic] permission denied:', message);
            setError(`Mic permission denied: ${message}`);
        }
    }, []);

    /**
     * Stop recording and transcribe via STT API
     * @returns Transcribed text or null on error
     */
    const stopRecording = useCallback(async (): Promise<string | null> => {
        if (!mediaRecorderRef.current || !isRecording) {
            return null;
        }

        setIsRecording(false);

        return new Promise((resolve) => {
            const mediaRecorder = mediaRecorderRef.current!;

            mediaRecorder.onstop = async () => {
                // Stop all tracks
                streamRef.current?.getTracks().forEach(track => track.stop());

                // Create blob from chunks
                const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });

                // Contract log: [mic] recorder stop size_bytes=<...>
                console.log(`[mic] recorder stop size_bytes=${blob.size}`);

                if (blob.size === 0) {
                    console.error('[mic] recorder produced zero-byte blob');
                    setError('Recording produced no audio data');
                    resolve(null);
                    return;
                }

                if (blob.size < 1000) {
                    console.warn('[mic] Recording too short, size_bytes=' + blob.size);
                    resolve(null);
                    return;
                }

                // Transcribe via STT API
                setIsTranscribing(true);
                try {
                    const transcript = await transcribeAudio(blob, mimeTypeRef.current);
                    setIsTranscribing(false);
                    resolve(transcript);
                } catch (err) {
                    const message = err instanceof Error ? err.message : 'Transcription failed';
                    setError(message);
                    setIsTranscribing(false);
                    resolve(null);
                }
            };

            mediaRecorder.stop();
        });
    }, [isRecording]);

    return {
        isRecording,
        isTranscribing,
        error,
        startRecording,
        stopRecording,
    };
}

/**
 * Call STT API to transcribe audio blob
 */
async function transcribeAudio(blob: Blob, mimeType: string): Promise<string> {
    const formData = new FormData();

    // Determine file extension from mime type
    const ext = blob.type.includes('webm') ? 'webm' : 'ogg';
    formData.append('audio', blob, `recording.${ext}`);

    const userId = localStorage.getItem(CONFIG.STORAGE_KEY_USER_ID) || '';

    // Contract log: [stt] POST start bytes=<...> mime=<...>
    console.log(`[stt] POST start bytes=${blob.size} mime=${mimeType}`);

    const startTime = performance.now();

    const response = await fetch(`${CONFIG.API_BASE_URL}/stt/transcribe`, {
        method: 'POST',
        headers: {
            [CONFIG.USER_ID_HEADER]: userId,
        },
        body: formData,
    });

    const elapsed = Math.round(performance.now() - startTime);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const code = errorData.error?.code || response.status.toString();
        const message = errorData.error?.message || errorData.error || `HTTP ${response.status}`;

        // Contract log: [stt] error code=<...> message=<...>
        console.error(`[stt] error code=${code} message=${message}`);
        throw new Error(message);
    }

    const data = await response.json();
    const transcriptLen = data.transcript?.length || 0;

    // Contract log: [stt] POST done status=<...> transcript_len=<...>
    console.log(`[stt] POST done status=${response.status} transcript_len=${transcriptLen} elapsed_ms=${elapsed}`);

    return data.transcript;
}

export default useMicRecorder;
