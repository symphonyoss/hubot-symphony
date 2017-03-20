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

//@flow

import {Response, User} from 'hubot';
import EventEmitter from 'events';
import V2Message from '../src/message';
import Log from 'log';

type LoggerType = {
    error: (string) => void,
    info: (string) => void,
    debug: (string) => void
};

type BrainType = {
    userForId: (string, UserPropertiesType) => User
};

type UserPropertiesType = {
    room: string
};

const logger: Log = new Log(process.env.HUBOT_SYMPHONY_LOG_LEVEL || process.env.HUBOT_LOG_LEVEL || 'info');

class FakeRobot extends EventEmitter {
    logs: Map<string, Array<string>>;
    logger: LoggerType;
    users: Map<string, User>;
    brain: BrainType;
    received: Array<V2Message>;
    Response: Response;

    constructor() {
        super();

        // echo any errors
        this.on('error', function (err: Error) {
            logger.error(err);
        });

        // required to allow nested functions to access robot state
        let self = this;

        // no-op the logging
        this.logs = new Map();
        this.logger = {
            error: function (message: string) {
                self._log('error', message);
            },
            info: function (message: string) {
                self._log('info', message);
            },
            debug: function (message: string) {
                self._log('debug', message);
            }
        };

        // save user details in brain
        this.users = new Map();
        this.brain = {
            userForId: function (id: string, options: UserPropertiesType): User {
                let user = self.users.get(id);
                if (user === undefined) {
                    logger.debug(`Creating userId ${id} = ${JSON.stringify(options)}`);
                    user = new User(id, options);
                    self.users.set(id, user);
                }
                if (options && options.room && (!user.room || user.room !== options.room)) {
                    logger.debug(`Updating userId ${id} = ${JSON.stringify(options)}`);
                    user = new User(id, options);
                    self.users.set(id, user);
                }
                return user;
            }
        };

        // record all received messages
        this.received = [];

        this.Response = Response;
    }

    _log(level: string, message: string) {
        let messages = this.logs.get(level);
        if (messages === undefined) {
            messages = [];
            this.logs.set(level, messages);
        }
        messages.push(message);
        logger[level](message);
    }

    receive(msg: V2Message) {
        this.received.push(msg);
        super.emit('received');
    }
}

module.exports = FakeRobot;