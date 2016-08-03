#
#    Copyright 2016 Jon Freedman
#
#    Licensed under the Apache License, Version 2.0 (the "License");
#    you may not use this file except in compliance with the License.
#    You may obtain a copy of the License at
#
#        http://www.apache.org/licenses/LICENSE-2.0
#
#    Unless required by applicable law or agreed to in writing, software
#    distributed under the License is distributed on an "AS IS" BASIS,
#    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#    See the License for the specific language governing permissions and
#    limitations under the License.
#

{Response} = require 'hubot'
EventEmitter = require 'events'
Log = require('log')
logger = new Log process.env.HUBOT_SYMPHONY_LOG_LEVEL or process.env.HUBOT_LOG_LEVEL or 'info'

class FakeRobot extends EventEmitter
  
  constructor: ->
    # noop the logging
    @logs = {}
    @logger = {
      info: (message) =>
        @_log('info', message)
      debug: (message) =>
        @_log('debug', message)
      error: (message) =>
        @_log('error', message)
    }

    # record all received messages
    @received = []

    @Response = Response

  _log: (type, message) =>
    @logs[type] ?= []
    @logs[type].push(message)
    logger[type] message

  receive: (msg) =>
    @received.push msg
    @emit 'received'

module.exports = {
  FakeRobot
}
