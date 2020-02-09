const Redis = require('ioredis');
var profile = process.argv[2];
const readline = require('readline');
var redis_members = null;

var version = "1.0.1";
var author = "futl@deepblueai.com";
var cluster = null;
var total = 0;
function init(){
    if(profile == "test"){
        redis_members=getTestConfig();
    }else if(profile == "uat"){
            redis_members=getUatConfig();
    }else if(profile == "pro"){
        redis_members=getProConfig();
}
    if(profile==null){
            console.log('没有配置profile,默认test。(profile:test|uat|pro)');
            redis_members=getTestConfig();
            profile="test"
    }
    var option={
        clusterRetryStrategy:function(times) {
            var delay = Math.min(times * 50, 2000);
            return delay;
          }
    };

    cluster=new Redis.Cluster(redis_members,option);
    // cluster.pipeline([["get","iot_webhook_clientId:LITLAN-2-DBS800-2-V2-000001"],
    // ["get","iot_webhook_clientId:biglan20181108-pro01"]]).exec(function(err, results) {
    //     console.log("pipeline:"+results);
    // });
}
init();




function readSyncByRl() {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
                terminal: true,
                historySize: 30,
                prompt:profile+">",
                completer:completer
            });
            rl.prompt(profile+">");
            rl.on('line', (input) => {
                parsingInput(input.toString(),rl);
              });
        });
}
readSyncByRl();
function completer(line) {
    const completions = 'get set ttl incr decr keys keysv keysc del sadd scard expire version help author switch profile'.split(' ');
    const hits = completions.filter((c) => c.startsWith(line));
    // 如果没有匹配，则显示所有补全。
    return [hits.length ? hits : completions, line];
  }
 function getValue(key,isv,rl){
    if(!isv){
        cluster.get(key, function (err, res) {
            console.log(res);
            rl.prompt(profile+">");
        });
    }else{
      return  new Promise((resolve) => {
            cluster.get(key, function (err, res) {
                var o = {};
                o.key = key;
                o.value = res;
                resolve(o);
            });
        });
      
    }
    
}
function parsingInput(text,rl){
     if(text.indexOf("sadd")==0){
        var key =text.replace("sadd","")
        key = key.trim();  
        var kv=key.split(" ");
            if(kv.length <3){
                console.log("未识别的命令:"+text);    
                rl.prompt(profile+">");          
            }
        var mems=[]
        for(var i = 1;i<kv.length;i++){
            mems.push(kv[i]);
        }    
        cluster.sadd(kv[0],mems).then(function(data){
            console.log(data);
            rl.prompt(profile+">"); 
        });
        }else if(text.indexOf("ttl")==0){
            var key =text.replace("ttl","")
            key = key.trim();  
            cluster.ttl(key, function (err, res) {
                console.log(res);
                rl.prompt(profile+">");
         });
        }else if(text.indexOf("expire")==0){
            var key =text.replace("expire","")
            key = key.trim();  
            var kv=key.split(" ");
            if(kv.length !=2){
                console.log("未识别的命令:"+text);    
                rl.prompt(profile+">");          
            }
            cluster.expire(kv[0],kv[1]).then(function(data){
                console.log(data);
                rl.prompt(profile+">"); 
            });
        }else if(text.indexOf("scard")==0){
            var key =text.replace("scard","")
            key = key.trim();  
            cluster.scard(key).then(function(data){
                console.log(data);
                rl.prompt(profile+">"); 
            });
        }else if(text.indexOf("smembers")==0){
            var key =text.replace("smembers","")
            key = key.trim();  
            cluster.smembers(key).then(function(data){
                console.log(data);
                rl.prompt(profile+">"); 
            });
        }else if(text.indexOf("get")==0){
            var key =text.replace("get","")
            key = key.trim();  
            getValue(key,false,rl);
        }else if(text.indexOf("incr")==0){
            var key =text.replace("incr","")
            key = key.trim();  
            cluster.incr(key, function (err, res) {
                console.log(res);
                rl.prompt(profile+">");
            });
        }else if(text.indexOf("decr")==0){
            var key =text.replace("decr","")
            key = key.trim();  
            cluster.decr(key, function (err, res) {
                console.log(res);
                rl.prompt(profile+">");
            });
        }else  if(text.indexOf("set")==0){
            var key = text.replace("set","")
            key = key.trim();  
            var kv=key.split(" ");
            if(kv.length !=2 && kv.length !=4){
                console.log("未识别的命令:"+text);              
            }else{
                var k = kv[0].trim();
                var v = kv[1].trim();
                if(kv.length ==2){
                    cluster.set(k,v).then(function(data){
                        console.log(data);
                        rl.prompt(profile+">"); 
                    });
                }else{
                    var mode = kv[2].trim();
                    var time = kv[3].trim();
                    cluster.set(k,v,mode,time).then(function(data){
                        console.log(data);
                        rl.prompt(profile+">"); 
                    });
                }    
            }
        } else  if(text.indexOf("del")==0){
            var key = text.replace("del","")
            key = key.trim();  
            cluster.del(key).then(function(data){
                console.log(data);
                rl.prompt(profile+">"); 
            });
        }else  if(text.indexOf("keysv")==0){
            var keys = text.replace("keysv","")
            keys = keys.trim();  
            if(keys.length<5){
                console.log("key长度不能小于5"); 
                rl.prompt(profile+">");
            }else if(keys == "*"){
                console.log("禁止查询所有的key!"); 
                rl.prompt(profile+">");
            }else if(keys.replace(/\*/g,"")==""){
                console.log("key格式错误!"); 
                rl.prompt(profile+">");
            }else{
                keysCluster(keys,true,rl);
            }
           
        }else  if(text.indexOf("keysc")==0){
            var pattern = text.replace("keysc","")
            pattern = pattern.trim();  
            if(pattern.length<5){
                console.log("key长度不能小于5"); 
                rl.prompt(profile+">");
            }else if(pattern == "*"){
                console.log("禁止查询所有的key!"); 
                rl.prompt(profile+">");
            }else if(pattern.replace(/\*/g,"")==""){
                console.log("key格式错误!"); 
                rl.prompt(profile+">");
            }else{
                var masters = cluster.nodes("master");
                Promise.all(
                    masters.map(function(node) {
                        return getNodeKeys(node,pattern);
                    })
                  ).then(function(keys) {
                      var newArr=[];
                      for(var i=0;i<keys.length;i++){
                          if(keys[i].length>0){
                              for(var j=0;j<keys[i].length;j++){
                                  newArr.push(keys[i][j]);
                              }
                          } 
                      }
                    console.log("size:"+newArr.length);
                    rl.prompt(profile+">");
                  });
            }
           
        }else  if(text.indexOf("keys")==0){
            var keys = text.replace("keys","")
            keys = keys.trim();  
            if(keys.length<5){
                console.log("key长度不能小于5"); 
                rl.prompt(profile+">");
            }else if(keys == "*"){
                console.log("禁止查询所有的key!"); 
                rl.prompt(profile+">");
            }else if(keys.replace(/\*/g,"")==""){
                console.log("key格式错误!"); 
                rl.prompt(profile+">");
            }else{
                keysCluster(keys,false,rl);
            }
            
        }else if(text=="author"){
            console.log("author:"+author);
            rl.prompt(profile+">");
        }else if(text=="profile"){
            console.log("current profile:"+profile);
            rl.prompt(profile+">");
        }else if(text=="version"){
            console.log("current version:"+version);
            rl.prompt(profile+">");
        }else if(text.indexOf("switch")==0){
            var e_profie = text.replace(/switch/g,"")
            e_profie = e_profie.trim();
            if(profile !=e_profie && (e_profie=="test"||e_profie=="uat"||e_profie=="pro")){
            profile = e_profie;
            init();
            }  
            console.log("switch success!current profile:"+profile);
            rl.setPrompt(profile+">");
            rl.prompt(profile+">");
        }else if(text=="help"){
            help(rl);
        } else if(text=="") {
            rl.prompt(profile+">");
        }else {
            console.log("未识别的命令:"+text);
            help(rl);
        }
}

function help(rl){
    console.log("支持tab命令自动补全,支持历史命令记录查询。注意：模糊查询的key过多时，终端可能显示不全");
    console.log("get {key} ---查询指定key");
    console.log("set {key} {value} [expiration EX seconds|PX milliseconds]---给指定的key赋值");
    console.log("del {key} ---删除指定key");
    console.log("ttl {key} ---查询key的剩余时间");
    console.log("expire {key} ---设置key的过期时间,单位:秒");
    console.log("sadd {key} value1 value2  ---向set中add值");
    console.log("scard {key} ---查询set中的数量");
    console.log("smembers {key} ---查询set中所有的值");
    console.log("incr {key} ---加1");
    console.log("decr {key} ---减1");
    console.log("keys {keys} ---模糊查询集群中的keys. ex:*mykey* .禁止查询所有的key:*");
    console.log("keysv {keys} ---同keys,当查询小于200个时会把value也查出来");
    console.log("keysc {keys} ---模糊查询总数");
    console.log("version ---查询当前版本");
    console.log("profile ---查询当前的profile所指的环境");
    console.log("switch {profile} ---切换profile:(test|uat|pro),也可以在启动程序时指定。ex:cluster-cli uat,没有配置profile默认为test");
    console.log("author ---futl@deepblueai.com");
    rl.prompt(profile+">");
}
function keysCluster(pattern,isv,rl){
var masters = cluster.nodes("master");
if(!isv){
    Promise.all(
        masters.map(function(node) {
            return getNodeKeys(node,pattern);
        })
      ).then(function(keys) {
          var newArr=[];
          for(var i=0;i<keys.length;i++){
              if(keys[i].length>0){
                  for(var j=0;j<keys[i].length;j++){
                      newArr.push(keys[i][j]);
                  }
              } 
          }
        consoleArr(newArr);
        rl.prompt(profile+">");
      });
}else{
    Promise.all(
        masters.map(function(node) {
           return getNodeKeys(node,pattern);
        })
      ).then(function(keys) {
          var newArr=[];
          for(var i=0;i<keys.length;i++){
              if(keys[i].length>0){
                  for(var j=0;j<keys[i].length;j++){
                      newArr.push(keys[i][j]);
                  }
              } 
          }
        if(newArr.length>200||newArr.length==0){
        consoleArr(newArr);
        rl.prompt(profile+">");
        }else{
            for(var k=0;k<newArr.length;k++){
               getValue(newArr[k],true).then((data)=>{
                console.log(JSON.stringify(data,null,2));
                total = total+1;
                if(total==newArr.length){
                    rl.prompt(profile+">");
                    total=0;
                }
               });  
            }
        }  
        
      });
}

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
   var keySet = new Set(result);
   return Array.from(keySet);
};

function scan(node,cursor,pattern){
   return new Promise(function (resolve, reject) {
    node.scan(cursor,'match',pattern,'count',10000).then(function(data){
        const [cursor, matched] = data;
        return resolve({ cursor, matched ,pattern});
    });
    });
    
}
function consoleArr(newArr){
    newArr = newArr.sort();
     if(newArr.length<=200){
        for(var i=0;i<newArr.length;i++){
        console.log(newArr[i]); 
        }
        return;
    }
    console.log(JSON.stringify(newArr));
}
function getProConfig(){
    var redis_members = [{
        port: 6379,
        password: '',
        host: ''
      }, {
        port: 6379,
        password: '',
        host: ''
      }, {
        port: 6379,
        password: '',
        host: ''
      }]
      return redis_members;
}
function getUatConfig(){
    var redis_members = [{
        port: 6380,
        password: '',
        host: ''
      }, {
        port: 6385,
        password: '',
        host: ''
      }, {
        port: 6381,
        password: '',
        host: ''
      }]
      return redis_members;
}
function getTestConfig(){
    var redis_members = [{
        port: 6379,
        password: '',
        host: ''
      }, {
        port: 6380,
        password: '',
        host: ''
      }, {
        port: 6381,
        password: '',
        host: ''
      }]
      return redis_members;
}
