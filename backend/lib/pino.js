'use strict';

/**
 * Module dependencies.
 * @private
 */
const pino = require('pino');

// Логгер.
const logger = pino();

// Устанавливаем уровень логгирования.
logger.level = process.env.LOG_LEVEL;

module.exports = logger;
