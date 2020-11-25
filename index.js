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

var last_total_supply = null;

var logMessages = []

log = function(message) {
  logtext = new Date().toString() + ": " + message
  logMessages.push(logtext)
  console.log(logtext)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const STATE = {
  INIT : "init",
  START : "start",
  CHECK_SUPPLY : "check supply",
  FETCH_GAS : "fetch gas",
  CHECK_BALANCE : "balance",
  EXECUTE_TRANSACTION : "execute transaction",
  DONE : "done"
}

const script_machine = async () => {

  var provider = new HDWalletProvider(CONF.pk, CONF.http);
  let web3 = new Web3(provider)
  let accounts = await web3.eth.getAccounts()
  let ampl = new web3.eth.Contract(UFragmentsContract, CONF.ufragments_address)
  let pair = new web3.eth.Contract(UniswapPairContract, CONF.pair_address)
  let gas_price = CONF.default_gas_price
  let gas_tries = 0

  let state = STATE.INIT
  
  while(true) {
    switch(state) {
      case STATE.INIT:
        log("Script started")
        log("Account: " + accounts[0])
        log("Script is ran for the first time, fetching AMPL total supply...")
        last_total_supply = BigInt(await ampl.methods.totalSupply().call())
        state = STATE.START
        break

      case STATE.START:
        log("Running scheduled check...")
        state = STATE.CHECK_SUPPLY
        break

      case STATE.CHECK_SUPPLY:
        log("Checking AMPL total supply...")

        log("Last total supply: " + last_total_supply)
        let supply = BigInt(await ampl.methods.totalSupply().call())
        if(supply === last_total_supply) {
          log("Total supply didn't change, nothing to do")
          state = STATE.DONE
        } else {
          log("Total supply changed: " + last_total_supply + " vs " + supply)
          state = STATE.FETCH_GAS
        }
        break

      case STATE.FETCH_GAS:
        log("Fetching gas prices...")

        if(gas_tries > CONF.max_tries) {
          gas_price = CONF.default_gas_price
          gas_tries = 0
        } else {
          try {
            let res = await fetch("https://ethgasstation.info/json/ethgasAPI.json");
            let jsonRes = await res.json()
            gas_price = jsonRes.fastest * 100000000
            gas_tries = 0
          } catch(error) {
              log("Failed to fetch gas price from ethgasstation, trial " + (i+1))
              gas_tries++
          }
        }

        if(gas_price > CONF.max_gas_price) {
          log("Gas price is superior to maximum allowed in conf, cap activated")
          gas_price = CONF.max_gas_price
        }
        log("Using gas price : " + gas_price)

        state = STATE.CHECK_BALANCE
        break

      case STATE.CHECK_BALANCE:
        log("Checking balance...")

        let balance = await web3.eth.getBalance(accounts[0])
        log("Remaining balance : " + web3.utils.fromWei(balance, "ether"))
        if(gas_price * CONF.max_gas > balance) {
          log("Not enough balance to send transaction : " + gas_price * CONF.max_gas + " > " + balance)
          state = STATE.DONE
        } else {
          state = STATE.EXECUTE_TRANSACTION
        }
        break

      case STATE.EXECUTE_TRANSACTION:
        log("Sending transaction...")
        // consider that the transaction is ok
        last_total_supply = supply

        pair.methods.sync().send({from : accounts[0], gas : CONF.max_gas, gasPrice : gas_price}, function(error, transactionHash){})
        .on('error', function(error)
        { 
          log("Transaction error: " + error)
          last_total_supply = 0
        })
        .on('transactionHash', function(transactionHash)
        { 
          log("Transaction hash: " + transactionHash) 
        })
        .on('receipt', function(receipt)
        {
           log("Transaction receipt ready")
        })
  
        
        state = STATE.DONE
        break

      case STATE.DONE:
        log("Sleeping for " + CONF.frequency + "ms")
        await sleep(CONF.frequency)
        state = STATE.START
        break

    }
  }
}

app.get('/', (req, res) => {
  res.send(logMessages)
})

app.listen(port, hostname, async () => {
  log(`Server running at http://${hostname}:${port}/`);
  await script_machine()
});