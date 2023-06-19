#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { a as assertIsDefined, g as generateTspec, i as initTspecServer } from './chunks/index.js';
import fs from 'fs/promises';
import path from 'path';
import 'express';
import 'http-proxy-middleware';
import 'swagger-ui-express';
import 'debug';
import 'glob';
import 'typescript';
import 'typescript-json-schema';
import 'json-schema-to-openapi-schema';

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
    assertIsDefined(type);
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
  await generateTspec(generateTspecParams);
};

const startTspecServer = async (args) => {
  const generateTspecParams = validateGeneratorOptions(args);
  initTspecServer({ ...generateTspecParams, port: args.port, proxyHost: args.proxyHost });
};

const runCli = async () => yargs(hideBin(process.argv))
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

if (import.meta.url.startsWith('file:')) {
  const modulePath = realpathSync(fileURLToPath(import.meta.url));
  if (realpathSync(process.argv[1]) === modulePath) {
    runCli();
  }
}

export { runCli };
