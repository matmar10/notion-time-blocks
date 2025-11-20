import fs from 'fs/promises';
import yaml from 'js-yaml';
import moment from 'moment-timezone';
import type pino from 'pino';
import { NotionClientWrapper } from './notion-client';
import { Config, SavedTemplates } from './types';
import { formatDate, formatDateTime } from './date-utils';

/**
 * Scheduled mode: Create time blocks for a specific date
 */
export async function runScheduledMode(config: Config, targetDate: moment.Moment, dayFilter: string | undefined, logger: pino.Logger): Promise<void> {
  logger.info('Running scheduled mode...');

  const today = moment();
  const isToday = targetDate.isSame(today, 'day');
  const dateDisplay = isToday ? `${formatDate(targetDate.toDate())} (today)` : formatDate(targetDate.toDate());

  logger.debug(`Target date: ${dateDisplay}`);
  if (dayFilter) {
    logger.debug(`Day filter: ${dayFilter}`);
  }
  logger.debug(`Time Blocks Database ID: ${config.timeBlocksDatabase}`);

  // Load templates
  logger.debug('Loading templates...');
  const templatesContent = await fs.readFile(config.templatesFilePath, 'utf-8');
  const savedTemplates = yaml.load(templatesContent) as SavedTemplates;

  if (!savedTemplates.templates || savedTemplates.templates.length === 0) {
    throw new Error('No templates found. Run with --init first to create templates.');
  }

  logger.debug(`Found ${savedTemplates.templates.length} templates`);

  // Find the reference date (earliest date across all templates)
  const referenceDate = findReferenceDate(savedTemplates.templates);
  logger.debug(`Reference date: ${referenceDate.format('YYYY-MM-DD')}`);

  // Sort templates by start time (ascending order)
  const sortedTemplates = sortTemplatesByStartTime(savedTemplates.templates);
  logger.debug('Templates sorted by start time');

  // Filter templates by day if specified
  let templatesToCreate = sortedTemplates;
  if (dayFilter) {
    templatesToCreate = filterTemplatesByDay(sortedTemplates, dayFilter);
    logger.debug(`Filtered to ${templatesToCreate.length} templates matching day: ${dayFilter}`);

    if (templatesToCreate.length === 0) {
      logger.warn('No templates found matching the specified day filter.');
      logger.info('Exiting without creating any time blocks.');
      return;
    }
  }

  const client = new NotionClientWrapper(config, logger);

  // Extract Day values from templates and ensure they exist in the schema
  const dayValues = extractDayValues(templatesToCreate);
  await ensureDayOptionsExist(client, config.timeBlocksDatabase, dayValues, logger);

  // Create entries in the time blocks database for each template (serially)
  logger.debug('Creating time blocks in time blocks database (in order)...');
  let created = 0;

  for (const template of templatesToCreate) {
    // Log what we're about to create
    logger.debug(`Creating: ${template.title}`);

    const updatedProperties = updatePropertiesForDate(
      template.properties,
      targetDate,
      referenceDate,
      logger
    );

    // Log date range for debugging
    logDateRange(template.properties, updatedProperties, logger);

    await client.createPage(config.timeBlocksDatabase, updatedProperties);
    created++;
    logger.trace('Successfully created');

    // Small delay to respect rate limits (always delay between requests)
    await delay(350);
  }

  logger.info(`Created ${created} of ${templatesToCreate.length} time blocks`);
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
  targetDate: moment.Moment,
  referenceDate: moment.Moment,
  logger: pino.Logger
): Record<string, any> {
  const updated: Record<string, any> = {};

  const tz = moment.tz.guess();

  for (const [key, value] of Object.entries(properties)) {
    // Skip read-only metadata fields
    if (!value || typeof value !== 'object') {
      continue;
    }

    // Handle date properties (like "When" column)
    if (value.type === 'date' && value.date) {
      const start = moment(value.date.start);
      const end = moment(value.date.end);

      const newStart = combineDateTimeWithReference(start, targetDate, referenceDate, logger);
      const newEnd = combineDateTimeWithReference(end, targetDate, referenceDate, logger);
      logger.trace({
        newStart: newStart.format(),
        newStartISO: newStart.toISOString(),
        newEnd: newEnd.format(),
        newEndISO: newEnd.toISOString(),
      }, 'Date calculation result');

      // Validate that start is before end
      if (newStart && newEnd) {
        if (newStart.isSameOrAfter(newEnd)) {
          logger.warn(
            `Warning: Invalid date range detected for property "${key}"`
          );
          logger.warn(`Start: ${newStart}`);
          logger.warn(`End: ${newEnd}`);
          logger.warn('Skipping this property to avoid error');
          continue; // Skip this property
        }
      }

      const newStartUTC= newStart.utc(true);
      const newEndUTC = newEnd.utc(true);

      const date = {
        start: newStartUTC.toISOString(),
        end: newEndUTC.toISOString(),
        time_zone: tz,
      };

      updated[key] = { date };
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
      // Select property - only send the name, not the full object with ID
      updated[key] = {
        select: value.select?.name ? { name: value.select.name } : null,
      };
    } else if (value.type === 'multi_select') {
      // Multi-select property - only send the names, not the full objects with IDs
      updated[key] = {
        multi_select: (value.multi_select || []).map((option: any) => ({
          name: option.name
        })),
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
      // Relation property - only send IDs, not full objects
      updated[key] = {
        relation: (value.relation || []).map((rel: any) => ({
          id: rel.id
        })),
      };
    } else if (value.type === 'people') {
      // People property - only send IDs, not full user objects
      updated[key] = {
        people: (value.people || []).map((person: any) => ({
          id: person.id
        })),
      };
    } else if (value.type === 'files') {
      // Files property - only send required file structure
      updated[key] = {
        files: (value.files || []).map((file: any) => {
          if (file.type === 'external') {
            return {
              name: file.name,
              external: { url: file.external.url }
            };
          } else {
            // For uploaded files, we can only keep the name
            // Note: We can't re-upload files, so this might not work as expected
            return file;
          }
        }),
      };
    } else if (value.type === 'status') {
      // Status property - only send the name, not the full object with ID
      updated[key] = {
        status: value.status?.name ? { name: value.status.name } : null,
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
  updatedProperties: Record<string, any>,
  logger: pino.Logger
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

        logger.trace(`Property: ${key}`);
        if (originalStart && newStart) {
          logger.trace(`Template start: ${formatDateTime(originalStart)}`);
          logger.trace(`New start:      ${formatDateTime(newStart)}`);
        }
        if (originalEnd && newEnd) {
          logger.trace(`Template end:   ${formatDateTime(originalEnd)}`);
          logger.trace(`New end:        ${formatDateTime(newEnd)}`);
        }
      }
    }
  }
}

/**
 * Find the reference date (earliest date) across all templates
 * This is used as the base to calculate day offsets
 * Returns the earliest date found, or the start of today if no dates exist
 */
function findReferenceDate(templates: any[]): moment.Moment {
  let earliest: moment.Moment | null = null;

  for (const template of templates) {
    for (const [, value] of Object.entries(template.properties)) {
      const prop = value as any;
      if (prop && typeof prop === 'object' && prop.type === 'date' && prop.date) {
        if (prop.date.start) {
          const startDate = moment(prop.date.start);
          if (!earliest || startDate.isBefore(earliest)) {
            earliest = startDate;
          }
        }
        if (prop.date.end) {
          const endDate = moment(prop.date.end);
          if (!earliest || endDate.isBefore(earliest)) {
            earliest = endDate;
          }
        }
      }
    }
  }

  // Return earliest found date, or start of today if none found
  return earliest || moment().startOf('day');
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

    return moment(aStart).diff(moment(bStart));
  });
}

/**
 * Filter templates by Day property (case-insensitive)
 */
function filterTemplatesByDay(templates: any[], dayFilter: string): any[] {
  const normalizedFilter = dayFilter.toLowerCase().trim();

  return templates.filter((template) => {
    // Look for a "Day" property in the template
    for (const [key, value] of Object.entries(template.properties)) {
      const prop = value as any;

      // Check if this is a select property named "Day"
      if (prop && typeof prop === 'object' &&
          key.toLowerCase() === 'day' &&
          prop.type === 'select' &&
          prop.select?.name) {
        const dayValue = prop.select.name.toLowerCase().trim();
        return dayValue === normalizedFilter;
      }

      // Also check multi_select in case Day is configured as multi-select
      if (prop && typeof prop === 'object' &&
          key.toLowerCase() === 'day' &&
          prop.type === 'multi_select' &&
          Array.isArray(prop.multi_select)) {
        return prop.multi_select.some((option: any) =>
          option.name?.toLowerCase().trim() === normalizedFilter
        );
      }
    }

    return false;
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
  templateDate: moment.Moment,
  targetDate: moment.Moment,
  referenceDate: moment.Moment,
  logger: pino.Logger
): moment.Moment {
  logger.trace(`RAW TEMPLATE DATE: ${templateDate.format()}`);
  logger.trace(`RAW TARGET DATE: ${targetDate.format()}`);
  logger.trace(`RAW REFERENCE DATE: ${referenceDate.format()}`);

  const templateDay = templateDate.clone().startOf('day');
  logger.trace(`TEMPLATE DAY: ${templateDay.format()}`);
  const refDay = referenceDate.clone().startOf('day');
  logger.trace(`REFERENCE DAY: ${refDay.format()}`);
  const targetDay = targetDate.clone().startOf('day');
  logger.trace(`TARGET DAY: ${targetDay.format()}`);

  // Calculate how many days after the reference date this template datetime is
  const dayOffset = templateDay.diff(refDay, 'days');
  logger.trace(`DAY OFFSET: ${dayOffset}`);

  logger.trace({
    hour: templateDate.hour(),
    minute: templateDate.minute(),
    second: templateDate.second(),
    millisecond: templateDate.millisecond(),
  }, 'TEMPLATE DATE');

  // Create new date with target year/month/day (plus offset) but template time
  return targetDay.clone()
    .add(dayOffset, 'days')
    .hour(templateDate.hour())
    .minute(templateDate.minute())
    .seconds(templateDate.seconds())
    .milliseconds(templateDate.milliseconds());
}

/**
 * Extract all unique Day values from templates
 */
function extractDayValues(templates: any[]): string[] {
  const dayValues = new Set<string>();

  for (const template of templates) {
    for (const [key, value] of Object.entries(template.properties)) {
      const prop = value as any;

      // Check for select property named "Day"
      if (prop && typeof prop === 'object' &&
          key.toLowerCase() === 'day' &&
          prop.type === 'select' &&
          prop.select?.name) {
        dayValues.add(prop.select.name);
      }

      // Check for multi_select property named "Day"
      if (prop && typeof prop === 'object' &&
          key.toLowerCase() === 'day' &&
          prop.type === 'multi_select' &&
          Array.isArray(prop.multi_select)) {
        prop.multi_select.forEach((option: any) => {
          if (option.name) {
            dayValues.add(option.name);
          }
        });
      }
    }
  }

  return Array.from(dayValues);
}

/**
 * Ensure Day select options exist in the database schema
 * If missing, update the schema to add them
 */
async function ensureDayOptionsExist(
  client: NotionClientWrapper,
  databaseId: string,
  dayValues: string[],
  logger: pino.Logger
): Promise<void> {
  if (dayValues.length === 0) {
    return; // No Day values to check
  }

  logger.debug('Checking Day select options in database schema...');

  // Get current database schema
  const schema = await client.getDatabaseSchema(databaseId);

  // Find the Day property in the schema
  let dayProperty: any = null;
  let dayPropertyName: string | null = null;

  for (const [propertyName, propertyConfig] of Object.entries(schema.properties)) {
    const config = propertyConfig as any;
    if (propertyName.toLowerCase() === 'day' &&
        (config.type === 'select' || config.type === 'multi_select')) {
      dayProperty = config;
      dayPropertyName = propertyName;
      break;
    }
  }

  if (!dayProperty || !dayPropertyName) {
    logger.warn('Warning: No "Day" select/multi_select property found in database schema.');
    logger.warn('Day values in templates will be skipped.');
    return;
  }

  // Get existing options from the schema
  const existingOptions = dayProperty.type === 'select'
    ? (dayProperty.select?.options || [])
    : (dayProperty.multi_select?.options || []);

  const existingOptionNames = new Set(
    existingOptions.map((opt: any) => opt.name)
  );

  // Find missing options
  const missingOptions = dayValues.filter(
    (value) => !existingOptionNames.has(value)
  );

  if (missingOptions.length === 0) {
    logger.debug('All Day options already exist in schema');
    return;
  }

  logger.debug(`Found ${missingOptions.length} missing Day option(s): ${missingOptions.join(', ')}`);
  logger.debug('Adding missing options to database schema...');

  // Create new options to add
  const newOptions = missingOptions.map((name) => ({
    name,
    color: 'default' as const,
  }));

  // Combine existing and new options
  const allOptions = [...existingOptions, ...newOptions];

  // Update the schema
  const propertyUpdate = dayProperty.type === 'select'
    ? { select: { options: allOptions } }
    : { multi_select: { options: allOptions } };

  await client.updateDatabaseSchema(databaseId, {
    [dayPropertyName]: propertyUpdate,
  });

  logger.debug('Successfully added missing Day options to schema');
}

/**
 * Simple delay utility
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
