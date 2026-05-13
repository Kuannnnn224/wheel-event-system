import { Tag } from 'antd';

interface ProbabilityTableTagProps {
  value?: 'low' | 'high' | 'prize' | 'dailyLimit' | string | null;
  suffix?: string;
}

export default function ProbabilityTableTag({ value, suffix }: ProbabilityTableTagProps) {
  const normalized = value?.toLowerCase();

  if (normalized === 'prize') {
    return <Tag color="magenta">PRIZE{suffix}</Tag>;
  }

  if (normalized === 'dailylimit') {
    return <Tag color="gold">DAILY LIMIT{suffix}</Tag>;
  }

  if (normalized === 'high') {
    return <Tag color="cyan">HIGH{suffix}</Tag>;
  }

  if (normalized === 'low') {
    return <Tag color="blue">LOW{suffix}</Tag>;
  }

  return <Tag>{value?.toUpperCase?.() ?? '-'}{suffix}</Tag>;
}
