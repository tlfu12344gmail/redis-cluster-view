const redisCommand = require('./redis-command.js')
const s = require('./store.js');
const  Redis = require('ioredis');
var util = util || {};
var currentProfile = null;

$.fn.setCursorPosition = function (position) {
  if (this.lengh == 0) return this;
  return $(this).setSelection(position, position);
}

$.fn.setSelection = function (selectionStart, selectionEnd) {
  if (this.lengh == 0) return this;
  input = this[0];

  if (input.createTextRange) {
      var range = input.createTextRange();
      range.collapse(true);
      range.moveEnd('character', selectionEnd);
      range.moveStart('character', selectionStart);
      range.select();
  } else if (input.setSelectionRange) {
      input.focus();
      input.setSelectionRange(selectionStart, selectionEnd);
  }

  return this;
}

$.fn.focusEnd = function () {
  if (this.val() != undefined) {
      this.setCursorPosition(this.val().length);
  }
}
util.toArray = function(list) {
  return Array.prototype.slice.call(list || [], 0);
};
String.prototype.endWith=function(endStr){
  var d=this.length-endStr.length;
  return (d>=0&&this.lastIndexOf(endStr)==d)
}
var Terminal = Terminal || function(cmdLineContainer, outputContainer,currentTab) {
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
  var currentTab = currentTab;

  // window.addEventListener('click', function(e) {
  //   cmdLine_.focus();
  // }, false);
  $("#south").bind('click', function(e){
    //e.preventDefault();
    if(e.target.id=='south'||e.target.id.indexOf('container')!=-1){
      //cmdLine_.focus();
      $("#input-line"+currentTab+" .cmdline").focusEnd();
    }
  });
  $("#south").bind('dblclick', function(e){
    if(e.target.className=="pSize"){
      var text = $(e.target).next();
        if(text){
          selectRange(text[0]);
        }
      } 
  });
 // cmdLine_.addEventListener('click', inputTextClick_, false);
  cmdLine_.addEventListener('keyup', historyHandler_, false);
  cmdLine_.addEventListener('keydown', processNewCommand_, false);

  function selectRange(text){
    if (document.body.createTextRange)
     {
                var range = document.body.createTextRange();
                range.moveToElementText(text);
                range.select();
      } else if (window.getSelection) {
                var selection = window.getSelection();
                var range = document.createRange();
                range.selectNodeContents(text);
                selection.removeAllRanges();
                selection.addRange(range);
                              
        } 
  }
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
        //this.value = history_[histpos_] ? history_[histpos_] : histtemp_;
        //this.value = this.value; // Sets cursor to end of input.
        var temp = history_[histpos_] ? history_[histpos_] : histtemp_;
        //$(this).val('');
       // $(this).focus();
        //$(this).val(temp);
        $(this).val(temp);
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
  function tabEvent(){
    var input = $("#input-line"+currentTab+" .cmdline").val();
    var count = 0;
    var temp = null;
    if(input&&input!=''){
      if(input.indexOf('use ')==0||input.indexOf('show ')==0){
       var arr = input.split(' ');
       var command = arr[0];
       var content = arr[1];
       if(content.trim()!=""){
        var showContent= [];
         if(command=='show'){
            showContent= ['cons','dbs','commands'];
         }else if(command=='use'){
           showContent=findConsNames();
         }
         for(var i=0;i<showContent.length;i++){
          if(showContent[i].indexOf(content)==0){
            count++;
            temp=command+" "+showContent[i];
          }
        }
       }
      }else{
        for(var i=0;i<CMDS_DESC.length;i++){
          var command = CMDS_DESC[i].split(' ')[0];
          if(command.indexOf(input)==0){
            count++;
            temp=command;
          }
        }
      }
    if(count==1){
      $("#input-line"+currentTab+" .cmdline").val(temp);
    }  
    }
  }
  function processNewCommand_(e) {

    if (e.keyCode == 9) { // tab
      e.preventDefault();
      tabEvent();
      // Implement tab suggest.
    }else if(e.ctrlKey && e.keyCode  == 67) {   
      //doSomething();  
      // 返回false, 防止重复触发copy事件  
      $('#searching'+currentTab).remove();
      $('#input-line'+currentTab+' .prompt').html('use command "help" to show usage> ');
      currentProfile=null;
    }else if(e.keyCode == 32){//space
      if($("#input-line"+currentTab+" .cmdline").val().trim()!=""){
        var input = $("#input-line"+currentTab+" .cmdline").val()+" ";
        var cmdDesc = getCmdDesc(input.toLowerCase());
        if(cmdDesc !=null){
         $('#input-line'+currentTab+' .placeholder:last').html(buildSpace(input.length*1.5)+cmdDesc);
        }else{
         $('#input-line'+currentTab+' .placeholder:last').html("");
        }
      }
    }else if (e.keyCode == 13) { // enter
      $('#searching'+currentTab).removeAttr("id");
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
      $('#input-line'+currentTab).hide();
      output_.appendChild(line);

      if (this.value && this.value.trim()) {
        var args = this.value.split(' ').filter(function(val, i) {
          return val;
        });
        var cmd = args[0].toLowerCase();
        args = args.splice(1); // Remove cmd from arg list.
        if(cmd.indexOf("keys")==0&&args.length==1){
          if(args[0].replace(/\*/g,"")==""){
            args.push(command.defautKeysSize);
          }else{
            args.push(-1);
          }
        }
      }else{
        showLine();
      }
      $('#input-line'+currentTab+' .placeholder:last').html("");
      if(cmd=='help'){
        help();
        showLine();
      }else if(this.value&&this.value.trim() !=""){
        
        if(cmd=='use'){
          output_.insertAdjacentHTML('beforeEnd', '<p id="searching'+currentTab+'">connecting......</p>');
        }else{
          output_.insertAdjacentHTML('beforeEnd', '<p id="searching'+currentTab+'">'+cmd+'......</p>');
        }
        var title = $('#input-line'+currentTab+' .prompt').html().replace("&gt;","");
        if(title.indexOf('use command') !=0){
          if(cmd=="select"){
            currentProfile=title.split(":")[0];
          }else{
            currentProfile=title;
          }
          
        }
        command.parseCmd(currentProfile,cmd,args).then(function (data){
          dealWithRedisCallback(data,cmd);
          showLine();
        });
      }
      $("#container"+currentTab).scrollTop($("#container"+currentTab)[0].scrollHeight+32);
      this.value = ''; // Clear/setup line for next input.
      $('#input-line'+currentTab+' .placeholder').html("");
    }else{
      $('#input-line'+currentTab+' .placeholder:last').html("");
    }
  }
  function showLine(){
    $('#input-line'+currentTab).show();
    $('#input-line'+currentTab+' .cmdline').focus();
    $("#container"+currentTab).scrollTop($("#container"+currentTab)[0].scrollHeight+32);
  }
  function help(){
    var html="show cons ----show existing connections<br>"+
              "use ${con} ----use a connection<br>"+
              "show commands ----show supported commands<br>"+
              "clear ---to clear output in terminal<br>"+
              "ctrl+c ---quit the current terminal connection<br>";
      output(html);    
    
  }
  function dealWithRedisCallback(data,cmd){
    if(data.err && data.err.message){
      output(data.err.message);
      return;
    }
    if(data.err){
      output(data.err);
    }else{
      if(data.res && data.res=== data.res+""&& data.res == "commands"){
        showCommands();
      }else if(data.res && data.res=== data.res+""&& data.res == "cons"){
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
           if(newArr.length<=100&&cmd!="keysv"){
             newArr = newArr.sort()
             var outputShow = ""
              for(var i=0;i<newArr.length;i++){
                var j =i+1;
                if($.isPlainObject(newArr[i])| Array.isArray(newArr[i])){
                  outputShow=outputShow+j+") "+JSON.stringify(newArr[i])+"<br>"; 
                }else{
                  outputShow=outputShow+j+") "+newArr[i]+"<br>"; 
                }
                
              }
             // $('#searching').remove();
              output("<p class=\"pSize\">size:"+newArr.length+"</p>",true);
              output(outputShow);
              return;
          }
          $('#searching'+currentTab).remove();
          output("<p class=\"pSize\">size:"+newArr.length+"</p>",true);
          if(newArr.length<=command.defautKeysSize){
            output(syntaxHighlight(newArr),true);
          }else{
            output(JSON.stringify(newArr, undefined, 2));
          }
          
          //console.log(JSON.stringify(newArr,null,2));
      }else if($.isPlainObject(data.res)){
        if(newArr.length<=command.defautKeysSize){
          output(syntaxHighlight(data.res),true);
        }else{
          output(JSON.stringify(data.res, undefined, 2));
        }
      }else{ 
        output(data.res);
      }
      
    }
  }
  function useDb(db){
    if(db>=0&&db<=50){
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
      command.parseCmd(currentProfile,'config',['get','databases']).then(function (data){
       var dbCount = parseInt(data.res[1]);
       var  dbs="";
       for(var i=0;i<dbCount;i++){
        dbs=dbs+i+"<br>"
       }
       output(dbs);
      });
    
    }
   }
  }
  function findConsNames(){
    var consName=[];
    var config = s.Store().get("config");
    if(config!=null){
      for(var i=0;i<config.length;i++){
        consName.push(config[i].profile);
      }
    }
    
    return consName;
  }
  function setTabTitle(title){
    var tab = $('#tabs').tabs('getSelected');  // get selected panel
    tab.panel('setTitle','title');
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
       const cluserOptionTest={
        clusterRetryStrategy:function(times) {
            return "no";
          }  
       };
       const clusterTest=new Redis.Cluster(useCon,cluserOptionTest);
       clusterTest.get("custom:key:test", function (err, res) {
        if(err ==null){
          clusterTest.disconnect();
          const cluster=new Redis.Cluster(useCon,cluserOption);
          var instance = {};
          instance.redis = cluster;
          instance.isCluster = true;
          redisCommand.RedisCommand().init(profile,instance);
          $('#searching'+currentTab).html(profile+" connect successfully!");
          $('#input-line'+currentTab+' .prompt').html(profile+'>');
          $('#searching'+currentTab).removeAttr("id");

          //setTabTitle(profile);
          $('#south .tabs-selected .tabs-title').html(profile);
          currentProfile = profile;
          redisCommand.RedisCommand().resetSlotMap();

        }else{
         output(err);
        }
     });
    }else if(useCon!=null && !Array.isArray(useCon)){
      var con = {
        port: useCon.port, // Redis port
        host: useCon.host, // Redis host
        password: useCon.password,
        db: db,
        retryStrategy: function(times) {
        return 'no';
        }
      }   
    var redisTest = new Redis(con);
    redisTest.get("custom:key:test", function (err, res) {
     if(err ==null){
      redisTest.disconnect();
      useCon.db = db;
      const redis = new Redis(useCon);
      var instance = {};
      instance.redis = redis;
      instance.isCluster = false;
      redisCommand.RedisCommand().init(profile+":"+db,instance);
      $('#searching'+currentTab).html(profile+":"+db+" connect successfully!");
      $('#input-line'+currentTab+' .prompt').html(profile+':'+useCon.db+'>');
      $('#searching'+currentTab).removeAttr("id");
      currentProfile = profile+":"+db;
      //setTabTitle(profile);
      $('#south .tabs-selected .tabs-title').html(profile);
     }else{
      output(err);
     }
     
  });
    }else{
      output('not exist connection:'+profile);
    }

  }
  function showCommands(){
    var commands="";
    for(var i=0;i<CMDS_DESC.length;i++){
      var j = i+1;
      commands=commands+j+") "+CMDS_DESC[i]+"<br>"
    }
    output(commands);
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
  function output(html,noNeedp) {
    $('#searching'+currentTab).remove();
    if(noNeedp){
      output_.insertAdjacentHTML('beforeEnd', html);
    }else{
      output_.insertAdjacentHTML('beforeEnd', '<p>' + html + '</p>');
    }
    
    //window.scrollTo(0, getDocHeight_());
    $("#container"+currentTab).scrollTop($("#container"+currentTab)[0].scrollHeight+32);
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
  function syntaxHighlight(json) {
    if (typeof json != 'string') {
        json = JSON.stringify(json, undefined, 2);
    }
    json = json.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
    var str = json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function(match) {
        var cls = 'number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'key';
            } else {
                cls = 'string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'boolean';
        } else if (/null/.test(match)) {
            cls = 'null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
    return '<pre>'+str+'</pre>';

}
  //
  return {
    init: function() {
      output('<img align="left" src="http://www.w3.org/html/logo/downloads/HTML5_Badge_128.png" width="100" height="100" style="padding: 0px 10px 20px 0px"><h2 style="letter-spacing: 4px">HTML5 Web Terminal</h2><p>' + new Date() + '</p><p>Enter "help" for more information.</p>');
    },
    output: output,
    setCurrentTab:function(currentTab){
      currentTab=currentTab;
    },
    syntaxHighlight:function(json){
      return syntaxHighlight(json);
    }
  }
};
module.exports={
  Terminal:Terminal
}