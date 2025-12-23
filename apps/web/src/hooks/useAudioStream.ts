import { useRef, useCallback, useState } from 'react';

/**
 * WebAudio streaming hook for JARVIS voice playback
 * Contract: WebSocket + WebAudio only (no downloads/files)
 * Supports: mp3 (decodeAudioData), pcm_16000 (Int16 → Float32 → AudioBuffer)
 */
export function useAudioStream() {
    const audioContextRef = useRef<AudioContext | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const sourceNodesRef = useRef<AudioBufferSourceNode[]>([]);
    const frameCountRef = useRef<number>(0);

    /**
     * Initialize or resume AudioContext (must be called on user gesture)
     */
    const initAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            console.log('[audio] AudioContext initialized, sampleRate:', audioContextRef.current.sampleRate);
        }
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
            console.log('[audio] AudioContext resumed');
        }
        return audioContextRef.current;
    }, []);

    /**
     * Schedule and play an AudioBuffer
     * Queues frames sequentially for gapless playback
     */
    const playBuffer = (ctx: AudioContext, buffer: AudioBuffer) => {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);

        // Calculate start time for sequential playback
        const currentTime = ctx.currentTime;
        const startTime = Math.max(currentTime, nextStartTimeRef.current);

        source.start(startTime);
        nextStartTimeRef.current = startTime + buffer.duration;

        sourceNodesRef.current.push(source);
        source.onended = () => {
            sourceNodesRef.current = sourceNodesRef.current.filter(n => n !== source);
            if (sourceNodesRef.current.length === 0) {
                setIsPlaying(false);
                console.log('[audio] Playback queue empty');
            }
        };
    };

    /**
     * Decode and play PCM_16000 audio
     * Contract: pcm_16000 - convert Int16 PCM → Float32 → AudioBuffer
     */
    const decodeAndPlayPCM = async (ctx: AudioContext, base64Data: string, sampleRate = 16000) => {
        try {
            const raw = atob(base64Data);
            const bytes = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) {
                bytes[i] = raw.charCodeAt(i);
            }

            const int16 = new Int16Array(bytes.buffer);
            const float32 = new Float32Array(int16.length);
            for (let i = 0; i < int16.length; i++) {
                float32[i] = int16[i] / 32768.0;
            }

            const buffer = ctx.createBuffer(1, float32.length, sampleRate);
            buffer.getChannelData(0).set(float32);

            playBuffer(ctx, buffer);
        } catch (err) {
            console.error('[audio] PCM decode error:', err);
        }
    };

    /**
     * Decode and play MP3 audio
     * Contract: mp3 - decodeAudioData()
     */
    const decodeAndPlayMP3 = async (ctx: AudioContext, base64Data: string) => {
        try {
            const raw = atob(base64Data);
            const bytes = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) {
                bytes[i] = raw.charCodeAt(i);
            }

            // Copy to ArrayBuffer for decodeAudioData
            const arrayBuffer = bytes.buffer.slice(0);
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            playBuffer(ctx, audioBuffer);
        } catch (e) {
            console.error('[audio] MP3 decode error:', e);
        }
    };

    /**
     * Feed an audio frame for playback
     * @param data_b64 Base64-encoded audio data
     * @param codec Codec identifier (pcm_16000 | mp3)
     */
    const feedFrame = useCallback(async (data_b64: string, codec: string) => {
        const ctx = initAudioContext();
        setIsPlaying(true);
        frameCountRef.current++;

        if (codec.includes('pcm_16000') || codec === 'pcm') {
            await decodeAndPlayPCM(ctx, data_b64, 16000);
        } else if (codec === 'mp3') {
            await decodeAndPlayMP3(ctx, data_b64);
        } else {
            console.warn('[audio] Unsupported codec:', codec);
        }
    }, [initAudioContext]);

    /**
     * Signal end of stream (allows current queue to finish)
     */
    const endStream = useCallback(() => {
        console.log('[audio] Stream ended signal received, queued frames:', sourceNodesRef.current.length);
        frameCountRef.current = 0;
    }, []);

    /**
     * Stop all audio immediately
     */
    const stopAll = useCallback(() => {
        console.log('[audio] Stopping all playback');
        sourceNodesRef.current.forEach(node => {
            try { node.stop(); } catch (e) { }
        });
        sourceNodesRef.current = [];
        nextStartTimeRef.current = 0;
        frameCountRef.current = 0;
        setIsPlaying(false);
    }, []);

    return {
        feedFrame,
        endStream,
        stopAll,
        isPlaying,
        initAudioContext
    };
}
