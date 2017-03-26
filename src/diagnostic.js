/**
 *    Copyright 2017 Jon Freedman
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

// @flow

// / !pragma coverage-skip-block ///

import Log from 'log';
import Symphony from './symphony';
import NockServer from '../test/nock-server';

const logger: Log = new Log(process.env.HUBOT_SYMPHONY_LOG_LEVEL || process.env.HUBOT_LOG_LEVEL || 'info');

let argv = require('yargs')
    .usage('Usage: $0 --publicKey [key1.pem] --privateKey [key2.pem] --passphrase [changeit] ' +
      '--host [host.symphony.com] --kmhost [keymanager.host.com] --agenthost [agent.host.com] ' +
      '--sessionhost [session.host.com]')
    .demand(['publicKey', 'privateKey', 'host', 'passphrase'])
    .argv;

let nock: NockServer;

if (argv.runOffline) {
  logger.info('Instantiating nock server...');
  nock = new NockServer({host: 'https://foundation.symphony.com'});
}

logger.info(`Running diagnostics against https://${argv.host}`);

let symphony = new Symphony({
  host: argv.host,
  privateKey: argv.privateKey,
  publicKey: argv.publicKey,
  passphrase: argv.passphrase,
  keyManagerHost: argv.kmhost || argv.host,
  agentHost: argv.agenthost || argv.host,
  sessionAuthHost: argv.sessionhost || argv.host,
});

logger.info('Connection initiated, starting tests...');

// check tokens
symphony.sessionAuth()
  .then((response) => {
    logger.info(`Session token: ${response.token}`);
  })
  .catch((err) => {
    logger.error(`Failed to fetch session token: ${err}`);
  });
symphony.keyAuth()
  .then((response) => {
    logger.info(`Key manager token: ${response.token}`);
  })
  .catch((err) => {
    logger.error(`Failed to fetch key manager token: ${err}`);
  });

// who am i
symphony.whoAmI()
  .then((response) => {
    logger.info(`UserId: ${response.userId}`);
    return symphony.getUser({userId: response.userId});
  })
  .then((response) => {
    logger.info(`My name is ${response.displayName} [${response.emailAddress}]`);
  })
  .catch((err) => {
    logger.error(`Failed to fetch userId: ${err}`);
  });

// read message...
symphony.createDatafeed()
  .then((response) => {
    logger.info(`Created datafeed: ${response.id}`);
    logger.info('You should send me a message...');
    return symphony.readDatafeed(response.id);
  })
  .then((response) => {
    for (const msg of response) {
      if (msg.v2messageType === 'V2Message') {
        logger.info(`Received '${msg.message}'`);
      }
    }
    if (argv.runOffline) {
      nock.close();
    }
    process.exit(0);
  })
  .catch((err) => {
    logger.error(`Failed to fetch key manager token: ${err}`);
  });
