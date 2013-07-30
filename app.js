/*  
 * Copyright (c) 2013 TruongNGUYEN
 BH Licensed.
 */

var socketio = require('socket.io'), https = require('https'),fs = require('fs'), app_server = module.exports, game_server = require('./game.server.js'), path = require('path');

var app = https.createServer(options, handler)
  , io = require('socket.io').listen(app);

 app.listen(3300);

function handler (req, res) {
      res.writeHead(200);
    res.end("welcome to node\n");
}

var options = {
  key: fs.readFileSync('privatekey.pem', 'utf8'),
  cert: fs.readFileSync('certificate.pem', 'utf8')
  // ca: fs.readFileSync('certrequest.csr', 'utf8')
}

var allowCrossDomain = function(req, res, next) {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
	res.header('Access-Control-Allow-Headers',
			'Content-Type, Authorization, Content-Length, X-Requested-With');

	// intercept OPTIONS method
	if ('OPTIONS' == req.method) {
		res.send(200);
	} else {
		next();
	}
};

app.configure(function() {
	app.use(allowCrossDomain);
	app.set('port', process.env.PORT || 3000);
});

// app.configure('development', function() {
// 	app.use(express.errorHandler());
// });

// app.get('/ping', function(req, res) {
// 	res.send('pong');
// });

// var server = https.createServer(options, app)
// 	server.listen(app.get('port'), function () {
//   	console.log('secure server listening on port: ' + app.get('port'))
// })

// var server = app.listen(app.get('port'), function() {
// 	console.log("Express server listening on port " + app.get('port'));
// });
var io = socketio.listen(server, {
	origins : '*:*'
});
io.set('origins', '*:*');

io.configure('development', function() {
	io.set('transports', [ 'xhr-polling' ]);
	io.set("polling duration", 15);
	io.set('close timeout', 15); // 24h time out
});

io.sockets.on('connection', function(socket) {
	socket.on('setusername', function(data) {
		console.log("CLIENT:" + socket.id + " CONNECTED TO SERVER");
		game_server.setUser(socket.id, data);
	});

	socket.on('request', function(msg) {
		var obj = JSON.parse(msg);
		console.log("Object type: " + obj.type);
		try {
			if (obj.type == "findGame") {
				game_server.findGame(obj);
			} else if (obj.type == "confirmJoinGame") {
				game_server.confirmJoinGame(obj);
			} else if (obj.type == "startGame") {
				game_server.startGame(socket.id, obj);
			} else if (obj.type == "playerAnswer") {
				game_server.onPlayerAnswer(obj);
			} else if (obj.type == "onlinePlayers") {
				game_server.getAvailablePlayers(socket.id, obj);
			} else if (obj.type == "invite") {
				game_server.inviteToGame(socket.id, obj);
			} else if (obj.type == "requestEndGame") {
				game_server.onReceiveRqEndGame(obj);
			} else if (obj.type == "playerQuitGame") {
				game_server.onUserQuitGame(socket.id);
			} else if (obj.type == "playerLogOut") {
				socket.onDisconnect();
			}
		} catch (err) {
		}

	});
	socket.on('disconnect', function() {
		game_server.onUserDisconnect(socket.id);
	});
});

app_server.sendMsgToClient = function(sId, msg) {
	try {
		io.sockets.sockets[sId].emit('message', msg);
	} catch (err) {
		console.log("Error: " + JSON.stringify(err));
	}

};

app_server.sendToClient = function(sId, notice, msg) {
	try {
		io.sockets.sockets[sId].emit(notice, msg);
	} catch (err) {
		console.log("Error: " + JSON.stringify(err));
	}
};

var hasOwnProperty = Object.prototype.hasOwnProperty;