const http = require('http');
const Web3 = require('web3');
var HDWalletProvider = require("truffle-hdwallet-provider");
const fetch = require('node-fetch');
const express = require('express')
const app = express()

const UFragmentsContract = require("./contracts/UFragments.json")
const UniswapPairContract = require("./contracts/uniswap-pair.json")
const CONF = require("./conf.json")

const hostname = '127.0.0.1';
const port = 3000;

let last_total_supply = 270813374568561777;

var logBackup = console.log;
var logMessages = [];

console.log = function() {
    logMessages.push.apply(logMessages, [Date.now() + ": " + arguments[0]]);
    logBackup.apply(console, arguments);
};

const testRebase = async () => {
  console.log("Running scheduled check")
  var provider = new HDWalletProvider(CONF.pk, CONF.http);
  let web3 = new Web3(provider);
  let accounts = await web3.eth.getAccounts()
  console.log("Available accounts: " + accounts)
  console.log("Last total supply: " + last_total_supply)

  let ampl = new web3.eth.Contract(UFragmentsContract, CONF.ufragments_address)
  
  let supply = await ampl.methods.totalSupply().call()
  if(supply === last_total_supply) {
    console.log("Total supply didn't change, nothing to do, retrying in " + CONF.frequency + "ms")
    return
  }

  console.log("Total supply is different: " + last_total_supply + " vs " + supply)

  let gas_price = CONF.default_gas_price
  //fetch gas price in 3 tries
  for(var i = 0; i < CONF.max_tries; i++) {
    try {
      let res = await fetch("https://ethgasstation.info/json/ethgasAPI.json");
      let jsonRes = await res.json()
      gas_price = jsonRes.fastest * 100000000
      break
    } catch(error) {
        console.warn("Failed to fetch gas price from ethgasstation, trial " + (i+1))
    }
  }

  if(gas_price > CONF.max_gas_price) {
    console.warn("Gas price is superior to maximum allowed in conf, cap activated")
    gas_price = CONF.max_gas_price
  }

  let balance = await web3.eth.getBalance(accounts[0])
  
  console.log("Using gas price : " + gas_price)
  console.log("Remaining balance : " + web3.utils.fromWei(balance, "ether"))

  
  if(gas_price * CONF.max_gas <= balance) {
      let pair = new web3.eth.Contract(UniswapPairContract, CONF.pair_address)
      console.log("Sending transaction...")
      /*pair.methods.sync().send({from : accounts[0], gas : CONF.max_gas, gasPrice : gas_price}, function(error, transactionHash){})
      .on('error', function(error){ console.error("Transaction error: ", error) })
      .on('transactionHash', function(transactionHash){ console.log("Transaction hash: " + transactionHash) })
      .on('receipt', function(receipt){
         console.log("Transaction receipt ready")
      })*/

      last_total_supply = supply

  } else {
    console.warn("Not enough balance to send transaction : " + gas_price * CONF.max_gas + " > " + balance)
  }
}

app.get('/', (req, res) => {
  res.send(logMessages)
})

app.listen(port, hostname, async () => {
  console.log(`Server running at http://${hostname}:${port}/`);
  await testRebase()
  setInterval(testRebase,CONF.frequency);
});