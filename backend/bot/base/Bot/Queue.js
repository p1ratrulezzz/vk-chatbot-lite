'use strict';

/**
 * Класс, реализующий работу очереди сообщений.
 */
class Queue {
  /**
   * Constructor.
   * @param  {Object} options
   *   @property {Number} limit Максимальное кол-во сообщений в очереди
   * @return {this}
   * @public
   */
  constructor ({ limit }) {
    /**
     * Очередь сообщений.
     * @type {Array of QueueItem}
     *
     * QueueItem:
     *   [
     *    chatId<Number>
     *    message<Object>
     *   ]
     */
    this.queue = [];

    /**
     * Максимальное кол-во сообщений в очереди.
     * @type {Number}
     */
    this.limit = limit || 50;
  }

  /**
   * Помещает сообщение в конец очереди.
   * @param  {Object} message Объект сообщения
   * @return {void}
   * @public
   */
  enqueue (message) {
    const conversationId = message.chat_id || message.user_id;

    /**
     * * Только для сообщений без прикреплений.
     *
     * Если в очереди есть сообщение в диалог conversationId,
     * то добавляем к нему ещё одно и выходим из функции.
     *
     * Если такого conversationId в очереди не оказалось,
     * то добавляем новое сообщение в очередь (по завершению цикла).
     */
    if (!message.attachment && !message.captcha_key) {
      // Пробегаемся по очереди и находим нужный conversationId.
      for (let i = 0, len = this.queue.length; i < len; i++) {
        // Убедимся, что в сообщении нет прикреплений
        if (this.queue[i] && this.queue[i][0] === conversationId && !this.queue[i][1].attachment) {
          // Объединяем текущее сообщение с найденным сообщением в очереди
          this.queue[i][1].message          += '\n\n' + message.message;
          this.queue[i][1].forward_messages += ',' + message.forward_messages;

          return;
        }
      }
    }

    // Если же сообщение содержит прикрепления, либо для данного сообщения не было
    // найдено подходящее сообщение в очереди (без прикреплений), то добавляем новый массив в конец очереди.
    this.queue.push([conversationId, message]);
  }

  /**
   * Удаляет первый элемент из очереди и возвращает его.
   * @return {Object}
   * @public
   */
  dequeue () {
    const queueItem = this.queue.shift();

    return queueItem && queueItem[1];
  }

  /**
   * Удаляет все сообщения из очереди для определённой беседы.
   * @param  {Number} chatId ID беседы
   * @return {void}
   * @public
   */
  clearById (chatId) {
    let i = 0;

    // Пробегаемся по очереди и удаляем из неё сообщения для беседы chatId.
    while (i++ < this.queue.length) {
      if (this.queue[i] && this.queue[i][0] === chatId) {
        this.queue[i] = null;
      }
    }
  }

  /**
   * Вернёт true, если очередь пуста.
   * @return {Boolean}
   * @public
   */
  isEmpty () {
    return this.queue.length === 0;
  }

  /**
   * Вернёт true, если очередь заполнена.
   * @return {Boolean}
   * @public
   */
  isFull () {
    return this.queue.length === this.limit;
  }
}

module.exports = Queue;
