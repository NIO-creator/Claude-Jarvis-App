/**
 * Speech-to-Text Routes
 * POST /stt/transcribe - Transcribe audio to text
 * @module routes/stt
 */

import OpenAI from 'openai';
import { Readable } from 'stream';

// Initialize OpenAI client (will use OPENAI_API_KEY from env)
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Check if STT is configured
 */
export function isSTTConfigured() {
    if (process.env.STT_MOCK_MODE === 'true') {
        return true;
    }
    return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * Transcribe audio using OpenAI Whisper
 * @param {Buffer} audioBuffer - Audio data
 * @param {string} filename - Original filename with extension
 * @returns {Promise<string>} - Transcribed text
 */
async function transcribeWithOpenAI(audioBuffer, filename) {
    // Create a File object from the buffer for OpenAI
    const audioFile = new File([audioBuffer], filename, {
        type: getMimeType(filename),
    });

    const response = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'en', // Default to English for JARVIS
    });

    return response.text;
}

/**
 * Mock transcription for development/testing
 */
function mockTranscribe() {
    const mockPhrases = [
        "Hello JARVIS, how are you today?",
        "What's the weather like?",
        "Tell me a joke, please.",
        "JARVIS, run a systems check.",
        "Good morning, sir. What's on the agenda?",
    ];
    const idx = Math.floor(Math.random() * mockPhrases.length);
    return mockPhrases[idx];
}

/**
 * Get MIME type from filename
 */
function getMimeType(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes = {
        'webm': 'audio/webm',
        'ogg': 'audio/ogg',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'm4a': 'audio/mp4',
        'mp4': 'audio/mp4',
        'flac': 'audio/flac',
    };
    return mimeTypes[ext] || 'audio/webm';
}

/**
 * Register STT routes
 * @param {import('fastify').FastifyInstance} app 
 */
export function registerSTTRoutes(app) {
    /**
     * POST /stt/transcribe
     * Transcribe audio file to text
     * 
     * Headers:
     *   x-jarvis-user-id: <uuid>
     * Body:
     *   multipart/form-data with audio file (field name: "audio")
     * Response:
     *   { "transcript": "..." }
     */
    app.post('/stt/transcribe', async (request, reply) => {
        const userId = request.userId;
        const startTime = Date.now();

        if (!userId) {
            return reply.status(401).send({
                error: { code: 'UNAUTHORIZED', message: 'User identity required' }
            });
        }

        // Check configuration
        if (!isSTTConfigured()) {
            return reply.status(503).send({
                error: { code: 'NOT_CONFIGURED', message: 'STT not configured. Set OPENAI_API_KEY or STT_MOCK_MODE=true' }
            });
        }

        try {
            // Get the audio file from multipart
            const data = await request.file();

            if (!data) {
                return reply.status(400).send({
                    error: { code: 'NO_AUDIO', message: 'No audio file provided' }
                });
            }

            // Contract log: [stt] received content-type=... bytes=...
            // Note: We'll get exact bytes after streaming
            app.log.info(`[stt] received content-type=${data.mimetype} filename=${data.filename}`);

            // Mock mode for development
            if (process.env.STT_MOCK_MODE === 'true') {
                const transcript = mockTranscribe();
                const elapsed = Date.now() - startTime;

                // Contract log: [stt] provider=... elapsed_ms=... transcript_len=...
                app.log.info(`[stt] provider=mock elapsed_ms=${elapsed} transcript_len=${transcript.length}`);

                return { transcript };
            }

            // Convert stream to buffer
            const chunks = [];
            for await (const chunk of data.file) {
                chunks.push(chunk);
            }
            const audioBuffer = Buffer.concat(chunks);

            // Contract log: [stt] received content-type=... bytes=...
            app.log.info(`[stt] received content-type=${data.mimetype} bytes=${audioBuffer.length}`);

            // Transcribe with OpenAI
            const transcript = await transcribeWithOpenAI(audioBuffer, data.filename || 'audio.webm');
            const elapsed = Date.now() - startTime;

            // Contract log: [stt] provider=... elapsed_ms=... transcript_len=...
            app.log.info(`[stt] provider=openai elapsed_ms=${elapsed} transcript_len=${transcript.length}`);

            return { transcript };

        } catch (err) {
            const elapsed = Date.now() - startTime;
            app.log.error({ err, userId, elapsed_ms: elapsed }, '[stt] transcription failed');

            if (err.status === 401) {
                return reply.status(502).send({
                    error: { code: 'PROVIDER_AUTH_FAILED', message: 'STT provider authentication failed' }
                });
            }

            return reply.status(500).send({
                error: { code: 'TRANSCRIPTION_FAILED', message: err.message || 'Transcription failed' }
            });
        }
    });

    /**
     * GET /stt/status
     * Check STT service status
     */
    app.get('/stt/status', async (request, reply) => {
        return {
            configured: isSTTConfigured(),
            provider: process.env.STT_MOCK_MODE === 'true' ? 'mock' : 'openai',
            mock_mode: process.env.STT_MOCK_MODE === 'true',
        };
    });
}
