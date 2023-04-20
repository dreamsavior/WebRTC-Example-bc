console.log("Starting Broadcast Channel");

var BC = function(channelName="DEFAULT") {
    this.channelName = channelName;
    this.bc = new window.BroadcastChannel(channelName);

    this.bc.onmessage = (evt) => {
        if (typeof this.onmessage == "function") this.onmessage.call(this, evt);
    }

    this.send = function(msg) {
        this.bc.postMessage(msg);
    }
};