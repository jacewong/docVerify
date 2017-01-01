var Web3 = require("web3");
var SolidityEvent = require("web3/lib/web3/event.js");

(function() {
  // Planned for future features, logging, etc.
  function Provider(provider) {
    this.provider = provider;
  }

  Provider.prototype.send = function() {
    this.provider.send.apply(this.provider, arguments);
  };

  Provider.prototype.sendAsync = function() {
    this.provider.sendAsync.apply(this.provider, arguments);
  };

  var BigNumber = (new Web3()).toBigNumber(0).constructor;

  var Utils = {
    is_object: function(val) {
      return typeof val == "object" && !Array.isArray(val);
    },
    is_big_number: function(val) {
      if (typeof val != "object") return false;

      // Instanceof won't work because we have multiple versions of Web3.
      try {
        new BigNumber(val);
        return true;
      } catch (e) {
        return false;
      }
    },
    merge: function() {
      var merged = {};
      var args = Array.prototype.slice.call(arguments);

      for (var i = 0; i < args.length; i++) {
        var object = args[i];
        var keys = Object.keys(object);
        for (var j = 0; j < keys.length; j++) {
          var key = keys[j];
          var value = object[key];
          merged[key] = value;
        }
      }

      return merged;
    },
    promisifyFunction: function(fn, C) {
      var self = this;
      return function() {
        var instance = this;

        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {
          var callback = function(error, result) {
            if (error != null) {
              reject(error);
            } else {
              accept(result);
            }
          };
          args.push(tx_params, callback);
          fn.apply(instance.contract, args);
        });
      };
    },
    synchronizeFunction: function(fn, instance, C) {
      var self = this;
      return function() {
        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {

          var decodeLogs = function(logs) {
            return logs.map(function(log) {
              var logABI = C.events[log.topics[0]];

              if (logABI == null) {
                return null;
              }

              var decoder = new SolidityEvent(null, logABI, instance.address);
              return decoder.decode(log);
            }).filter(function(log) {
              return log != null;
            });
          };

          var callback = function(error, tx) {
            if (error != null) {
              reject(error);
              return;
            }

            var timeout = C.synchronization_timeout || 240000;
            var start = new Date().getTime();

            var make_attempt = function() {
              C.web3.eth.getTransactionReceipt(tx, function(err, receipt) {
                if (err) return reject(err);

                if (receipt != null) {
                  // If they've opted into next gen, return more information.
                  if (C.next_gen == true) {
                    return accept({
                      tx: tx,
                      receipt: receipt,
                      logs: decodeLogs(receipt.logs)
                    });
                  } else {
                    return accept(tx);
                  }
                }

                if (timeout > 0 && new Date().getTime() - start > timeout) {
                  return reject(new Error("Transaction " + tx + " wasn't processed in " + (timeout / 1000) + " seconds!"));
                }

                setTimeout(make_attempt, 1000);
              });
            };

            make_attempt();
          };

          args.push(tx_params, callback);
          fn.apply(self, args);
        });
      };
    }
  };

  function instantiate(instance, contract) {
    instance.contract = contract;
    var constructor = instance.constructor;

    // Provision our functions.
    for (var i = 0; i < instance.abi.length; i++) {
      var item = instance.abi[i];
      if (item.type == "function") {
        if (item.constant == true) {
          instance[item.name] = Utils.promisifyFunction(contract[item.name], constructor);
        } else {
          instance[item.name] = Utils.synchronizeFunction(contract[item.name], instance, constructor);
        }

        instance[item.name].call = Utils.promisifyFunction(contract[item.name].call, constructor);
        instance[item.name].sendTransaction = Utils.promisifyFunction(contract[item.name].sendTransaction, constructor);
        instance[item.name].request = contract[item.name].request;
        instance[item.name].estimateGas = Utils.promisifyFunction(contract[item.name].estimateGas, constructor);
      }

      if (item.type == "event") {
        instance[item.name] = contract[item.name];
      }
    }

    instance.allEvents = contract.allEvents;
    instance.address = contract.address;
    instance.transactionHash = contract.transactionHash;
  };

  // Use inheritance to create a clone of this contract,
  // and copy over contract's static functions.
  function mutate(fn) {
    var temp = function Clone() { return fn.apply(this, arguments); };

    Object.keys(fn).forEach(function(key) {
      temp[key] = fn[key];
    });

    temp.prototype = Object.create(fn.prototype);
    bootstrap(temp);
    return temp;
  };

  function bootstrap(fn) {
    fn.web3 = new Web3();
    fn.class_defaults  = fn.prototype.defaults || {};

    // Set the network iniitally to make default data available and re-use code.
    // Then remove the saved network id so the network will be auto-detected on first use.
    fn.setNetwork("default");
    fn.network_id = null;
    return fn;
  };

  // Accepts a contract object created with web3.eth.contract.
  // Optionally, if called without `new`, accepts a network_id and will
  // create a new version of the contract abstraction with that network_id set.
  function Contract() {
    if (this instanceof Contract) {
      instantiate(this, arguments[0]);
    } else {
      var C = mutate(Contract);
      var network_id = arguments.length > 0 ? arguments[0] : "default";
      C.setNetwork(network_id);
      return C;
    }
  };

  Contract.currentProvider = null;

  Contract.setProvider = function(provider) {
    var wrapped = new Provider(provider);
    this.web3.setProvider(wrapped);
    this.currentProvider = provider;
  };

  Contract.new = function() {
    if (this.currentProvider == null) {
      throw new Error("DocumentVerify error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("DocumentVerify error: contract binary not set. Can't deploy new instance.");
    }

    var regex = /__[^_]+_+/g;
    var unlinked_libraries = this.binary.match(regex);

    if (unlinked_libraries != null) {
      unlinked_libraries = unlinked_libraries.map(function(name) {
        // Remove underscores
        return name.replace(/_/g, "");
      }).sort().filter(function(name, index, arr) {
        // Remove duplicates
        if (index + 1 >= arr.length) {
          return true;
        }

        return name != arr[index + 1];
      }).join(", ");

      throw new Error("DocumentVerify contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of DocumentVerify: " + unlinked_libraries);
    }

    var self = this;

    return new Promise(function(accept, reject) {
      var contract_class = self.web3.eth.contract(self.abi);
      var tx_params = {};
      var last_arg = args[args.length - 1];

      // It's only tx_params if it's an object and not a BigNumber.
      if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
        tx_params = args.pop();
      }

      tx_params = Utils.merge(self.class_defaults, tx_params);

      if (tx_params.data == null) {
        tx_params.data = self.binary;
      }

      // web3 0.9.0 and above calls new twice this callback twice.
      // Why, I have no idea...
      var intermediary = function(err, web3_instance) {
        if (err != null) {
          reject(err);
          return;
        }

        if (err == null && web3_instance != null && web3_instance.address != null) {
          accept(new self(web3_instance));
        }
      };

      args.push(tx_params, intermediary);
      contract_class.new.apply(contract_class, args);
    });
  };

  Contract.at = function(address) {
    if (address == null || typeof address != "string" || address.length != 42) {
      throw new Error("Invalid address passed to DocumentVerify.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: DocumentVerify not deployed or address not set.");
    }

    return this.at(this.address);
  };

  Contract.defaults = function(class_defaults) {
    if (this.class_defaults == null) {
      this.class_defaults = {};
    }

    if (class_defaults == null) {
      class_defaults = {};
    }

    var self = this;
    Object.keys(class_defaults).forEach(function(key) {
      var value = class_defaults[key];
      self.class_defaults[key] = value;
    });

    return this.class_defaults;
  };

  Contract.extend = function() {
    var args = Array.prototype.slice.call(arguments);

    for (var i = 0; i < arguments.length; i++) {
      var object = arguments[i];
      var keys = Object.keys(object);
      for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        var value = object[key];
        this.prototype[key] = value;
      }
    }
  };

  Contract.all_networks = {
  "default": {
    "abi": [
      {
        "constant": true,
        "inputs": [
          {
            "name": "hash",
            "type": "string"
          }
        ],
        "name": "documentExists",
        "outputs": [
          {
            "name": "exists",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "docId",
            "type": "uint256"
          }
        ],
        "name": "getDocument",
        "outputs": [
          {
            "name": "blockNumber",
            "type": "uint256"
          },
          {
            "name": "hash",
            "type": "string"
          },
          {
            "name": "from",
            "type": "address"
          },
          {
            "name": "to",
            "type": "address"
          },
          {
            "name": "timeStamp",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "getLatest",
        "outputs": [
          {
            "name": "latest",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "hash",
            "type": "string"
          }
        ],
        "name": "newDocument",
        "outputs": [
          {
            "name": "success",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "empty",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "hash",
            "type": "string"
          },
          {
            "name": "recipient",
            "type": "address"
          }
        ],
        "name": "transferDocument",
        "outputs": [
          {
            "name": "success",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "inputs": [],
        "payable": false,
        "type": "constructor"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "blockNumber",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "hash",
            "type": "string"
          },
          {
            "indexed": false,
            "name": "from",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "to",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "timeStamp",
            "type": "uint256"
          }
        ],
        "name": "DocumentEvent",
        "type": "event"
      }
    ],
    "unlinked_binary": "0x606060405234610000575b60008054600160a060020a03191633600160a060020a03161790555b5b610916806100366000396000f3006060604052361561005c5763ffffffff60e060020a6000350416633026785f81146100615780633f9b250a146100c8578063c36af4601461019d578063cbdd51ea146101bc578063f2a75fe414610223578063faff6eb514610232575b610000565b34610000576100b4600480803590602001908201803590602001908080601f016020809104026020016040519081016040528093929190818152602001838380828437509496506102a495505050505050565b604080519115158252519081900360200190f35b34610000576100d8600435610322565b604051808681526020018060200185600160a060020a0316600160a060020a0316815260200184600160a060020a0316600160a060020a0316815260200183815260200182810382528681815181526020019150805190602001908083836000831461015f575b80518252602083111561015f57601f19909201916020918201910161013f565b505050905090810190601f16801561018b5780820380516001836020036101000a031916815260200191505b50965050505050505060405180910390f35b34610000576101aa6103fb565b60408051918252519081900360200190f35b34610000576100b4600480803590602001908201803590602001908080601f0160208091040260200160405190810160405280939291908181526020018383808284375094965061040295505050505050565b604080519115158252519081900360200190f35b34610000576102306104a1565b005b34610000576100b4600480803590602001908201803590602001908080601f0160208091040260200160405190810160405280939291908181526020018383808284375094965050509235600160a060020a031692506104dc915050565b604080519115158252519081900360200190f35b60006003826040518082805190602001908083835b602083106102d85780518252601f1990920191602091820191016102b9565b51815160209384036101000a600019018019909216911617905292019485525060405193849003019092205460ff1615915061031890505750600161031c565b5060005b5b919050565b60408051602080820183526000808352848152600280835284822080546001808301805489519281161561010002600019011694909404601f81018790048702820187019098528781529096939485948594918301828280156103c65780601f1061039b576101008083540402835291602001916103c6565b820191906000526020600020905b8154815290600101906020018083116103a957829003601f168201915b505050600284015460038501546004860154949950600160a060020a03918216985016955091935050505b5091939590929450565b6001545b90565b600061040d826102a4565b1561041a5750600061031c565b610425823333610581565b60016003836040518082805190602001908083835b602083106104595780518252601f19909201916020918201910161043a565b51815160209384036101000a60001901801990921691161790529201948552506040519384900301909220805460ff1916931515939093179092555060019150505b5b919050565b60008054604051600160a060020a03308116319392169183156108fc02918491818181858888f1935050505015156104d857610000565b5b50565b60006104e7836102a4565b156105795733600160a060020a03166004846040518082805190602001908083835b602083106105285780518252601f199092019160209182019101610509565b51815160209384036101000a6000190180199092169116179052920194855250604051938490030190922054600160a060020a031692909214159150610579905057610575833384610581565b5060015b5b5b92915050565b600180548101905560405183518291600491869190819060208401908083835b602083106105c05780518252601f1990920191602091820191016105a1565b51815160209384036101000a60001901801990921691161790529201948552506040519384900381018420805473ffffffffffffffffffffffffffffffffffffffff1916600160a060020a03969096169590951790945550508451600192600392879290918291908401908083835b6020831061064e5780518252601f19909201916020918201910161062f565b6001836020036101000a038019825116818451168082178552505050505050905001915050908152602001604051809103902060006101000a81548160ff02191690831515021790555060a06040519081016040528043815260200184815260200183600160a060020a0316815260200182600160a060020a0316815260200142815250600260006001548152602001908152602001600020600082015181600001556020820151816001019080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f1061074357805160ff1916838001178555610770565b82800160010185558215610770579182015b82811115610770578251825591602001919060010190610755565b5b506107919291505b8082111561078d5760008155600101610779565b5090565b505060408201518160020160006101000a815481600160a060020a030219169083600160a060020a0316021790555060608201518160030160006101000a815481600160a060020a030219169083600160a060020a03160217905550608082015181600401559050507fbb1ca6813018202726114dac793544d4581bb383c5cfb2c9bc1292c675056c994384848442604051808681526020018060200185600160a060020a0316600160a060020a0316815260200184600160a060020a0316600160a060020a031681526020018381526020018281038252868181518152602001915080519060200190808383600083146108a7575b8051825260208311156108a757601f199092019160209182019101610887565b505050905090810190601f1680156108d35780820380516001836020036101000a031916815260200191505b50965050505050505060405180910390a15b5050505600a165627a7a72305820d2e9cfc6ddaef85e291961105bfe9b3dcc97b737e066c8719c488fc00798b7240029",
    "events": {
      "0xbb1ca6813018202726114dac793544d4581bb383c5cfb2c9bc1292c675056c99": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "blockNumber",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "hash",
            "type": "string"
          },
          {
            "indexed": false,
            "name": "from",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "to",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "timeStamp",
            "type": "uint256"
          }
        ],
        "name": "DocumentEvent",
        "type": "event"
      }
    },
    "updated_at": 1483235784522,
    "links": {},
    "address": "0x79377558eb385c5ea3f29838e7a5bb4ee0d9c34a"
  }
};

  Contract.checkNetwork = function(callback) {
    var self = this;

    if (this.network_id != null) {
      return callback();
    }

    this.web3.version.network(function(err, result) {
      if (err) return callback(err);

      var network_id = result.toString();

      // If we have the main network,
      if (network_id == "1") {
        var possible_ids = ["1", "live", "default"];

        for (var i = 0; i < possible_ids.length; i++) {
          var id = possible_ids[i];
          if (Contract.all_networks[id] != null) {
            network_id = id;
            break;
          }
        }
      }

      if (self.all_networks[network_id] == null) {
        return callback(new Error(self.name + " error: Can't find artifacts for network id '" + network_id + "'"));
      }

      self.setNetwork(network_id);
      callback();
    })
  };

  Contract.setNetwork = function(network_id) {
    var network = this.all_networks[network_id] || {};

    this.abi             = this.prototype.abi             = network.abi;
    this.unlinked_binary = this.prototype.unlinked_binary = network.unlinked_binary;
    this.address         = this.prototype.address         = network.address;
    this.updated_at      = this.prototype.updated_at      = network.updated_at;
    this.links           = this.prototype.links           = network.links || {};
    this.events          = this.prototype.events          = network.events || {};

    this.network_id = network_id;
  };

  Contract.networks = function() {
    return Object.keys(this.all_networks);
  };

  Contract.link = function(name, address) {
    if (typeof name == "function") {
      var contract = name;

      if (contract.address == null) {
        throw new Error("Cannot link contract without an address.");
      }

      Contract.link(contract.contract_name, contract.address);

      // Merge events so this contract knows about library's events
      Object.keys(contract.events).forEach(function(topic) {
        Contract.events[topic] = contract.events[topic];
      });

      return;
    }

    if (typeof name == "object") {
      var obj = name;
      Object.keys(obj).forEach(function(name) {
        var a = obj[name];
        Contract.link(name, a);
      });
      return;
    }

    Contract.links[name] = address;
  };

  Contract.contract_name   = Contract.prototype.contract_name   = "DocumentVerify";
  Contract.generated_with  = Contract.prototype.generated_with  = "3.2.0";

  // Allow people to opt-in to breaking changes now.
  Contract.next_gen = false;

  var properties = {
    binary: function() {
      var binary = Contract.unlinked_binary;

      Object.keys(Contract.links).forEach(function(library_name) {
        var library_address = Contract.links[library_name];
        var regex = new RegExp("__" + library_name + "_*", "g");

        binary = binary.replace(regex, library_address.replace("0x", ""));
      });

      return binary;
    }
  };

  Object.keys(properties).forEach(function(key) {
    var getter = properties[key];

    var definition = {};
    definition.enumerable = true;
    definition.configurable = false;
    definition.get = getter;

    Object.defineProperty(Contract, key, definition);
    Object.defineProperty(Contract.prototype, key, definition);
  });

  bootstrap(Contract);

  if (typeof module != "undefined" && typeof module.exports != "undefined") {
    module.exports = Contract;
  } else {
    // There will only be one version of this contract in the browser,
    // and we can use that.
    window.DocumentVerify = Contract;
  }
})();
