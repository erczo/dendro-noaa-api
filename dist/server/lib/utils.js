'use strict';

/**
 * NOAA API utilities and helpers.
 *
 * @author J. Scott Smith
 * @license BSD-2-Clause-FreeBSD
 * @module lib/utils
 */

const { EventEmitter } = require('events');

/**
 * Basic sequential queue class that is promise-friendly.
 */
class SeqQueue extends EventEmitter {
  constructor() {
    super();

    this.isBusy = false;
    this.queue = [];
  }

  _doTask() {
    if (!this.queue) return;

    const task = this.queue.shift();
    if (!task) {
      this.isBusy = false;
      this.emit('empty');
      return;
    }

    const ret = task.fn(task.done, task.error);

    if (ret instanceof Promise) {
      Promise.resolve(ret).then(task.done).catch(task.error);
    }
  }

  _next() {
    setImmediate(() => this._doTask());
  }

  cancel() {
    this.isBusy = false;
    this.queue = null;
  }

  push(fn) {
    if (!this.queue) return;

    let res;
    let rej;
    const p = new Promise((resolve, reject) => {
      res = resolve;
      rej = reject;
    });

    const self = this;
    const task = {
      done(value) {
        res(value);
        res = rej = null;
        self._next();
      },
      error(err) {
        rej(err);
        res = rej = null;
        self._next();
      },
      fn: fn
    };

    this.queue.push(task);

    if (!this.isBusy) {
      this.isBusy = true;
      self._next();
    }

    return p;
  }
}

exports.SeqQueue = SeqQueue;

/**
 * Works like Array.map, expect for objects.
 */
function treeMap(obj, callback, path = '') {
  if (Array.isArray(obj)) return obj.map((el, i) => {
    return treeMap(el, callback, `${path}/${i}`);
  });

  // We only want to map leaf properties of data objects
  if (obj.toString() === '[object Object]') {
    obj = Object.assign({}, obj);
    Object.keys(obj).forEach(key => {
      obj[key] = treeMap(obj[key], callback, `${path}/${key}`);
    });
    return obj;
  }
  return callback(obj, path);
}

exports.treeMap = treeMap;