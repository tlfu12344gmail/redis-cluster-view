const crc = require('./crc16-ccitt');

var util = util || {};
util.toArray = function(list) {
  return Array.prototype.slice.call(list || [], 0);
};
var map = new Map();
var slotMap = new Map();
var defautKeysSize=10000;
var defaultGroupSize = defautKeysSize/50;
const CMDS_DESC=[
  'show cons|dbs|commands',
  'use con',
  'select db',
  'config get databases',
  'dbsize',
  'get key',
  'set key value [EX|PX seconds|milliseconds] [NX|XX]',
  'del key [key ...]',
  'ttl key',
  'expire key seconds',
  'exists key',
  'type key',
  'keys pattern [count]',
  'keysc pattern [count]',
  'keysv pattern [count]',

  'sadd key member [member ...]',
  'scard key',
  'smembers key',
  'srem key member [member ...]',
  'sismember key member',
  'sscan key cursor [MATCH pattern] [COUNT count]',

  'incr key',
  'decr key',

  'zadd key [NX|XX] [CH] [INCR] score member [score member ...]',
  'zcard key',
  'zcount key min max',
  'zrem key member [member ...]',
  'zrange key start stop [WITHSCORES]',
  'zrank key member',
  'zscore key member',
  'zscan key cursor [MATCH pattern] [COUNT count]',
   
  'lset key index value',
  'lpush key value [value ...]',
  'rpush key value [value ...]',
  'lpushx key value',
  'rpushx key value',
  'llen key',
  'lrange key start stop',
  'lrem key count value',
  'linsert key BEFORE|AFTER pivot value',
  'lindex key index',

  'hset key field value',
  'hmset key field value [field value ...]',
  'hsetnx key field value',
  'hlen key',
  'hdel key field [field ...]',
  'hexists key field',
  'hget key field',
  'hmget key field [field ...]',
  'hkeys key',
  'hgetall key',
  'hscan key cursor [MATCH pattern] [COUNT count]',
  'hstrlen key field',
  'hvals key',
  "clear"
];
var RedisCommand = RedisCommand || function() {
  
  function getWrongNumberArg(cmd){
    return {err:"ERR wrong number of arguments for '"+cmd+"' command",res:""}
  }
  const getNodeKeys = async(node, pattern,max) => {
    const result = [];
    let cursor = 0;
    var map = new Map();
    while (true) {
        var { matched, cursor: newCursor } = await scan(node,cursor, pattern,10000);
        var nerrArr=[];
        if(max!=-1){
        for(var i=0;i<matched.length;i++){
          if(matched[i].indexOf(":")==-1){
            nerrArr.push(matched[i]);
          }else{
            var group = matched[i].substr(0,matched[i].indexOf(":"));
           if(map.get(group)!=null){
             var count = map.get(group);
             if(count<defaultGroupSize){
              nerrArr.push(matched[i]);
             }
             map.set(group,++count);
           }else{
            nerrArr.push(matched[i]);
            map.set(group,1);
           }
          }
        }
        if(nerrArr.length>max){
          nerrArr = nerrArr.slice(0,max);
        }
       }else{
        nerrArr=matched;
       }
        result.push(...nerrArr);
        cursor = newCursor;
        if(max!=-1&&result.length>=max){
          break;
        }
        if (cursor === '0') {
            break;
        }
    }
    map = new Map();
   return Array.from(new Set(result));
};
function initClusterSlotMap(slots){
  var tempNode = null;
  var range = [];
 for(var i=0;i<slots.length;i++){
   var mNode = slots[i][0];
   if(tempNode ==null){
     tempNode = mNode;
     range.push(i);
   }
   if(mNode != tempNode){
    range.push(i-1);
    slotMap.set(tempNode,range);
    range=[];
    range.push(i);
    tempNode = mNode;
   }
   if(i==slots.length-1){
    range.push(i);
    slotMap.set(tempNode,range);
   }
 }
}
function getKeyNode(key,profile){
  var slot = crc.getSlot(key);
  if(slotMap.size==0&&map.get(profile).isCluster){
    initClusterSlotMap(map.get(profile).redis.slots);
  }
  for (var m of slotMap) { // 遍历Map
    var s = m[1][0];
    var e = m[1][1];
    if(slot>= s && slot<= e){
      return m[0];
    }
}



}
function scan(node,cursor,pattern,size){
   return new Promise(function (resolve, reject) {
    node.scan(cursor,'match',pattern,'count',size).then(function(data){
        const [cursor, matched] = data;
        return resolve({ cursor, matched ,pattern});
    });
    });
    
}
function getKeysNode(keys,profile){
  var map = new Map();
  for(var i=0;i<keys.length;i++){
   var nodeName = getKeyNode(keys[i],profile);
   if(map.has(nodeName)){
     var keysArr = map.get(nodeName);
     keysArr.push(keys[i]);
     map.set(nodeName,keysArr);
   }else{
     var keysArr = [];
     keysArr.push(keys[i]);
     map.set(nodeName,keysArr);
   }
  }
  return map;
}

function getAllKeysV(typeMap,currentRedis){
  var pa=[];
  for(var k of typeMap){
    if(k[0]=='string'){
      pa.push(getStringV(currentRedis,k[1].sort()));
     }else if(k[0]=='set'){
       pa.push(getSetV(currentRedis,k[1].sort()));
     }else if(k[0]=='zset'){
      pa.push(getZSetV(currentRedis,k[1].sort()));
    }else if(k[0]=='list'){
      pa.push(getListV(currentRedis,k[1].sort()));
    }else if(k[0]=='hash'){
      pa.push(getHashV(currentRedis,k[1].sort()));
    }
  }
  return Promise.all(pa);
}
function buildPipelineArr(keys,commands){
  var arr=[];
                   
  for(var i=0;i<keys.length;i++){
    var typeCommand=[];
    typeCommand.push(commands);
    typeCommand.push(keys[i]);
    arr.push(typeCommand);
    }
  return arr;
}
function getZSetV(currentRedis,keys){
  var arr=[];
                   
  for(var i=0;i<keys.length;i++){
    var typeCommand=[];
    typeCommand.push("zscan");
    typeCommand.push(keys[i]);
    typeCommand.push(0);
    typeCommand.push("MATCH");
    typeCommand.push("*");
    typeCommand.push("COUNT");
    typeCommand.push(defaultGroupSize);
    arr.push(typeCommand);
    }
  return new Promise(function(resolve,reject){
    currentRedis.pipeline(arr).exec().then(function(data){
      var kvArr=[];
      for(var i=0;i<data.length;i++){
        var kv = {};
        kv.key = keys[i];
        kv.type = 'zset';
        kv.value = data[i][1][1];
        kvArr.push(kv);
      }
     return resolve(kvArr);
    })
    });
}
function getSetV(currentRedis,keys){
  var arr=[];
                   
  for(var i=0;i<keys.length;i++){
    var typeCommand=[];
    typeCommand.push("sscan");
    typeCommand.push(keys[i]);
    typeCommand.push(0);
    typeCommand.push("MATCH");
    typeCommand.push("*");
    typeCommand.push("COUNT");
    typeCommand.push(defaultGroupSize);
    arr.push(typeCommand);
    }
 
  return new Promise(function(resolve,reject){
    currentRedis.pipeline(arr).exec().then(function(data){
      var kvArr=[];
      for(var i=0;i<data.length;i++){
        var kv = {};
        kv.key = keys[i];
        kv.type = 'set';
        kv.value = data[i][1][1];
        kvArr.push(kv);
      }
     return resolve(kvArr);
    })
    });
}
function getListV(currentRedis,keys){ 
  var arr =[];
                   
  for(var i=0;i<keys.length;i++){
    var typeCommand=[];
    typeCommand.push("lrange");
    typeCommand.push(keys[i]);
    typeCommand.push(0);
    typeCommand.push(defaultGroupSize);
    arr.push(typeCommand);
    }
  return new Promise(function(resolve,reject){
    currentRedis.pipeline(arr).exec().then(function(data){
      var kvArr=[];
      for(var i=0;i<data.length;i++){
        var kv = {};
        kv.key = keys[i];
        kv.type = 'list';
        kv.value = data[i][1];
        kvArr.push(kv);
      }
     return resolve(kvArr);
    })
    });
}
function getHashV(currentRedis,keys){
  var arr=[];
                   
  for(var i=0;i<keys.length;i++){
    var typeCommand=[];
    typeCommand.push("hscan");
    typeCommand.push(keys[i]);
    typeCommand.push(0);
    typeCommand.push("MATCH");
    typeCommand.push("*");
    typeCommand.push("COUNT");
    typeCommand.push(defaultGroupSize);
    arr.push(typeCommand);
    }               
  return new Promise(function(resolve,reject){
    currentRedis.pipeline(arr).exec().then(function(data){
      var kvArr=[];
      for(var i=0;i<data.length;i++){
        var kv = {};
        kv.key = keys[i];
        kv.type = 'hash';
        kv.value = data[i][1][1];
        kvArr.push(kv);
      }
     return resolve(kvArr);
    })
    });
}
function getStringV(currentRedis,keys){
  var arr = buildPipelineArr(keys,'get');
  return new Promise(function(resolve,reject){
    currentRedis.pipeline(arr).exec().then(function(data){
      var kvArr=[];
      for(var i=0;i<data.length;i++){
        var kv = {};
        kv.key = keys[i];
        kv.type = 'string';
        kv.value = data[i][1];
        kvArr.push(kv);
      }
     return resolve(kvArr);
    })
    });
}
function keyvPromise(currentRedis,keys){
  var arr = buildPipelineArr(keys,'type');
  return new Promise(function(resolve,reject){
    currentRedis.pipeline(arr).exec().then(function(data){
      var typeMap = new Map();
      for(var i=0;i<data.length;i++){
        var type = data[i][1];
        var typeArr = [];
          if(typeMap.has(type)){
           typeArr = typeMap.get(type); 
          }
          typeArr.push(keys[i]);
          typeMap.set(type,typeArr); 
      }
      getAllKeysV(typeMap,currentRedis).then(function(data){
        var kv=[];
        for(var i=0;i<data.length;i++){
          var kvv=data[i];
          for(var j=0;j<kvv.length;j++){
            kv.push(kvv[j]);
          }
        }
        resolve(kv);
      });
       
    });
  });
}
function findNode(currentRedis,hp){
  var masters = currentRedis.nodes("master");
  for(var i=0;i<masters.length;i++){
    if(masters[i].connector.options.host+":"+masters[i].connector.options.port == hp){
      return masters[i];
    }
  }
}
function getKeysV(currentRedis,isCluster,keys,profile){
  var pa = [];
if(isCluster){
  var nodeKeyMap = getKeysNode(keys,profile);
  
  for (var t of nodeKeyMap){
    var node = findNode(currentRedis,t[0]);
    var p= keyvPromise(node,t[1]);
    pa.push(p); 
  } 
 }else{
   pa.push(keyvPromise(currentRedis,keys));
 }

  return Promise.all(pa);
  
}

const command =function(profile,cmd,args){
  return new Promise(function (resolve, reject) {
    if(!map.get(profile)&&cmd!="show"&&cmd!="use"&&cmd!="clear"&&cmd!="select"){
      return resolve({err:"please connect first!",res:null});
    }
    var instance = map.get(profile);
    var currentRedis = instance==null?null:instance.redis;
    if(args&&args.length>0){
      args[0]=args[0].replace(/'|"/g);
    }
    switch (cmd) {
      case 'keysv':
      case 'keysc':
      case 'keys':
        if(args.length!=2){
          return resolve(getWrongNumberArg(cmd));
        }
        if(instance.isCluster){
          var masters = currentRedis.nodes("master");
          Promise.all(
            masters.map(function(node) {
               return getNodeKeys(node,args[0],args[1]);
            })
          ).then(function(keys) {
            var keyset = new Set();
              for(var i=0;i<keys.length;i++){
                  if(keys[i].length>0){
                      for(var j=0;j<keys[i].length;j++){
                        if(keys[i][j]){
                          keyset.add(keys[i][j]);
                        }
                        
                      }
                  } 
              }
              var keyArr=Array.from(keyset);
              //args[1]为查询的条数，集群下不做控制，每个节点下查这个数，返回的数据为args[1]*masters节点个数
              // if(keyArr.length>args[1]){
              //   keyArr = keyArr.slice(0,args[1]);
              // }
              if(cmd=='keysc'){
                resolve({err:false,res:keyArr.length}); 
              }else if(cmd =='keys'){
                resolve({err:false,res:keyArr}); 
              }else if(cmd = 'keysv'){
                if(keyArr.length>0&& keyArr.length<=defautKeysSize){
                  getKeysV(currentRedis,true,keyArr,profile).then(function(data){  
                    var kvs = [];
                    for(var i=0;i<data.length;i++){
                      var kv =data[i];
                      for(var j=0; j<kv.length;j++){
                        kvs.push(kv[j]);
                      }
                      
                    }
                    resolve({err:false,res:kvs});
                  },function(e){
                    return resolve({err:e,res:null});
                   
                });
                }else{
                  resolve({err:false,res:keyArr}); 
                }
              }
             
          },function(e){
            return resolve({err:e,res:null});
           
        }); 
        }else{
           getNodeKeys(currentRedis,args[0],args[1]).then(function(data){
            if(cmd=='keysc'){
              resolve({err:false,res:data.length}); 
            }else if(cmd =='keys'){
              resolve({err:false,res:Array.from(data).sort()});
            }else if(cmd = 'keysv'){
              if(data.length>0&& data.length<=defautKeysSize){
                getKeysV(currentRedis,false,data,profile).then(function(d){  
                  var kvs = [];
                  for(var i=0;i<d.length;i++){
                    var kv =d[i];
                    for(var j=0; j<kv.length;j++){
                      kvs.push(kv[j]);
                    }
                    
                  }
                  resolve({err:false,res:kvs});
                });
              }else{
                resolve({err:false,res:data}); 
              }
            }
            
           },function(e){
            return resolve({err:e,res:null});
           
        });
          
        }
       break;   
      case 'clear':
        return resolve({err:null,res:"clear"});  
      case 'use':
      case 'select':
        if(args.length!=1){
          return resolve(getWrongNumberArg(cmd));
        }
        return resolve({'err':false,'res':cmd+':'+args[0]});
      case 'show':  
        if(args.length!=1){
          return resolve(getWrongNumberArg(cmd));
        }
        return resolve({'err':false,'res':args[0]});
      case 'set':
        if(args.length<2||args.length>5){
          return resolve(getWrongNumberArg(cmd));
        }
        if(args.length==2){
          currentRedis.set(args[0], args[1],function (err, res) {
          return  resolve({err,res});
        });
        }else if(args.length ==3){
          currentRedis.set(args[0], args[1],args[2],function (err, res) {
            return resolve({err,res});
        });
        }else if(args.length ==4){
          currentRedis.set(args[0], args[1],args[2],args[3],function (err, res) {
            return resolve({err,res});
        });
        }else if(args.length ==5){
          currentRedis.set(args[0], args[1],args[2],args[3],args[4],function (err, res) {
            return resolve({err,res});
        });
        }
        break;
      
      case 'get':
          if(args.length>1){
            return resolve(getWrongNumberArg(cmd));
          } 
          currentRedis.get(args[0], function (err, res) {
              return resolve({err,res});
          });
          // for(var i=0;i<100000;i++){
          //   currentRedis.set("tzsu:age:"+i,i,function(err,res){

          //   })
          // }
          // for(var i=0;i<10000;i++){
          //   currentRedis.set("xinyin:addr:"+i,"tzsu:addr:"+i,function(err,res){
              
          //   })
          // }
          // for(var i=0;i<1000;i++){
          //   currentRedis.set("tianming:tel:"+i,"tzsu:tel:"+i,function(err,res){
              
          //   })
          // }
          // for(var i=0;i<500;i++){
          //   currentRedis.set("guang:hand:"+i,"tzsu:hand:"+i,function(err,res){
              
          //   })
          // }
          // for(var i=0;i<200;i++){
          //   currentRedis.set("xu:sun:"+i,"tzsu:sun:"+i,function(err,res){
              
          //   })
          // }

        break;
      case 'type':
          if(args.length>1){
            return resolve(getWrongNumberArg(cmd));
          } 
          currentRedis.type(args[0], function (err, res) {
              return resolve({err,res});
          });
        break;
      case 'exists':
          if(args.length>1){
            return resolve(getWrongNumberArg(cmd));
          } 
          currentRedis.exists(args[0], function (err, res) {
              return resolve({err,res});
          });
        break;
        
      case 'del':
         currentRedis.del(args, function (err, res) {
            return resolve({err,res});
          });
          break;
      case 'ttl':
        if(args.length>1){
          return resolve(getWrongNumberArg(cmd));
        }
          currentRedis.ttl(args[0], function (err, res) {
            return resolve({err,res});
          });
      break;          
      case 'expire':
        if(args.length!=2){
          return resolve(getWrongNumberArg(cmd));
        }
          currentRedis.expire(args[0],args[1], function (err, res) {
            return resolve({err,res});
          });
          break; 
      case 'config':
        currentRedis.config(args[0],args[1]).then(function(data){
          return resolve({err:null,res:data});
        },function(e){
          return resolve({err:e,res:null});
         
      });
          break;
      case 'dbsize':
        if(instance.isCluster){
          var masters = currentRedis.nodes("master");
          Promise.all(
            masters.map(function(node) {
               return node.dbsize();
            })
          ).then(function(data) {
            return resolve({err:null,res:eval(data.join("+"))});  
          },function(e){
            return resolve({err:e,res:null});
           
        });
        }else{
          currentRedis.dbsize(function (err, res) {
            return resolve({err:err,res:res});
          });
        }
        break;
      case 'sadd':
        if(args.length<2){
          return resolve(getWrongNumberArg(cmd));
        }
        var mems = args.slice(1);
        currentRedis.sadd(args[0],mems).then(function(data){
          return resolve({err:false,res:data});
      },function(e){
        return resolve({err:e,res:null});
       
    });
        break;
      case 'srem':
        if(args.length<2){
          return resolve(getWrongNumberArg(cmd));
        }
        var mems = args.slice(1);
        currentRedis.srem(args[0],mems).then(function(data){
          return resolve({err:false,res:data});
      },function(e){
        return resolve({err:e,res:null});
       
    });
        break;
      case 'scard':
          if(args.length!=1){
            return resolve(getWrongNumberArg(cmd));
          }
          currentRedis.scard(args[0]).then(function(data){
            return resolve({err:false,res:data});
        },function(e){
          return resolve({err:e,res:null});
         
      });
          break;
      case 'smembers':
            if(args.length!=1){
              return resolve(getWrongNumberArg(cmd));
            }
            currentRedis.smembers(args[0]).then(function(data){
              return resolve({err:false,res:data});
          },function(e){
            return resolve({err:e,res:null});
           
        });
            break; 
      case 'sismember':
              if(args.length!=2){
                return resolve(getWrongNumberArg(cmd));
              }
              currentRedis.sismember(args[0],args[1]).then(function(data){
                return resolve({err:false,res:data});
            },function(e){
              return resolve({err:e,res:null});
             
          });
              break; 
      case 'sscan':
                       if(args.length<3){
                              return resolve(getWrongNumberArg(cmd));
                            }
                           var values = args.slice(2);
                            currentRedis.sscan(args[0],args[1],values).then(function(data){
                                return resolve({err:false,res:data});
                            },function(e){
                              return resolve({err:e,res:null});
                             
                          });
                           
                            break;         
      case 'incr':
              if(args.length!=1){
                return resolve(getWrongNumberArg(cmd));
              }
              currentRedis.incr(args[0]).then(function(data){
                return resolve({err:false,res:data});
            },function(e){
              return resolve({err:e,res:null});
             
          });
              break; 
      case 'decr':
                if(args.length!=1){
                  return resolve(getWrongNumberArg(cmd));
                }
                currentRedis.decr(args[0]).then(function(data){
                  return resolve({err:false,res:data});
              },function(e){
                return resolve({err:e,res:null});
               
            });
                break;       
                
                
      case 'zadd':
                  if(args.length<3){
                    return resolve(getWrongNumberArg(cmd));
                  }
                  var values = args.slice(1);
                  currentRedis.zadd(args[0],values).then(function(data){
                    return resolve({err:false,res:data});
                },function(e){
                  return resolve({err:e,res:null});
                 
              });
                  break; 
      case 'zcard':
                    if(args.length!=1){
                      return resolve(getWrongNumberArg(cmd));
                    }
                    currentRedis.zcard(args[0]).then(function(data){
                      return resolve({err:false,res:data});
                  },function(e){
                    return resolve({err:e,res:null});
                   
                });
                    break;
      case 'zcount':
                    if(args.length!=3){
                      return resolve(getWrongNumberArg(cmd));
                    }
                    currentRedis.zcount(args[0],args[1],args[2]).then(function(data){
                      return resolve({err:false,res:data});
                  },function(e){
                    return resolve({err:e,res:null});
                   
                });
                    break; 
      case 'zrem':
                    if(args.length<2){
                      return resolve(getWrongNumberArg(cmd));
                    }
                    var values = args.slice(1);
                    currentRedis.zrem(args[0],values).then(function(data){
                      return resolve({err:false,res:data});
                  },function(e){
                    return resolve({err:e,res:null});
                   
                });
                    break;  

      case 'zrange':
                      if(args.length!=3&&args.length!=4){
                        return resolve(getWrongNumberArg(cmd));
                      }
                      if(args.length==3){
                        currentRedis.zrange(args[0],args[1],args[2]).then(function(data){
                          return resolve({err:false,res:data});
                      },function(e){
                        return resolve({err:e,res:null});
                       
                    });
                      }else{
                        currentRedis.zrange(args[0],args[1],args[2],args[3]).then(function(data){
                          return resolve({err:false,res:data});
                      }),function(e){
                        return resolve({err:e,res:null});
                       
                    };
                      }
                      
                      break;  
      case 'zrank':
                        if(args.length!=2){
                          return resolve(getWrongNumberArg(cmd));
                        }
                       
                        currentRedis.zrank(args[0],args[1]).then(function(data){
                            return resolve({err:false,res:data});
                        },function(e){
                          return resolve({err:e,res:null});
                         
                      });
                       
                        break;
      case 'zscore':
                          if(args.length!=2){
                            return resolve(getWrongNumberArg(cmd));
                          }
                         
                          currentRedis.zscore(args[0],args[1]).then(function(data){
                              return resolve({err:false,res:data});
                          },function(e){
                            return resolve({err:e,res:null});
                           
                        });
                         
                          break;  
        case 'zscan':
                            if(args.length<3){
                              return resolve(getWrongNumberArg(cmd));
                            }
                           var values = args.slice(2);
                          
                           
                           currentRedis.zscan(args[0],args[1],values).then(function(data){
                                return resolve({err:false,res:data});
                            },function(e){
                              return resolve({err:e,res:null});
                             
                          });
                           
                            break;  
         case 'lset':
                              if(args.length!=3){
                                return resolve(getWrongNumberArg(cmd));
                              }
                             currentRedis.lset(args[0],args[1],args[2]).then(function(data){
                                  return resolve({err:false,res:data});
                              },function(e){
                                return resolve({err:e,res:null});
                               
                            });
                             
                              break;  
          case 'rpush':                        
          case 'lpush':
          case 'rpushx':                        
          case 'lpushx':
                                if(args.length<2){
                                  return resolve(getWrongNumberArg(cmd));
                                }
                               var values = args.slice(1);
                              
                               if(cmd=="rpush"){
                                currentRedis.rpush(args[0],values).then(function(data){
                                  return resolve({err:false,res:data});
                                   },function(e){
                                     return resolve({err:e,res:null});
                               
                                 });
                               }else if(cmd=="lpush"){
                                currentRedis.lpush(args[0],values).then(function(data){
                                  return resolve({err:false,res:data});
                                  },function(e){
                                return resolve({err:e,res:null});
                               
                                });
                              }else if(cmd=='rpushx'){
                                currentRedis.rpushx(args[0],args[1]).then(function(data){
                                  return resolve({err:false,res:data});
                                  },function(e){
                                return resolve({err:e,res:null});
                               
                                });
                              }else if(cmd=='lpushx'){
                                currentRedis.lpushx(args[0],args[1]).then(function(data){
                                  return resolve({err:false,res:data});
                                  },function(e){
                                return resolve({err:e,res:null});
                               
                                });
                              }
                               
                               
                                break;                    
                            
                      case 'llen':
                                  if(args.length!=1){
                                    return resolve(getWrongNumberArg(cmd));
                                  }
                                  currentRedis.llen(args[0]).then(function(data){
                                    return resolve({err:false,res:data});
                                },function(e){
                                  return resolve({err:e,res:null});
                                 
                              });
                                  break; 
                      case 'lrange':
                                    if(args.length!=3){
                                      return resolve(getWrongNumberArg(cmd));
                                    }
                                      currentRedis.lrange(args[0],args[1],args[2]).then(function(data){
                                        return resolve({err:false,res:data});
                                    },function(e){
                                      return resolve({err:e,res:null});
                                     
                                  });
                                    break;  
                      case 'lrem':
                                  if(args.length!=3){
                                    return resolve(getWrongNumberArg(cmd));
                                  }
                                  currentRedis.lrem(args[0],args[1],args[2]).then(function(data){
                                    return resolve({err:false,res:data});
                                },function(e){
                                  return resolve({err:e,res:null});
                                
                              });
                                  break;   
                        case 'linsert':
                                    if(args.length!=4){
                                      return resolve(getWrongNumberArg(cmd));
                                    }
                                    currentRedis.linsert(args[0],args[1],args[2],args[3]).then(function(data){
                                      return resolve({err:false,res:data});
                                  },function(e){
                                    return resolve({err:e,res:null});
                                  
                                });
                                    break;  
                        case 'lindex':
                                      if(args.length!=2){
                                        return resolve(getWrongNumberArg(cmd));
                                      }
                                      currentRedis.lindex(args[0],args[1]).then(function(data){
                                        return resolve({err:false,res:data});
                                    },function(e){
                                      return resolve({err:e,res:null});
                                    
                                  });
                                      break;  
                         case 'hset':
                                if(args.length!=3){
                                  return resolve(getWrongNumberArg(cmd));
                                }
                                currentRedis.hset(args[0],args[1],args[2]).then(function(data){
                                  return resolve({err:false,res:data});
                                  },function(e){
                                return resolve({err:e,res:null});
                              
                                   });
                          break;  
                         case 'hsetnx':
                                        if(args.length!=3){
                                          return resolve(getWrongNumberArg(cmd));
                                        }
                                        currentRedis.hsetnx(args[0],args[1],args[2]).then(function(data){
                                          return resolve({err:false,res:data});
                                      },function(e){
                                        return resolve({err:e,res:null});
                                      
                                    });
                                        break;  
                          case 'hmset':
                                        if(args.length<3){
                                          return resolve(getWrongNumberArg(cmd));
                                        }
                                        var values = args.slice(1);
                                        currentRedis.hmset(args[0],values).then(function(data){
                                          return resolve({err:false,res:data});
                                      },function(e){
                                        return resolve({err:e,res:null});
                                      
                                    });
                                        break;
                            case 'hlen':
                                        if(args.length!=1){
                                          return resolve(getWrongNumberArg(cmd));
                                        }
                                        currentRedis.hlen(args[0]).then(function(data){
                                          return resolve({err:false,res:data});
                                      },function(e){
                                        return resolve({err:e,res:null});
                                      
                                    });
                                        break;   
                             case 'hdel':
                                          if(args.length<2){
                                            return resolve(getWrongNumberArg(cmd));
                                          }
                                          var values = args.slice(1);
                                          currentRedis.hdel(args[0],values).then(function(data){
                                            return resolve({err:false,res:data});
                                        },function(e){
                                          return resolve({err:e,res:null});
                                        
                                      });
                                          break;  
                              case 'hexists':
                                          if(args.length!=2){
                                            return resolve(getWrongNumberArg(cmd));
                                          }
                                          currentRedis.hexists(args[0],args[1]).then(function(data){
                                            return resolve({err:false,res:data});
                                        },function(e){
                                          return resolve({err:e,res:null});
                                        
                                      });
                                          break; 
                                case 'hget':
                                            if(args.length!=2){
                                              return resolve(getWrongNumberArg(cmd));
                                            }
                                            currentRedis.hget(args[0],args[1]).then(function(data){
                                              return resolve({err:false,res:data});
                                          },function(e){
                                            return resolve({err:e,res:null});
                                          
                                        });
                                            break; 
                                  case 'hmget':
                                            if(args.length<2){
                                              return resolve(getWrongNumberArg(cmd));
                                            }
                                            var values = args.slice(1);
                                            currentRedis.hmget(args[0],values).then(function(data){
                                              return resolve({err:false,res:data});
                                          },function(e){
                                            return resolve({err:e,res:null});
                                          
                                        });
                                            break; 
                                    case 'hkeys':
                                              if(args.length!=1){
                                                return resolve(getWrongNumberArg(cmd));
                                              }
                                              currentRedis.hkeys(args[0]).then(function(data){
                                                return resolve({err:false,res:data});
                                               },function(e){
                                              return resolve({err:e,res:null});
                                            
                                             });
                                              break;
                                    case 'hgetall':   
                                        if(args.length!=1){
                                          return resolve(getWrongNumberArg(cmd));
                                        }
                                        currentRedis.hgetall(args[0]).then(function(data){
                                          return resolve({err:false,res:data});
                                          },function(e){
                                            return resolve({err:e,res:null});
                                          
                                        });
                                        break;                  
                                            
                                    case 'hscan':
                                          if(args.length<3){
                                            return resolve(getWrongNumberArg(cmd));
                                          }
                                         var values = args.slice(2);
                                        
                                         
                                         currentRedis.hscan(args[0],args[1],values).then(function(data){
                                              return resolve({err:false,res:data});
                                          },function(e){
                                            return resolve({err:e,res:null});
                                           
                                        });
                                        break;
                                      case 'hstrlen':
                                          if(args.length!=2){
                                            return resolve(getWrongNumberArg(cmd));
                                          }
                                         currentRedis.hstrlen(args[0],args[1]).then(function(data){
                                              return resolve({err:false,res:data});
                                          },function(e){
                                            return resolve({err:e,res:null});
                                           
                                        });
                                        break;
                                        case 'hvals':
                                          if(args.length!=1){
                                            return resolve(getWrongNumberArg(cmd));
                                          }
                                         currentRedis.hvals(args[0]).then(function(data){
                                              return resolve({err:false,res:data});
                                          },function(e){
                                            return resolve({err:e,res:null});
                                           
                                        });
                                        break;
                                      
                                             
      default:
        if (cmd) {
          return resolve({err:"notSupport conmmand:"+cmd,res:""});
        }
    };
    });
}
  return {
    init:function(profile,redis){
      if(!map.has(profile)){
        map.set(profile,redis);
      } 
    },
    getRedis:function(profile){
      return map;
    },
    CMDS_DESC :CMDS_DESC,
    parseCmd : command,
    defautKeysSize:defautKeysSize,
    resetSlotMap:function(){
      slotMap=new Map();
    }
  }
};
module.exports={
  RedisCommand:RedisCommand
}