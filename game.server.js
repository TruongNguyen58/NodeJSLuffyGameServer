/*  Copyright (c) 2013 TruongNGUYEN
    BH Licensed.
 */

var TYPE_INVITE = "invite";
var TYPE_PLAYER_NOT_AVAILABLE = "playerNotAvailable";
var TYPE_WELLCOME = "wellcome";
var TYPE_RECEIVE_CONFIRM = "receiveConfirm";
var TYPE_START_GAME = "startGame";
var TYPE_NEXT_ROUND = "nextRound";
var TYPE_PLAYER_ANSWER = "playerAnswer";
var TYPE_END_GAME = "endGame";
var TYPE_PLAYER_DISCONNECT = "playerDisconnect";
var TYPE_PLAYER_RECONNECTED = "playerReconnect";
var TYPE_ONLINE_PLAYERS = "onlinePlayers";
var TYPE_CONNECTED = "userJoined";
var intervalTime = 15;
var hasOwnProperty = Object.prototype.hasOwnProperty;

var recordIntervals = {};
var numberOfPlayerAnswer = {};
var clients = {};
var socketsOfClients = {};
var games = {};
var players = {};
var currentGameOfPlayer = {};

var game_server = module.exports, app_server = require('./app.js'), verbose = true;

game_server.setUser = function(sId, data) {
	console.log("begin set user");
	onUserConnect(sId, data);
	app_server.sendToClient(sId, TYPE_CONNECTED, {});
};

function onUserConnect(sId, playerData) {
	var playerName = playerData.userName;
	console.log("User: " + playerName + " connected with socketID: " + sId);
	// Does not exist ... so, proceed
	clients[playerName] = sId;
	if (players.hasOwnProperty(playerName)) {
		console.log("players.hasOwnProperty(" + playerName + ")");
		try {
			if (currentGameOfPlayer.hasOwnProperty(playerName)) {
				var gameId = currentGameOfPlayer[playerName];
				var data = {};
				data.player = playerName;
				endWhenPlayerQuitGame(gameId, "playerQuitGame", data);
			}
		} catch (err) {
		}
		delete players[playerName];
	}
	players[playerName] = {
		"status" : playerData.status,
		"socketId" : sId,
		"appName" : playerData.appName
	};
	console.log("Current player: " + JSON.stringify(players[playerName]));
	Object.keys(socketsOfClients).forEach(
			function(oldSocketId) {
				console.log("Key: " + oldSocketId + " Value: "
						+ socketsOfClients[oldSocketId] + " PlayerName: "
						+ playerName);
				if (socketsOfClients[oldSocketId] == playerName) {
					delete socketsOfClients[oldSocketId];
				}
			});

	socketsOfClients[sId] = playerName;
	console.log("clients: " + JSON.stringify(clients));
	console.log("socketsOfClients: " + JSON.stringify(socketsOfClients));
}

game_server.onUserDisconnect = function(sId) {

	try {
		if (socketsOfClients.hasOwnProperty(sId)) {
			console
					.log("Player: " + socketsOfClients[sId]
							+ " Disconnect game");
			console.log("currentGameOfPlayer: "
					+ JSON.stringify(currentGameOfPlayer));
			if (currentGameOfPlayer.hasOwnProperty(socketsOfClients[sId])) {
				var gameId = currentGameOfPlayer[socketsOfClients[sId]];
				var data = {};
				data.player = socketsOfClients[sId];
				endWhenPlayerQuitGame(gameId, "playerQuitGame", data);
			}
			delete players[socketsOfClients[sId]];
			delete clients[socketsOfClients[sId]];
			delete socketsOfClients[sId];
		}
	} catch (err) {
		console.log("ERORR onUserDisconnect: " + JSON.stringify(err));
	}
};

game_server.onUserQuitGame = function(sId) {
	console.log("Player: " + clients[socketsOfClients[sId]] + " Quit game");
	try {
		if (socketsOfClients.hasOwnProperty(sId)) {
			if (currentGameOfPlayer.hasOwnProperty(socketsOfClients[sId])) {
				var gameId = currentGameOfPlayer[socketsOfClients[sId]];
				var data = {};
				data.player = socketsOfClients[sId];
				endWhenPlayerQuitGame(gameId, "playerQuitGame", data);
			}
		}
	} catch (err) {
		console.log("ERORR onUserQuitGame: " + JSON.stringify(err));
	}
};

game_server.getAvailablePlayers = function(sId, clientData) {
	setTimeout(function() {
		try {
			var availableUsers = new Array();
			console.log("online users: " + JSON.stringify(players));
			Object.keys(players).forEach(
					function(userName) {
						if (players[userName].appName == clientData.appName
								&& players[userName].status == 1)
							availableUsers.push(userName);
					});
			console.log('Sending availableUsers to ' + sId);

			var dataToSend = {
				"notice" : TYPE_ONLINE_PLAYERS,
				"data" : {
					"availablePlayers" : availableUsers
				}
			};
			app_server.sendMsgToClient(sId, dataToSend);

		} catch (err) {
			console.log("Error when delete data to endGame: "
					+ JSON.stringify(err));
		}

	}, 1 * 1000);

}; //game_server.getAvailablePlayers

game_server.findGame = function(obj) {
	var dataToSend = {};
	console.log('looking for a game for user: ' + obj.sender);
	for ( var playerName in players) {
		console.log(playerName);
			if (playerName != obj.sender && players[playerName].status == 1) {
				dataToSend.notice = TYPE_INVITE;
				dataToSend.data = obj;
				console.log('found user: ' + JSON.stringify(playerName));
				app_server.sendMsgToClient(clients[playerName], dataToSend);
				break;
			}
	}
}; //game_server.findGame

game_server.inviteToGame = function(sId, obj) {
	var dataToSend = {};
	console.log('looking for a game for user: ' + obj.data.sender);
	obj.data.friends.forEach(function(playerId) {
		if (players[playerId].status == 1) {
			dataToSend.notice = TYPE_INVITE;
			dataToSend.data = obj.data;
			console.log('send invite to user: ' + JSON.stringify(playerId));
			app_server.sendMsgToClient(clients[playerId], dataToSend);
		} else {
			dataToSend.notice = TYPE_PLAYER_NOT_AVAILABLE;
			dataToSend.data = {
				"friends" : playerId
			};
			app_server.sendMsgToClient(sId, dataToSend);
		}

	});

}; //game_server.inviteToGame

game_server.confirmJoinGame = function(obj) {
	console.log("Available user: " + JSON.stringify(clients));
	var dataToSend = {};
	console.log('send confirm to sender: ' + obj.sender);
	dataToSend.notice = "receiveConfirm";
	dataToSend.data = obj;
	app_server.sendMsgToClient(clients[obj.sender], dataToSend);
}; //game_server.confirmJoinGame

game_server.startGame = function(_id, obj) {
	// if(!games.hasOwnProperty(_id)){
	var gameToSave = JSON.parse(obj.game);
	var dataToSend = {};
	console.log("Game before save: " + JSON.stringify(gameToSave));
	games[_id] = gameToSave;
	gameToSave.gameId = _id;
	obj.game = gameToSave;
	dataToSend.notice = "startGame";
	dataToSend.data = obj;
	try {
		gameToSave.playerIds.forEach(function(playerId) {
			players[playerId].status = 2;
			currentGameOfPlayer[playerId] = _id;
			app_server.sendMsgToClient(clients[playerId], dataToSend);
		});
	} catch (err) {
		console.log("Err 1: " + JSON.stringify(err));
	}

	numberOfPlayerAnswer[_id] = 0;
	games[_id].passedRound = {};
	if (recordIntervals.hasOwnProperty(_id)) {
		try {
			clearTimeout(recordIntervals[_id]);
			delete recordIntervals[_id];
		} catch (err) {
			console.log("Err 2: " + JSON.stringify(err));
		}
	}
	games[_id].playerIds.forEach(function(playerId) {
		var s = {};
		s[playerId] = 0;
		games[_id].scores.push(s);
	});
	console.log("game saved with: " + JSON.stringify(games[_id]));
	setTimeout(function() {
		recordIntervals[_id] = startIntervalTimer(_id, intervalTime);
	}, 3 * 1000);
	//}
}; //game_server.confirmJoinGame

game_server.onPlayerAnswer = function(obj) {
	var _id = obj.gameId;
	var round = obj.round;
	console.log("games[_id].currRound  = " + games[_id].currRound  + " --- Player answer round: " + round);
	if (games.hasOwnProperty(_id) && (games[_id].currRound == round)) {
		//var dataToSend = {};
		numberOfPlayerAnswer[_id] = numberOfPlayerAnswer[_id] + 1;
		console.log(_id + " --- " + obj.questionId + " ----- " + obj.result
				+ " \\\\\ " + JSON.stringify(numberOfPlayerAnswer));
		console.log("Found game: " + JSON.stringify(games[_id]));
		if (games[_id].passedRound[round] != true) // undefined or false
			games[_id].passedRound[round] = false;
		try {
			for ( var i = 0; i < games[_id].scores.length; i++) {
				var playerScore = games[_id].scores[i];
				if (playerScore.hasOwnProperty(obj.playerAnswer)) {
					if (obj.result == 'true')
						playerScore[obj.playerAnswer] = playerScore[obj.playerAnswer] + 1;
					else
						playerScore[obj.playerAnswer] = playerScore[obj.playerAnswer] - 1;
				}
			}
			games[_id].playerIds.forEach(function(playerId) {
				if (playerId != obj.playerAnswer) {
					var dataToSend = {};
					dataToSend.notice = obj.type;
					dataToSend.data = obj;
					sendMessageToAPlayer(playerId, dataToSend);
				}
			});
			if (games[_id].passedRound[round] == false
					&& (obj.result == 'true' || numberOfPlayerAnswer[_id] >= games[_id].playerIds.length)) {
				clearTimeout(recordIntervals[_id]);
				games[_id].passedRound[round] = true;
				//gameRounds[_id] = gameRounds[_id] - 1;
				games[_id].currRound = games[_id].currRound + 1;
				numberOfPlayerAnswer[_id] = 0;
				//console.log("Game round remain: " + gameRounds[_id]);
				if (games[_id].currRound < games[_id].roundNum) {
					console.log("Request next round");
					sendRequestNextRoundToAll(games[_id]);

					if (recordIntervals.hasOwnProperty(_id)) {
						delete recordIntervals[_id];
					}
					recordIntervals[_id] = startIntervalTimer(_id, intervalTime);
				} else {
					endgame(_id);
				}
			}
		} catch (err) {
			console.log("Error when process player answer: "
					+ JSON.stringify(err));
		}
	} else {
	}
}; //game_server.onPlayerAnswer

game_server.onReceiveRqEndGame = function(obj) {
	console.log(msg);
	var _id = obj.gameId;
	console.log("Game with id: " + _id + " receive request to end!");
	console.log("Current Games: " + JSON.stringify(games));
	if (games.hasOwnProperty(_id)) {
		clearTimeout(recordIntervals[_id]);
		endgame(_id);
	}
}; //game_server.onPlayerAnswer

function is_empty(obj) {
	// null and undefined are empty
	if (obj == null)
		return true;
	// Assume if it has a length property with a non-zero value
	// that that property is correct.
	if (obj.length && obj.length > 0)
		return false;
	if (obj.length === 0)
		return true;
	for ( var key in obj) {
		if (hasOwnProperty.call(obj, key))
			return false;
	}

	return true;
}

function startIntervalTimer(_id, timerInterval) {
	if (games.hasOwnProperty(_id)) {
		var start_time = new Date();
		var count = 1;
		var interval = setTimeout(function() {
			try {
				games[_id].currRound = games[_id].currRound + 1;
				if (games[_id].currRound < games[_id].roundNum) {
					var end_time = new Date();
					var dif = end_time.getTime() - start_time.getTime();
					console.log("Tick no. " + count + " after "
							+ Math.round(dif / 1000) + " seconds");
					sendRequestNextRoundToAll(games[_id]);
					count++;
					delete recordIntervals[_id];
					recordIntervals[_id] = startIntervalTimer(_id,
							timerInterval);
				} else {
					clearTimeout(this);
					endgame(_id);
				}
			} catch (err) {
			}
		}, timerInterval * 1000);
		return interval;
	}
}

function endWhenPlayerQuitGame(_id, notice, data) {
	clearTimeout(recordIntervals[_id]);
	if (games.hasOwnProperty(_id)) {
		console.log("End game! zzzzzzzzzzzzzzzzz: "
				+ JSON.stringify(games[_id]));
		var dataToSend = {};
		dataToSend.notice = notice;
		data.scores = games[_id].scores;
		dataToSend.data = data;
		sendMessageToAll(games[_id], dataToSend);
		try {
			delete recordIntervals[_id];
			delete numberOfPlayerAnswer[_id];
			//delete gameRounds[_id];
			console.log(JSON.stringify(games));
			games[_id].playerIds.forEach(function(playerId) {
				players[playerId].status = 1;
				if (currentGameOfPlayer.hasOwnProperty(playerId)) {
					delete currentGameOfPlayer[playerId];
				}
			});
			delete games[_id];
		} catch (err) {
			console.log("Error when delete data to endGame: "
					+ JSON.stringify(err));
		}
	}
}

function endgame(_id) {
	if (games.hasOwnProperty(_id)) {
		console.log("End game! zzzzzzzzzzzzzzzzz: "
				+ JSON.stringify(games[_id]));
		var dataToSend = {};
		dataToSend.notice = "endGame";
		dataToSend.data = {
			"scores" : games[_id].scores
		};
		sendMessageToAll(games[_id], dataToSend);
		setTimeout(function() {
			try {
				delete recordIntervals[_id];
				delete numberOfPlayerAnswer[_id];
				console.log(JSON.stringify(games));
				games[_id].playerIds.forEach(function(playerId) {
					if (currentGameOfPlayer.hasOwnProperty(playerId)) {
						delete currentGameOfPlayer[playerId];
					}
					if (players[playerId].status == 2)
						players[playerId].status = 1;
				});
				delete games[_id];
			} catch (err) {
				console.log("Error when delete data to endGame: "
						+ JSON.stringify(err));
			}
		}, 3 * 1000);
	}
}

function sendRequestNextRoundToAll(game) {
	console.log("sendRequestNextRoundToAll");
	if (typeof game != undefined) {
		var dataToSend = {};
		dataToSend.notice = "nextRound";
		dataToSend.data = {
			"round" : game.currRound,
			"scores" : game.scores
		};
		sendMessageToAll(game, dataToSend);
		console.log("game saved: " + JSON.stringify(game));
	}
}

function sendMessageToAll(game, msg) {
	if (typeof game != undefined) {
		try {
			game.playerIds.forEach(function(playerId) {
				sendMessageToAPlayer(playerId, msg);
			});
		} catch (err) {
			console.log("Error when send msg to all");
		}
	}
}

function sendMessageToAPlayer(playerId, msg) {
	try {
		app_server.sendMsgToClient(clients[playerId], msg);
	} catch (err) {
		console.log("Error when sendMessageToAPlayer " + JSON.stringify(err));
	}
}