import moment from 'moment-timezone';

/**
 * Parse a date string or use today if not provided
 */
export function parseTargetDate(dateStr?: string): moment.Moment {
  if (!dateStr) {
    return moment();
  }

  const parsed = moment(dateStr);
  if (!parsed.isValid()) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }

  return parsed;
}

/**
 * Format date for display
 */
export function formatDate(date: Date): string {
  return moment(date).format('YYYY-MM-DD');
}

/**
 * Format datetime for display with time
 */
export function formatDateTime(dateTime: string | Date): string {
  return moment(dateTime).format('YYYY-MM-DD HH:mm:ss');
}
