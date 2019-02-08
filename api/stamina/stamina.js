const http = require("http");
const path = require("path");
const fs = require("fs");
const express = require("express");
const _ = require('lodash');

const Tx = require("ethereumjs-tx");

const BigNumber = require("bignumber.js")
const Web3 = require("web3");
const httpProviderUrl = "http://127.0.0.1:8547";
const wsProviderUrl = "ws://127.0.0.1:8546";
// const wsProvider = new Web3.providers.WebsocketProvider(wsProviderUrl);

const web3 = new Web3(new Web3.providers.HttpProvider(httpProviderUrl));
const ether = n => new BigNumber(n * 1e18);

const app = express();
app.use(express.json());

app.post('/api/stamina/:method', async(req, res, next) => {
  const abiPath = path.join(__dirname, '..', '..', 'build', 'contracts', 'Stamina.json');
  const abi = JSON.parse(fs.readFileSync(abiPath).toString()).abi;

  const contract_address = "0x000000000000000000000000000000000000dead";
  const contract = new web3.eth.Contract(abi, contract_address);

  // const from = "0x575f4B87A995b06cfD2A7D9370D1Fb2bc710fdc9";
  // const delegator = "0x16Fb96a5fa0427Af0C8F7cF1eB4870231c8154B6";
  // const from = "0x16Fb96a5fa0427Af0C8F7cF1eB4870231c8154B6";
  const privateKey = new Buffer('3b5cb209361b6457e068e7abdccbcc1d88e1e82d73074434f117d3bb4eab0481', 'hex');

  let nonce;
  try {
    nonce = await web3.eth.getTransactionCount(req.body.msg.from);
  } catch (err) {
    return res.status(400).json({
      code: 1,
      message: err.message,
    });
  }
  
  let params = {};
  const method = req.params.method;

  let bytecode;
  
  try{
    bytecode = getBytecode(web3, abi, method, req.body.params);
    
  } catch(err) {
    return res.status(400).json({
      code: 2,
      message: err.message,
    });
  }
  let value;
  if (!_.isUndefined(req.body.msg.value) ){
    value = req.body.msg.value
  } else {
    value = 0;
  }
  // const value = web3.utils.soliditySha3(ether(1))
  // console.log(value);
  // const value = new Buffer("1000000000000000", 'hex');
  if (!_.isUndefined(req.body.params)) params = Object.values(req.body.params);
  let gas;
  
  const rawTx = {
    nonce: nonce,
    chainId: await web3.eth.net.getId(),
    to: contract_address,
    value: value,
    data: bytecode,
    gasPrice: '22e9',
    gasLimit: 4700000
  };

  const tx = new Tx(rawTx);
  tx.sign(privateKey);
  const serializedTx = tx.serialize().toString('hex');

  try {
    web3.eth.sendSignedTransaction('0x' + serializedTx)
    .on('receipt', receipt => {
      return res.status(200).json({
        code: 0,
        message: 'success',
        response: {
          txhash: receipt.transactionHash,
        }
      });
    }).on('error', error => {
      return res.status(400).json({
        code: 5,
        message: error.message,
      });
    });
  } catch (err) {
    return res.status(400).json({
      code: 6,
      message: err.message,
    });
  }

});

app.post('/api/stamina/init', async(req, res, next) => {
  const abiPath = path.join(__dirname, '..', '..', 'build', 'contracts', 'Stamina.json');
  const abi = JSON.parse(fs.readFileSync(abiPath).toString()).abi;

  const contract_address = "0x000000000000000000000000000000000000dead";
  const contract = new web3.eth.Contract(abi, contract_address);

  const privateKey = new Buffer('3b5cb209361b6457e068e7abdccbcc1d88e1e82d73074434f117d3bb4eab0481', 'hex');

  let nonce;
  try {
    nonce = await web3.eth.getTransactionCount(from);
  } catch (err) {
    return res.status(400).json({
      code: 1,
      message: err.message,
    });
  }
  
  let params = {};
  const method = req.params.method;

  let bytecode;
  
  // const value = web3.utils.soliditySha3(ether(1))
  // console.log(value);
  // const value = new Buffer("1000000000000000", 'hex');
  if (!_.isUndefined(req.body.params)) params = Object.values(req.body.params);

  try{
    const result = await contract.methods[method](...params).estimateGas(req.body.msg);
    // const result = await contract.methods.addStamina("0x575f4B87A995b06cfD2A7D9370D1Fb2bc710fdc9",value).send({ from: "0x3e37e68230bd4da3fe670fe10b44ffd16c36735e",gas:2e6 });
  } catch (err) {
    return res.status(400).json({
      code: 3,
      message: err.message,
    });
  }
  
  
});

// getter
app.get('/api/stamina/:method/:address', async(req, res, next) => {
  const abiPath = path.join(__dirname, '..', '..', 'build', 'contracts', 'Stamina.json');
  const abi = JSON.parse(fs.readFileSync(abiPath).toString()).abi;

  const contract_address = "0x000000000000000000000000000000000000dead";
  const contract = new web3.eth.Contract(abi, contract_address);

  const method = req.params.method;
  const address = req.params.address;
  
  try {
    result = await contract.methods[method](address).call();
    return res.status(200).json({
      code: 0,
      message: 'success',
      response: result
    })
  } catch (err) {
    return res.status(400).json({
      code: 1,
      message: err.message,
    });
  }  
});

app.listen(8080, async () => {
  console.log("Express listening 8080");
});

function getBytecode(web3, abi, methodName, params) {
  let method;
  for (let i = 0; i < abi.length; i++) {
    if (abi[i].name == methodName) {
      method = abi[i];
      break;
    }
  }

  const functionSelector = web3.eth.abi.encodeFunctionSignature(method);
  const types = [];
  for (let i = 0; i < method.inputs.length; i++) {
    types.push(method.inputs[i].type);
  }
  
  const values = Object.values(params);
  
  const encodeParamters = web3.eth.abi.encodeParameters(types, values).slice(2);
  const bytecode = functionSelector.concat(encodeParamters);
  return bytecode;
}

async function getValue(web3, contract, name) {
  const result = await contract.methods[name]().call();
  return result;
}