import { Client } from '@notionhq/client';
import type pino from 'pino';
import {
  DatabaseObjectResponse,
  PageObjectResponse,
  QueryDatabaseResponse,
} from '@notionhq/client/build/src/api-endpoints';
import { Config } from './types';

export class NotionClientWrapper {
  private client: Client;
  private logger: pino.Logger;

  constructor(config: Config, logger: pino.Logger) {
    this.client = new Client({ auth: config.notionApiKey });
    this.logger = logger;
  }

  /**
   * Retrieve the database schema
   */
  async getDatabaseSchema(databaseId: string): Promise<DatabaseObjectResponse> {
    const response = await this.client.databases.retrieve({
      database_id: databaseId,
    });

    return response as DatabaseObjectResponse;
  }

  /**
   * Query all pages from the database
   */
  async getAllPages(databaseId: string): Promise<PageObjectResponse[]> {
    const pages: PageObjectResponse[] = [];
    let hasMore = true;
    let startCursor: string | undefined = undefined;

    while (hasMore) {
      this.logger.trace(`Querying database ${databaseId}...`);
      const response: QueryDatabaseResponse = await this.client.databases.query({
        database_id: databaseId,
        start_cursor: startCursor,
      });

      pages.push(...(response.results as PageObjectResponse[]));
      hasMore = response.has_more;
      startCursor = response.next_cursor || undefined;

      this.logger.trace(`Fetched ${response.results.length} pages, hasMore: ${hasMore}`);

      // Add small delay to respect rate limits
      if (hasMore) {
        await this.delay(350); // ~3 requests per second
      }
    }

    return pages;
  }

  /**
   * Create a new page in the database
   */
  async createPage(databaseId: string, properties: Record<string, any>): Promise<PageObjectResponse> {
    const response = await this.client.pages.create({
      parent: { database_id: databaseId },
      properties,
    });

    return response as PageObjectResponse;
  }

  /**
   * Update database schema (e.g., to add select options)
   */
  async updateDatabaseSchema(
    databaseId: string,
    properties: Record<string, any>
  ): Promise<DatabaseObjectResponse> {
    const response = await this.client.databases.update({
      database_id: databaseId,
      properties,
    });

    return response as DatabaseObjectResponse;
  }

  /**
   * Archive (delete) a page
   */
  async deletePage(pageId: string): Promise<void> {
    await this.client.pages.update({
      page_id: pageId,
      archived: true,
    });
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
