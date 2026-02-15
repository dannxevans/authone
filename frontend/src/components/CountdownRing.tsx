interface CountdownRingProps {
  remaining: number;
  period: number;
  size?: number;
  strokeWidth?: number;
}

export default function CountdownRing({
  remaining,
  period,
  size = 44,
  strokeWidth = 3,
}: CountdownRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = remaining / period;
  const offset = circumference * (1 - progress);

  const isWarning = remaining <= 5;
  const color = isWarning ? '#f59e0b' : '#3b82f6'; // amber-400 : blue-500

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#374151"
        strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.5s linear, stroke 0.3s' }}
      />
      {/* Center text - rotate back to readable */}
      <text
        x={size / 2}
        y={size / 2}
        dominantBaseline="central"
        textAnchor="middle"
        fill={isWarning ? '#f59e0b' : '#9ca3af'}
        fontSize={size * 0.28}
        fontWeight="600"
        style={{ transform: `rotate(90deg)`, transformOrigin: '50% 50%' }}
      >
        {remaining}
      </text>
    </svg>
  );
}
