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

util = require 'util'
logger = require('log4js').getLogger()
argv = require('yargs')
  .usage('Usage: $0 --publicKey [key1.pem] --privateKey [key2.pem] --host [host.symphony.com]')
  .demand(['publicKey', 'privateKey', 'host'])
  .argv

Symphony = require './symphony'

if argv.runOffline?
  logger.info 'Instantiating nock server...'
  NockServer = require '../test/nock-server'
  nock = new NockServer('https://foundation.symphony.com')

logger.info util.format('Running diagnostics against https://%s', argv.host)

symphony = new Symphony(argv.host, argv.privateKey, argv.publicKey)

logger.info 'Connection initiated, starting tests...'

# check tokens
symphony.sessionAuth
  .then (response) =>
    logger.info util.format('Session token: %s', response.token)
  .fail (err) =>
    logger.error util.format('Failed to fetch session token: %s', err)
  .done
symphony.keyAuth
  .then (response) =>
    logger.info util.format('Key manager token: %s', response.token)
  .fail (err) =>
    logger.error util.format('Failed to fetch key manager token: %s', err)
  .done

# who am i
userId = symphony.whoAmI()
  .then (response) =>
    logger.info util.format('UserId: %s', response.userId)
    symphony.getUser(response.userId)
  .then (response) =>
    logger.info util.format('My name is %s [%s] and I\'m %s', response.userAttributes?.displayName, response.userAttributes?.emailAddress, response.userSystemInfo?.status)
  .fail (err) =>
    logger.error util.format('Failed to fetch userId: %s', err)
  .done
