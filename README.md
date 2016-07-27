# hubot-symphony

[Hubot](http://hubot.github.com/) adapter for [Symphony](https://symphony.com) developed by the [Symphony Foundation](http://symphony.foundation/)

[![Build Status](https://travis-ci.org/symphonyoss/hubot-symphony.svg?branch=master)](https://travis-ci.org/symphonyoss/hubot-symphony)
[![Coverage Status](https://coveralls.io/repos/github/symphonyoss/hubot-symphony/badge.svg?branch=master)](https://coveralls.io/github/symphonyoss/hubot-symphony)
[![Dependency Status](https://www.versioneye.com/user/projects/57991bd627629700333f615c/badge.svg?style=flat-square)](https://www.versioneye.com/user/projects/57991bd627629700333f615c)
[![Coverity Scan Build Status](https://scan.coverity.com/projects/9358/badge.svg)](https://scan.coverity.com/projects/symphonyoss-hubot-symphony)

## Usage
You must pass the following environment variables to hubot
* `HUBOT_SYMPHONY_HOST` set to the url of your pod without the https:// prefix
* `HUBOT_SYMPHONY_PUBLIC_KEY` set to the location of your bot account .pem public key file
* `HUBOT_SYMPHONY_PRIVATE_KEY` set to the location of your bot account .pem private key file
* `HUBOT_SYMPHONY_PASSPHRASE` set to the passphrase associated with your bot account private key

These arguments are passed through to the NodeJs request module as described [here](https://github.com/request/request#tlsssl-protocol).

### Diagnostics
A simple diagnostic script is included to help confirm that you have all the necessary pieces to get started.  You can run this as follows:

```
npm install hubot-symphony
npm run diagnostic -- --publicKey [key1.pem] --privateKey [key2.pem] --passphrase [changeit] --host [host.symphony.com]
```

If the script runs as expected it will obtain and log both session and key manager tokens, look up and log some details of the bot account and then create a datafeed and poll.  If you send a message using the Symphony client to the bot account you should see the details logged.

#### Note
The privateKey.pem and publicKey.pem files under test/resources have been generated at random and are not real keys.
