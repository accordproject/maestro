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

const util = require('util');
const nunjucks = require('nunjucks');
const fs = require('fs');
const fsPath = require('path');

const CommonModelManager = require('composer-common').ModelManager;
const ScriptManager = require('composer-common').ScriptManager;

const ModelManager = require('composer-concerto').ModelManager;
const BusinessNetworkDefinition = require('composer-common').BusinessNetworkDefinition;
const CodeGen = require('composer-concerto-tools').CodeGen;
const FileWriter = require('composer-common').FileWriter;
const beautify = require('js-beautify').js;

const APACHE_HEADER = require('./apacheHeader');
// const writeFile = util.promisify(fs.writeFile);
const readFile = util.promisify(fs.readFile);

nunjucks.configure('./templates', { autoescape: false });

const isDirectory = path => fs.statSync(path).isDirectory();
const getDirectories = path =>
    fs.readdirSync(path).map(name => fsPath.join(path, name)).filter(isDirectory);

const isFile = path => fs.statSync(path).isFile();
const getFiles = path =>
    fs.readdirSync(path).map(name => fsPath.join(path, name)).filter(isFile);

const getFilesRecursively = (path) => {
    let dirs = getDirectories(path);
    let files = dirs
        .map(dir => getFilesRecursively(dir)) // go through each directory
        .reduce((a,b) => a.concat(b), []);    // map returns a 2d array (array of file arrays) so flatten
    return files.concat(getFiles(path));
};

/**
 * Convert the contents of a BusinessNetworkDefinition to HLF 1.4 compatible JavaScript code.
 * Set a fileWriter property (instance of FileWriter) on the parameters
 * object to control where the generated code is written to disk.
 *
 * @private
 * @class
 * @memberof module:@accordproject/maestro
 */
class BusinessNetworkDefinitionVisitor {
    /**
     * Visitor design pattern
     * @param {Object} thing - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visit(thing, parameters) {
        if (thing instanceof BusinessNetworkDefinition) {
            return this.visitBusinessNetworkDefinition(thing, parameters);
        }
        else if (thing instanceof CommonModelManager) {
            return this.visitModelManager(thing, parameters);
        }
        else if (thing instanceof ScriptManager) {
            return this.visitScriptManager(thing, parameters);
        } else {
            throw new Error('Unrecognised type: ' + typeof thing + ', value: ' + util.inspect(thing, { showHidden: true, depth: null }));
        }
    }

    /**
     * Visitor design pattern
     * @param {BusinessNetworkDefinition} businessNetworkDefinition - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitBusinessNetworkDefinition(businessNetworkDefinition, parameters) {
        console.log(`Processing network ${businessNetworkDefinition.getIdentifier()}`);

        // copy all static files
        const staticFiles = getFilesRecursively(fsPath.join(__dirname, '../templates/'));
        staticFiles.forEach(file => {
            const relativePath = fsPath.relative(fsPath.join(__dirname, '../templates/'), file);
            if(!relativePath.endsWith('.njk')) {
                console.log(`Copying ${relativePath}`);
                let fileContents = fs.readFileSync(file, 'utf8');
                parameters.fileWriter.openFile(relativePath);
                parameters.fileWriter.writeLine(0, fileContents);
                parameters.fileWriter.closeFile();
            }
        });

        // generate index.js
        const indexResult = nunjucks.render('index.njk', {
            contractName: 'MyContract'
        });
        parameters.fileWriter.openFile('index.js');
        parameters.fileWriter.writeLine(0, indexResult);
        parameters.fileWriter.closeFile();

        // generate package.json
        const packageResult = nunjucks.render('package.njk', {
            packageName: businessNetworkDefinition.getName(),
            packageDescription: businessNetworkDefinition.getDescription(),
            packageVersion: `"${businessNetworkDefinition.getVersion()}"`

        });
        parameters.fileWriter.openFile('package.json');
        parameters.fileWriter.writeLine(0, packageResult);
        parameters.fileWriter.closeFile();

        // visit the model manager
        businessNetworkDefinition.getModelManager().accept(this, parameters);

        // visit the script manager
        businessNetworkDefinition.getScriptManager().accept(this, parameters);
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    }

    replaceGlobally(original, searchTxt, replaceTxt) {
        const regex = new RegExp(this.escapeRegExp(searchTxt), 'g');
        return original.replace(regex, replaceTxt) ;
    }

    /**
     * Processes a script contents
     * @param {string} contents the contents of the script file
     */
    processScript(contents) {
        const getAssetRegistry = this.replaceGlobally(contents, 'getAssetRegistry(', 'this.getAssetRegistry(');
        const getFactory = this.replaceGlobally(getAssetRegistry, 'getFactory()', 'this.getFactory()');
        const emit = this.replaceGlobally(getFactory, 'emit(', 'this.emit(');
        const asyncFunction = this.replaceGlobally(emit, 'async function', 'async');
        const apacheHeader = this.replaceGlobally(asyncFunction, APACHE_HEADER, '');
        const eslint = this.replaceGlobally(apacheHeader, '/* global getAssetRegistry getFactory emit */', '' );
        return eslint;
    }

    /**
     * Visitor design pattern
     * @param {ScriptManager} scriptManager - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    async visitScriptManager(scriptManager, parameters) {

        const functions = [];
        scriptManager.getScripts().forEach( script => {
            console.log(`Processing script ${script.getName()}`);
            functions.push(this.processScript(script.getContents()));
        });

        // generate the contract
        const templateResult = nunjucks.render('MyContract.njk', {
            contractName: 'MyContract',
            functions: functions
        });

        // beautify
        const pretty = beautify(templateResult, { indent_size: 4, space_in_empty_paren: true });
        parameters.fileWriter.openFile('lib/my-contract.js');
        parameters.fileWriter.writeLine(0, pretty);
        parameters.fileWriter.closeFile();
    }

    /**
     * Visitor design pattern
     * @param {ModelManager} commonModelManager - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitModelManager(commonModelManager, parameters) {

        // WARNING! we need to convert the composer-common ModelManager into a
        // composer-concerto ModelManager so that we can use composer-common-tools
        // for code generation

        const modelManager = new ModelManager();

        // add the composer system model
        const systemModel = fs.readFileSync(fsPath.join(__dirname, '../templates/models/org.hyperledger.composer.system.cto'));
        modelManager.addModelFile(systemModel.toString(), 'org.hyperledger.composer.system.cto', true, true);

        // add all the model files from the BNA
        commonModelManager.getModelFiles().forEach( (modelFile) => {
            if(!modelFile.isSystemModelFile()) {
                console.log(`Processing model ${modelFile.getNamespace()}`);
                modelManager.addModelFile(modelFile.getDefinitions(), modelFile.getName(), true);
            }
        });

        // validate and copy model files
        modelManager.validateModelFiles();

        modelManager.getModelFiles().forEach( (modelFile) => {
            if(!modelFile.isSystemModelFile()) {
                console.log(`Copying model file ${modelFile.getName()}`);
                parameters.fileWriter.openFile(modelFile.getName());
                parameters.fileWriter.writeLine(0, modelFile.getDefinitions());
                parameters.fileWriter.closeFile();
            }
        });

        // generate typescript
        const subParameters = {
            fileWriter: new FileWriter(parameters.fileWriter.outputDirectory + '/lib/gen-models')
        };
        const typescriptVisitor = new CodeGen.TypescriptVisitor();
        return typescriptVisitor.visit(modelManager, subParameters);
    }
}

module.exports = BusinessNetworkDefinitionVisitor;
