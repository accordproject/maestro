#!/usr/bin/env node
/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';


const Commands = require('./lib/commands');

require('yargs')
    .scriptName('cli')
    .usage('$0 <cmd> [args]')
    .command('migrate', 'migrate a Composer Business Network Archives', (yargs) => {

        yargs.option('bnaPath', {
            describe: 'path to a business network archive',
            type: 'string',
            default: '.'
        });
        yargs.option('outputDirectory', {
            describe: 'output directory path',
            type: 'string',
            default: './output/'
        });
    }, (argv) => {
        if (argv.verbose) {
            console.log(`migrate a business network archive ${argv.bnaPath} to directory ${argv.outputDirectory}`);
        }

        return Commands.migrate(argv.bnaPath, argv.outputDirectory)
            .then((result) => {
                console.log(result);
            })
            .catch((err) => {
                console.log(err.message + ' ' + err);
            });
    })
    .option('verbose', {
        alias: 'v',
        default: false
    })
    .help()
    .argv;