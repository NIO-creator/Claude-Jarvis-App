import React, { useRef, useEffect } from 'react';

interface TranscriptPanelProps {
    transcript: string;
    assistantText: string;
    provider: string | null;
    streamInfo?: { codec?: string; sample_rate?: number } | null;
}

const TranscriptPanel: React.FC<TranscriptPanelProps> = ({ transcript, assistantText, provider, streamInfo }) => {
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
                    {provider && (
                        <div className="provider-info">
                            Routing: {provider} {streamInfo?.codec ? `(${streamInfo.codec}${streamInfo.sample_rate ? ` @ ${streamInfo.sample_rate}Hz` : ''})` : ''}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TranscriptPanel;
