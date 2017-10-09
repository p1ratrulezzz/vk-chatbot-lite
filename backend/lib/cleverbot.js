'use strict';

/**
 * Module dependencies.
 * @private
 */
const { URLSearchParams } = require('url');
const xml2js              = require('xml2js');
const fetch               = require('./fetch');
const config              = require('../config');

/**
 * Local constants.
 * @private
 */
const REQUEST_URL = 'http://cleverbot.existor.com/webservicexml';

/**
 * Парсит ответ Cleverbot.
 * @param   {String}  response XML-документ
 * @return  {Promise}
 * @private
 */
async function parseResponse (response) {
  if (!response || !response.length) {
    throw new Error('"response" is empty.');
  }

  return new Promise((resolve, reject) => {
    xml2js.parseString(response, (err, result) => {
      if (err) {
        // Не возвращаем и не логгируем ошибки парсера.
        return resolve();
      }

      resolve(result.webservicexml.session[0].response[0]);
    });
  });
}

/**
 * Получает ответ на сообщение.
 * @param  {String}  messageText Текст сообщения
 * @return {Promise}
 * @public
 */
async function send (messageText) {
  if (!messageText) {
    throw new Error('"messageText" can not be empty.');
  }

  return fetch(REQUEST_URL, {
      method: 'POST',
      body:   new URLSearchParams({
        icognoID:    config['cleverbot-username'],
        icognoCheck: config['cleverbot-password'],
        isLearning:  '0',
        stimulus:    messageText
      })
    })
    .then(response => response.text())
    .then(response => parseResponse(response));
}

module.exports = {
  send
}
