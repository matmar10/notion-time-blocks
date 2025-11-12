
# Notion Daily Time Block Sync Script

## Overview

This script uses **two separate Notion databases**:

1. **Templates Database**: Contains your master time block templates with times and durations
2. **Time Blocks Database**: Where daily time block entries are created

Each template block has a "When" column with start/end date/time.
Every work day, the script creates new entries in the Time Blocks database
based on the templates, preserving the time and duration but updating the date.

This script has two modes:

1. **Init Mode**: Reads templates from the Templates Database and saves them locally
2. **Scheduled Mode**: Creates new time block entries in the Time Blocks Database for a specific date

## Installation

### 1. Set up Notion Databases

Create two Notion databases:

**Templates Database**:
- Create a database with a "When" column (date property with start and end times)
- Add your template time blocks (e.g., "Morning standup 9:00-9:30", "Focus time 10:00-12:00")
- These templates define the recurring schedule

**Time Blocks Database**:
- Create another database with the same schema (must have matching "When" column)
- This will be populated with daily entries
- Can be empty initially

### 2. Create Notion Integration

1. Go to https://www.notion.so/my-integrations
2. Create a new integration and copy the API key
3. Share **both databases** with your integration:
   - Open each database in Notion
   - Click "..." menu → "Add connections" → Select your integration

### 3. Install and Configure

```bash
# Clone or download this repository
npm install
npm run build

# Set up environment variables
cp .env.example .env
```

Edit `.env` and add your credentials:
- `NOTION_API_KEY`: Your integration API key
- `NOTION_TEMPLATES_DATABASE_ID`: Database ID from Templates Database URL
- `NOTION_TIME_BLOCKS_DATABASE_ID`: Database ID from Time Blocks Database URL

## Usage

```bash
# Runs init mode to save schema and templates
npm start -- --init
node dist/index.js --init

# Creates the time blocks for today
npm start
node dist/index.js

# Creates the time blocks for a specific date
npm start -- 2024-03-15
node dist/index.js 2024-03-15

# Purge all time blocks from the time blocks database
npm start -- --purge --confirm
node dist/index.js --purge --confirm
```

### Init Mode

When "Init Mode" is run:

1. Connects to the **Templates Database**
2. Reads the database schema and saves it locally to `.notion-schema.json`
3. Downloads all template entries and saves them to `.notion-templates.yaml`

These local files are used by Scheduled Mode to create new entries.

### Scheduled Mode

When "Scheduled Mode" is run:

1. Reads the saved template YAML file
2. Sorts templates by start time (ascending order)
3. For each template, creates a new entry in the **Time Blocks Database**
4. Updates dates to the target date while preserving time portions
5. Handles multi-day blocks (e.g., blocks that start on the next day)

### Purge Mode

**⚠️ WARNING: This is a destructive operation!**

Purge mode deletes (archives) all entries from the **Time Blocks Database**. This is useful for:
- Testing the script
- Cleaning up test data
- Starting fresh

**Important:**
- Requires `--confirm` flag to prevent accidental deletion
- Only affects the Time Blocks Database (templates are safe)
- Deleted entries are archived in Notion (can be recovered from trash)

```bash
# Without confirmation - shows warning and exits
npm start -- --purge

# With confirmation - actually deletes all entries
npm start -- --purge --confirm
```

## Cron Triggering

To run automatically every weekday at 6 AM, add to your crontab:

```bash
# Edit crontab
crontab -e

# Add this line (adjust path to your project):
0 6 * * 1-5 cd /path/to/notion-time-blocks && /usr/local/bin/node dist/index.js >> /tmp/notion-time-blocks.log 2>&1
```

Make sure to:
1. Replace `/path/to/notion-time-blocks` with your actual project path
2. Ensure the `.env` file exists in the project directory
3. Run `--init` mode first to create templates

## Development

```bash
# Run in development mode with ts-node
npm run dev -- --init
npm run dev -- 2024-03-15

# Watch mode for development
npm run watch

# Build for production
npm run build

# Clean build artifacts
npm run clean
```