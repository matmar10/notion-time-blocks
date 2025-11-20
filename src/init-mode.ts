import fs from 'fs/promises';
import yaml from 'js-yaml';
import type pino from 'pino';
import { NotionClientWrapper } from './notion-client';
import { Config, SavedSchema, SavedTemplates, TemplateTimeBlock } from './types';
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

/**
 * Initialize mode: Save database schema and templates
 */
export async function runInitMode(config: Config, logger: pino.Logger): Promise<void> {
  logger.info('Running init mode...');
  logger.debug(`Templates Database ID: ${config.templatesDatabase}`);

  const client = new NotionClientWrapper(config, logger);

  // Step 1: Fetch and save database schema from templates database
  logger.debug('Fetching templates database schema...');
  const schema = await client.getDatabaseSchema(config.templatesDatabase);
  const savedSchema: SavedSchema = {
    database: schema,
    savedAt: new Date().toISOString(),
  };

  await fs.writeFile(
    config.schemaFilePath,
    JSON.stringify(savedSchema, null, 2),
    'utf-8'
  );
  logger.debug(`Schema saved to: ${config.schemaFilePath}`);

  // Step 2: Fetch and save all pages from templates database
  logger.debug('Fetching template entries from templates database...');
  const pages = await client.getAllPages(config.templatesDatabase);
  logger.debug(`Found ${pages.length} template entries`);

  const templates: TemplateTimeBlock[] = pages.map((page) => convertPageToTemplate(page));

  const savedTemplates: SavedTemplates = {
    templates,
    savedAt: new Date().toISOString(),
  };

  await fs.writeFile(
    config.templatesFilePath,
    yaml.dump(savedTemplates, { lineWidth: -1, noRefs: true }),
    'utf-8'
  );
  logger.debug(`Templates saved to: ${config.templatesFilePath}`);

  logger.info('Init mode completed successfully!');
}

/**
 * Convert a Notion page to a template format
 */
function convertPageToTemplate(page: PageObjectResponse): TemplateTimeBlock {
  // Extract title if available (usually from a title property)
  let title = 'Untitled';

  for (const [key, value] of Object.entries(page.properties)) {
    if (value.type === 'title' && value.title.length > 0) {
      title = value.title.map((t) => t.plain_text).join('');
      break;
    }
  }

  return {
    title,
    properties: page.properties,
  };
}
