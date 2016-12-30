#!/bin/bash
# Run hubot-symphony diagnostic against the Foundation Open Developer Platform

# To run this script, you must install NodeJS and run npm install:
# $ brew update
# $ brew upgrade node
# $ npm install

npm run diagnostic -- --publicKey ./certs/publicCert.pem --privateKey ./certs/privateKey.pem --passphrase changeit --host foundation-dev.symphony.com --agenthost foundation-dev-api.symphony.com --kmhost foundation-dev-api.symphony.com --sessionhost foundation-dev-api.symphony.com
