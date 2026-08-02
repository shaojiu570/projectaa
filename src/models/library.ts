import { DrawRecord } from '../data/types';
import { ALGO_FACTORIES, PREDEFINED_ALGOS } from './dynamic';
import { getZodiacByNumber } from '../utils/lunarCalendar';
import { getElement } from '../constants/element';
import type { SeparatedModelType } from '../stores/SeparatedModelContext';

/**
 * 统一算法模型库 —— 整个系统（智能预测/动态预测/自动发送脚本）唯一数据源。
 * 仅包含通用算法，可预测任意分类类型（号码/生肖/头/尾/五行）。
 */

export type UnifiedPredictFn = (data: DrawRecord[], seed: number) => Record<string, number> | number[];

export interface UnifiedModelInfo {
  id: string;
  name: string;
  desc: string;
  kind: 'generic' | 'specific';
  outputType: 'number_array' | 'category_map' | 'adaptive';
  defaultWeight: number;
  specificTypes?: SeparatedModelType[];
}

// ==================== 类别元数据 ====================

export const NUMBER_CATS = Array.from({ length: 49 }, (_, i) => String(i + 1));
export const ZODIAC_CATS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
export const HEAD_CATS = ['0头', '1头', '2头', '3头', '4头'];
export const TAIL_CATS = ['0尾', '1尾', '2尾', '3尾', '4尾', '5尾', '6尾', '7尾', '8尾', '9尾'];
export const ELEMENT_CATS = ['金', '木', '水', '火', '土'];

export interface SepTypeMeta {
  type: SeparatedModelType;
  categories: string[];
  getCat: (n: number) => string;
}

export const SEPARATED_TYPE_META: Record<SeparatedModelType, SepTypeMeta> = {
  number: {
    type: 'number',
    categories: NUMBER_CATS,
    getCat: n => String(n),
  },
  zodiac: {
    type: 'zodiac',
    categories: ZODIAC_CATS,
    getCat: n => getZodiacByNumber(new Date(), n),
  },
  head: {
    type: 'head',
    categories: HEAD_CATS,
    getCat: n => `${Math.floor((n - 1) / 10)}头`,
  },
  tail: {
    type: 'tail',
    categories: TAIL_CATS,
    getCat: n => `${n % 10}尾`,
  },
  element: {
    type: 'element',
    categories: ELEMENT_CATS,
    getCat: n => getElement(n, new Date().getFullYear()),
  },
};

// ==================== 统一模型清单 ====================

// 通用算法：可预测任意分类类型（号码/生肖/头/尾/五行等）
export const GENERIC_ALGOS: UnifiedModelInfo[] = PREDEFINED_ALGOS.map(a => ({
  id: a.id,
  name: a.name,
  desc: '通用算法·可预测任意分类',
  kind: 'generic',
  outputType: 'adaptive',
  defaultWeight: 0.1,
}));

export const ALL_UNIFIED_MODELS: UnifiedModelInfo[] = GENERIC_ALGOS;

export const GENERIC_ALGO_IDS = Object.keys(ALGO_FACTORIES);

export const GENERIC_ALGO_NAMES: Record<string, string> = Object.fromEntries(
  PREDEFINED_ALGOS.map(a => [a.id, a.name]),
);

export function isGenericAlgo(modelId: string): boolean {
  return GENERIC_ALGO_IDS.includes(modelId);
}

/** 获取某类型可用的统一模型列表 */
export function getUnifiedModels(type: SeparatedModelType): UnifiedModelInfo[] {
  return ALL_UNIFIED_MODELS.filter(m => m.kind === 'generic' || m.specificTypes?.includes(type));
}

/** 解析某类型下任意模型 id 为预测函数（仅通用算法） */
export function resolveUnifiedModelFn(type: SeparatedModelType, modelId: string): UnifiedPredictFn {
  const meta = SEPARATED_TYPE_META[type];
  const factory = ALGO_FACTORIES[modelId];
  if (factory) {
    const algoFn = factory(meta.categories, meta.getCat);
    if (type === 'number') {
      return (data, seed) => {
        const probs = algoFn(data, seed);
        const arr = new Array(49).fill(0);
        for (let i = 1; i <= 49; i++) arr[i - 1] = probs[String(i)] || 0;
        return arr;
      };
    }
    return algoFn;
  }
  throw new Error(`未知模型: ${modelId} (${type})`);
}
