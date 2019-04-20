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

const fs = require('fs');
const util = require('util');
const readFile = util.promisify(fs.readFile);

const BusinessNetworkDefinition = require('composer-common').BusinessNetworkDefinition;
const FileWriter = require('composer-common').FileWriter;
const BusinessNetworkDefinitionVisitor = require('./businessnetworkdefinitionvisitor');

/**
 * Utility class that implements the commands exposed by the CLI.
 * @class
 * @memberof module:concerto-tools
 */
class Commands {

    /**
     * Converts the model for a template into code
     *
     * @param {string} bnaPath the path to the business network archive
     * @param {string} outputDirectory the output directory
     * @returns {Promise<string>} Result of code generation
     */
    static async generate(bnaPath, outputDirectory) {
        const archive = await readFile(bnaPath);
        const businessNetwork = await BusinessNetworkDefinition.fromArchive(archive);
        const visitor = new BusinessNetworkDefinitionVisitor();
        const parameters = {
            fileWriter: new FileWriter(outputDirectory)
        };

        visitor.visit(businessNetwork, parameters);
        return 'Done.';
    }
}

module.exports = Commands;