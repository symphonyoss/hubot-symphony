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

logger = require('log4js').getLogger()
argv = require('yargs')
  .usage('Usage: $0 --publicKey [key1.pem] --privateKey [key2.pem] --passphrase [changeit] --host [host.symphony.com]')
  .demand(['publicKey', 'privateKey', 'host', 'passphrase'])
  .argv

Symphony = require './symphony'

if argv.runOffline?
  logger.info 'Instantiating nock server...'
  NockServer = require '../test/nock-server'
  nock = new NockServer('https://foundation.symphony.com')

logger.info "Running diagnostics against https://#{argv.host}"

symphony = new Symphony(argv.host, argv.privateKey, argv.publicKey, argv.passphrase)

logger.info 'Connection initiated, starting tests...'

# check tokens
symphony.sessionAuth
  .then (response) =>
    logger.info "Session token: #{response.token}"
  .fail (err) =>
    logger.error "Failed to fetch session token: #{err}"
  .done
symphony.keyAuth
  .then (response) =>
    logger.info "Key manager token: #{response.token}"
  .fail (err) =>
    logger.error "Failed to fetch key manager token: #{err}"
  .done

# who am i
userId = symphony.whoAmI()
  .then (response) =>
    logger.info "UserId: #{response.userId}"
    symphony.getUser(response.userId)
  .then (response) =>
    logger.info "My name is #{response.userAttributes?.displayName} [#{response.userAttributes?.emailAddress}] and I'm #{response.userSystemInfo?.status}"
  .fail (err) =>
    logger.error "Failed to fetch userId: #{err}"
  .done

# read a message...
symphony.createDatafeed()
  .then (response) =>
    logger.info "Created datafeed: #{response.id}"
    logger.info "You should send me a message..."
    symphony.readDatafeed(response.id)
  .then (response) =>
    logger.info "Received '#{msg.message}'" for msg in response when msg.v2messageType = 'V2Message'
  .fail (err) =>
    logger.error "Failed to receive a message: #{err}"