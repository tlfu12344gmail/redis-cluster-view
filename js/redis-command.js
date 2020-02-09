const crc = require('./crc16-ccitt');

var util = util || {};
util.toArray = function(list) {
  return Array.prototype.slice.call(list || [], 0);
};
var map = new Map();
var slotMap = new Map();
var defautKeysSize=1000;
const CMDS_DESC=[
  'show cons|dbs|commands',
  'use con',
  'select db',
  'config get databases',
  'get key',
  'set key value [EX|PX seconds|milliseconds] [NX|XX]',
  'del key [key ...]',
  'ttl key',
  'expire key seconds',
  'exists key',
  'keys pattern [count(可选)]',
  'keysc pattern [count(可选)]',
  'keysv pattern [count(可选)]',
  'sadd key member [member ...]',
  'scard key',
  'smembers key',
  'srem key member [member ...]',
  'sismember key member',
  'incr key',
  'decr key',
  'clear'
];
var RedisCommand = RedisCommand || function() {
  
  function getWrongNumberArg(cmd){
    return {err:"ERR wrong number of arguments for '"+cmd+"' command",res:""}
  }
  const getNodeKeys = async(node, pattern,max) => {
    const result = [];
    let cursor = 0;
    while (true) {
        var { matched, cursor: newCursor } = await scan(node,cursor, pattern,max);
        if(matched.length>max){
          matched = matched.slice(0,max);
        }
        result.push(...matched);
        cursor = newCursor;
        if(max!=-1&&result.length>=max){
          break;
        }
        if (cursor === '0') {
            break;
        }
    }
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

function getAllKeysV(typeMap,currentRedis,keys){
  var pa=[];
  for(var k of typeMap){
    if(k[0]=='string'){
      pa.push(getStringV(currentRedis,k[1]));
     }else if(k[0]=='set'){
       pa.push(getSetV(currentRedis,k[1]));
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
function getSetV(currentRedis,keys){
  var arr = buildPipelineArr(keys,'smembers');
  return new Promise(function(resolve,reject){
    currentRedis.pipeline(arr).exec().then(function(data){
      var kvArr=[];
      for(var i=0;i<data.length;i++){
        var kv = {};
        kv.key = keys[i];
        kv.value = data[i][1];
        kv.type = 'set';
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
        kv.value = data[i][1];
        kv.type = 'string';
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
              if(cmd=='keysc'){
                resolve({err:false,res:keyset.size}); 
              }else if(cmd =='keys'){
                resolve({err:false,res:Array.from(keyset)}); 
              }else if(cmd = 'keysv'){
                if(keyset.size>0&& keyset.size<=defautKeysSize){
                  getKeysV(currentRedis,true,Array.from(keyset),profile).then(function(data){  
                    var kvs = [];
                    for(var i=0;i<data.length;i++){
                      var kv =data[i];
                      for(var j=0; j<kv.length;j++){
                        kvs.push(kv[j]);
                      }
                      
                    }
                    resolve({err:false,res:kvs});
                  });
                }else{
                  resolve({err:false,res:Array.from(keyset)}); 
                }
              }
             
          }); 
        }else{
           getNodeKeys(currentRedis,args[0],args[1]).then(function(data){
            if(cmd=='keysc'){
              resolve({err:false,res:data.length}); 
            }else if(cmd =='keys'){
              resolve({err:false,res:Array.from(data)});
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
      });
        break;
      case 'srem':
        if(args.length<2){
          return resolve(getWrongNumberArg(cmd));
        }
        var mems = args.slice(1);
        currentRedis.srem(args[0],mems).then(function(data){
          return resolve({err:false,res:data});
      });
        break;
      case 'scard':
          if(args.length!=1){
            return resolve(getWrongNumberArg(cmd));
          }
          currentRedis.scard(args[0]).then(function(data){
            return resolve({err:false,res:data});
        });
          break;
      case 'smembers':
            if(args.length!=1){
              return resolve(getWrongNumberArg(cmd));
            }
            currentRedis.smembers(args[0]).then(function(data){
              return resolve({err:false,res:data});
          });
            break; 
      case 'sismember':
              if(args.length!=2){
                return resolve(getWrongNumberArg(cmd));
              }
              currentRedis.sismember(args[0],args[1]).then(function(data){
                return resolve({err:false,res:data});
            });
              break;       
      case 'incr':
              if(args.length!=1){
                return resolve(getWrongNumberArg(cmd));
              }
              currentRedis.incr(args[0]).then(function(data){
                return resolve({err:false,res:data});
            });
              break; 
      case 'decr':
                if(args.length!=1){
                  return resolve(getWrongNumberArg(cmd));
                }
                currentRedis.decr(args[0]).then(function(data){
                  return resolve({err:false,res:data});
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
      map.set(profile,redis);
    },
    getRedis:function(profile){
      return this.map;
    },
    CMDS_DESC :CMDS_DESC,
    parseCmd : command,
    defautKeysSize:defautKeysSize
  }
};
module.exports={
  RedisCommand:RedisCommand
}