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

const CommonModelManager = require('composer-common').ModelManager;
const ScriptManager = require('composer-common').ScriptManager;
const Script = require('composer-common').Script;

const ModelManager = require('composer-concerto').ModelManager;
const BusinessNetworkDefinition = require('composer-common').BusinessNetworkDefinition;
const CodeGen = require('composer-concerto-tools').CodeGen;

const SYSTEM_MODELS = require('./systemModels');

/**
 * Convert the contents of a BusinessNetworkDefinition to JavaScript code.
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
        }
        else if (thing instanceof Script) {
            return this.visitScript(thing, parameters);
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

        // visit the model manager
        businessNetworkDefinition.getModelManager().accept(this, parameters);

        // visit the script manager
        businessNetworkDefinition.getScriptManager().accept(this, parameters);
    }

    /**
     * Visitor design pattern
     * @param {ScriptManager} scriptManager - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitScriptManager(scriptManager, parameters) {
        scriptManager.getScripts().forEach( scriptFile => {
            scriptFile.accept(this, parameters);
        });
    }

    /**
     * Visitor design pattern
     * @param {Script} script - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitScript(script, parameters) {
        console.log(`Processing script ${script.getName()}`);
        parameters.fileWriter.openFile(script.getName());
        parameters.fileWriter.writeLine(0, script.getContents());
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

        // add the composer system models
        SYSTEM_MODELS.forEach((SYSTEM_MODEL) => {
            modelManager.addModelFile(SYSTEM_MODEL.contents, SYSTEM_MODEL.fileName, true, true);
        });

        // add all the model files from the BNA
        commonModelManager.getModelFiles().forEach( (modelFile) => {
            if(!modelFile.isSystemModelFile()) {
                console.log(`Processing model ${modelFile.getNamespace()}`);
                modelManager.addModelFile(modelFile.getDefinitions(), modelFile.getName(), true);
            }
        });

        // validate and then generate typescript code
        modelManager.validateModelFiles();
        const typescriptVisitor = new CodeGen.TypescriptVisitor();
        return typescriptVisitor.visit(modelManager, parameters);
    }
}

module.exports = BusinessNetworkDefinitionVisitor;
