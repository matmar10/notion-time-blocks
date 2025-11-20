
# Notion Template Duplicator

## What Is This?

A TypeScript CLI tool that **duplicates Notion database entries from templates**. It uses a two-database architecture where one database stores your master templates, and another receives the duplicated entries with updated dates.

## How It Works

The tool uses **two separate Notion databases**:

1. **Templates Database**: Contains your master template entries (read-only)
2. **Target Database**: Where new entries are created based on templates (write-only)

When you run the tool with a target date, it:
- Reads all entries from the Templates Database
- Duplicates each entry to the Target Database
- Updates any date/datetime properties to the target date
- Preserves all other properties (text, numbers, selections, etc.)
- Handles multi-day date ranges correctly

## Use Cases

### 📅 Daily Time Block Scheduling
Create recurring daily schedules without manual copying.
- **Templates DB**: "Morning standup 9:00-9:30", "Focus time 10:00-12:00"
- **Target DB**: Daily time blocks for each workday
- **Use**: Run daily via cron to populate your schedule

### 📋 Recurring Task Lists
Generate task lists for regular intervals (daily, weekly, monthly).
- **Templates DB**: Standard project setup tasks
- **Target DB**: Task lists for each new project
- **Use**: Run when starting a new project or sprint

### 📝 Meeting Agendas
Duplicate standard meeting agendas with updated dates.
- **Templates DB**: Standard agenda items for different meeting types
- **Target DB**: Specific meeting instances with actual dates
- **Use**: Run before scheduling a recurring meeting

### 🎯 Event Planning
Clone event planning checklists for recurring events.
- **Templates DB**: Master event checklist with relative timings
- **Target DB**: Specific event instances with actual dates
- **Use**: Run when planning a new instance of a recurring event

### 📊 Reporting Templates
Generate periodic reports from templates.
- **Templates DB**: Report structure with data points to collect
- **Target DB**: Monthly/quarterly report instances
- **Use**: Run at the start of each reporting period

## Installation

### 1. Set up Notion Databases

Create two Notion databases with **identical schemas**:

**Templates Database**:
- Create a database with your desired properties
- Include at least one date/datetime property (e.g., "Date", "When", "Due Date")
- Add your template entries with sample dates
- These templates will be duplicated to the target database

**Target Database**:
- Create another database with the **exact same schema**
- All property names and types must match the Templates Database
- Can be empty initially
- This is where duplicated entries will be created

**Example for Time Blocks:**
- Both databases have: Title (text), When (date with time), Duration (number), Category (select)
- Templates DB contains: "Morning standup 9:00-9:30", "Focus time 10:00-12:00"
- Target DB will receive these entries with updated dates

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
- `NOTION_TIME_BLOCKS_DATABASE_ID`: Database ID from Target Database URL

**Finding Database IDs:**
Database IDs are in the URL when viewing a database in Notion:
`https://www.notion.so/workspace/DATABASE_ID?v=...`
Copy the 32-character ID between the workspace name and the `?v=`

## Usage

### Quick Start

```bash
# 1. Initialize: Save templates locally
npm start -- --init

# 2. Create entries for today
npm start

# 3. Create entries for a specific date
npm start -- 2024-03-15

# 4. Clean up: Delete all entries from target database
npm start -- --purge --confirm
```

### Detailed Commands

```bash
# Initialize mode: Save schema and templates locally
npm start -- --init
node dist/index.js --init

# Create entries for today (default behavior)
npm start
node dist/index.js

# Create entries for a specific date (ISO format: YYYY-MM-DD)
npm start -- 2024-03-15
npm start -- 2024-12-25
node dist/index.js 2024-03-15

# Purge all entries from target database (requires confirmation)
npm start -- --purge --confirm
node dist/index.js --purge --confirm

# Enable debug logging for troubleshooting
npm start -- --debug
node dist/index.js --debug

# Enable verbose (trace) logging for detailed output
npm start -- --verbose
node dist/index.js --verbose

# View help
npm start -- --help
```

### Logging Levels

The tool supports three logging levels:

- **`info` (default)**: Only essential messages like success/failure summaries
- **`--debug`**: Includes operational details like template loading, database IDs, progress
- **`--verbose`**: Full trace logging including date calculations, API calls, property mappings

Use `--debug` or `--verbose` when troubleshooting issues or understanding what the tool is doing.

## Operating Modes

### 1. Init Mode (`--init`)

**Purpose:** Download and save templates locally

**What it does:**
1. Connects to the **Templates Database**
2. Reads the database schema and saves it to `.notion-schema.json`
3. Downloads all template entries and saves them to `.notion-templates.yaml`

**When to run:**
- First time setup
- After adding/modifying templates in the Templates Database
- After changing the database schema

**Example:**
```bash
npm start -- --init
```

### 2. Create Mode (default)

**Purpose:** Duplicate templates to target database with updated dates

**What it does:**
1. Reads the saved template YAML file (from init mode)
2. Sorts templates by start time (ascending order)
3. For each template, creates a new entry in the **Target Database**
4. Updates all date/datetime properties to the target date
5. Preserves time portions (e.g., 9:00 AM stays 9:00 AM)
6. Handles multi-day date ranges (e.g., events spanning midnight)
7. Copies all other properties unchanged (text, numbers, selections, etc.)

**When to run:**
- Daily via cron for recurring schedules
- On-demand when you need to create entries for a specific date
- After running init mode for the first time

**Examples:**
```bash
# Create entries for today
npm start

# Create entries for specific date
npm start -- 2024-03-15

# Create entries for next Monday
npm start -- 2024-03-18
```

**Output example:**
```
Running scheduled mode...
Target date: 2024-03-15
Reference date: 2024-01-01
Templates sorted by start time

Creating time blocks in time blocks database (in order)...

  Creating: Morning Standup
     Property: When
       Template start: 2024-01-01 09:00:00
       New start:      2024-03-15 09:00:00
       Template end:   2024-01-01 09:30:00
       New end:        2024-03-15 09:30:00
  ✓ Successfully created

✓ Created 5 of 5 time blocks
```

### 3. Purge Mode (`--purge --confirm`)

**Purpose:** Delete all entries from the target database

**⚠️ WARNING: This is a destructive operation!**

**What it does:**
1. Fetches all entries from the **Target Database**
2. Archives (deletes) each entry one by one
3. Shows progress for each deletion

**When to use:**
- Testing the script
- Cleaning up test data
- Starting fresh after experimenting
- Clearing out old entries before regenerating

**Safety features:**
- Requires `--confirm` flag to prevent accidental deletion
- Only affects the Target Database (templates are safe)
- Deleted entries are archived in Notion (recoverable from trash)
- Shows warning if confirmation is missing

**Examples:**
```bash
# Without confirmation - shows warning and exits safely
npm start -- --purge
# Output: ⚠️ WARNING: This will delete ALL entries...

# With confirmation - actually deletes all entries
npm start -- --purge --confirm
# Output: Found 15 time blocks to delete...
```

## Automation with Cron

You can automate the tool to run on a schedule using cron (macOS/Linux).

### Daily Time Blocks - Weekdays Only (Mon-Thu)

Run Monday through Thursday at 6 AM to create today's time blocks (excludes Fri-Sun):

```bash
# Edit crontab
crontab -e

# Add this line (adjust path to your project):
0 6 * * 1-4 cd /path/to/notion-time-blocks && /usr/local/bin/node dist/index.js >> /tmp/notion-duplicator.log 2>&1
```

**Cron Day Reference:**
- `1` = Monday
- `2` = Tuesday
- `3` = Wednesday
- `4` = Thursday
- `5` = Friday
- `6` = Saturday
- `0` or `7` = Sunday

### Alternative Schedules

**Run Monday-Friday (all weekdays):**
```bash
0 6 * * 1-5 cd /Users/matmar10/Projects/notion-time-blocks && /Users/matmar10/.nvm/versions/node/v22.18.0/bin/node dist/index.js >> output.log 2>&1
```

**Run Monday-Wednesday only:**
```bash
0 6 * * 1-3 cd /path/to/notion-time-blocks && /usr/local/bin/node dist/index.js >> /tmp/notion-duplicator.log 2>&1
```

**Run every weekday with debug logging:**
```bash
0 6 * * 1-4 cd /path/to/notion-time-blocks && /usr/local/bin/node dist/index.js --debug >> /tmp/notion-duplicator.log 2>&1
```

**Prepare the night before (Sun-Wed at 11 PM for Mon-Thu):**
```bash
0 23 * * 0-3 cd /path/to/notion-time-blocks && /usr/local/bin/node dist/index.js >> /tmp/notion-duplicator.log 2>&1
```

### Other Scheduling Examples

**Monthly Reports - 1st of each month at 9 AM:**
```bash
0 9 1 * * cd /path/to/notion-time-blocks && /usr/local/bin/node dist/index.js >> /tmp/notion-duplicator.log 2>&1
```

**Weekly Tasks - Every Monday at 8 AM:**
```bash
0 8 * * 1 cd /path/to/notion-time-blocks && /usr/local/bin/node dist/index.js >> /tmp/notion-duplicator.log 2>&1
```

**Bi-weekly - Every other Monday:**
```bash
# Run on weeks 1, 3, 5, etc. of the month
0 8 1-7,15-21,29-31 * 1 cd /path/to/notion-time-blocks && /usr/local/bin/node dist/index.js >> /tmp/notion-duplicator.log 2>&1
```

### Cron Script with Error Handling

Create a wrapper script `cron-sync.sh` for better error handling:

```bash
#!/bin/bash
# Save as cron-sync.sh in your project directory

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/logs"
LOG_FILE="${LOG_DIR}/cron-$(date +%Y-%m-%d).log"

# Create log directory
mkdir -p "${LOG_DIR}"

# Function to log with timestamp
log() {
    echo "[$(date +%Y-%m-%d\ %H:%M:%S)] $*" | tee -a "${LOG_FILE}"
}

# Check day of week (1=Mon, 5=Fri, 6=Sat, 7=Sun)
DAY_OF_WEEK=$(date +%u)

# Skip if Friday, Saturday, or Sunday
if [ "${DAY_OF_WEEK}" -ge 5 ]; then
    log "Skipping - weekend day detected"
    exit 0
fi

# Change to script directory
cd "${SCRIPT_DIR}"

# Load environment variables
if [ -f "${SCRIPT_DIR}/.env" ]; then
    export $(grep -v '^#' "${SCRIPT_DIR}/.env" | xargs)
fi

# Run the sync
log "Running time blocks sync..."
if node dist/index.js 2>&1 | tee -a "${LOG_FILE}"; then
    log "✓ Sync completed successfully"
else
    log "✗ Sync failed"
    exit 1
fi

# Clean up old logs (keep 30 days)
find "${LOG_DIR}" -name "cron-*.log" -type f -mtime +30 -delete 2>/dev/null || true
```

Make it executable and schedule it:
```bash
chmod +x cron-sync.sh

# Edit crontab
crontab -e

# Add this line:
0 6 * * 1-4 /path/to/notion-time-blocks/cron-sync.sh
```

### Viewing Logs

```bash
# View today's log
tail -f /tmp/notion-duplicator.log

# Or with the script above:
tail -f logs/cron-$(date +%Y-%m-%d).log

# View last 50 lines
tail -50 /tmp/notion-duplicator.log

# Search logs for errors
grep -i error /tmp/notion-duplicator.log
```

### Setup Checklist

Before setting up cron, make sure:
1. ✅ Replace `/path/to/notion-time-blocks` with your actual project path (use absolute paths)
2. ✅ The `.env` file exists in the project directory with correct credentials
3. ✅ You've run `--init` mode at least once to save templates
4. ✅ The project is built (`npm run build`)
5. ✅ Test the command manually first to ensure it works
6. ✅ Check the log file after the first automated run
7. ✅ On macOS, grant Full Disk Access to `cron` in System Preferences if needed

### macOS Specific: Full Disk Access

On macOS Catalina+, you may need to grant cron access:
1. Open **System Preferences** → **Security & Privacy** → **Privacy**
2. Select **Full Disk Access**
3. Click the lock to make changes
4. Click `+` and add `/usr/sbin/cron`
5. Restart cron: `sudo launchctl kickstart -k system/com.vixie.cron`

## Advanced Usage

### Understanding Date Handling

The tool intelligently handles date/datetime properties:

**Single Dates:**
- Template: `2024-01-15`
- Target date: `2024-03-20`
- Result: `2024-03-20`

**Date Ranges with Times:**
- Template: `2024-01-15 09:00` to `2024-01-15 10:30`
- Target date: `2024-03-20`
- Result: `2024-03-20 09:00` to `2024-03-20 10:30`

**Multi-Day Ranges:**
- Template: `2024-01-15 23:00` to `2024-01-16 02:00` (spans midnight)
- Target date: `2024-03-20`
- Result: `2024-03-20 23:00` to `2024-03-21 02:00` (preserves span)

**Reference Date:**
The tool automatically finds the earliest date in your templates and uses it as a reference point. All other dates are calculated as offsets from this reference.

### Property Support

The tool handles all standard Notion property types:

✅ **Supported (copied as-is):**
- Title
- Rich Text
- Number
- Select / Multi-select
- Checkbox
- URL
- Email
- Phone Number
- People
- Files
- Relation
- Status

✅ **Supported (date updated):**
- Date (with or without time)

❌ **Skipped (read-only/computed):**
- Formula
- Rollup
- Created Time
- Created By
- Last Edited Time
- Last Edited By

### Workflow Tips

**Best Practice Workflow:**
1. Design your template database schema carefully
2. Add template entries with sample dates
3. Run `--init` to save templates
4. Test with `--purge --confirm` and create mode on a test date
5. Verify results in Notion
6. Set up cron for automation

**Updating Templates:**
1. Modify entries in the Templates Database
2. Run `--init` again to update local cache
3. Templates are now updated for future runs

**Schema Changes:**
1. Update both Templates and Target databases with new schema
2. Run `--init` to save the new schema
3. Existing templates will work with new properties

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

## Troubleshooting

### "NOTION_API_KEY environment variable is required"
- Make sure `.env` file exists in the project root
- Verify the file contains `NOTION_API_KEY=your_key_here`

### "No templates found. Run with --init first"
- Run `npm start -- --init` to download templates
- Verify Templates Database has entries
- Check that the integration has access to the Templates Database

### "Invalid date range, start date must be before end date"
- Check your template dates - ensure start < end
- The tool will skip invalid date properties and show a warning
- Fix the template entry and run `--init` again

### Entries not appearing in Target Database
- Verify Target Database ID is correct in `.env`
- Check that integration has access to Target Database
- Look for error messages in the output

### Rate Limiting
- The tool includes automatic rate limiting (350ms between requests)
- For very large template sets (100+ entries), the process may take several minutes
- This is normal and prevents hitting Notion's API limits

## Contributing

Issues and pull requests are welcome! Please ensure:
- TypeScript compiles without errors (`npm run build`)
- Code follows existing patterns and style
- Updates to functionality include README updates

## License

MIT