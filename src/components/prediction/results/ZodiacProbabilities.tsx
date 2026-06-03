import { PredictionResult } from '../../utils/prediction';

interface ZodiacProbabilitiesProps {
  result: PredictionResult;
  zodiacTopK: number;
}

const ZODIAC_EMOJI: Record<string, string> = {
  鼠: '🐭',
  牛: '🐮',
  虎: '🐯',
  兔: '🐰',
  龙: '🐲',
  蛇: '🐍',
  马: '🐴',
  羊: '🐑',
  猴: '🐵',
  鸡: '🐔',
  狗: '🐶',
  猪: '🐷',
};

export default function ZodiacProbabilities({ result, zodiacTopK }: ZodiacProbabilitiesProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">🐲 生肖概率排名</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {result.topZodiacs.slice(0, 12).map((z, i) => (
          <div
            key={z.zodiac}
            className={`p-3 rounded-lg border text-center transition-all ${
              i < zodiacTopK
                ? 'bg-indigo-50 border-indigo-300 shadow-sm'
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="text-2xl mb-1">{ZODIAC_EMOJI[z.zodiac] || '❓'}</div>
            <div className="font-medium text-gray-800">{z.zodiac}</div>
            <div className="text-sm text-indigo-600 font-mono">{(z.probability * 100).toFixed(1)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}
