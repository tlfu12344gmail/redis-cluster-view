var util = util || {};
util.toArray = function(list) {
  return Array.prototype.slice.call(list || [], 0);
};

var RedisCommand = RedisCommand || function(cluster,redis) {
  window.URL = window.URL || window.webkitURL;
  window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
  var currentRedis = cluster != null?cluster:redis;
  var isCluster = cluster != null
  
  
  function getWrongNumberArg(cmd){
    return {err:"ERR wrong number of arguments for '"+cmd+"' command",res:""}
  }
  return {
    CMDS_DESC : [
      'get key',
      'set key value [EX|PX seconds|milliseconds] [NX|XX]',
      'del key [key ...]',
      'ttl key',
      'expire key seconds'
    ],
    parseCmd : function(cmd,args){
    console.log(args);
    return new Promise(function (resolve, reject) {
      switch (cmd) {
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