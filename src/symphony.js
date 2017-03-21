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

import fs from 'fs';
import request from 'request';
import memoize from 'memoizee';
import Log from 'log';

const logger: Log = new Log(process.env.HUBOT_SYMPHONY_LOG_LEVEL || process.env.HUBOT_LOG_LEVEL || 'info');

type ConstructorArgsType = {
    host: string,
    privateKey: string,
    publicKey: string,
    passphrase: string,
    keyManagerHost?: string,
    sessionAuthHost?: string,
    agentHost?: string
};

export type AuthenticateResponseType = {
    name: string,
    token: string
};

export type EchoType = {
    message: string
};

export type SymphonyUserIdType = {
    userId: number
};

export type GetUserArgsType = {
    userId?: number,
    username?: string,
    emailAddress?: string
};

export type SymphonyUserType = {
    id: number,
    emailAddress: string,
    firstName: string,
    lastName: string,
    displayName: string,
    company: string,
    username: string
};

export type SymphonyAttachmentType = {
    id: string,
    name: string,
    size: number
};

export type SymphonyMessageType = {
    id: string,
    timestamp: string,
    v2messageType: string,
    streamId: string,
    message: string,
    attachments: Array<SymphonyAttachmentType>,
    fromUserId: number
};

export type CreateDatafeedResponseType = {
    id: string
};

export type CreateIMResponseType = {
    id: string
};

class Symphony {
    host: string;
    keyManagerHost: string;
    sessionAuthHost: string;
    agentHost: string;
    privateKey: string;
    publicKey: string;
    passphrase: string;
    sessionAuth: () => Promise<AuthenticateResponseType>;
    keyAuth: () => Promise<AuthenticateResponseType>;

    constructor(args: ConstructorArgsType) {
        this.host = args.host;
        this.keyManagerHost = args.keyManagerHost || args.host;
        this.sessionAuthHost = args.sessionAuthHost || args.host;
        this.agentHost = args.agentHost || args.host;
        this.privateKey = args.privateKey;
        this.publicKey = args.publicKey;
        this.passphrase = args.passphrase;
        logger.info(`Connecting to ${this.host}`);
        if (this.keyManagerHost !== this.host) {
            logger.info(`Using separate KeyManager ${this.keyManagerHost}`);
        }
        if (this.sessionAuthHost !== this.host) {
            logger.info(`Using separate SessionAuth ${this.sessionAuthHost}`);
        }
        if (this.agentHost !== this.host) {
            logger.info(`Using separate Agent ${this.agentHost}`);
        }
        // refresh tokens on a weekly basis
        let weeklyRefresh = memoize(this._httpPost.bind(this), {maxAge: 604800000, length: 2});
        this.sessionAuth = function (): Promise<AuthenticateResponseType> {
            return weeklyRefresh(this.sessionAuthHost, '/sessionauth/v1/authenticate');
        };
        this.keyAuth = function (): Promise<AuthenticateResponseType> {
            return weeklyRefresh(this.keyManagerHost, '/keyauth/v1/authenticate');
        };
        Promise.all([this.sessionAuth(), this.keyAuth()]).then((values: Array<AuthenticateResponseType>) => {
            const [sessionToken, keyManagerToken] = values;
            logger.info(`Initialising with sessionToken: ${sessionToken.token} and keyManagerToken: ${keyManagerToken.token}`);
        })
    }

    echo(body: EchoType): Promise<EchoType> {
        return this._httpAgentPost('/agent/v1/util/echo', body);
    }

    whoAmI(): Promise<SymphonyUserIdType> {
        return this._httpPodGet('/pod/v1/sessioninfo');
    }

    getUser(args: GetUserArgsType): Promise<SymphonyUserType> {
        if (args.userId !== undefined && args.userId !== null) {
            return this._httpPodGet(`/pod/v2/user?uid=${args.userId}&local=true`);
        }
        if (args.username !== undefined && args.username !== null) {
            return this._httpPodGet(`/pod/v2/user?username=${args.username}&local=true`);
        }
        if (args.emailAddress !== undefined && args.emailAddress !== null) {
            return this._httpPodGet(`/pod/v2/user?email=${args.emailAddress}&local=true`);
        }
        return Promise.reject('No valid user argument supplied');
    }

    sendMessage(streamId: string, message: string, format: string): Promise<SymphonyMessageType> {
        let body = {
            message: message,
            format: format
        };
        return this._httpAgentPost(`/agent/v2/stream/${streamId}/message/create`, body)
    }

    getMessages(streamId: string): Promise<Array<SymphonyMessageType>> {
        return this._httpAgentGet(`/agent/v2/stream/${streamId}/message`);
    }

    createDatafeed(): Promise<CreateDatafeedResponseType> {
        return this._httpAgentPost('/agent/v1/datafeed/create', undefined);
    }

    readDatafeed(datafeedId: string): Promise<Array<SymphonyMessageType>> {
        return this._httpAgentGet(`/agent/v2/datafeed/${datafeedId}/read`);
    }

    createIM(userId: number): Promise<CreateIMResponseType> {
        return this._httpPodPost('/pod/v1/im/create', [userId])
    }

    _httpPodGet(path: string): Promise<Object> {
        return this.sessionAuth().then((sessionToken) => {
            let headers = {
                sessionToken: sessionToken.token
            };
            return this._httpGet(this.agentHost, path, headers);
        })
    }

    _httpPodPost(path: string, body: Object): Promise<Object> {
        return this.sessionAuth().then((sessionToken) => {
            let headers = {
                sessionToken: sessionToken.token
            };
            return this._httpPost(this.agentHost, path, headers, body);
        })
    }

    _httpAgentGet(path: string): Promise<Object> {
        return Promise.all([this.sessionAuth(), this.keyAuth()]).then((values) => {
            const [sessionToken, keyManagerToken] = values;
            let headers = {
                sessionToken: sessionToken.token,
                keyManagerToken: keyManagerToken.token
            };
            return this._httpGet(this.agentHost, path, headers);
        })
    }

    _httpAgentPost(path: string, body: ?Object): Promise<Object> {
        return Promise.all([this.sessionAuth(), this.keyAuth()]).then((values) => {
            const [sessionToken, keyManagerToken] = values;
            let headers = {
                sessionToken: sessionToken.token,
                keyManagerToken: keyManagerToken.token
            };
            return this._httpPost(this.agentHost, path, headers, body);
        })
    }

    _httpGet(host: string, path: string, headers: Object = {}): Promise<Object> {
        return this._httpRequest('GET', host, path, headers, undefined);
    }

    _httpPost(host: string, path: string, headers: Object = {}, body: ?Object): Promise<Object> {
        return this._httpRequest('POST', host, path, headers, body);
    }

    _httpRequest(method: string, host: string, path: string, headers: Object, body: ?Object): Promise<Object> {
        let self = this;
        return new Promise(function (resolve, reject) {
            let options = {
                baseUrl: `https://${host}`,
                url: path,
                json: true,
                headers: headers,
                method: method,
                key: fs.readFileSync(self.privateKey),
                cert: fs.readFileSync(self.publicKey),
                passphrase: self.passphrase,
                body: undefined
            };
            if (body !== undefined && body !== null) {
                options.body = body;
            }
            request(options, (err, res, data) => {
                if (err !== undefined && err !== null) {
                    let statusCode = res === undefined ? undefined : res.statusCode;
                    logger.warning(`received ${statusCode} error response from https://${host}${path}: ${err}`);
                    reject(new Error(err));
                } else if (Math.floor(res.statusCode / 100) != 2) {
                    let err = `received ${res.statusCode} response from https://${host}${path}: ${JSON.stringify(data)}`;
                    logger.warning(err);
                    reject(new Error(err));
                } else {
                    logger.debug(`received ${res.statusCode} response from https://${host}${path}: ${JSON.stringify(data)}`);
                    resolve(data);
                }
            })
        });
    }
}

module.exports = Symphony;