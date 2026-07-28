import { modelRegistry } from './registry';
import { resnetModel, colorMarkovModel, elementMarkovModel, sizeMarkovModel, parityMarkovModel, hotTrendModel, coldTrendModel, maTrendModel, randomNumberModel } from '../number';
import { zodiacFreqModel, zodiacMarkovModel, zodiacPatternModel, zodiacResnetModel, zodiacLstmModel, zodiacComboModel, zodiacCondProbModel, zodiacBayesModel } from '../zodiac';
import { colorFreqModel, colorTrendModel, colorPatternModel } from '../color';
import { sizeFreqModel, sizeAlternateModel } from '../size';
import { parityFreqModel, parityTrendModel } from '../parity';
import { headFreqModel, headMarkovModel, headTrendModel, headPatternModel, headComboModel } from '../head';
import { tailFreqModel, tailMarkovModel, tailTrendModel, tailPatternModel, tailComboModel } from '../tail';
import { elementFreqModel, elementMarkovModel, elementTrendModel, elementPatternModel, elementComboModel } from '../element';

const numberModels = [
  { id: 'resnet', name: '号码-ResNet', desc: '1D残差网络，时间序列分析', fn: resnetModel, weight: 0.2 },
  { id: 'color_markov', name: '号码-波色马尔可夫', desc: '波色转移矩阵', fn: colorMarkovModel, weight: 0.1 },
  { id: 'element_markov', name: '号码-五行马尔可夫', desc: '五行转移矩阵', fn: elementMarkovModel, weight: 0.1 },
  { id: 'size_markov', name: '号码-大小马尔可夫', desc: '大小转移矩阵', fn: sizeMarkovModel, weight: 0.05 },
  { id: 'parity_markov', name: '号码-奇偶马尔可夫', desc: '奇偶转移矩阵', fn: parityMarkovModel, weight: 0.05 },
  { id: 'hot_trend', name: '号码-热号趋势', desc: '近期热号加权', fn: hotTrendModel, weight: 0.08 },
  { id: 'cold_trend', name: '号码-冷号趋势', desc: '遗漏较大号码', fn: coldTrendModel, weight: 0.05 },
  { id: 'ma_trend', name: '号码-MA趋势', desc: '移动平均趋势', fn: maTrendModel, weight: 0.07 },
  { id: 'lstm', name: '号码-LSTM', desc: '长短期记忆网络', fn: randomNumberModel, weight: 0.15 },
  { id: 'xgboost', name: '号码-XGBoost', desc: '梯度提升树', fn: randomNumberModel, weight: 0.1 },
  { id: 'lightgbm', name: '号码-LightGBM', desc: '轻量梯度提升', fn: randomNumberModel, weight: 0.08 },
];

const categoryModels = [
  { id: 'zodiac_resnet', name: '生肖-遗漏值', desc: '最久未出现的生肖概率更高', fn: zodiacResnetModel, cats: ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'], weight: 0.25 },
  { id: 'zodiac_lstm', name: '生肖-一阶马尔可夫', desc: '基于上期生肖的转移概率', fn: zodiacLstmModel, cats: ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'], weight: 0.2 },
  { id: 'zodiac_markov', name: '生肖-二阶马尔可夫', desc: '基于前两期生肖的转移概率', fn: zodiacMarkovModel, cats: ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'], weight: 0.2 },
  { id: 'zodiac_pattern', name: '生肖-周期分析', desc: '遗漏与平均间隔对比', fn: zodiacPatternModel, cats: ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'], weight: 0.15 },
  { id: 'zodiac_freq', name: '生肖-冷热均衡', desc: '近30期低频生肖反向加权', fn: zodiacFreqModel, cats: ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'], weight: 0.1 },
  { id: 'zodiac_combo', name: '生肖-综合融合', desc: '遗漏+马尔可夫+频率融合', fn: zodiacComboModel, cats: ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'], weight: 0.1 },
  { id: 'zodiac_condProb', name: '生肖-条件概率', desc: '基于号码头尾数的条件概率', fn: zodiacCondProbModel, cats: ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'], weight: 0.1 },
  { id: 'zodiac_bayes', name: '生肖-贝叶斯', desc: '遗漏似然×先验概率', fn: zodiacBayesModel, cats: ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'], weight: 0.1 },
  { id: 'color_freq', name: '波色-频率分析', desc: '波色出现频率', fn: colorFreqModel, cats: ['红','蓝','绿'], weight: 1/3 },
  { id: 'color_trend', name: '波色-趋势分析', desc: '波色切换趋势', fn: colorTrendModel, cats: ['红','蓝','绿'], weight: 1/3 },
  { id: 'color_pattern', name: '波色-模式识别', desc: '波色隔期重复', fn: colorPatternModel, cats: ['红','蓝','绿'], weight: 1/3 },
  { id: 'size_freq', name: '大小-频率分析', desc: '大小出现频率', fn: sizeFreqModel, cats: ['大','小'], weight: 0.5 },
  { id: 'size_alternate', name: '大小-交替分析', desc: '大小交替模式', fn: sizeAlternateModel, cats: ['大','小'], weight: 0.5 },
  { id: 'parity_freq', name: '单双-频率分析', desc: '单双出现频率', fn: parityFreqModel, cats: ['单','双'], weight: 0.5 },
  { id: 'parity_trend', name: '单双-趋势分析', desc: '单双连续模式', fn: parityTrendModel, cats: ['单','双'], weight: 0.5 },
  // 头部预测模型
  { id: 'head_freq', name: '头数-频率分析', desc: '头数历史频率分析', fn: headFreqModel, cats: ['0头','1头','2头','3头','4头'], weight: 1/3 },
  { id: 'head_markov', name: '头数-马尔可夫', desc: '头数转移概率分析', fn: headMarkovModel, cats: ['0头','1头','2头','3头','4头'], weight: 1/3 },
  { id: 'head_trend', name: '头数-趋势分析', desc: '头数隔期重复模式', fn: headTrendModel, cats: ['0头','1头','2头','3头','4头'], weight: 1/5 },
  { id: 'head_pattern', name: '头数-周期分析', desc: '头数遗漏与平均间隔对比', fn: headPatternModel, cats: ['0头','1头','2头','3头','4头'], weight: 1/5 },
  { id: 'head_combo', name: '头数-综合融合', desc: '头数频率+马尔可夫融合', fn: headComboModel, cats: ['0头','1头','2头','3头','4头'], weight: 1/5 },
  // 尾部预测模型
  { id: 'tail_freq', name: '尾数-频率分析', desc: '尾数历史频率分析', fn: tailFreqModel, cats: ['0尾','1尾','2尾','3尾','4尾','5尾','6尾','7尾','8尾','9尾'], weight: 1/5 },
  { id: 'tail_markov', name: '尾数-马尔可夫', desc: '尾数转移概率分析', fn: tailMarkovModel, cats: ['0尾','1尾','2尾','3尾','4尾','5尾','6尾','7尾','8尾','9尾'], weight: 1/3 },
  { id: 'tail_trend', name: '尾数-趋势分析', desc: '尾数隔期重复模式', fn: tailTrendModel, cats: ['0尾','1尾','2尾','3尾','4尾','5尾','6尾','7尾','8尾','9尾'], weight: 1/5 },
  { id: 'tail_pattern', name: '尾数-周期分析', desc: '尾数遗漏与平均间隔对比', fn: tailPatternModel, cats: ['0尾','1尾','2尾','3尾','4尾','5尾','6尾','7尾','8尾','9尾'], weight: 1/5 },
  { id: 'tail_combo', name: '尾数-综合融合', desc: '尾数频率+马尔可夫融合', fn: tailComboModel, cats: ['0尾','1尾','2尾','3尾','4尾','5尾','6尾','7尾','8尾','9尾'], weight: 1/5 },
  // 五行预测模型
  { id: 'element_freq', name: '五行-频率分析', desc: '五行历史频率分析', fn: elementFreqModel, cats: ['金','木','水','火','土'], weight: 1/5 },
  { id: 'element_markov', name: '五行-马尔可夫', desc: '五行转移概率分析', fn: elementMarkovModel, cats: ['金','木','水','火','土'], weight: 1/5 },
  { id: 'element_trend', name: '五行-趋势分析', desc: '五行隔期重复模式', fn: elementTrendModel, cats: ['金','木','水','火','土'], weight: 1/5 },
  { id: 'element_pattern', name: '五行-周期分析', desc: '五行遗漏与平均间隔对比', fn: elementPatternModel, cats: ['金','木','水','火','土'], weight: 1/5 },
  { id: 'element_combo', name: '五行-综合融合', desc: '五行频率+马尔可夫融合', fn: elementComboModel, cats: ['金','木','水','火','土'], weight: 1/5 },
];

numberModels.forEach(m => {
  modelRegistry.register({
    id: m.id, name: m.name, desc: m.desc,
    outputType: 'number_array',
    predict: m.fn,
    defaultWeight: m.weight,
  });
});

categoryModels.forEach(m => {
  modelRegistry.register({
    id: m.id, name: m.name, desc: m.desc,
    outputType: 'category_map',
    predict: m.fn,
    defaultWeight: m.weight,
    categories: m.cats,
  });
});

export { modelRegistry };
