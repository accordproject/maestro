/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Factory } = require('composer-concerto');
const { ModelManager } = require('composer-concerto');
const { Contract } = require('fabric-contract-api');

const fs = require('fs');
const fsPath = require('path');

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

class ComposerContract extends Contract {

    async instantiate(ctx) {
        console.info('instantiate');

        // create the model manager
        this.modelManager = new ModelManager();

        // add the composer system model
        const systemModel = fs.readFileSync(fsPath.join(__dirname, '../models/org.hyperledger.composer.system.cto'));
        this.modelManager.addModelFile(systemModel.toString(), 'org.hyperledger.composer.system.cto', true, true);

        const staticFiles = getFilesRecursively(fsPath.join(__dirname, '../models/'));
        staticFiles.forEach(file => {
            const relativePath = fsPath.relative(fsPath.join(__dirname, '../models/'), file);
            if(relativePath.endsWith('.cto') && !relativePath.endsWith('org.hyperledger.composer.system.cto')) {
                console.info(`Loading ${relativePath}`);
                let fileContents = fs.readFileSync(file, 'utf8');
                this.modelManager.addModelFile(fileContents, relativePath, true);
            }
        });

        this.modelManager.validateModelFiles();
        this.factory = new Factory(this.modelManager);
    }

    async getAssetRegistry(fqn) {
    }

    async getFactory() {
        return this.factory;
    }

    async emit(event) {
        throw new Error('No yet implemented');
    }
}

module.exports = ComposerContract;



