/**
 * Parse a date string or use today if not provided
 */
export function parseTargetDate(dateStr?: string): Date {
  if (!dateStr) {
    return new Date();
  }

  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }

  return parsed;
}

/**
 * Combine a template time (from original entry) with a new target date
 * Preserves the time portion from the template, replaces the date portion with target
 * Also preserves day offset (e.g., if template spans to next day)
 */
export function combineDateTime(
  templateDateTime: string,
  targetDate: Date,
  templateStartDateTime?: string
): string {
  const templateDate = new Date(templateDateTime);

  // If we have a start date, calculate the day offset
  let dayOffset = 0;
  if (templateStartDateTime) {
    const templateStart = new Date(templateStartDateTime);
    const templateCurrent = new Date(templateDateTime);

    // Calculate how many days apart they are (ignoring time)
    const startDay = new Date(
      templateStart.getFullYear(),
      templateStart.getMonth(),
      templateStart.getDate()
    );
    const currentDay = new Date(
      templateCurrent.getFullYear(),
      templateCurrent.getMonth(),
      templateCurrent.getDate()
    );

    dayOffset = Math.round((currentDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Create new date with target year/month/day (plus offset) but template time
  const combined = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate() + dayOffset,
    templateDate.getHours(),
    templateDate.getMinutes(),
    templateDate.getSeconds(),
    templateDate.getMilliseconds()
  );

  return combined.toISOString();
}

/**
 * Format date for display
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format datetime for display with time
 */
export function formatDateTime(dateTime: string | Date): string {
  const date = typeof dateTime === 'string' ? new Date(dateTime) : dateTime;
  return date.toISOString().replace('T', ' ').substring(0, 19);
}
