# hubot-symphony

[Hubot](http://hubot.github.com/) adapter for [Symphony](https://symphony.com) developed by the [Symphony Foundation](http://symphony.foundation/)

Hubot is a [chatops](http://lmgtfy.com/?q=chatops+hubot) tool developed by GitHub, with this adapator you can get up and running with a programmable bot written in JavaScript/Coffescript [in a few minutes](http://blog.symphony.foundation/run-a-symphony-bot-in-less-than-three-minutes-on-docker).  This project wraps a small number of the Symphony REST APIs required for two-way bot communication and user lookup together with offline test cases, the adaptor is in use both by Symphony clients and by Symphony themselves.

[![Symphony Software Foundation - Active](https://cdn.rawgit.com/symphonyoss/contrib-toolbox/master/images/ssf-badge-active.svg)](https://symphonyoss.atlassian.net/wiki/display/FM/Active)

[![Build Status](https://travis-ci.org/symphonyoss/hubot-symphony.svg?branch=master)](https://travis-ci.org/symphonyoss/hubot-symphony)
[![Coverage Status](https://coveralls.io/repos/github/symphonyoss/hubot-symphony/badge.svg?branch=master)](https://coveralls.io/github/symphonyoss/hubot-symphony)
[![Code Climate](https://codeclimate.com/github/symphonyoss/hubot-symphony/badges/gpa.svg)](https://codeclimate.com/github/symphonyoss/hubot-symphony)
[![Versioneye dependencies](https://www.versioneye.com/user/projects/58cfec3d6893fd003b3c36ce/badge.svg?style=flat-square)](https://www.versioneye.com/user/projects/58cfec3d6893fd003b3c36ce)
[![bitHound Dependencies](https://www.bithound.io/github/symphonyoss/hubot-symphony/badges/dependencies.svg)](https://www.bithound.io/github/symphonyoss/hubot-symphony/master/dependencies/npm)
[![bitHound Dev Dependencies](https://www.bithound.io/github/symphonyoss/hubot-symphony/badges/devDependencies.svg)](https://www.bithound.io/github/symphonyoss/hubot-symphony/master/dependencies/npm)
[![NSP Status](https://nodesecurity.io/orgs/symphonyoss/projects/9309ce59-9a6b-43a9-b7bb-54c6f0117e0a/badge)](https://nodesecurity.io/orgs/symphonyoss/projects/9309ce59-9a6b-43a9-b7bb-54c6f0117e0a)

[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

[![NPM](https://nodei.co/npm/hubot-symphony.png?downloads=true&stars=true)](https://nodei.co/npm/hubot-symphony/)

## Usage
You must pass the following environment variables to hubot
* `HUBOT_SYMPHONY_HOST` set to the url of your pod without the https:// prefix
* `HUBOT_SYMPHONY_PUBLIC_KEY` set to the location of your bot account .pem public key file
* `HUBOT_SYMPHONY_PRIVATE_KEY` set to the location of your bot account .pem private key file
* `HUBOT_SYMPHONY_PASSPHRASE` set to the passphrase associated with your bot account private key

There are also optional arguments which should be used if you are running on-premise
* `HUBOT_SYMPHONY_KM_HOST` set to the url of your key manager without the https:// prefix
* `HUBOT_SYMPHONY_AGENT_HOST` set to the url of your agent without the https:// prefix
* `HUBOT_SYMPHONY_SESSIONAUTH_HOST` set to the url of your session auth without the https:// prefix
* `HUBOT_SYMPHONY_POD_HOST` set to the url of your pod without the https:// prefix

These arguments are passed through to the NodeJs request module as described [here](https://github.com/request/request#tlsssl-protocol).

### Non-standard messaging

If you want to send a rich message you can call send with an Object instead of a String:
```
module.exports = (robot) ->
  robot.respond /pug me/i, (msg) ->
    msg.http("http://pugme.herokuapp.com/random")
      .get() (err, res, body) ->
        pug = JSON.parse(body).pug
        msg.send pug
        msg.send {
          format: 'MESSAGEML'
          text: "<messageML><a href=\"#{pug}\"/></messageML>"
        }
```
The various supported tags are documented [here](https://rest-api.symphony.com/docs/message-format).

If you want to send a direct message to a user in response to a webhook you can interact with the adaptor via the robot variable:
```
module.exports = (robot) ->
  robot.router.post '/hubot/webhook', (req, res) ->
    email = req.params.email
    message = req.params.message
    robot.adapter.sendDirectMessageToEmail(email, message)
    res.send 'OK'
```

### Diagnostics
A simple diagnostic script is included to help confirm that you have all the necessary pieces to get started.  You can run this as follows:

```
git clone https://github.com/symphonyoss/hubot-symphony.git
cd hubot-symphony
npm install
npm run diagnostic -- \
  --publicKey [key1.pem] \
  --privateKey [key2.pem] \
  --passphrase [changeit] \
  --host [host.symphony.com]
```

If you are running on-premise you can add optional fifth / sixth / seventh arguments

```
git clone https://github.com/symphonyoss/hubot-symphony.git
cd hubot-symphony
npm install
npm run diagnostic -- \
  --publicKey [key1.pem] \
  --privateKey [key2.pem] \
  --passphrase [changeit] \
  --host [host.symphony.com] \
  --kmhost [keymanager.host.com] \
  --agenthost [agent.host.com] \
  --sessionhost [session.host.com] \
  --podHost [pod.host.com]
```

If the script runs as expected it will obtain and log both session and key manager tokens, look up and log some details of the bot account and then create a datafeed and poll.  If you send a message using the Symphony client to the bot account you should see the details logged.

### Contribute

Contributions are accepted via GitHub pull requests. All contributors must be covered by contributor license agreements to comply with the [Code Contribution Process](https://symphonyoss.atlassian.net/wiki/display/FM/Code+Contribution+Process).

#### Note
The privateKey.pem and publicKey.pem files under test/resources have been generated at random and are not real keys.
