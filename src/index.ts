#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { getConfig } from './config';
import { runInitMode } from './init-mode';
import { runScheduledMode } from './scheduled-mode';
import { runPurgeMode } from './purge-mode';
import { parseTargetDate } from './date-utils';

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .usage('Usage: $0 [date] [options]')
    .command('$0 [date]', 'Create time blocks for the specified date (defaults to today)', (yargs) => {
      return yargs.positional('date', {
        describe: 'Target date (ISO format: YYYY-MM-DD)',
        type: 'string',
      });
    })
    .option('init', {
      alias: 'i',
      type: 'boolean',
      description: 'Initialize mode: save schema and templates',
      default: true,
    })
    .option('purge', {
      alias: 'p',
      type: 'boolean',
      description: 'Purge mode: delete all time blocks',
      default: false,
    })
    .option('confirm', {
      alias: 'y',
      type: 'boolean',
      description: 'Confirm destructive operations (required for --purge)',
      default: false,
    })
    .option('day', {
      alias: 'd',
      type: 'string',
      description: 'Filter templates by Day column (e.g., Monday, Tuesday, etc.)',
      default: 'Default',
    })
    .example('$0 --init', 'Initialize schema and templates')
    .example('$0', 'Create time blocks for today')
    .example('$0 2024-03-15', 'Create time blocks for March 15, 2024')
    .example('$0 --day Monday', 'Create time blocks for today, filtered by Monday templates')
    .example('$0 2024-03-15 --day Friday', 'Create time blocks for March 15, 2024, filtered by Friday templates')
    .example('$0 --purge --confirm', 'Delete all time blocks from database')
    .help('h')
    .alias('h', 'help')
    .version('1.0.0')
    .alias('v', 'version')
    .parseAsync();

  try {
    const config = getConfig();
    console.log(config);

    if (argv.purge) {
      await runPurgeMode(config, argv.confirm as boolean);
      return;
    }

    if (argv.init) {
      await runInitMode(config);
    }

    const targetDate = parseTargetDate(argv.date as string | undefined);
    const dayFilter = argv.day as string | undefined;
    await runScheduledMode(config, targetDate, dayFilter);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('An unexpected error occurred:', error);
    }
    process.exit(1);
  }
}

main();
