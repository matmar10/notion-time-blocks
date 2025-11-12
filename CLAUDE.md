# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js/TypeScript CLI tool that syncs daily time blocks between two Notion databases. It reads template time blocks from one database and creates daily entries in another database with updated dates.

**Key Requirements:**
- Built for Mac/OSX cron execution
- Uses **two separate Notion databases**:
  - **Templates Database**: Source of master time block templates
  - **Time Blocks Database**: Destination for daily time block entries
- Stores schema and templates locally for daily time block creation
- Two modes: Init (setup) and Scheduled (daily sync)

## Architecture

### Two-Database Design

The system uses separate databases for templates and time blocks:

1. **Templates Database**: Contains master time block definitions
   - Read-only during operation (after init)
   - Defines the recurring schedule structure
   - Example: "Morning standup 9:00-9:30", "Focus time 10:00-12:00"

2. **Time Blocks Database**: Receives daily time block entries
   - Write-only during scheduled mode
   - Must have matching schema to Templates Database
   - Populated with dated entries based on templates

### Three Operating Modes

**Init Mode** (`--init` flag):
1. Connects to **Templates Database** via API
2. Reads and saves database schema to `.notion-schema.json`
3. Downloads all template entries as YAML to `.notion-templates.yaml`
4. These local files serve as the basis for creating new entries

**Scheduled Mode** (default, with optional date argument):
1. Reads saved YAML template file from disk
2. Sorts templates by start time (ascending order)
3. Creates new entries in **Time Blocks Database** for the specified date
4. Preserves start/end times from template, updates dates (handles multi-day spans)
5. Creates entries serially to maintain order

**Purge Mode** (`--purge --confirm` flags):
1. Fetches all pages from **Time Blocks Database**
2. Archives (deletes) each page one by one
3. Requires `--confirm` flag as safety measure
4. Useful for testing and cleanup

### Key Design Considerations

- **Date/Time Handling**: The "When" column contains start/end date/time. When creating new entries, preserve the time portion but update the date to the target day.
- **YAML Templates**: Templates must capture all necessary Notion properties to properly recreate entries.
- **Schema Persistence**: Save the Notion database schema to ensure compatibility when creating new entries.
- **Error Handling**: Must handle Notion API rate limits, network failures, and invalid date inputs gracefully.
- **Cron Compatibility**: Script must be non-interactive and suitable for automated execution.

## Development Commands

### Required Dependencies
- `dotenv` - Environment variable management (Notion API key)
- `yargs` - CLI argument parsing
- `@notionhq/client` - Official Notion API client (recommended)
- TypeScript compilation tooling

### CLI Interface

```bash
# Initialize schema and templates
create-notion-time-blocks --init

# Create time blocks for specific date (defaults to today)
create-notion-time-blocks [date]

# Delete all time blocks
create-notion-time-blocks --purge --confirm

# Date format should follow ISO 8601 or similar standard
```

### Environment Variables

Required in `.env`:
- `NOTION_API_KEY` - Notion integration API key (must have access to both databases)
- `NOTION_TEMPLATES_DATABASE_ID` - Database ID for reading templates
- `NOTION_TIME_BLOCKS_DATABASE_ID` - Database ID for writing/deleting time blocks

## Implementation Notes

### Notion API Considerations

- Use official `@notionhq/client` SDK for type safety
- Database schema discovery via `databases.retrieve` API (Templates DB)
- Template entries via `databases.query` API (Templates DB)
- New entry creation via `pages.create` API (Time Blocks DB)
- Handle pagination for large template sets
- Respect rate limits (3 requests/second)
- NotionClientWrapper accepts database ID as parameter for flexibility

### File Storage

- Schema file: JSON format for easy parsing
- Template file: YAML format as specified (human-readable, good for time blocks)
- Store in project directory or XDG config location for cron access

### Date Logic

- Parse input date flexibly (ISO string, natural language, etc.)
- Calculate correct start/end datetimes by combining template time + target date
- Handle timezone considerations (likely system local time)
- Validate that target date makes sense (not too far in past, reasonable future range)
