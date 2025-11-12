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
      default: false,
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
    .example('$0 --init', 'Initialize schema and templates')
    .example('$0', 'Create time blocks for today')
    .example('$0 2024-03-15', 'Create time blocks for March 15, 2024')
    .example('$0 --purge --confirm', 'Delete all time blocks from database')
    .help('h')
    .alias('h', 'help')
    .version('1.0.0')
    .alias('v', 'version')
    .parseAsync();

  try {
    const config = getConfig();

    if (argv.init) {
      // Run init mode
      await runInitMode(config);
    } else if (argv.purge) {
      // Run purge mode
      await runPurgeMode(config, argv.confirm as boolean);
    } else {
      // Run scheduled mode
      const targetDate = parseTargetDate(argv.date as string | undefined);
      await runScheduledMode(config, targetDate);
    }
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
