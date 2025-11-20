import moment from 'moment-timezone';
import type pino from 'pino';
import { NotionClientWrapper } from './notion-client';
import { Config } from './types';
import { formatDate } from './date-utils';

/**
 * Purge mode: Delete entries from the time blocks database
 * If targetDate is provided, only delete entries for that date
 * Otherwise, delete all entries
 */
export async function runPurgeMode(config: Config, confirmed: boolean, targetDate: moment.Moment | undefined, logger: pino.Logger): Promise<void> {
  logger.info('Running purge mode...');
  logger.debug(`Time Blocks Database ID: ${config.timeBlocksDatabase}`);

  if (targetDate) {
    logger.debug(`Target date: ${formatDate(targetDate.toDate())}`);
  }

  if (!confirmed) {
    if (targetDate) {
      logger.warn(`WARNING: This will delete time blocks for ${formatDate(targetDate.toDate())}!`);
    } else {
      logger.warn('WARNING: This will delete ALL entries from the time blocks database!');
    }
    logger.info('To confirm, run with: --purge --confirm');
    logger.info('Aborting...');
    return;
  }

  const client = new NotionClientWrapper(config, logger);

  // Fetch all pages from the time blocks database
  logger.debug('Fetching all time blocks...');
  const allPages = await client.getAllPages(config.timeBlocksDatabase);

  if (allPages.length === 0) {
    logger.info('No time blocks found. Database is already empty.');
    return;
  }

  // Filter pages by target date if specified
  const pages = targetDate
    ? filterPagesByDate(allPages, targetDate)
    : allPages;

  if (pages.length === 0) {
    if (targetDate) {
      logger.info(`No time blocks found for ${formatDate(targetDate.toDate())}.`);
    } else {
      logger.info('No time blocks found. Database is already empty.');
    }
    return;
  }

  if (targetDate) {
    logger.debug(`Found ${pages.length} time blocks to delete for ${formatDate(targetDate.toDate())} (out of ${allPages.length} total)`);
  } else {
    logger.debug(`Found ${pages.length} time blocks to delete`);
  }
  logger.debug('Deleting time blocks...');

  let deleted = 0;
  let failed = 0;

  for (const page of pages) {
    try {
      // Extract title for logging
      const title = extractTitle(page);

      logger.debug(`Deleting: ${title}`);
      await client.deletePage(page.id);
      deleted++;
      logger.trace('Deleted');

      // Small delay to respect rate limits
      if (deleted + failed < pages.length) {
        await delay(350);
      }
    } catch (error) {
      failed++;
      logger.error(`Failed to delete page ${page.id}:`);
      if (error instanceof Error) {
        logger.error(`Error: ${error.message}`);
      } else {
        logger.error({ error }, 'Error');
      }
    }
  }

  logger.info(`Purge complete: ${deleted} deleted, ${failed} failed`);
}

/**
 * Extract title from a page for logging
 */
function extractTitle(page: any): string {
  try {
    for (const [, value] of Object.entries(page.properties)) {
      const prop = value as any;
      if (prop?.type === 'title' && prop.title && prop.title.length > 0) {
        return prop.title.map((t: any) => t.plain_text).join('');
      }
    }
  } catch {
    // Ignore errors
  }
  return page.id.substring(0, 8) + '...';
}

/**
 * Filter pages to only include those matching the target date
 * Checks the "When" property's start date
 */
function filterPagesByDate(pages: any[], targetDate: moment.Moment): any[] {
  const targetDay = targetDate.clone().startOf('day');

  return pages.filter((page) => {
    try {
      // Look for date properties (like "When")
      for (const [, value] of Object.entries(page.properties)) {
        const prop = value as any;
        if (prop?.type === 'date' && prop.date?.start) {
          const startDate = moment(prop.date.start).startOf('day');
          if (startDate.isSame(targetDay)) {
            return true;
          }
        }
      }
    } catch {
      // If there's an error parsing the date, don't include this page
    }
    return false;
  });
}

/**
 * Simple delay utility
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
