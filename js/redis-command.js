var util = util || {};
util.toArray = function(list) {
  return Array.prototype.slice.call(list || [], 0);
};
var currentRedis = null;
var isCluster = false;
var RedisCommand = RedisCommand || function() {
  
  function getWrongNumberArg(cmd){
    return {err:"ERR wrong number of arguments for '"+cmd+"' command",res:""}
  }
  const getNodeKeys = async(node, pattern) => {
    const result = [];
    let cursor = 0;
    while (true) {
        const { matched, cursor: newCursor } = await scan(node,cursor, pattern);
        result.push(...matched);
        cursor = newCursor;
        if (cursor === '0') {
            break;
        }
    }
   return Array.from(new Set(result));
};

function scan(node,cursor,pattern){
   return new Promise(function (resolve, reject) {
    node.scan(cursor,'match',pattern,'count',10000).then(function(data){
        const [cursor, matched] = data;
        return resolve({ cursor, matched ,pattern});
    });
    });
    
}
  return {
    isCluster:function(){
      return this.isCluster;
    },
    init:function(cluster,redis){
      currentRedis = cluster!=null?cluster:redis;
      isCluster = cluster!=null;
    },
    CMDS_DESC :[
      'show cons|dbs',
      'use con',
      'select db',
      'get key',
      'set key value [EX|PX seconds|milliseconds] [NX|XX]',
      'del key [key ...]',
      'ttl key',
      'expire key seconds',
      'keys pattern',
      'keysc pattern',
      'keysv pattern',
    ],
    parseCmd : function(cmd,args){
      return new Promise(function (resolve, reject) {
        if(!currentRedis&&cmd!="show"&&cmd!="use"&&cmd!="clear"&&cmd!="select"){
          return resolve({err:"please connect first!",res:null});
        }
        switch (cmd) {
          case 'keysv':
          case 'keysc':
          case 'keys':
            if(args.length!=1){
              return resolve(getWrongNumberArg(cmd));
            }
            if(isCluster){
              var masters = currentRedis.nodes("master");
              Promise.all(
                masters.map(function(node) {
                   return getNodeKeys(node,args[0]);
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
                    if(data.length>0&& data.length<=10000){

                    }else{
                      resolve({err:false,res:Array.from(keyset)}); 
                    }
                  }
                 
              }); 
            }else{
               getNodeKeys(currentRedis,args[0]).then(function(data){
                if(cmd=='keysc'){
                  resolve({err:false,res:data.length}); 
                }else if(cmd =='keys'){
                  resolve({err:false,res:Array.from(data)});
                }else if(cmd = 'keysv'){
                  if(data.length>0&& data.length<=10000){
                   var arr=[];
                   
                   for(var i=0;i<data.length;i++){
                    var typeCommand=[];
                    typeCommand.push("type");
                    typeCommand.push(data[i]);
                    arr.push(typeCommand);
                   }
                   console.log(arr);
                  currentRedis.pipeline(arr).exec().then(function(data){
                    console.log(data);
                  });
                  }else{
                    resolve({err:false,res:Array.from(keyset)}); 
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
          default:
            if (cmd) {
              return resolve({err:"notSupport conmmand",res:""});
            }
        };
        });
}
  }
};
module.exports={
  RedisCommand:RedisCommand
}