import { NotionClientWrapper } from './notion-client';
import { Config } from './types';

/**
 * Purge mode: Delete all entries from the time blocks database
 */
export async function runPurgeMode(config: Config, confirmed: boolean): Promise<void> {
  console.log('Running purge mode...');
  console.log(`Time Blocks Database ID: ${config.timeBlocksDatabase}`);

  if (!confirmed) {
    console.log('\n⚠️  WARNING: This will delete ALL entries from the time blocks database!');
    console.log('   To confirm, run with: --purge --confirm');
    console.log('\nAborting...');
    return;
  }

  const client = new NotionClientWrapper(config);

  // Fetch all pages from the time blocks database
  console.log('\nFetching all time blocks...');
  const pages = await client.getAllPages(config.timeBlocksDatabase);

  if (pages.length === 0) {
    console.log('No time blocks found. Database is already empty.');
    return;
  }

  console.log(`Found ${pages.length} time blocks to delete`);
  console.log('\nDeleting time blocks...');

  let deleted = 0;
  let failed = 0;

  for (const page of pages) {
    try {
      // Extract title for logging
      const title = extractTitle(page);

      console.log(`  Deleting: ${title}`);
      await client.deletePage(page.id);
      deleted++;
      console.log(`  ✓ Deleted`);

      // Small delay to respect rate limits
      if (deleted + failed < pages.length) {
        await delay(350);
      }
    } catch (error) {
      failed++;
      console.error(`  ✗ Failed to delete page ${page.id}:`);
      if (error instanceof Error) {
        console.error(`     Error: ${error.message}`);
      } else {
        console.error(`     Error:`, error);
      }
    }
  }

  console.log(`\n✓ Purge complete: ${deleted} deleted, ${failed} failed`);
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
 * Simple delay utility
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
