import { DrawRecord } from '../data/types';
import { LotteryRecord } from './crawler';

export async function syncFromBackend(): Promise<DrawRecord[]> {
  try {
    const response = await fetch('http://localhost:3001/api/data/export?format=json');
    const result = await response.json();

    if (result.success && Array.isArray(result.data)) {
      const backendData: LotteryRecord[] = result.data;
      const convertedData: DrawRecord[] = backendData.map(record => {
        let issue = record.Issue || `${record.Year}${String(record.Date).slice(5, 7).replace('-', '')}${String(record.Date).slice(8, 10)}`;
        return {
          issue: issue,
          date: record.Date,
          normals: [record.Num1, record.Num2, record.Num3, record.Num4, record.Num5, record.Num6],
          special: record.Special,
        };
      });
      return convertedData;
    }
    return [];
  } catch (error) {
    console.error('同步后端数据失败:', error);
    return [];
  }
}
