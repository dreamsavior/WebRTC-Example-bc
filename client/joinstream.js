var BC = function(channelName="DEFAULT") {
  this.channelName = channelName;
  this.bc = new window.BroadcastChannel(channelName);

  this.bc.onmessage = (evt) => {
    console.log("Receiging message", evt);
    if (typeof this.onmessage == "function") this.onmessage.call(this, evt);
  }

  this.send = function(msg) {
      this.bc.postMessage(msg);
  }
};

var StreamServer = function(options) {
  var that = this;
  this.options = options || {}
  this.isClient = this.options.isClient;
  this.localStream = this.options.localStream;
  this.localVideo = this.options.localVideo;
  this.remoteVideo = this.options.remoteVideo;

  var peerConnection;
  var uuid;
  var serverConnection;

  var peerConnectionConfig = {
    'iceServers': [
      {'urls': 'stun:stun.stunprotocol.org:3478'},
      {'urls': 'stun:stun.l.google.com:19302'},
    ]
  };

  var createDummyStream = async function() {
    var canvas = document.createElement("canvas");
    canvas.getContext("2d");
    return canvas.captureStream(1);
  }

  this.init = async function() {
    if (that.isClient) console.log("Starting server as client");
    uuid = createUUID();

    this.localVideo = this.localVideo||document.getElementById('localVideo');
    this.remoteVideo = this.remoteVideo||document.getElementById('remoteVideo');

    serverConnection = new BC();
    serverConnection.onmessage = gotMessageFromServer;

    var constraints = {
      video: true,
      audio: false,
    };

    if (that.isClient) {
      this.localStream = await createDummyStream();
    } else {
      if(navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia(constraints).then(getUserMediaSuccess).catch(errorHandler);
      } else {
        alert('Your browser does not support getUserMedia API');
      }
    }

  }

  function getUserMediaSuccess(stream) {
    that.localStream = stream;
    that.localVideo.srcObject = stream;
  }

  var start = function(isCaller) {
    console.log("Starting call as caller:", isCaller);
    console.log("Stream is", that.localStream);
    that.isCaller = isCaller;
    peerConnection = new RTCPeerConnection(peerConnectionConfig);
    peerConnection.onicecandidate = gotIceCandidate;
    peerConnection.ontrack = gotRemoteStream;
    peerConnection.addStream(that.localStream);

    if(isCaller) {
      peerConnection.createOffer().then(createdDescription).catch(errorHandler);
    }
  }
  this.start = start;

  function gotMessageFromServer(message) {
    if(!peerConnection) start(false);

    var signal = JSON.parse(message.data);

    // Ignore messages from ourself
    if(signal.uuid == uuid) return;


    if(signal.sdp) {
      peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(function() {
        // Only create answers in response to offers
        if(signal.sdp.type == 'offer') {
          peerConnection.createAnswer().then(createdDescription).catch(errorHandler);
        }
      }).catch(errorHandler);
    } else if(signal.ice) {
      peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(errorHandler);
    }
  }

  function gotIceCandidate(event) {
    if(event.candidate != null) {
      serverConnection.send(JSON.stringify({'ice': event.candidate, 'uuid': uuid}));
    }
  }

  function createdDescription(description) {
    console.log('got description', description);

    peerConnection.setLocalDescription(description).then(function() {
      console.log("Sending local description");
      serverConnection.send(JSON.stringify({'sdp': peerConnection.localDescription, 'uuid': uuid}));
    }).catch(errorHandler);
  }

  function gotRemoteStream(event) {
    console.log('got remote stream');
    that.remoteVideo.srcObject = event.streams[0];
  }

  function errorHandler(error) {
    console.error(error);
  }

  // Taken from http://stackoverflow.com/a/105074/515584
  // Strictly speaking, it's not a real UUID, but it gets the job done here
  function createUUID() {
    function s4() {
      return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }

    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
  }

  
  this.init();
}

function pageReady() {
  var loc = new URLSearchParams(window.location.search);

  window.streamServer = new StreamServer({
    isClient:loc.get("client")
  });
}