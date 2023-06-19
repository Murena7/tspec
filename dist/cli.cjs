#!/usr/bin/env node
'use strict';

var node_fs = require('node:fs');
var node_url = require('node:url');
var yargs = require('yargs');
var helpers = require('yargs/helpers');
var index = require('./chunks/index.cjs');
var fs = require('fs/promises');
var path = require('path');
require('express');
require('http-proxy-middleware');
require('swagger-ui-express');
require('debug');
require('glob');
require('typescript');
require('typescript-json-schema');
require('json-schema-to-openapi-schema');

const TSPEC_CONFIG_FILE_NAME = 'tspec.config.json';

const readTspecConfig = (path) => {
  try {
    return fs.readFile(path, { encoding: 'utf8' });
  } catch (err) {
    console.error('Cannot read Tspec config');
    throw err;
  }
};

const parseTspecConfig = (config) => {
  try {
    return JSON.parse(config);
  } catch (err) {
    console.error('Cannot parse Tspec config');
    throw err;
  }
};












function validateTspecConfig(config) {
  const errors = [];

  const validatePrimitive = (property, value, type) => {
    index.assertIsDefined(type);
    if (typeof value !== type) { // eslint-disable-line valid-typeof
      errors.push({
        message: `property is not a ${type}.`,
        property,
      });
    }
  };

  const validateStringArray = (property, value) => {
    if (!Array.isArray(value)) {
      errors.push({
        message: 'property is not an array.',
        property,
      });
    } else if (value.some((glob) => typeof glob !== 'string')) {
      errors.push({
        message: 'property contains more than one non-string value.',
        property,
      });
    }
  };

  if (config.specPathGlobs) {
    validateStringArray('specPathGlobs', config.specPathGlobs);
  }
  if (config.tsconfigPath) {
    validatePrimitive('tsconfigPath', config.tsconfigPath, 'string');
  }
  if (config.outputPath) {
    validatePrimitive('outputPath', config.outputPath, 'string');
  }
  if (config.openapiTitle) {
    validatePrimitive('openapiTitle', config.openapiTitle, 'string');
  }
  if (config.openapiVersion) {
    validatePrimitive('openapiVersion', config.openapiVersion, 'string');
  }
  if (config.debug) {
    validatePrimitive('debug', config.debug, 'boolean');
  }
  if (config.ignoreErrors) {
    validatePrimitive('ignoreErrors', config.ignoreErrors, 'boolean');
  }

  if (errors.length) {
    const message = `Tspec configuration file is not valid.\n${
      errors.map((error) => `${error.property}: ${error.message}`).join('\n')
    }\n`;
    throw new Error(message);
  }
}

const getConfigPath = (inputPath) => {
  const filePath = inputPath || TSPEC_CONFIG_FILE_NAME;
  return path.join(process.cwd(), filePath);
};

const isTspecFileConfigAvailable = async (
  inputPath,
) => {
  const configPath = getConfigPath(inputPath);
  return fs.access(configPath)
    .then(() => true)
    .catch(() => false);
};

const getTspecConfigFromConfigFile = async (
  inputPath,
) => {
  const configPath = getConfigPath(inputPath);
  const fileResult = await readTspecConfig(configPath);

  const config = parseTspecConfig(fileResult);
  validateTspecConfig(config);

  return config;
};

function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } }



































var SupportedSpecVersion; (function (SupportedSpecVersion) {
  const THREE = 3; SupportedSpecVersion[SupportedSpecVersion["THREE"] = THREE] = "THREE";
})(SupportedSpecVersion || (SupportedSpecVersion = {}));

const defaultArgs = {
  specPathGlobs: ['**/*.ts'],
  tsconfigPath: 'tsconfig.json',
  outputPath: undefined,
  specVersion: SupportedSpecVersion.THREE,
  openapi: {
    title: 'Tspec API',
    version: '0.0.1',
    securityDefinitions: undefined,
    servers: undefined,
  },
  debug: undefined,
  ignoreErrors: undefined,
};

















const generatorOptions = {
  specPathGlobs: { type: 'array', default: defaultArgs.specPathGlobs },
  tsconfigPath: { type: 'string', default: defaultArgs.tsconfigPath },
  outputPath: { type: 'string', default: defaultArgs.outputPath },
  specVersion: { type: 'number' },
  openapiTitle: { type: 'string', default: defaultArgs.openapi.title },
  openapiVersion: { type: 'string', default: defaultArgs.openapi.version },
  debug: { type: 'boolean', default: defaultArgs.debug },
  ignoreErrors: { type: 'boolean', default: defaultArgs.ignoreErrors },
} ;

const runServerOptions = {
  ...generatorOptions,
  port: { type: 'number', default: 7000 },
  proxyHost: { type: 'string' },
} ;

const validateGeneratorOptions = async (args) => {
  if (args.specVersion && !Object.values(SupportedSpecVersion).includes(args.specVersion)) {
    // eslint-disable-next-line max-len
    throw new Error(`Tspec currently supports only OpenAPI Spec with version ${Object.values(SupportedSpecVersion).join(', ')}.`);
  }

  let generateTspecParams = {
    specPathGlobs: args.specPathGlobs.length > 0
      ? args.specPathGlobs.map((glob) => glob.toString())
      : defaultArgs.specPathGlobs,
    tsconfigPath: args.tsconfigPath,
    outputPath: args.outputPath,
    specVersion: (_nullishCoalesce(args.specVersion, () => ( defaultArgs.specVersion))) ,
    openapi: {
      title: args.openapiTitle,
      version: args.openapiVersion,
      securityDefinitions: defaultArgs.openapi.securityDefinitions,
      servers: defaultArgs.openapi.servers,
    },
    debug: args.debug,
    ignoreErrors: args.ignoreErrors,
  };

  if (await isTspecFileConfigAvailable()) {
    const fileConfig = await getTspecConfigFromConfigFile();
    generateTspecParams = {
      ...fileConfig,
      ...generateTspecParams,
    };
  }

  return generateTspecParams;
};

const specGenerator = async (args) => {
  const generateTspecParams = await validateGeneratorOptions(args);
  generateTspecParams.outputPath ||= 'openapi.json';
  await index.generateTspec(generateTspecParams);
};

const startTspecServer = async (args) => {
  const generateTspecParams = validateGeneratorOptions(args);
  index.initTspecServer({ ...generateTspecParams, port: args.port, proxyHost: args.proxyHost });
};

const runCli = async () => yargs(helpers.hideBin(process.argv))
  .usage('Usage: $0 <command> [options]')
  .command(
    'generate',
    'Generate OpenAPI Spec from Tspec',
    generatorOptions,
    (yargs) => specGenerator(yargs),
  )
  .command(
    'server',
    'Start Tspec server',
    runServerOptions,
    (yargs) => startTspecServer(yargs),
  )
  .help('help')
  .alias('help', 'h')
  .parse();

if ((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (document.currentScript && document.currentScript.src || new URL('cli.cjs', document.baseURI).href)).startsWith('file:')) {
  const modulePath = node_fs.realpathSync(node_url.fileURLToPath((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (document.currentScript && document.currentScript.src || new URL('cli.cjs', document.baseURI).href))));
  if (node_fs.realpathSync(process.argv[1]) === modulePath) {
    runCli();
  }
}

exports.runCli = runCli;
