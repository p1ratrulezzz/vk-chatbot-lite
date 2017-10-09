'use strict';

/**
 * Module dependencies.
 * @private
 */
const http        = require('http');
const querystring = require('querystring');

/**
 * Отправляет JSON-ответ на запрос.
 * @param   {Any}  data Данные к отправке
 * @return  {void}
 * @private
 *
 * this #http.ServerResponse
 */
function responseWithJSON (data) {
  if (!this.headersSent) {
    this.writeHead(200, {
      'Content-Type': 'application/json; charset=UTF-8'
    });
  }

  this.end(JSON.stringify(data));
}

// response.err()
http.ServerResponse.prototype.err = function err (cause) {
  responseWithJSON.call(this, {
    ok: false,
    cause
  });
}

// response.ok()
http.ServerResponse.prototype.ok = function ok (response) {
  responseWithJSON.call(this, {
    ok: true,
    response
  });
}

/**
 * Обработчик всех входящих запросов.
 * @param  {Request}  request  http.IncomingMessage
 * @param  {Response} response http.ServerResponse
 * @return {void}
 * @public
 *
 * this #Server
 */
function requestHandler (request, response) {
  let   url        = request.url;
  const signIndex  = url.indexOf('?', 1);

  request.query = Object.create(null);

  // Парсим параметры запроса.
  if (~signIndex) {
    request.query = querystring.parse(url.slice(signIndex + 1));
    url           = url.slice(0, signIndex);
  }

  // Удаляем слэши в конце строки URL.
  if (url.length > 1 && url.endsWith('/')) {
    url = url.slice(0, -1);
  }

  const routeHandler = this.router.resolve(url);

  // Нет обработчика для этого маршрута.
  if (!routeHandler) {
    response.writeHead(404);
    response.end();

    return;
  }

  routeHandler(request, response);
}

class Router {
  constructor () {
    this.routes = Object.create(null);
  }

  /**
   * Возвращает обработчик маршрута.
   * @param  {String}   url Маршрут
   * @return {Function}     Обработчик (undefined, если обработчика нет)
   * @public
   */
  resolve (url) {
    if (!url) {
      return;
    }

    return this.routes[url];
  }

  /**
   * Добавляет обработчик маршрута.
   * @param  {String}   path Маршрут
   * @param  {Function} func Обработчик
   * @return {Router}
   * @public
   */
  route (path, func) {
    if (!path || !func) {
      return;
    }

    // Добавляем начальный слэш, если его нет.
    if (!path.startsWith('/')) {
      path = '/' + path;
    }

    // Убираем слэши в конце адреса, если они есть.
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }

    this.routes[path] = func;

    return this;
  }
}

class Server {
  constructor () {
    this.instance = null;
    this.router   = new Router();
  }

  /**
   * Останавливает сервер.
   * @return {void}
   * @public
   */
  close () {
    if (!this.instance) {
      return;
    }

    this.instance.close();
  }

  /**
   * Запускает сервер.
   * @param  {Number} port Порт
   * @return {void}
   * @public
   */
  listen (port = 3000) {
    if (this.instance) {
      return;
    }

    this.instance = http.createServer(requestHandler.bind(this));
    this.instance.listen(port);
  }
}

module.exports = Server;
