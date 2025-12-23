import React from 'react';

interface StatusRingProps {
    status: 'idle' | 'listening' | 'thinking' | 'speaking';
}

const StatusRing: React.FC<StatusRingProps> = ({ status }) => {
    return (
        <svg className="status-svg" viewBox="0 0 240 240">
            <circle
                className={`status-circle ${status}`}
                cx="120"
                cy="120"
                r="100"
            />
            {/* Decorative inner circles */}
            <circle
                cx="120"
                cy="120"
                r="115"
                fill="none"
                stroke="rgba(0, 242, 255, 0.1)"
                strokeWidth="1"
                strokeDasharray="4 8"
            />
            <circle
                cx="120"
                cy="120"
                r="85"
                fill="none"
                stroke="rgba(0, 242, 255, 0.1)"
                strokeWidth="1"
                strokeDasharray="2 4"
            />
        </svg>
    );
};

export default StatusRing;
