import { BadRequestException } from '@nestjs/common';

const BUSINESS_TIME_ZONE = 'Asia/Taipei';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function getBusinessDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function assertBusinessDate(value: string): string {
  if (!DATE_PATTERN.test(value)) {
    throw new Error('Business date must use YYYY-MM-DD');
  }

  return value;
}

export function resolveBusinessDate(value?: string): string {
  return value ? assertBusinessDate(value) : getBusinessDate();
}

export function resolveCurrentBusinessDate(value?: string): string {
  const businessDate = resolveBusinessDate(value);
  const currentBusinessDate = getBusinessDate();

  if (businessDate !== currentBusinessDate) {
    throw new BadRequestException(`Only current business date ${currentBusinessDate} is allowed.`);
  }

  return businessDate;
}
