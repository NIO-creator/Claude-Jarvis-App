/**
 * Speech-to-Text Routes
 * POST /stt/transcribe - Transcribe audio to text
 * @module routes/stt
 */

import OpenAI, { toFile } from 'openai';

// Lazy-initialized OpenAI client (deferred to avoid crash when key missing)
let openai = null;

/**
 * Get OpenAI client (lazy initialization)
 * Configures timeout and retry settings for reliability
 * @returns {OpenAI | null}
 */
function getOpenAIClient() {
    if (!openai && process.env.OPENAI_API_KEY) {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            timeout: 60000, // 60 second timeout for audio uploads
            maxRetries: 2,  // Retry twice on transient failures
        });
    }
    return openai;
}

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
    // Get lazily-initialized OpenAI client
    const client = getOpenAIClient();
    if (!client) {
        throw new Error('OpenAI client not available - OPENAI_API_KEY not set');
    }

    // Use OpenAI's toFile helper to properly convert Buffer for API upload
    // This fixes APIConnectionError caused by using browser File() constructor
    const audioFile = await toFile(audioBuffer, filename, {
        type: getMimeType(filename),
    });

    const response = await client.audio.transcriptions.create({
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
        // Generate correlation ID for request tracing
        const correlationId = `stt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        reply.header('x-correlation-id', correlationId);

        if (!userId) {
            return reply.status(401).send({
                error: { code: 'UNAUTHORIZED', message: 'User identity required', correlation_id: correlationId }
            });
        }

        // Check configuration
        if (!isSTTConfigured()) {
            app.log.warn(`[stt] correlation_id=${correlationId} STT_NOT_CONFIGURED provider=openai`);
            return reply.status(503).send({
                error: {
                    code: 'STT_NOT_CONFIGURED',
                    message: 'STT provider openai requires OPENAI_API_KEY',
                    correlation_id: correlationId
                }
            });
        }

        try {
            // Get the audio file from multipart
            const data = await request.file();

            if (!data) {
                return reply.status(400).send({
                    error: { code: 'NO_AUDIO', message: 'No audio file provided', correlation_id: correlationId }
                });
            }

            // Contract log: [stt] received content-type=... bytes=...
            // Note: We'll get exact bytes after streaming
            app.log.info(`[stt] correlation_id=${correlationId} received content-type=${data.mimetype} filename=${data.filename}`);

            // Mock mode for development
            if (process.env.STT_MOCK_MODE === 'true') {
                const transcript = mockTranscribe();
                const elapsed = Date.now() - startTime;

                // Contract log: [stt] provider=... elapsed_ms=... transcript_len=...
                app.log.info(`[stt] correlation_id=${correlationId} provider=mock elapsed_ms=${elapsed} transcript_len=${transcript.length}`);

                return { transcript, correlation_id: correlationId };
            }

            // Convert stream to buffer
            const chunks = [];
            for await (const chunk of data.file) {
                chunks.push(chunk);
            }
            const audioBuffer = Buffer.concat(chunks);

            // Contract log: [stt] received content-type=... bytes=...
            app.log.info(`[stt] correlation_id=${correlationId} received content-type=${data.mimetype} bytes=${audioBuffer.length}`);

            // Transcribe with OpenAI
            const transcript = await transcribeWithOpenAI(audioBuffer, data.filename || 'audio.webm');
            const elapsed = Date.now() - startTime;

            // Contract log: [stt] provider=... elapsed_ms=... transcript_len=...
            app.log.info(`[stt] correlation_id=${correlationId} provider=openai elapsed_ms=${elapsed} transcript_len=${transcript.length}`);

            return { transcript, correlation_id: correlationId };

        } catch (err) {
            const elapsed = Date.now() - startTime;

            // Detailed error classification for debugging
            const errorClass = err.constructor?.name || 'Error';
            const errorStatus = err.status || null;
            const errorType = err.type || null;
            const errorCode = err.code || null;
            const errorCause = err.cause?.message || null;

            // Sanitize error message to avoid leaking API keys
            const safeMessage = err.message?.replace(/Bearer\s+[^\s]+/g, 'Bearer [REDACTED]') || 'Transcription failed';

            // Structured error log with all relevant details
            app.log.error({
                correlation_id: correlationId,
                userId,
                elapsed_ms: elapsed,
                error_class: errorClass,
                error_status: errorStatus,
                error_type: errorType,
                error_code: errorCode,
                error_cause: errorCause,
                error_message: safeMessage
            }, `[stt] transcription failed: ${errorClass}`);

            if (err.status === 401) {
                return reply.status(502).send({
                    error: { code: 'PROVIDER_AUTH_FAILED', message: 'STT provider authentication failed', correlation_id: correlationId }
                });
            }

            // Provide more specific error code for connection issues
            if (errorClass === 'APIConnectionError' || safeMessage.includes('Connection error')) {
                return reply.status(502).send({
                    error: {
                        code: 'PROVIDER_CONNECTION_ERROR',
                        message: 'Failed to connect to STT provider',
                        correlation_id: correlationId
                    }
                });
            }

            return reply.status(500).send({
                error: { code: 'TRANSCRIPTION_FAILED', message: safeMessage, correlation_id: correlationId }
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
