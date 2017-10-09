'use strict';

/**
 * Module dependencies.
 * @private
 */
const Captcha = require('../../../bot/base/Bot/Captcha');

/**
 * Обработчик запроса.
 * @param  {Request}  request  http.IncomingMessage
 * @param  {Response} response http.ServerResponse
 * @return {void}
 * @public
 */
async function handler (request, response) {
  const activeCaptcha = await Captcha.getAll();

  if (!activeCaptcha) {
    return response.ok([]);
  }

  response.ok(activeCaptcha);
}

module.exports = handler;
