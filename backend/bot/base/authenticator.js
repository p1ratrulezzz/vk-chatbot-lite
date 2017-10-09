'use strict';

/**
 * Module dependencies.
 * @private
 */
const VkApi = require('node-vkapi');
const pino  = require('../../lib/pino');

/**
 * Авторизует бота, используя данные из "account".
 * @param   {Object}            account { login<String>, password<String> }
 * @return  {Promise => Object}         { botId<Number>, token<String> }
 * @private
 */
async function authenticate (account) {
  const vkapi = new VkApi();

  // Авторизуем бота с максимальными разрешениями в официальном
  // приложении ВКонтакте для Android, используя логин и пароль.
  return vkapi.authorize(account)
    .then(response => {
      pino.info('Bot id%d was successfully authorized.', response.user_id);

      return {
        botId: response.user_id,
        token: response.access_token
      }
    });
}

/**
 * Авторизует ботов, перечисленных в "accounts".
 * @param  {Array}                      accounts [{ login<String>, password<String> }, ...]
 * @return {Promise => Array of Object}
 * @public
 */
async function authenticator (accounts) {
  return Promise.all(
    accounts.map(async account => authenticate(account))
  );
}

module.exports = authenticator;
