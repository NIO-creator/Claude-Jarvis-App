/**
 * Speech-to-Text Routes
 * POST /stt/transcribe - Transcribe audio to text
 * Uses native fetch() instead of OpenAI SDK to avoid node-fetch ECONNRESET issues in Cloud Run
 * @module routes/stt
 */


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
 * Transcribe audio using OpenAI Whisper API with raw fetch()
 * Uses native fetch() instead of OpenAI SDK to avoid node-fetch ECONNRESET issues
 * @param {Buffer} audioBuffer - Audio data
 * @param {string} filename - Original filename with extension
 * @param {object} logger - Logger instance for structured logging
 * @param {string} correlationId - Request correlation ID
 * @returns {Promise<string>} - Transcribed text
 */
async function transcribeWithOpenAI(audioBuffer, filename, logger, correlationId) {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
        throw new Error('OpenAI client not available - OPENAI_API_KEY not set');
    }

    const mimeType = getMimeType(filename);
    logger?.info({ correlation_id: correlationId, filename, mimeType, bufferSize: audioBuffer.length }, '[stt] preparing OpenAI transcription request (raw fetch)');

    // Build FormData with audio file
    // Using native FormData + Blob for maximum compatibility
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: mimeType });
    formData.append('file', audioBlob, filename);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    logger?.info({ correlation_id: correlationId }, '[stt] calling OpenAI Whisper API (raw fetch)');
    const startTime = Date.now();

    try {
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                // Note: Do NOT set Content-Type header - let fetch set it with boundary for FormData
            },
            body: formData,
        });

        const elapsed = Date.now() - startTime;

        if (!response.ok) {
            const errorText = await response.text();
            logger?.error({ correlation_id: correlationId, status: response.status, error: errorText, elapsed_ms: elapsed }, '[stt] OpenAI Whisper API HTTP error');
            const error = new Error(`OpenAI API error: ${response.status} - ${errorText}`);
            error.status = response.status;
            throw error;
        }

        const data = await response.json();
        logger?.info({ correlation_id: correlationId, elapsed_ms: elapsed, transcript_len: data.text?.length }, '[stt] OpenAI Whisper API success');

        return data.text;
    } catch (fetchError) {
        const elapsed = Date.now() - startTime;
        // Capture error details for debugging
        const errorDetails = {
            correlation_id: correlationId,
            elapsed_ms: elapsed,
            error_name: fetchError.name,
            error_message: fetchError.message,
            error_status: fetchError.status,
            error_code: fetchError.code,
            cause_name: fetchError.cause?.name,
            cause_message: fetchError.cause?.message,
            cause_code: fetchError.cause?.code,
        };
        logger?.error(errorDetails, '[stt] OpenAI Whisper API failed (raw fetch)');
        throw fetchError;
    }
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
            const transcript = await transcribeWithOpenAI(audioBuffer, data.filename || 'audio.webm', app.log, correlationId);
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
