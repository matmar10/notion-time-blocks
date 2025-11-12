import fs from 'fs/promises';
import yaml from 'js-yaml';
import { NotionClientWrapper } from './notion-client';
import { Config, SavedTemplates } from './types';
import { combineDateTime, formatDate, formatDateTime } from './date-utils';

/**
 * Scheduled mode: Create time blocks for a specific date
 */
export async function runScheduledMode(config: Config, targetDate: Date): Promise<void> {
  console.log('Running scheduled mode...');

  const today = new Date();
  const isToday = formatDate(targetDate) === formatDate(today);
  const dateDisplay = isToday ? `${formatDate(targetDate)} (today)` : formatDate(targetDate);

  console.log(`Target date: ${dateDisplay}`);
  console.log(`Time Blocks Database ID: ${config.timeBlocksDatabase}`);

  // Load templates
  console.log('\nLoading templates...');
  const templatesContent = await fs.readFile(config.templatesFilePath, 'utf-8');
  const savedTemplates = yaml.load(templatesContent) as SavedTemplates;

  if (!savedTemplates.templates || savedTemplates.templates.length === 0) {
    throw new Error('No templates found. Run with --init first to create templates.');
  }

  console.log(`Found ${savedTemplates.templates.length} templates`);

  // Find the reference date (earliest date across all templates)
  const referenceDate = findReferenceDate(savedTemplates.templates);
  if (referenceDate) {
    console.log(`Reference date: ${formatDate(referenceDate)}`);
  }

  // Sort templates by start time (ascending order)
  const sortedTemplates = sortTemplatesByStartTime(savedTemplates.templates);
  console.log('Templates sorted by start time');

  const client = new NotionClientWrapper(config);

  // Create entries in the time blocks database for each template (serially)
  console.log('\nCreating time blocks in time blocks database (in order)...');
  let created = 0;

  for (const template of sortedTemplates) {
    try {
      // Log what we're about to create
      console.log(`\n  Creating: ${template.title}`);

      const updatedProperties = updatePropertiesForDate(
        template.properties,
        targetDate,
        referenceDate
      );

      // Log date range for debugging
      logDateRange(template.properties, updatedProperties);

      await client.createPage(config.timeBlocksDatabase, updatedProperties);
      created++;
      console.log(`  ✓ Successfully created`);

      // Small delay to respect rate limits (always delay between requests)
      await delay(350);
    } catch (error) {
      console.error(`  ✗ Failed to create ${template.title}:`);
      if (error instanceof Error) {
        console.error(`     Error: ${error.message}`);
      } else {
        console.error(`     Error:`, error);
      }
    }
  }

  console.log(`\n✓ Created ${created} of ${sortedTemplates.length} time blocks`);
}

/**
 * Update properties to use the new target date
 * Focuses on updating date/datetime properties
 *
 * Note: When creating pages, we must NOT include 'type' or 'id' fields.
 * Only send the value portion of each property.
 */
function updatePropertiesForDate(
  properties: Record<string, any>,
  targetDate: Date,
  referenceDate: Date | null
): Record<string, any> {
  const updated: Record<string, any> = {};

  for (const [key, value] of Object.entries(properties)) {
    // Skip read-only metadata fields
    if (!value || typeof value !== 'object') {
      continue;
    }

    // Handle date properties (like "When" column)
    if (value.type === 'date' && value.date) {
      const start = value.date.start;
      const end = value.date.end;

      const newStart = start
        ? combineDateTimeWithReference(start, targetDate, referenceDate)
        : null;
      const newEnd = end
        ? combineDateTimeWithReference(end, targetDate, referenceDate)
        : null;

      // Validate that start is before end
      if (newStart && newEnd) {
        const startTime = new Date(newStart).getTime();
        const endTime = new Date(newEnd).getTime();

        if (startTime >= endTime) {
          console.warn(
            `    ⚠ Warning: Invalid date range detected for property "${key}"`
          );
          console.warn(`       Start: ${formatDateTime(newStart)}`);
          console.warn(`       End: ${formatDateTime(newEnd)}`);
          console.warn(`       Skipping this property to avoid error`);
          continue; // Skip this property
        }
      }

      updated[key] = {
        date: {
          start: newStart,
          end: newEnd,
          time_zone: value.date.time_zone || null,
        },
      };
    } else if (value.type === 'title') {
      // Title property - only send the title array
      updated[key] = {
        title: value.title || [],
      };
    } else if (value.type === 'rich_text') {
      // Rich text property
      updated[key] = {
        rich_text: value.rich_text || [],
      };
    } else if (value.type === 'number') {
      // Number property
      updated[key] = {
        number: value.number,
      };
    } else if (value.type === 'select') {
      // Select property
      updated[key] = {
        select: value.select,
      };
    } else if (value.type === 'multi_select') {
      // Multi-select property
      updated[key] = {
        multi_select: value.multi_select || [],
      };
    } else if (value.type === 'checkbox') {
      // Checkbox property
      updated[key] = {
        checkbox: value.checkbox || false,
      };
    } else if (value.type === 'url') {
      // URL property
      updated[key] = {
        url: value.url,
      };
    } else if (value.type === 'email') {
      // Email property
      updated[key] = {
        email: value.email,
      };
    } else if (value.type === 'phone_number') {
      // Phone number property
      updated[key] = {
        phone_number: value.phone_number,
      };
    } else if (value.type === 'relation') {
      // Relation property
      updated[key] = {
        relation: value.relation || [],
      };
    } else if (value.type === 'people') {
      // People property
      updated[key] = {
        people: value.people || [],
      };
    } else if (value.type === 'files') {
      // Files property
      updated[key] = {
        files: value.files || [],
      };
    } else if (value.type === 'status') {
      // Status property
      updated[key] = {
        status: value.status,
      };
    }
    // Note: We skip formula, rollup, created_time, created_by, last_edited_time, last_edited_by
    // as these are read-only/computed properties
  }

  return updated;
}

/**
 * Log date ranges for debugging
 */
function logDateRange(
  originalProperties: Record<string, any>,
  updatedProperties: Record<string, any>
): void {
  // Find date properties and log them
  for (const [key, value] of Object.entries(originalProperties)) {
    if (value?.type === 'date' && value.date) {
      const originalStart = value.date.start;
      const originalEnd = value.date.end;

      const updated = updatedProperties[key];
      if (updated?.date) {
        const newStart = updated.date.start;
        const newEnd = updated.date.end;

        console.log(`     Property: ${key}`);
        if (originalStart && newStart) {
          console.log(`       Template start: ${formatDateTime(originalStart)}`);
          console.log(`       New start:      ${formatDateTime(newStart)}`);
        }
        if (originalEnd && newEnd) {
          console.log(`       Template end:   ${formatDateTime(originalEnd)}`);
          console.log(`       New end:        ${formatDateTime(newEnd)}`);
        }
      }
    }
  }
}

/**
 * Find the reference date (earliest date) across all templates
 * This is used as the base to calculate day offsets
 */
function findReferenceDate(templates: any[]): Date | null {
  let earliest: Date | null = null;

  for (const template of templates) {
    for (const [, value] of Object.entries(template.properties)) {
      const prop = value as any;
      if (prop && typeof prop === 'object' && prop.type === 'date' && prop.date) {
        if (prop.date.start) {
          const startDate = new Date(prop.date.start);
          if (!earliest || startDate < earliest) {
            earliest = startDate;
          }
        }
        if (prop.date.end) {
          const endDate = new Date(prop.date.end);
          if (!earliest || endDate < earliest) {
            earliest = endDate;
          }
        }
      }
    }
  }

  return earliest;
}

/**
 * Sort templates by their start time (ascending order)
 */
function sortTemplatesByStartTime(templates: any[]): any[] {
  return [...templates].sort((a, b) => {
    const aStart = getTemplateStartTime(a);
    const bStart = getTemplateStartTime(b);

    if (!aStart && !bStart) return 0;
    if (!aStart) return 1;
    if (!bStart) return -1;

    return aStart.getTime() - bStart.getTime();
  });
}

/**
 * Get the start time from a template (first date property with a start time)
 */
function getTemplateStartTime(template: any): Date | null {
  for (const [, value] of Object.entries(template.properties)) {
    const prop = value as any;
    if (prop && typeof prop === 'object' && prop.type === 'date' && prop.date?.start) {
      return new Date(prop.date.start);
    }
  }
  return null;
}

/**
 * Combine a template datetime with a target date, using reference date to calculate day offset
 */
function combineDateTimeWithReference(
  templateDateTime: string,
  targetDate: Date,
  referenceDate: Date | null
): string {
  const templateDate = new Date(templateDateTime);

  // Calculate day offset from reference date
  let dayOffset = 0;
  if (referenceDate) {
    // Strip time components to get just the date
    const refDay = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate()
    );
    const templateDay = new Date(
      templateDate.getFullYear(),
      templateDate.getMonth(),
      templateDate.getDate()
    );

    // Calculate how many days after the reference date this template datetime is
    dayOffset = Math.round((templateDay.getTime() - refDay.getTime()) / (1000 * 60 * 60 * 24));
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
 * Simple delay utility
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
