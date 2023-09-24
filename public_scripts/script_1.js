const urlprefix = subdomain_prefix
const shortenerUrl = shortener_url
// Dont forget to use the "urlprefix" while fetching, example :
// .src = `${urlprefix}/sprites/cloud`

//#region - PRELOAD FUNCTIONS - ( They need to be created before html elements who use them )
function toggleDarkMode(element) {
	if (element.checked) {
		document.body.classList.add('dark-mode');
	} else {
		document.body.classList.remove('dark-mode');
	}
}
//#endregion

window.addEventListener('load', async function () {

//#region - CLASSES
//#endregion

//#region - HTML-ELEMENTS
const modal = document.getElementById('modal');
const inviteLink = document.getElementById('inviteLink');
const copyButton = document.getElementById('copyButton');
const invitButton = document.getElementById('invitButton');
const sendButton = document.getElementById('sendButton');
//const clearButton = document.getElementById('clearButton');
const messageInput = document.getElementById('message');
const chatWindow = document.getElementById('chatWindow');
const textarea = document.querySelector('textarea');
//#endregion

//#region - VARIABLES
let userID = null;
let inviteKey = "";
let first_msg = true;
// new URLSearchParams(window.location.search).get('key')
if (window.location.search != "") {
	const params = new URLSearchParams(window.location.search);
	inviteKey = params.get('key');
	// remove key from url
	window.history.replaceState({}, document.title, window.location.pathname);
}
//#endregion

//#region - SIMPLE FUNCTIONS
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1) + min); }
function rndCharKey() {
	const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	return chars[rnd(0, chars.length - 1)];
}
function createKey(length) {
	let key = "";
	for (let i = 0; i < length; i++) { key += rndCharKey(); }
	return key;
}
async function shortenUrl(originalUrl, selfDestruct = 1) {
	const apiUrl = ;	
	const url = `${apiUrl}?o=${originalUrl}&s=${selfDestruct}`;

	console.log(`url: ${url}`);
	
	const response = await fetch(url);
	const data = await response.json();
	return data.shortUrl;
}
async function showInviteLink() {
	if (inviteKey == "") { inviteKey = createKey(42); }
	const url_ = String(window.location.href);
	console.log(`url_: ${url_}`);
	
	// SHORTEN THE INVITE LINK
	const shorten_url = await shortenUrl(`${url_}?key=${inviteKey}`, 1); // Get the shorten url - selfDestruct = 1 click
	console.log(`shorten_url: ${shorten_url}`);
	if (shorten_url == undefined) { return; };
	
	inviteLink.value = shorten_url;
	copyButton.innerHTML = "Copy";
	modal.style.display = "flex";
	setTimeout(() => { modal.style.opacity = 1 }, 100);

	// send inviteKey to server
	ws.send(JSON.stringify({ type: 'createConv', data: { convID: inviteKey } }));
}
function copyInviteLink() {
	inviteLink.select();
	inviteLink.setSelectionRange(0, 99999);
	navigator.clipboard.writeText(inviteLink.value);
	copyButton.innerHTML = "Copied !";
}
function sendMsg() {
	const message = messageInput.value;
	if (message == "") { return; }
	// console.log(`sendMsg: ${message}`);

	// Send message to server
	ws.send(JSON.stringify({ type: 'newMsg', data: { msg: message } }));

	messageInput.value = '';
}
function addInfoMessage(message) {
	const messageElement = document.createElement('p');
	messageElement.innerHTML = `Info : ${message}`
	chatWindow.appendChild(messageElement);
}
function addMessage(message, is_sender = false) {
	const msgWrap = document.createElement('div');
	msgWrap.classList.add('msg-wrap');
	if (is_sender) { msgWrap.classList.add('isSender'); }

	const messageElement = document.createElement('div');
	messageElement.classList.add('message');
	if (is_sender) { messageElement.classList.add('isSender'); }

	const messageText = document.createElement('p');
	messageText.innerHTML = message.replace(/\n/g, '<br>')

	messageElement.appendChild(messageText);
	msgWrap.appendChild(messageElement);
	chatWindow.appendChild(msgWrap);
	chatWindow.scrollTop = chatWindow.scrollHeight;
}
//#endregion

//#region - EVENT LISTENERS
document.getElementById("dark-mode-toggle").addEventListener('change', (event) => {
	// save dark-mode state
	localStorage.setItem('dark-mode', event.target.checked);
});
sendButton.addEventListener('click', function() {
	sendMsg();
});
let shiftKey_pressed = false;
messageInput.addEventListener('keydown', function(event) {
	if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
		shiftKey_pressed = true;
	}
	if (event.code === 'Enter' && !shiftKey_pressed) {
		event.preventDefault();
	}
});
messageInput.addEventListener('keyup', function(event) {
	if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
		shiftKey_pressed = false;
	}
	if (event.code === 'Enter' && !shiftKey_pressed) {
		event.preventDefault();
		sendMsg();
	}
});
modal.addEventListener('click', function(event) { // Close modal when clicking on the modal background
	if (event.target === modal) {
		modal.style.opacity = 0;
		// wait 0.2 sec
		setTimeout(() => { modal.style.display = "none"; }, 200);
	}
});
/*clearButton.addEventListener('click', function() {
	messageInput.value = '';
});*/
copyButton.addEventListener('click', function() {
	copyInviteLink();
});
invitButton.addEventListener('click', function() {
	showInviteLink();
});
textarea.addEventListener('input', () => {
	// Reset height to 0 so the scrollHeight can be measured correctly
	textarea.style.height = '0';
  
	// Set the height to match it's content
	textarea.style.height = `${textarea.scrollHeight}px`;
});
//#endregion

//#region - SET SETTINGS FROM LOCALSTORAGE
if (localStorage.getItem('dark-mode') === "false") {
	document.getElementById('dark-mode-toggle').checked = false;
	toggleDarkMode(document.getElementById('dark-mode-toggle'));
}
//#endregion ----------------------------------------------

//#region - WEBSOCKET
const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
let ws_url = protocol + window.location.host; if (urlprefix != "") { ws_url += '/' + urlprefix; }
const ws = new WebSocket(ws_url);

ws.onmessage = async (message) => {
	if (message.data == "pong") { return; }
    const data = JSON.parse(message.data);
	const d_ = data.data;
	if (d_ == undefined) { console.log(`${data.type} not contain proper "data: {}"`); return false; }

	switch (data.type) {
		case 'log_msg':
			console.log(d_);
			break;
		case 'startConv':
			chatWindow.innerHTML = "";
			addInfoMessage(d_);
			console.log(d_);
			break;
		case 'userID':
			userID = d_;
			console.log(`userID: ${userID}`);
			break;
		case 'newMsg':
			if (first_msg) { first_msg = false; chatWindow.innerHTML = ""; }
			addMessage(d_.msg, d_.userID == userID);
			break;
		default:
			break;
	}
};
ws.onopen = async () => {
	console.log('Socket opened');
	let last_msg_timestamp = new Date().getTime();

	// EXAMPLE OF SENDING DATA TO SERVER
	// ws.send(JSON.stringify({ type: 'log_msg', data: 'Hello from client' }));
	// IF inviteKey IS SET IN URL, SEND IT TO SERVER
	if (inviteKey != "") { ws.send(JSON.stringify({ type: 'joinConv', data: { convID: inviteKey } })); }
	
	// start ping loop
	while(true) {
		const current_timestamp = new Date().getTime()
		// if last_ws_msg is more than 27 sec old, send 'ping' to keep the connection alive
		if (last_msg_timestamp + 27000 < current_timestamp) {
			ws.send('ping');
			last_msg_timestamp = current_timestamp;
		}
		await new Promise(r => setTimeout(r, 1000));
	}
};
ws.onclose = async () => {
	console.log('Socket closed');
	// wait 1 sec
	await new Promise(r => setTimeout(r, 1000));
	// refresh webpage;
	location.reload();
};
//#endregion ----------------------------------------------

});
