# hubot-symphony

[Hubot](http://hubot.github.com/) adapter for [Symphony](https://symphony.com) hosted by the [Symphony Program](https://finosfoundation.atlassian.net/wiki/spaces/SYM/overview) part of [FINOS](https://www.finos.org/)

Hubot is a [chatops](http://lmgtfy.com/?q=chatops+hubot) tool developed by GitHub, with this adapter you can get up and running with a programmable bot written in JavaScript/Coffescript [in a few minutes](http://blog.symphony.foundation/run-a-symphony-bot-in-less-than-three-minutes-on-docker).  This project wraps a small number of the Symphony REST APIs required for two-way bot communication and user lookup together with offline test cases, the adapter is in use both by Symphony clients and by Symphony themselves.

In mid-2018 Symphony released their own JavaScript API together with a Yeoman generator which facilitates creating simple bots, unless you wish to make use of existing Hubot scripts it's recommended to use this instead.  See the developer site [here](https://symphony-developers.symphony.com/) and [symphony-api-client-node](https://www.npmjs.com/package/symphony-api-client-node).

[![FINOS - Incubating](https://cdn.jsdelivr.net/gh/finos/contrib-toolbox@master/images/badge-incubating.svg)](https://finosfoundation.atlassian.net/wiki/display/FINOS/Incubating)

[![Build Status](https://travis-ci.org/symphonyoss/hubot-symphony.svg?branch=master)](https://travis-ci.org/symphonyoss/hubot-symphony)
[![Coverage Status](https://coveralls.io/repos/github/symphonyoss/hubot-symphony/badge.svg?branch=master)](https://coveralls.io/github/symphonyoss/hubot-symphony)
[![Code Climate](https://codeclimate.com/github/symphonyoss/hubot-symphony/badges/gpa.svg)](https://codeclimate.com/github/symphonyoss/hubot-symphony)
[![Greenkeeper badge](https://badges.greenkeeper.io/symphonyoss/hubot-symphony.svg)](https://greenkeeper.io/)

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

These arguments are passed through to the NodeJs request module as described [here](https://github.com/request/request#tlsssl-protocol).

### Non-standard messaging

If you want to send a rich message you can call send just pass messageML directly to the send method instead of plaintext.  The various supported tags are documented [here](https://rest-api.symphony.com/docs/message-format).  If you want to send [Structured Objects](https://rest-api.symphony.com/v1.47/docs/objects) you can call send with an Object instead of a String (note the text must be valid messageML).

```
module.exports = (robot) ->
  robot.respond /pug me/i, (msg) ->
    msg.http("http://pugme.herokuapp.com/random")
      .get() (err, res, body) ->
        pug = JSON.parse(body).pug
        // send url as text
        msg.send pug
        // send url as link
        msg.send "<messageML><a href=\"#{pug}\"/></messageML>"
        // send url as a card
        msg.send "<messageML><card iconSrc=\"#{iconSrc}\" accent=\"tempo-bg-color--blue\"><header>PUG!</header><body><img src=\"#{pug}\"/><br/><a href=\"#{pug}\"/></body></card></messageML>"
        // send message with a structured object
        msg.send {
          text: myMessageML,
          data: myStructuredObjectJson
        }
```


If you want to send a direct message to a user in response to a webhook you can interact with the adapter via the robot variable:
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
npm run diagnostic -- --publicKey [key1.pem] --privateKey [key2.pem] --passphrase [changeit] --host [host.symphony.com]
```

If you are running on-premise you can add optional fifth / sixth / seventh arguments

```
git clone https://github.com/symphonyoss/hubot-symphony.git
cd hubot-symphony
npm install
npm run diagnostic -- --publicKey [key1.pem] --privateKey [key2.pem] --passphrase [changeit] --host [host.symphony.com] --kmhost [keymanager.host.com] --agenthost [agent.host.com] --sessionhost [session.host.com]
```

If the script runs as expected it will obtain and log both session and key manager tokens, look up and log some details of the bot account and then create a datafeed and poll.  If you send a message using the Symphony client to the bot account you should see the details logged.

### Whitesource reports

To check security and legal compliance, the build integrates with Whitesource to submit and validate the list of third-party packages used by the build.

Simply run the following commands from the root project folder.
```
export WHITESOURCE_API_KEY=<WhiteSource API Key>
npm install ; npm run whitesource
```

The `<WhiteSource API Key>` can be retrieved from the [WhiteSource project dashboard](https://saas.whitesourcesoftware.com/Wss/WSS.html#!home).

If any issue is found, a file called `ws-log-policy-violations.json` will be generated in root project folder; if no issue is found, metrics will be sent to the [WhiteSource project dashboard](https://saas.whitesourcesoftware.com/Wss/WSS.html#!home) (available to project committers).

### Contribute

Contributions are accepted via GitHub pull requests. All contributors must be covered by contributor license agreements to comply with the [Code Contribution Process](https://symphonyoss.atlassian.net/wiki/display/FM/Code+Contribution+Process).

1. Fork it (<https://github.com/symphonyoss/hubot-symphony/fork>)
2. Create your feature branch (`git checkout -b feature/fooBar`)
3. Read our [contribution guidelines](.github/CONTRIBUTING.md) and [Community Code of Conduct](https://www.finos.org/code-of-conduct)
4. Commit your changes (`git commit -am 'Add some fooBar'`)
5. Push to the branch (`git push origin feature/fooBar`)
6. Create a new Pull Request

## License

The code in this repository is distributed under the [Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0).

Copyright 2016-2019 Jon Freedman

#### Note
The privateKey.pem and publicKey.pem files under test/resources have been generated at random and are not real keys.
