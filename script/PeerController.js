function PeerController(args) {
	if (!(this instanceof PeerController)) return new PeerController(args);
	EventEmitter.call(this);

	this.CHUNK_SIZE = args.CHUNK_SIZE;
	this.BLOCK_SIZE = args.BLOCK_SIZE;

	this.init();
}
inherits(PeerController, EventEmitter);

PeerController.prototype.init = function() {
	this.peer = null;
	this.connection = null;
	this.fileEntry = null;
	this.isSender = null;
	this.dataController = null;
};

PeerController.prototype.setPeer = function(peer) {
	this.peer = peer;
	// 최초의 Listening
	this.listen();

	this.peer.on("playRTC_phase1", function() {
		this.emit("message", "Connecting .    ", 4000);
	}.bind(this));
	this.peer.on("playRTC_phase2", function() {
		this.emit("message", "Connecting . .  ", 4000);
	}.bind(this));
	this.peer.on("playRTC_phase3", function() {
		this.emit("message", "Connecting . . .", 3000);
	}.bind(this));
};

// 송신자는 이 함수를 통해 connection을 얻는다.
PeerController.prototype.connect = function(opponent, file) {
	console.log(opponent.id +" 와 연결을 시도합니다.");

	this.fileEntry = file;

	this.isSender = true;
	this.connection = this.peer.connect(opponent.id);
	this.afterConnection();
	this.sendback();
};

// 수신자는 이 함수를 통해 connection을 얻는다.
PeerController.prototype.listen = function() {
	// 연결이 들어오기를 기다린다
	this.isSender = false;
	this.peer.removeAllListeners('connection');
	this.peer.on('connection', function(dataConnection) {
		this.connection = dataConnection;
		this.afterConnection();
		this.sendback();
	}.bind(this));
};

PeerController.prototype.sendback = function() {
	// 추가적인 연결이 들어오는 것을 막는다
	console.log("sendback");
	this.peer.removeAllListeners('connection');
	this.peer.on('connection', function(dataConnection) {
		dataConnection.on('open', this.sendRefusal.bind(this, dataConnection));
	}.bind(this));
};

PeerController.prototype.afterConnection = function() {
	if (!this.connection) {
		console.error("Connection is not valid");
		return;
	}

	this.setConnectionListener();
};

PeerController.prototype.setConnectionListener = function() {
	this.connection.on('open', this.setDataController.bind(this));
	this.connection.on('close', function(){
		var peerId = this.connection.peer;
		console.log(peerId + " 과 연결이 끊어졌습니다.");
		// dataController를 초기화하고
		this.dataController = null;
		// 연결이 끊어졌으니 새로운 연결을 기다림
		this.listen();
		this.emit('close');
	}.bind(this));
}

PeerController.prototype.setDataController = function() {
	if (this.isSender === null) {
		console.error("Role undefined");
	}
	console.log(this.isSender);
	if (this.isSender) {
		// 내가 송신자라면
		this.dataController = new SendController({
			conn: this.connection, 
			chunkSize: this.CHUNK_SIZE,
			blockSize: this.BLOCK_SIZE
		});
	} else {
		// 내가 수신자라면
		this.dataController = new SaveController({
			conn: this.connection
		});
	}
	this.setEventRepeater();

	if (this.isSender) {
		this.dataController.sendFile(this.fileEntry);
	}
};

PeerController.prototype.setEventRepeater = function() {
	// 하부 컨트롤러에서 올라오는 이벤트를 내가 다시 한 번 실행한다.
	// this.repeat('event name', from where)
	this.repeat('error', this.peer);
	this.repeat('fileSendPrepared', this.dataController);
	this.repeat('fileSavePrepared', this.dataController);
	this.repeat('opponentRefused', this.dataController);
	this.repeat('showProgress', this.dataController);
	this.repeat('updateProgress', this.dataController);
	this.repeat('message', this.dataController);
};

PeerController.prototype.sendRefusal = function(conn) {
	// WARN: 이 코드 좀 위험
	conn = conn || this.connection;
	console.log("거절 메시지 전송 : "+conn.peer)
	conn.send({
		"kind": "refusal"
	});
};
