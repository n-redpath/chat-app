// Require the packages we will use:
var http = require("http"),
	socketio = require("socket.io"),
	fs = require("fs"),
	emoji = require('node-emoji');

// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html:
var app = http.createServer(function(req, resp){
	// This callback runs when a new connection is made to our HTTP server.
	
	fs.readFile("client.html", function(err, data){
		// This callback runs when the client.html file has been read from the filesystem.
		
		if(err) return resp.writeHead(500);
		resp.writeHead(200);
		resp.end(data);
	});

});
app.listen(3456);
let rooms = {};
let users = {};
let userIds = {}; 

// Do the Socket.IO magic:
var io = socketio.listen(app);
io.sockets.on("connection", function(socket){
	socket.join('id');
	// This callback runs when a new Socket.IO connection is established.	
	socket.on('message_to_server', function(data) {
		// This callback runs when the server receives a new message from the client.
		console.log("user: " + data["sendingUser"] + " message: "+data["message"] + " room name: "+ data["room"].name); // log it to the Node.JS output
		let sendToRoom = 'id';  
		if (data['room'].name !=""){
			sendToRoom= data['room'].name; 
		}		
			io.sockets.emit("message_to_client",{message:data["message"], user:data["sendingUser"], roomName:data['room'].name});

	});

	//make a new user for the session
	socket.on('new_user', function(data){
		console.log(users);
		//get the user from the client
		socketio.user = data["user"]; 
		console.log("new user: "+ data["user"]); 
		//add the user and their ID to our arrays
		users[data['user'].name] = data['user'].inRoom; 
		userIds[data['user'].name] = socket.id; 
		console.log(userIds); 
	 });

	//make a new chat room
	 socket.on('create_new_room', function(data){
		console.log("new room created, name: "+ data["name"] + "creator : " + data["creator"].name);	
		//each room is a dictionary
		let new_room = {}; 
		//fill in the necessary information
		new_room.name= data["name"];
		new_room.creator=data["creator"];
		new_room.password=data["password"];
		new_room.roomUsers = []; 
		new_room.bannedUsers = []; 
		console.log(new_room); 
		//add the new room to the room list
		rooms[new_room.name] = new_room;
		console.log("rooms: " + rooms);
		//send the new room to the client
		io.sockets.emit("send_new_room", {newRoom: new_room}); 
	 }); 

	 //when a user joins a room
	 socket.on('add_room_user', function(data){
		//the room the client will see
		let roomToShow = data["roomName"]; 
		//joining the room
		socket.join(roomToShow); 
		//put the user into the array of users for that particular room
		rooms[roomToShow].roomUsers.push(data["user"].name);
//confused about this line
		users[data['user'].name] = roomToShow; 
		//send the information to the client
		io.sockets.emit('send_room_users', {roomName: roomToShow, roomUsers: rooms[roomToShow].roomUsers, addUser: data['user'].name});
	 });

	 //transfer the admin of the room
	 socket.on("transfer_admin", function(data){
		//get the new admin from the client
		let newAdmin = data['newAdmin']; 
		//figure out which room this is in
		let room = data['room']; 
		//set the creator of that room to the new admin
		rooms[room.name].creator = newAdmin; 
		//emit the new admin back to the client
		io.sockets.emit('send_new_admin', {room: rooms[room.name]}); 
	 }); 

	 //leaving the room
	 socket.on('send_leave_room', function(data){
		 //iterate through the room users to take out the user trying to leave
 		for (let k=0; k<rooms[data['room']].roomUsers.length; k++){
			if (rooms[data['room']].roomUsers[k]==data['userLeaving']){
			   rooms[data['room']].roomUsers.splice(k,1);
		 }
		}
		console.log(rooms[data['room']].roomUsers);
		//this is here so that we can use this functionality when a user is kicked out
		io.to(userIds[data['userLeaving']]).emit('you_are_kicked_out', 'for your eyes only');
		//the user has been removed from the room array, send the new info back to the client
		io.sockets.emit('left_room', {roomUsersArray: rooms[data['room']].roomUsers, userLeaving: data['userLeaving']})
	 }); 

	 //banning the user
	 socket.on('ban_user', function(data){
		//add to ban array
		room = data['room']; 
		rooms[room].bannedUsers.push(data['bannedUser']); 
		//send the banned user information back to the client
		
		//add socket.leave. 
	
		//also remove from roomUsers. 
		//io.to a room name will just send to that room. 
		console.log("about to ban " + data['bannedUser']); 
		console.log(rooms[room].roomUsers); 
		for (let k=0; k<rooms[room].roomUsers.length; k++){
			if (rooms[room].roomUsers[k] == data['bannedUser']){
				// console.log("found in a room")
				rooms[room].roomUsers.splice(k,1);
				// console.log("new room users: " + rooms[room].roomUsers); 

				// io.to(userIds[data['bannedUser']]).emit("you_were_banned", {bannedArray: rooms[room].bannedUsers, room:room, roomUsers:rooms[room].roomUser})
			}
		}
		io.sockets.emit("user_banned", {bannedArray: rooms[room].bannedUsers, room:room, roomUsers:rooms[room].roomUsers}); 


	 }); 

	 //sending a private message
	 socket.on('send_private_message', function(data){
		 /// get socket ids of the two users involved
		 let recipientId = userIds[data['recipient']];
		 let senderId = userIds[data['sender']]; 
		 
		// emit message
		console.log("MESSAGE: " + data['message'] + "sender id = " + senderId); 
		io.to(recipientId).emit('receive_private_message', {recipient:data['recipient'], sender:data['sender'], message: data['message'], room:data['room']})
		io.to(senderId).emit('receive_private_message', {recipient:data['recipient'], sender:data['sender'], message: data['message'], room:data['room']})
	 }); 

	 //showing the room options upon login
	 socket.on('show_all_rooms', function(data){
		 console.log("getting rooms for "+ data['userLoggingIn']); 
		//getting the socket id of the user logging in
		 let getId = userIds[data['userLoggingIn']]; 
		//showing that user the rooms
		 io.to(getId).emit('showing_rooms', {rooms: rooms, user:data['userLoggingIn']}); 
	 }); 

	 //when a user disconnects
	 socket.on('disconnect', ()=>{
		 console.log("DISCONNECTED"); 
		let id = socket.id;
		let name = ""; 
		// console.log(rooms);  
		for(var key in userIds) {
			if(userIds[key] === id) {
				name = key; 
				console.log(" disconnecting user "+  name);
				console.log(" id : "+ id); 
				//emit name back to client
				delete userIds[key];
				delete users[key]; 
				console.log(userIds); 
			}
		}
		//emit the users and update dom. 
		//loop through every room and delete from room users. then call send room users for every room. 
		for (var key in rooms){
			// console.log("room search" + rooms[key]);
			for (let k=0; k<rooms[key].roomUsers.length; k++){
				if (rooms[key].roomUsers[k] == name){
					// console.log("found in a room")
					rooms[key].roomUsers.splice(k,1);
					// console.log(rooms[key].roomUsers); 
					socket.emit("user_disconnected", {roomName: rooms[key].name, roomUsers:rooms[key].roomUsers}); 

				}
			}
		}
		// socket.emit(); 

	 });
	 

	 socket.on("unban_user", function(data){
		 let unbanned = data['userToUnban']; 
		 let room = data['room']; 

		 for (let b=0; b<rooms[room].bannedUsers.length; b++){
			if (unbanned == rooms[room].bannedUsers[b]){
				console.log("BANNED USERS DELETING: "+ rooms[room].bannedUsers[b]); 

				rooms[room].bannedUsers.splice(b,1); 
			}
		 }
		 console.log("banned users1: " +rooms[room].bannedUsers); 
		 socket.to(userIds[unbanned]).emit("you_were_unbanned", {userUnbanned:unbanned, bannedUsers: rooms[room].bannedUsers})
		 socket.emit("user_unbanned", {userUnbanned:unbanned, bannedUsers: rooms[room].bannedUsers})
	 }); 
	 
});//node static file server. -- but i just need to download it to 

//use screen??


///if you go to the server side and do a socket.on (disconnect. 
// that is automatically triggered when a client refreshes
//since you can telll which socket just disconnect. 
//socket.id == the one that disconnet. 
//then send to the client side something that refreshes that list. 