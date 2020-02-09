const electronStore = require('electron-store');
const store = new electronStore();
var Store = Store || function() {
  return {
    get: function(k) {
      return store.get(k);
    },
    set:function(k,v){
      store.set(k,v);
    },
    del:function(k,v){
      store.delete(k);
    }
  }
};
module.exports={
  Store:Store
}