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

let assert = require('chai').assert;
import SymphonyAdapter from '../src/adapter';
import NockServer from './nock-server';
import {FakeRobot} from './fakes';

process.env['HUBOT_SYMPHONY_HOST'] = 'foundation.symphony.com';
process.env['HUBOT_SYMPHONY_PUBLIC_KEY'] = './test/resources/publicKey.pem';
process.env['HUBOT_SYMPHONY_PRIVATE_KEY'] = './test/resources/privateKey.pem';
process.env['HUBOT_SYMPHONY_PASSPHRASE'] = 'changeit';

describe('Constructor test', () => {
    for (const constructorProp of ['HUBOT_SYMPHONY_HOST', 'HUBOT_SYMPHONY_PUBLIC_KEY', 'HUBOT_SYMPHONY_PRIVATE_KEY', 'HUBOT_SYMPHONY_PASSPHRASE']) {
        it(`should throw on construction if ${constructorProp} missing`, () => {
            let prop = process.env[constructorProp];
            delete process.env[constructorProp];
            assert.throws(SymphonyAdapter.use, new RegExp(`${constructorProp} undefined`));
            process.env[constructorProp] = prop
        });
    }
});

describe('Adapter test suite with helloWorld message', () => {
    let nock: NockServer = null;

    beforeEach(() => {
        nock = new NockServer({host: 'https://foundation.symphony.com'})
    });

    afterEach(() => {
        nock.close();
    });

    it('should connect and receive message', (done) => {
        let robot = new FakeRobot();
        let adapter = SymphonyAdapter.use(robot);
        adapter.on('connected', () => {
            assert.isDefined(adapter.symphony);
            robot.on('received', () => {
                assert.include(robot.received.map(m => m.text), 'Hello World');
                adapter.close();
                done();
            });
        });
        adapter.run();
    });

    it('should retry on http 400 errors when reading datafeed', (done) => {
        nock.datafeedReadHttp400Count = 1;
        let robot = new FakeRobot();
        let adapter = SymphonyAdapter.use(robot);
        adapter.on('connected', () => assert.isDefined(adapter.symphony));
        robot.on('error', () => {
            adapter.on('connected', () => {
                robot.on('received', () => {
                    assert.include(robot.received.map(m => m.text), 'Hello World');
                    adapter.close();
                    done();
                });
            });
        });
        adapter.run();
    });

    it('should retry if datafeed cannot be created', (done) => {
        nock.datafeedCreateHttp400Count = 1;
        let robot = new FakeRobot();
        let adapter = SymphonyAdapter.use(robot);
        adapter.on('connected', () => {
            assert.isDefined(adapter.symphony);
            robot.on('received', () => {
                assert.include(robot.received.map(m => m.text), 'Hello World');
                adapter.close();
                done();
            });
        });
        adapter.run();
    });
});

describe('Adapter test suite', () => {
    let nock: NockServer = null;

    beforeEach(() => {
        nock = new NockServer({host: 'https://foundation.symphony.com', startWithHelloWorldMessage: false})
    });

    afterEach(() => {
        nock.close();
    });

    it('should send with no adornment', (done) => {
        let robot = new FakeRobot();
        let adapter = SymphonyAdapter.use(robot);
        adapter.on('connected', () => {
            assert.isDefined(adapter.symphony);
            let envelope = {room: nock.streamId};
            adapter.send(envelope, 'foo bar');
            adapter.close();
        });
        nock.on('received', () => {
            assert.include(nock.messages.map(m => m.message), 'foo bar');
            done();
        });
        adapter.run()
    });

    it('should send MESSAGEML', (done) => {
        let robot = new FakeRobot();
        let adapter = SymphonyAdapter.use(robot);
        adapter.on('connected', () => {
            assert.isDefined(adapter.symphony);
            let envelope = {room: nock.streamId};
            adapter.send(envelope, {
                format: 'MESSAGEML',
                text: '<messageML><b>foo bar</b></messageML>'
            });
            adapter.close();
        });
        nock.on('received', () => {
            assert.include(nock.messages.map(m => m.message), '<messageML><b>foo bar</b></messageML>');
            done();
        });
        adapter.run()
    });

    it('should reply with @mention', (done) => {
        let robot = new FakeRobot();
        let adapter = SymphonyAdapter.use(robot);
        adapter.on('connected', () => {
            assert.isDefined(adapter.symphony);
            let envelope = {
                room: nock.streamId,
                user: {
                    emailAddress: 'johndoe@symphony.com'
                }
            };
            adapter.reply(envelope, 'foo bar baz');
            adapter.close();
        });
        nock.on('received', () => {
            assert.include(nock.messages.map(m => m.message), '<messageML><mention email="johndoe@symphony.com"/> foo bar baz</messageML>');
            done();
        });
        adapter.run()
    });

    it('should escape xml chars in reply', (done) => {
        let robot = new FakeRobot();
        let adapter = SymphonyAdapter.use(robot);
        adapter.on('connected', () => {
            assert.isDefined(adapter.symphony);
            let envelope = {
                room: nock.streamId,
                user: {
                    emailAddress: 'johndoe@symphony.com'
                }
            };
            adapter.reply(envelope, '<&>');
            adapter.close();
        });
        nock.on('received', () => {
            assert.include(nock.messages.map(m => m.message), '<messageML><mention email="johndoe@symphony.com"/> &lt;&amp;&gt;</messageML>');
            done();
        });
        adapter.run()
    });

    it('should exit datafeed cannot be created', (done) => {
        nock.datafeedCreateHttp400Count = 1;
        let robot = new FakeRobot();
        let adapter = SymphonyAdapter.use(robot, {
            shutdownFunc: () => done(),
            failConnectAfter: 1
        });
        adapter.run()
    });

    it('should send direct message to username', (done) => {
        let robot = new FakeRobot();
        let adapter = SymphonyAdapter.use(robot);
        adapter.on('connected', () => {
            assert.isDefined(adapter.symphony);
            adapter.sendDirectMessageToUsername(nock.realUserName, 'username message');
            adapter.close();
        });
        nock.on('received', () => {
            assert.include(nock.messages.map(m => m.message), 'username message');
            done();
        });
        adapter.run()
    });

    it('should send direct message to email', (done) => {
        let robot = new FakeRobot();
        let adapter = SymphonyAdapter.use(robot);
        adapter.on('connected', () => {
            assert.isDefined(adapter.symphony);
            adapter.sendDirectMessageToEmail(nock.realUserEmail, 'email message');
            adapter.close();
        });
        nock.on('received', () => {
            assert.include(nock.messages.map(m => m.message), 'email message');
            done();
        });
        adapter.run()
    });
});