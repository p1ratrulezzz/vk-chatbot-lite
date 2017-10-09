'use strict';

/**
 * Module dependencies.
 * @private
 */
const server = new (require('./Server'));
const config = require('../config');

[
  '/api/captcha.getAll',
  '/api/captcha.image',
  '/api/captcha.send'
].forEach(path => server.router.route(path, require('./routes' + path)));

server.listen(config['www-port']);
