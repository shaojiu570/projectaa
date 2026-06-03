import { getColorClass } from '../constants';

interface NumberBallProps {
  number: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showInfo?: boolean;
  highlight?: boolean;
  probability?: number;
}

export default function NumberBall({ number, size = 'md', highlight = false, probability }: NumberBallProps) {
  const sizeClasses = {
    xs: 'w-5 h-5 text-[10px]',
    sm: 'w-7 h-7 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base font-bold',
  };

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className={`${getColorClass(number)} ${sizeClasses[size]} rounded-full flex items-center justify-center font-mono shadow-md
          ${highlight ? 'ring-2 ring-yellow-400 ring-offset-1 scale-110' : ''}
          transition-all duration-200`}
      >
        {String(number).padStart(2, '0')}
      </div>
      {probability !== undefined && (
        <span className="text-[10px] text-gray-500 font-mono">
          {(probability * 100).toFixed(1)}%
        </span>
      )}
    </div>
  );
}
