'use strict';

var express = require('express');
var httpProxyMiddleware = require('http-proxy-middleware');
var swaggerUI = require('swagger-ui-express');
var fs = require('fs/promises');
var path = require('path');
var debug = require('debug');
var glob = require('glob');
var ts = require('typescript');
var TJS = require('typescript-json-schema');
var convert = require('json-schema-to-openapi-schema');

function _interopNamespaceDefault(e) {
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var TJS__namespace = /*#__PURE__*/_interopNamespaceDefault(TJS);

function isDefined(val) {
  return val !== undefined && val !== null;
}

function assertIsDefined(
  val,
  msg,
) {
  if (!isDefined(val)) {
    throw new Error(
      `Expected 'val' to be defined, but received: ${val};${msg || ''}`,
    );
  }
}

function _optionalChain$2(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }



const accessSchema = (
  obj,
  schemas,
) => {
  if (!obj) {
    return undefined;
  }
  if ('$ref' in obj) {
    const [, schemaName] = obj.$ref.split('#/components/schemas/');
    return schemas[schemaName];
  }
  return obj;
};

const accessProperty = (
  obj,
  key,
  schemas,
) => {
  const schema = accessSchema(obj, schemas);
  if (!schema) {
    return undefined;
  }
  const combinedSchema = schema.allOf || schema.oneOf || schema.anyOf;
  if (combinedSchema) {
    return combinedSchema.map((o) => accessProperty(o, key, schemas)).find((o) => o);
  }
  const value = _optionalChain$2([schema, 'access', _ => _.properties, 'optionalAccess', _2 => _2[key]]);
  return value && accessSchema(value, schemas);
};

const getPropertyByPath = (
  obj,
  path,
  schemas,
) => {
  const [first, ...rest] = path.split('.');
  const firstValue = accessProperty(obj, first, schemas);
  if (rest.length === 0) {
    return firstValue;
  }
  return getPropertyByPath(firstValue, rest.join('.'), schemas);
};

const getText = (obj) => {
  if (!obj || '$ref' in obj || obj.type !== 'string' || _optionalChain$2([obj, 'access', _3 => _3.enum, 'optionalAccess', _4 => _4.length]) !== 1) {
    return undefined;
  }
  return obj.enum[0];
};

const getTextPropertyByPath = (
  obj, path, schemas, options,
) => {
  const text = getText(getPropertyByPath(obj, path, schemas));
  if (_optionalChain$2([options, 'optionalAccess', _5 => _5.required]) === true && !text) {
    throw new Error(`Invalid '${path}' in ApiSpec`);
  }
  return text ;
};

const getTextListPropertyByPath = (
  obj,
  path,
  schemas,
  options,
) => {
  const value = getPropertyByPath(obj, path, schemas);
  if (!value || '$ref' in value || value.type !== 'array' || !value.items) {
    if (_optionalChain$2([options, 'optionalAccess', _6 => _6.required]) === true) {
      throw new Error(`Invalid '${path}' in ApiSpec`);
    }
    return [];
  }
  return (value.items )
    .map((item) => getText(item)).filter((item) => !!item);
};

const getObjectPropertyByPath = (
  obj, path, schemas, options,
) => {
  const value = getPropertyByPath(obj, path, schemas);
  if (!value || '$ref' in value || value.type !== 'object' || !value.properties) {
    if (_optionalChain$2([options, 'optionalAccess', _7 => _7.required]) === true) {
      throw new Error(
        `Invalid '${path}' in ${JSON.stringify(obj)}; value: ${JSON.stringify(value)}`,
      );
    }
    return undefined;
  }
  return { ...value, properties: value.properties };
};

function _optionalChain$1(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }

const DEBUG$1 = debug('tspec');









const parseBooleanAnnotation = (value) => {
  if (value === undefined) {
    return undefined;
  }
  if (value === '' || value === 'true' || value === true) {
    return true;
  }
  return false;
};

const getParameters = (obj, inType) => {
  const { properties, required } = obj;
  if (!properties) {
    return undefined;
  }
  return Object.entries(properties).map(([key, schema]) => {
    const {
      description, style, explode, allowReserved, allowEmptyValue,...rest
    } = schema ;
    return {
      description,
      name: key,
      in: inType,
      required: inType === 'path' ? true : (required || []).includes(key),
      schema: rest,
      style,
      explode: parseBooleanAnnotation(explode),
      allowReserved: parseBooleanAnnotation(allowReserved), 
      allowEmptyValue: parseBooleanAnnotation(allowEmptyValue),
    };
  });
};

const resolveParameters = ({ path, query, header, cookie }) => {
  const pathParams = (path && getParameters(path, 'path')) || [];
  const queryParams = (query && getParameters(query, 'query')) || [];
  const headerParams = (header && getParameters(header, 'header')) || [];
  const cookieParams = (cookie && getParameters(cookie, 'cookie')) || [];
  return [...pathParams, ...queryParams, ...headerParams, ...cookieParams];
};

const getOpenapiPaths = (
  openapiSchemas,
  tspecSymbols,
) => {
  const openapiPaths = {};

  const specs = tspecSymbols.flatMap((tspecSymbol) => {
    const paths = openapiSchemas[tspecSymbol].properties || {};
    return Object.keys(paths).flatMap((path) => {
      const methods = _optionalChain$1([accessSchema, 'call', _ => _(paths[path], openapiSchemas), 'optionalAccess', _2 => _2.properties]) || {};
      return Object.keys(methods).map((method) => {
        const spec = accessSchema(methods[method], openapiSchemas);
        assertIsDefined(spec);
        return {
          controllerName: tspecSymbol, path, method, spec,
        };
      });
    });
  });

  specs.forEach(({
    controllerName, path, method, spec,
  }) => {
    DEBUG$1({ controllerName, path, method });
    DEBUG$1({ spec: JSON.stringify(spec, null, 2) });
    const url = getTextPropertyByPath(spec, 'url', openapiSchemas, { required: true });
    const summary = getTextPropertyByPath(spec, 'summary', openapiSchemas);
    const description = getTextPropertyByPath(spec, 'description', openapiSchemas);
    const security = getTextPropertyByPath(spec, 'security', openapiSchemas);
    const tags = getTextListPropertyByPath(spec, 'tags', openapiSchemas);
    const responses = getObjectPropertyByPath(
      spec,
      'responses',
      openapiSchemas,
      { required: true },
    ).properties;

    const pathParams = getObjectPropertyByPath(spec, 'path', openapiSchemas) ;
    const queryParams = getObjectPropertyByPath(spec, 'query', openapiSchemas) ;
    const headerParams = getObjectPropertyByPath(spec, 'header', openapiSchemas) ;
    const cookieParams = getObjectPropertyByPath(spec, 'cookie', openapiSchemas) ;

    const bodyParams = getObjectPropertyByPath(spec, 'body', openapiSchemas) ;

    const operation = {
      operationId: `${controllerName}_${method}_${path}`,
      tags,
      summary,
      description,
      security: security && [{ [security]: [] }],
      parameters: resolveParameters({
        path: pathParams,
        query: queryParams,
        header: headerParams,
        cookie: cookieParams,
      }),
      requestBody: bodyParams && {
        description: bodyParams.description,
        required: true,
        content: {
          'application/json': {
            schema: bodyParams,
          },
        },
      },
      responses: Object.fromEntries(
        Object.entries(responses).map(([code, schema]) => {
          const resSchema = {
            description: (schema ).description || '',
            content: {
              'application/json': {
                schema,
              },
            },
          };
          return [code, resSchema];
        }),
      ),
    };
    (openapiPaths[url] ||= {})[method ] = operation ;
  });

  return openapiPaths;
};

const isSchemaNullableOnly = (s) => (
  Object.keys(s).filter((key) => s[key] !== undefined).length === 1 && s.nullable
);

const convertCombinedNullableInner = (schema, field) => {
  const types = schema[field] || [];
  const nullable = types.some((s) => isSchemaNullableOnly(s)) || undefined;
  return {
    ...schema,
    [field]: types.filter((s) => !isSchemaNullableOnly(s)),
    nullable,
  };
};

/** NOTE(hyeonseong): when anyOf or oneOf contains null, it should be nullable. */
const handleCombinedNullable = (schema) => { // TODO: fix types
  if (schema.anyOf) {
    return convertCombinedNullableInner(schema, 'anyOf');
  }
  if (schema.oneOf) {
    return convertCombinedNullableInner(schema, 'oneOf');
  }
  return schema;
};

const convertToNullableSchema = (schema) => {
  if (schema.type && !Array.isArray(schema.type) && schema.type === 'null') {
    return {
      ...schema,
      type: undefined,
      nullable: true,
    };
  }
  if (schema.type && Array.isArray(schema.type) && schema.type.length > 1) {
    const nullable = schema.type.includes('null');
    const types = schema.type.filter((type) => type !== 'null');
    if (types.length === 1) {
      return {
        ...schema,
        type: types[0],
        nullable,
      };
    }
    return {
      ...schema,
      type: undefined,
      oneOf: schema.type
        .filter((type) => type !== 'null')
        .map((type) => ({ ...schema, type })),
      nullable,
    };
  }
  return schema;
};

const handleExamples = (schema) => { // TODO: fix types
  if (schema.examples) {
    const { examples, ...rest } = schema;
    return {
      ...rest,
      example: Array.isArray(examples) ? examples[0] : examples,
    };
  }
  return schema;
};

const handleConst = (schema) => { // TODO: fix types
  if (schema.const) {
    const { const: c, ...rest } = schema;
    return {
      ...rest,
      enum: [c],
    };
  }
  return schema;
};

const handleDeprecated = (schema) => { // TODO: fix types
  if (schema.deprecated !== undefined && schema.deprecated !== false) {
    const { deprecated, ...rest } = schema;
    return {
      ...rest,
      deprecated: true,
    };
  }
  return schema;
};

const convertToOpenapiTypes = (schema) => { // TODO: fix types
  if (Array.isArray(schema)) {
    return schema.map((s) => convertToOpenapiTypes(s));
  }
  if (schema && typeof schema === 'object') {
    const nullableSchema = convertToNullableSchema(schema);
    const convertedSchema = Object.fromEntries(
      Object.entries(nullableSchema).map(([key, value]) => [key, convertToOpenapiTypes(value)]),
    );
    const handlers = [handleCombinedNullable, handleExamples, handleConst, handleDeprecated];
    return handlers.reduce((acc, handler) => handler(acc), convertedSchema);
  }
  return schema;
};

const findAllRefAndReplace = (schema, nameMapping) => { // TODO: fix types
  if (Array.isArray(schema)) {
    return schema.map((s) => findAllRefAndReplace(s, nameMapping));
  }
  if (schema && typeof schema === 'object') {
    if (schema.$ref) {
      const [, schemaName] = schema.$ref.split('#/definitions/');
      return {
        ...schema,
        $ref: `#/components/schemas/${nameMapping[schemaName]}`,
      };
    }
    return Object.fromEntries(
      Object.entries(schema).map(([key, value]) => [key, findAllRefAndReplace(value, nameMapping)]),
    );
  }
  return schema;
};

const escapeSchemaNames = (schemas) => {
  const escapedNameMapping = Object.fromEntries(Object.keys(schemas).map((schemaName) => (
    // only contain the characters A-Z a-z 0-9 - . _
    [schemaName, schemaName.replace(/[^A-Za-z0-9_.-]/g, '_')]
  )));
  const escapedSchemas = Object.fromEntries(Object.entries(schemas).map(([schemaName, schema]) => (
    [escapedNameMapping[schemaName], schema]
  )));
  // eslint-disable-next-line max-len
  return findAllRefAndReplace(escapedSchemas, escapedNameMapping) ; // TODO: fix types
};

const convertToOpenapiSchemas = async (
  jsonSchemas,
) => {
  const convertedJsonSchemas = convertToOpenapiTypes(jsonSchemas);
  const openapiSchemas = await convert(convertedJsonSchemas) ;
  return escapeSchemaNames(openapiSchemas);
};

function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }

const DEBUG = debug('tspec');

const isNodeExported = (node) => (
  // eslint-disable-next-line no-bitwise
  (ts.getCombinedModifierFlags(node ) & ts.ModifierFlags.Export) !== 0
  || (!!node.parent && node.parent.kind === ts.SyntaxKind.SourceFile)
);

const getTspecSignatures = (p) => {
  const entryPoints = p
    .getRootFileNames()
    .map((entryPointName) => p.getSourceFile(entryPointName)).filter(isDefined);

  const names = [];
  entryPoints.forEach((srcFile) => {
    srcFile.forEachChild((node) => {
      if (!isNodeExported(node)) {
        return;
      }

      // NOTE(hyeonseong): typescript 5.0 changed node kind of type alias declaration.
      // if (
      //   !ts.isTypeAliasDeclaration(node)
      //   || !ts.isTypeReferenceNode(node.type)
      // ) {
      //   return;
      // }

      if (_optionalChain([(node ), 'access', _ => _.type, 'optionalAccess', _2 => _2.typeName, 'optionalAccess', _3 => _3.right, 'optionalAccess', _4 => _4.escapedText]) !== 'DefineApiSpec') {
        return;
      }
      const name = (node ).name.escapedText ;
      if (names.includes(name)) {
        throw new Error(`Duplicate name: ${name}`);
      }
      names.push(name);
    });
  });

  return names;
};

const getCompilerOptions = (tsconfigPath) => {
  const { config, error } = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (error) {
    throw new Error(error.messageText );
  }
  return {
    ...config.compilerOptions,
    noEmit: true,
  };
};

const getDefaultProgramFiles = (compilerOptions) => {
  const { rootDir, rootDirs } = compilerOptions;
  const globs = [rootDir, ...(rootDirs || [])].filter(isDefined)
    .flatMap((r) => [`${r}/*.ts`, `${r}/**/*.ts`]);
  if (globs.length === 0) {
    return ['**/*.ts'];
  }
  return globs;
};

const getProgramFiles = (compilerOptions, specPathGlobs) => {
  const srcGlobs = specPathGlobs || getDefaultProgramFiles(compilerOptions);
  const programFils = [...new Set(srcGlobs.flatMap((g) => glob.sync(g, {
    ignore: ['**/node_modules/**'],
  })))];
  DEBUG({ programFils });
  return programFils;
};

/**
 * 제대로 동작하지 않는 케이스..?
 * 1. Partial of Record
 * export type BlockRegions = Partial<Record<'es' | 'en', { blockAt: string }>>;
 */
const getOpenapiSchemas = async (
  tsconfigPath,
  specPathGlobs,
  ignoreErrors,
) => {
  const compilerOptions = getCompilerOptions(tsconfigPath);
  DEBUG({ compilerOptions });
  const files = getProgramFiles(compilerOptions, specPathGlobs);
  DEBUG({ files });
  const program = TJS__namespace.getProgramFromFiles(files, compilerOptions);

  const tjsSettings = {
    required: true,
    noExtraProps: true,
    strictNullChecks: true,
    ignoreErrors: ignoreErrors || true,
    esModuleInterop: compilerOptions.esModuleInterop,
    // rejectDateType: true,
    validationKeywords: [
      /** NOTE: JSON schema keywords. see https://swagger.io/docs/specification/data-models/keywords/ */
      'title', 'pattern',
      'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
      'minLength', 'maxLength', 'pattern',
      'minItems', 'maxItems', 'uniqueItems',
      'minProperties', 'maxProperties',
      /** NOTE: These keywords are supported with minor differences */
      /** 'type', */ 'format', 'description', 'default',
      /** NOTE: Additional keywords */
      'deprecated', 'discriminator', 'example', 'externalDocs', 'nullable', /** 'readOnly', 'writeOnly', */
      /** NOTE: parameter validation. see https://swagger.io/docs/specification/describing-parameters/ */
      'allowReserved', 'style', 'form', 'allowEmptyValue', 'explode', 
    ],
  };
  DEBUG({ tjsSettings });
  const generator = TJS__namespace.buildGenerator(program, tjsSettings);
  assertIsDefined(generator);

  const tspecSymbols = getTspecSignatures(program );
  DEBUG({ tspecSymbols });
  const { definitions: jsonSchemas } = generator.getSchemaForSymbols(tspecSymbols);
  assertIsDefined(jsonSchemas);
  DEBUG({ schemaKeys: Object.keys(jsonSchemas) });

  const openapiSchemas = await convertToOpenapiSchemas(jsonSchemas);

  return { openapiSchemas, tspecSymbols };
};

const getOpenapiSchemasOnly = (openapiSchemas, tspecSymbols) => {
  const tspecPathSchemas = tspecSymbols.flatMap((tspecSymbol) => {
    const paths = openapiSchemas[tspecSymbol].properties || {};
    DEBUG({ tspecSymbol, paths });
    return Object.keys(paths).map((path) => {
      const obj = paths[path];
      if ('$ref' in obj) {
        const [, schemaName] = obj.$ref.split('#/components/schemas/');
        return schemaName;
      }
      return undefined;
    });
  });

  return Object.fromEntries(
    Object.entries(openapiSchemas).filter(
      ([key]) => (!tspecSymbols.includes(key) && !tspecPathSchemas.includes(key)),
    ),
  );
};

const generateTspec = async (
  params = {},
) => {
  const {
    openapiSchemas, tspecSymbols,
  } = await getOpenapiSchemas(
    params.tsconfigPath || 'tsconfig.json',
    params.specPathGlobs,
    params.ignoreErrors,
  );

  const paths = getOpenapiPaths(openapiSchemas, tspecSymbols);
  const schemas = getOpenapiSchemasOnly(openapiSchemas, tspecSymbols);

  const openapi = {
    info: {
      title: _optionalChain([params, 'access', _5 => _5.openapi, 'optionalAccess', _6 => _6.title]) || 'Tspec API',
      version: _optionalChain([params, 'access', _7 => _7.openapi, 'optionalAccess', _8 => _8.version]) || '0.0.1',
    },
    openapi: (params.specVersion === 3 && '3.0.3') || '3.0.3',
    paths,
    components: {
      schemas,
      securitySchemes: _optionalChain([params, 'access', _9 => _9.openapi, 'optionalAccess', _10 => _10.securityDefinitions]),
    },
    servers: _optionalChain([params, 'access', _11 => _11.openapi, 'optionalAccess', _12 => _12.servers]),
  };

  if (params.outputPath) {
    await fs.mkdir(path.dirname(params.outputPath), { recursive: true });
    await fs.writeFile(params.outputPath, JSON.stringify(openapi, null, 2));
  }

  return openapi;
};

const initTspecServer = async (options) => {
  const { port = 7000, proxyHost, ...generateOptions } = options || {};
  const app = express();
  const openapiSpec = await generateTspec(generateOptions);
  app.use('/docs', swaggerUI.serve, swaggerUI.setup(openapiSpec));
  if (proxyHost) {
    app.use('/', httpProxyMiddleware.createProxyMiddleware({
      target: proxyHost,
      changeOrigin: true,
      logLevel: 'warn',
    }));
  }
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Tspec API server is running on http://localhost:${port}/docs`);
    if (proxyHost) {
      // eslint-disable-next-line no-console
      console.log(`Tspec API server is proxying to ${proxyHost}`);
    }
  });
};

const TspecDocsMiddleware = async (
  generateOptions,
) => {
  const openapiSpec = await generateTspec(generateOptions);
  return [...swaggerUI.serve, swaggerUI.setup(openapiSpec)];
};

exports.DEBUG = DEBUG;
exports.TspecDocsMiddleware = TspecDocsMiddleware;
exports.assertIsDefined = assertIsDefined;
exports.generateTspec = generateTspec;
exports.initTspecServer = initTspecServer;
