import dotenv from 'dotenv';
import path from 'path';
import { Config } from './types';

dotenv.config();

export function getConfig(): Config {
  const notionApiKey = process.env.NOTION_API_KEY;
  const templatesDatabase = process.env.NOTION_TEMPLATES_DATABASE_ID;
  const timeBlocksDatabase = process.env.NOTION_TIME_BLOCKS_DATABASE_ID;

  if (!notionApiKey) {
    throw new Error('NOTION_API_KEY environment variable is required');
  }

  if (!templatesDatabase) {
    throw new Error('NOTION_TEMPLATES_DATABASE_ID environment variable is required');
  }

  if (!timeBlocksDatabase) {
    throw new Error('NOTION_TIME_BLOCKS_DATABASE_ID environment variable is required');
  }

  return {
    notionApiKey,
    templatesDatabase,
    timeBlocksDatabase,
    schemaFilePath: path.join(process.cwd(), '.notion-schema.json'),
    templatesFilePath: path.join(process.cwd(), '.notion-templates.yaml'),
  };
}
