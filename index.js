const http = require('http');
const Web3 = require('web3');
var HDWalletProvider = require("truffle-hdwallet-provider");
const fetch = require('node-fetch');
const express = require('express')
const app = express()

const UFragmentsContract = require("./contracts/UFragments.json")
const UniswapPairContract = require("./contracts/uniswap-pair.json")
const CONF = require("./conf.json")

const port = CONF.port;

var last_total_supply = null;

var logMessages = []
var pendingHash = null
var pendingNonce = 0

log = function(message) {
  logtext = new Date().toString() + ": " + message
  logMessages.push(logtext)
  console.log(logtext)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

app.get('/', (req, res) => {
  res.send(logMessages)
})

app.listen(port, async () => {
  var provider = new HDWalletProvider(CONF.pk, "https://mainnet.infura.io/v3/" + CONF.infura_api_key);
  let web3 = new Web3(provider)
  let accounts = await web3.eth.getAccounts()
  let pair = new web3.eth.Contract(UniswapPairContract, CONF.pair_address)
  log(`Server running on port ${port}/`);
  let date=Date.now()
  let when=1606615140000
  let duration = when - date
  log("sleeping for" + duration + " ms");
  await sleep(duration)
  pair.methods.sync().send({from : accounts[0], gas : 100000, gasPrice : "100000000000"}, function(error, transactionHash){})
  await sleep(20*1000)
  pair.methods.sync().send({from : accounts[0], gas : 100000, gasPrice : "100000000000"}, function(error, transactionHash){})
  await sleep(20*1000)
  pair.methods.sync().send({from : accounts[0], gas : 100000, gasPrice : "100000000000"}, function(error, transactionHash){})
  await sleep(20*1000)
  pair.methods.sync().send({from : accounts[0], gas : 100000, gasPrice : "100000000000"}, function(error, transactionHash){})
  await sleep(20*1000)
  pair.methods.sync().send({from : accounts[0], gas : 100000, gasPrice : "100000000000"}, function(error, transactionHash){})
});