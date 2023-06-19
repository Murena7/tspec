'use strict';

var index = require('./chunks/index.cjs');
require('express');
require('http-proxy-middleware');
require('swagger-ui-express');
require('fs/promises');
require('path');
require('debug');
require('glob');
require('typescript');
require('typescript-json-schema');
require('json-schema-to-openapi-schema');



exports.DEBUG = index.DEBUG;
exports.TspecDocsMiddleware = index.TspecDocsMiddleware;
exports.generateTspec = index.generateTspec;
exports.initTspecServer = index.initTspecServer;
