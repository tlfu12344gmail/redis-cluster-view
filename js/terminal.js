const redisCommand = require('./redis-command.js')
const s = require('./store.js');
const  Redis = require('ioredis');
var util = util || {};
var currentProfile = null;
util.toArray = function(list) {
  return Array.prototype.slice.call(list || [], 0);
};
String.prototype.endWith=function(endStr){
  var d=this.length-endStr.length;
  return (d>=0&&this.lastIndexOf(endStr)==d)
}
var Terminal = Terminal || function(cmdLineContainer, outputContainer) {
  window.URL = window.URL || window.webkitURL;
  window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;

  var cmdLine_ = document.querySelector(cmdLineContainer);
  var output_ = document.querySelector(outputContainer);
  var fs_ = null;
  var cwd_ = null;
  var history_ = [];
  var histpos_ = 0;
  var histtemp_ = 0;
  var command = redisCommand.RedisCommand();
  const CMDS_DESC = command.CMDS_DESC;

  window.addEventListener('click', function(e) {
    cmdLine_.focus();
  }, false);

  cmdLine_.addEventListener('click', inputTextClick_, false);
  cmdLine_.addEventListener('keydown', historyHandler_, false);
  cmdLine_.addEventListener('keydown', processNewCommand_, false);

  
  //
  function inputTextClick_(e) {
    this.value = this.value;
  }

  //
  function historyHandler_(e) {
    if (history_.length) {
      if (e.keyCode == 38 || e.keyCode == 40) {
        if (history_[histpos_]) {
          history_[histpos_] = this.value;
        } else {
          histtemp_ = this.value;
        }
      }

      if (e.keyCode == 38) { // up
        histpos_--;
        if (histpos_ < 0) {
          histpos_ = 0;
        }
      } else if (e.keyCode == 40) { // down
        histpos_++;
        if (histpos_ > history_.length) {
          histpos_ = history_.length;
        }
      }

      if (e.keyCode == 38 || e.keyCode == 40) {
        this.value = history_[histpos_] ? history_[histpos_] : histtemp_;
        this.value = this.value; // Sets cursor to end of input.
      }
    }
  }
  function find(str,cha,num){
    var x=str.indexOf(cha);
    for(var i=0;i<num;i++){
        x=str.indexOf(cha,x+1);
    }
    return x;
    }
  function getCmdDesc(cmd){
    var commandArr = cmd.split(" ");
    var newCommandArr = [];
    for(var k = 0;k<commandArr.length;k++){
      if(commandArr[k].trim()!=""){
        newCommandArr.push(commandArr[k]);
      }
    }
    var spaceCount = newCommandArr.length;
    for(var i=0;i<CMDS_DESC.length;i++){
      if(CMDS_DESC[i].indexOf(commandArr[0]) ==0){
        var index = find(CMDS_DESC[i]," ",spaceCount-1);
        if(index>=0){
          return CMDS_DESC[i].substr(index);
        }
        
      }
    }
    return null;
  }
  //
  function buildSpace(count){
    var spaces = "";
    for(var i=0;i<count;i++){
      spaces=spaces + "&nbsp;";
    }
    return spaces;
  }
  function processNewCommand_(e) {

    if (e.keyCode == 9) { // tab
      e.preventDefault();
      // Implement tab suggest.
    } else if(e.keyCode == 32){
      var input = $("input[class =cmdline]:last").val()+" ";
       var cmdDesc = getCmdDesc(input.toLowerCase());
       if(cmdDesc !=null){
        $('.placeholder:last').html(buildSpace(input.length*1.5)+cmdDesc);
       }else{
        $('.placeholder:last').html("");
       }
    }else if (e.keyCode == 13) { // enter
      // Save shell history.
      if (this.value) {
        history_[history_.length] = this.value;
        histpos_ = history_.length;
      }

      // Duplicate current input and append to output section.
      var line = this.parentNode.parentNode.cloneNode(true);
      line.removeAttribute('id')
      line.classList.add('line');
      var input = line.querySelector('input.cmdline');
      input.autofocus = false;
      input.readOnly = true;
      output_.appendChild(line);

      if (this.value && this.value.trim()) {
        var args = this.value.split(' ').filter(function(val, i) {
          return val;
        });
        var cmd = args[0].toLowerCase();
        args = args.splice(1); // Remove cmd from arg list.
      }
      $('.placeholder:last').html("");
      if(cmd=='help'){
        help();
      }else{
        command.parseCmd(cmd,args).then(function (data){
          dealWithRedisCallback(data);
        });
      }
      $("#south").scrollTop($("#south")[0].scrollHeight);
      this.value = ''; // Clear/setup line for next input.
      $('.placeholder').html("");
    }else{
      $('.placeholder:last').html("");
    }
  }

  function help(){
    var html="show cons ----show exist connections<br>"+
              "use ${con} ----use the connection which you select<br>";
      output(html);        
    
  }
  function dealWithRedisCallback(data){
    if(data.err && data.err.message){
      output(data.err);
      return
    }
    if(data.err){
      output(data.err);
    }else{
      if(data.res && data.res=== data.res+""&& data.res == "cons"){
        showConnections();
      }else if(data.res && data.res=== data.res+""&& data.res.indexOf("use:")==0){
        useConnection(data.res.split(':')[1],0);
      }else if(data.res && data.res=== data.res+""&& data.res == "clear"){
        $('output').empty();
      }else if(data.res && data.res=== data.res+""&& data.res == "dbs"){
        showDbs();
      }else if(data.res && data.res=== data.res+""&& data.res.indexOf("select:")==0){
        useDb(data.res.split(':')[1]);
      }else if(data.res && Array.isArray(data.res)){
         var newArr = data.res;
           if(newArr.length<=500){
             newArr = newArr.sort()
             var outputShow = ""
              for(var i=0;i<newArr.length;i++){
                var j =i+1;
                outputShow=outputShow+j+") "+newArr[i]+"<br>"; 
              }
              output("size:"+newArr.length);
              output(outputShow);
              return;
          }
          output("size:"+newArr.length);
          output(JSON.stringify(newArr));
      }
      else{
        output(data.res);
      }
      
    }
  }
  function useDb(db){
    if(db>=0&&db<=15){
      useConnection(currentProfile,db);
    }else{
    output("illegal db!");
    }
   
  }
  function showDbs(){
   if(currentProfile==null){
    output("please connect first!");
   }else{
    var config = s.Store().get("config");
    var useCon = null;
    for(var i=0;i<config.length;i++){
      if(config[i].profile == currentProfile){
        useCon = config[i].connection;
        break;
      }
    }

    if(useCon!=null && Array.isArray(useCon)){
      output("0");
    }else if(useCon!=null && !Array.isArray(useCon)){
      output("0<br>1<br>2<br>3<br>4<br>5<br>6<br>7<br>8<br>9<br>10<br>11<br>12<br>13<br>14<br>15<br>");
    }
   }
  }
  function useConnection(profile,db){
    var config = s.Store().get("config");
    var useCon = null;
    for(var i=0;i<config.length;i++){
      if(config[i].profile == profile){
        useCon = config[i].connection;
        break;
      }
    }
    if(useCon!=null && Array.isArray(useCon)){
      const cluserOption={
        clusterRetryStrategy:function(times) {
            var delay = Math.min(times * 50, 2000);
            return delay;
          }  
    };
    const cluster=new Redis.Cluster(useCon,cluserOption);
    redisCommand.RedisCommand().init(cluster,null);
    $('.prompt').html('['+profile+']# ');
    currentProfile = profile;
    }else if(useCon!=null && !Array.isArray(useCon)){
      useCon.db = db;
      const redis = new Redis(useCon);
      redisCommand.RedisCommand().init(null,redis);
      $('.prompt').html('['+profile+':'+useCon.db+']# ');
      currentProfile = profile;
    }else{
      output('not exist connection:'+profile);
    }

  }

  function showConnections(){
    var config = s.Store().get("config");
    var cons="";
    for(var i=0;i<config.length;i++){
      cons = cons+config[i].profile+"<br>"
    }
    output(cons);
  }
  //
  function formatColumns_(entries) {
    var maxName = entries[0].name;
    util.toArray(entries).forEach(function(entry, i) {
      if (entry.name.length > maxName.length) {
        maxName = entry.name;
      }
    });

    var height = entries.length <= 3 ?
        'height: ' + (entries.length * 15) + 'px;' : '';

    // 12px monospace font yields ~7px screen width.
    var colWidth = maxName.length * 7;

    return ['<div class="ls-files" style="-webkit-column-width:',
            colWidth, 'px;', height, '">'];
  }

  //
  function output(html) {
    output_.insertAdjacentHTML('beforeEnd', '<p>' + html + '</p>');
    //window.scrollTo(0, getDocHeight_());
    $("#south").scrollTop($("#south")[0].scrollHeight);
  }

  // Cross-browser impl to get document's height.
  function getDocHeight_() {
    var d = document;
    return Math.max(
        Math.max(d.body.scrollHeight, d.documentElement.scrollHeight),
        Math.max(d.body.offsetHeight, d.documentElement.offsetHeight),
        Math.max(d.body.clientHeight, d.documentElement.clientHeight)
    );
  }

  //
  return {
    init: function() {
      output('<img align="left" src="http://www.w3.org/html/logo/downloads/HTML5_Badge_128.png" width="100" height="100" style="padding: 0px 10px 20px 0px"><h2 style="letter-spacing: 4px">HTML5 Web Terminal</h2><p>' + new Date() + '</p><p>Enter "help" for more information.</p>');
    },
    output: output
  }
};
module.exports={
  Terminal:Terminal
}