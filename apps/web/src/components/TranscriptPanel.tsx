import React, { useRef, useEffect } from 'react';

interface TranscriptPanelProps {
    transcript: string;
    assistantText: string;
    provider: string | null;
    streamInfo?: { codec?: string; sample_rate?: number; correlation_id?: string } | null;
    llmInfo?: { provider?: string; correlation_id?: string } | null;
}

const TranscriptPanel: React.FC<TranscriptPanelProps> = ({ transcript, assistantText, provider, streamInfo, llmInfo }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [transcript, assistantText]);

    return (
        <div className="transcript-panel" ref={scrollRef}>
            {transcript && (
                <div className="message user">
                    {transcript}
                </div>
            )}
            {assistantText && (
                <div className="message assistant">
                    {assistantText}
                    {/* LLM Provider info */}
                    {llmInfo?.provider && (
                        <div className="provider-info" style={{ opacity: 0.7 }}>
                            Brain: {llmInfo.provider}
                            {llmInfo.correlation_id && ` (${llmInfo.correlation_id.substring(0, 8)}...)`}
                        </div>
                    )}
                    {/* TTS Provider info */}
                    {provider && (
                        <div className="provider-info">
                            Voice: {provider}
                            {streamInfo?.codec ? ` (${streamInfo.codec}${streamInfo.sample_rate ? ` @ ${streamInfo.sample_rate}Hz` : ''})` : ''}
                            {streamInfo?.correlation_id && ` corr=${streamInfo.correlation_id.substring(0, 8)}...`}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TranscriptPanel;

