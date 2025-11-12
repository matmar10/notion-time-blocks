import { DatabaseObjectResponse, PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

export interface Config {
  notionApiKey: string;
  templatesDatabase: string;  // Database to read templates from
  timeBlocksDatabase: string;  // Database to write time blocks to
  schemaFilePath: string;
  templatesFilePath: string;
}

export interface TimeBlock {
  id: string;
  properties: Record<string, any>;
}

export interface TemplateTimeBlock {
  title: string;
  properties: Record<string, any>;
}

export interface SavedSchema {
  database: DatabaseObjectResponse;
  savedAt: string;
}

export interface SavedTemplates {
  templates: TemplateTimeBlock[];
  savedAt: string;
}
