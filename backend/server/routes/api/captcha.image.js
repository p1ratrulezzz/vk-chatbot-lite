'use strict';

/**
 * Module dependencies.
 * @private
 */
const fetch = require('../../../lib/fetch');

/**
 * Обработчик запроса.
 * @param  {Request}  request  http.IncomingMessage
 * @param  {Response} response http.ServerResponse
 * @return {void}
 * @public
 */
function handler (request, response) {
  /**
   * Captcha SID.
   * @type {String}
   */
  const captchaSid = request.query.sid;

  if (!captchaSid) {
    return response.err('"sid" is undefined.');
  }

  return fetch('https://api.vk.com/captcha.php', {
    qs: {
      sid: captchaSid,
      s:   '1'
    }
  })
    .then(image => image.body.pipe(response));
}

module.exports = handler;
