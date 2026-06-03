import { DrawRecord } from '../data/types';

export function calculateNextIssue(lastRecord: DrawRecord): string {
  if (!lastRecord) return '';

  if ('issue' in lastRecord && typeof lastRecord.issue === 'string') {
    const currentIssueNum = parseInt(lastRecord.issue);
    const nextIssueNum = currentIssueNum + 1;
    return String(nextIssueNum).padStart(3, '0');
  }

  const issueStr = lastRecord.issue.slice(-3);
  const currentIssueNum = parseInt(issueStr);
  const nextIssueNum = currentIssueNum + 1;
  return String(nextIssueNum).padStart(3, '0');
}

export function calculateNextDate(lastDate: string): string {
  const last = new Date(lastDate);
  const next = new Date(last);
  next.setDate(last.getDate() + 1);
  return next.toISOString().split('T')[0];
}
