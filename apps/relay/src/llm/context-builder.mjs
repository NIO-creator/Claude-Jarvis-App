/**
 * LLM Context Builder - Deterministic prompt assembly
 * @module llm/context-builder
 * 
 * Strict ordering:
 * 1. SYSTEM: Persona + Memory Facts
 * 2. CONTEXT: Last session transcript (user/assistant messages)
 * 3. USER: Current user input
 */

/**
 * Format memory facts into a structured summary for the system prompt
 * @param {Array<{fact_key: string, fact_value: string, confidence: number}>} facts 
 * @returns {string}
 */
function formatMemoryFacts(facts) {
    if (!facts || facts.length === 0) {
        return '';
    }

    const factLines = facts.map(f => `- ${f.fact_key}: "${f.fact_value}"`);
    return `\n\n## User Memory\nThe following facts are known about the user:\n${factLines.join('\n')}`;
}

/**
 * Build LLM context with deterministic ordering
 * 
 * @param {Object} params
 * @param {string} params.persona_prompt - System persona instructions
 * @param {Array<{fact_key: string, fact_value: string, confidence: number}>} params.memory_facts - User memory facts
 * @param {Array<{role: string, content: string, created_at: string}>|null} params.last_session_transcript - Previous session messages
 * @param {string} params.user_input - Current user message
 * @returns {{messages: Array<{role: string, content: string}>}}
 */
export function buildLLMContext({ persona_prompt, memory_facts, last_session_transcript, user_input }) {
    const messages = [];

    // ============================================================
    // Position 0: SYSTEM message (Persona + Memory Facts)
    // ============================================================
    // Persona instructions are immutable and cannot be overridden
    let systemContent = persona_prompt;

    // Inject memory facts as structured summary
    const memorySection = formatMemoryFacts(memory_facts);
    if (memorySection) {
        systemContent += memorySection;
    }

    messages.push({
        role: 'system',
        content: systemContent
    });

    // ============================================================
    // Positions 1..N: Last session transcript (CONTEXT)
    // ============================================================
    // Only include user and assistant messages (not system)
    if (last_session_transcript && last_session_transcript.length > 0) {
        for (const msg of last_session_transcript) {
            if (msg.role === 'user' || msg.role === 'assistant') {
                messages.push({
                    role: msg.role,
                    content: msg.content
                });
            }
        }
    }

    // ============================================================
    // Position N+1: Current USER input
    // ============================================================
    messages.push({
        role: 'user',
        content: user_input
    });

    return { messages };
}

/**
 * Validate that a context is properly formed
 * Throws if validation fails
 * @param {{messages: Array<{role: string, content: string}>}} context 
 */
export function validateContext(context) {
    if (!context || !context.messages || !Array.isArray(context.messages)) {
        throw new Error('Invalid context: messages array required');
    }

    if (context.messages.length === 0) {
        throw new Error('Invalid context: at least one message required');
    }

    // First message must be system
    if (context.messages[0].role !== 'system') {
        throw new Error('Invalid context: first message must be system role');
    }

    // Last message must be user
    if (context.messages[context.messages.length - 1].role !== 'user') {
        throw new Error('Invalid context: last message must be user role');
    }

    // All messages must have role and content
    for (let i = 0; i < context.messages.length; i++) {
        const msg = context.messages[i];
        if (!msg.role || typeof msg.role !== 'string') {
            throw new Error(`Invalid context: message ${i} missing role`);
        }
        if (msg.content === undefined || msg.content === null) {
            throw new Error(`Invalid context: message ${i} missing content`);
        }
    }

    return true;
}
