const urlprefix = subdomain_prefix
// Dont forget to use the "urlprefix" while fetching, example :
// .src = `${urlprefix}/sprites/cloud`

//#region - CLASSES
/**
 * @class cryptoKeys
 * @property {CryptoKeyPair} keyPair
 * @property {Uint8Array} pubKey
 * @property {Uint8Array} privKey
 */
class cryptoKeys {
	constructor(keyPair, pubKey, privKey) {
		this.keyPair = keyPair;
		this.pubKey = pubKey;
		this.privKey = privKey;
	}
}
//#endregion

//#region - VARIABLES
let cryptInitStep = 0;
let userKeys = null;
let friendPubKey = "";
let userID = null;
let inviteKey = "";
let shortUrl = "";
let countDownStarted = false;
let encrypted = '';
let decrypted = '';
let sentEncryptedMsg = {};
if (window.location.search != "") {
	const params = new URLSearchParams(window.location.search);
	inviteKey = params.get('key');
	// remove key from url
	window.history.replaceState({}, document.title, window.location.pathname);
}
const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
//#endregion

// THESES FUNCTIONS CAN BE CALLED FROM CHROME CONSOLE
//#region - PRELOAD FUNCTIONS - ( They need to be created before html elements who use them )
function toggleDarkMode(element) {
	if (element.checked) {
		document.body.classList.add('dark-mode');
	} else {
		document.body.classList.remove('dark-mode');
	}
}
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1) + min); }
function rndCharKey() { return chars[rnd(0, chars.length - 1)]; }
function createInviteKey(length = 42) {
	let key = "";
	for (let i = 0; i < length; i++) { key += rndCharKey(); }
	return key;
}
//#endregion
//#region - CRYPTOGRAPHIC FUNCTIONS
// Generate RSA key pair
async function generateRSAKeyPair() {
	const keyPair = await window.crypto.subtle.generateKey(
		{
			name: 'RSA-OAEP',
			modulusLength: 2048,
			publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
			hash: 'SHA-256',
		},
		true,
		['encrypt', 'decrypt']
	);
	return keyPair;
}
async function encryptMessage(string, publicKey) {
	const importedPublicKey = await window.crypto.subtle.importKey(
	  'spki',
	  publicKey,
	  {
		name: 'RSA-OAEP',
		hash: 'SHA-256',
	  },
	  false,
	  ['encrypt']
	);
	
	const encodedMessage = new TextEncoder().encode(string);
	const encryptedData = await window.crypto.subtle.encrypt(
	  {
		name: 'RSA-OAEP',
	  },
	  importedPublicKey,
	  encodedMessage
	);
	
	const encryptedMessage = new Uint8Array(encryptedData);
	return encryptedMessage;
}
async function decryptMessage(ArrayBuffer, privateKey) {
	const importedPrivateKey = await window.crypto.subtle.importKey(
	  'pkcs8',
	  privateKey,
	  {
		name: 'RSA-OAEP',
		hash: 'SHA-256',
	  },
	  false,
	  ['decrypt']
	);
	
	const decryptedData = await window.crypto.subtle.decrypt(
	  {
		name: 'RSA-OAEP',
	  },
	  importedPrivateKey,
	  ArrayBuffer
	);
	
	const decryptedMessage = new TextDecoder().decode(decryptedData);
	return decryptedMessage;
}
function arrayBufferToString(ArrayBuffer) {
	const uint8Array = new Uint8Array(ArrayBuffer)
	return uint8Array.toString();
}
function StringToArrayBuffer(string) {
	const array_ = string.split(',').map(Number);
	return new Uint8Array(array_).buffer;
}
async function encryptMessageToString(string, publicKey) {
	const MAX_PART_LENGTH = 190; // Longueur maximale d'une partie encryptée avec RSA-OAEP et une clé de 2048 bits
  
	const parts_str = [];
	let remainingString = string;
	
	// Encrypt the message in parts to avoid the 245 bytes limitation
	while (remainingString.length > 0) {
		const part = remainingString.slice(0, MAX_PART_LENGTH);
		// console.log(`part: ${part}`)
		const encryptedPart = await encryptMessage(part, publicKey);
		
		const uint8Array = new Uint8Array(encryptedPart)
		parts_str.push(uint8Array.toString());
		remainingString = remainingString.slice(MAX_PART_LENGTH);
	}

	// Join the encrypted parts into a single string separated by a "|"
	return parts_str.join('|');
}
async function decryptStringToString(string, privateKey) {
	// Split the encrypted string into parts
	const parts_str = string.split('|');

	// Decrypt each part and join them into a single string
	const decrypted_parts = [];
	for (const part_str of parts_str) {
		const part = part_str.split(',').map(Number);
		const arrayBuffer = new Uint8Array(part).buffer;
		const decryptedPart = await decryptMessage(arrayBuffer, privateKey);
		decrypted_parts.push(decryptedPart);
	}

	return decrypted_parts.join('');
}
// MOUARF
function compareArrayBuffers(buffer1, buffer2) {
	const view1 = new Uint8Array(buffer1);
	const view2 = new Uint8Array(buffer2);
	
	if (view1.length !== view2.length) {
	  return false;
	}
	
	for (let i = 0; i < view1.length; i++) {
	  if (view1[i] !== view2[i]) {
		return false;
	  }
	}
	
	return true;
}
//#endregion

// THESES FUNCTIONS CANNOT BE CALLED FROM CHROME CONSOLE
window.addEventListener('load', async function () {
// GENERATE RSA KEY PAIR
userKeys = new cryptoKeys( await generateRSAKeyPair() );
userKeys.pubKey = await window.crypto.subtle.exportKey('spki', userKeys.keyPair.publicKey);
userKeys.privKey = await window.crypto.subtle.exportKey('pkcs8', userKeys.keyPair.privateKey);
// console.log(publicKeyToAlphanumeric(userKeys.pubKey))
//#region - HTML-ELEMENTS
const modal = document.getElementById('modal');
const remaining_time_value = document.getElementById('remaining-time-value');
const inviteLink = document.getElementById('inviteLink');
const copyButton = document.getElementById('copyButton');
const invitButton = document.getElementById('invitButton');
const sendButton = document.getElementById('sendButton');
//const clearButton = document.getElementById('clearButton');
const messageInput = document.getElementById('message');
const chatWindow = document.getElementById('chatWindow');
const textarea = document.querySelector('textarea');
//#endregion

//#region - HTML RELATED FUNCTIONS
function showInviteLink(link = 'toto') {
	inviteLink.value = link;
	copyButton.innerText = "Copy";
	modal.style.display = "flex";
	setTimeout(() => { modal.style.opacity = 1 }, 100);
}
function copyInviteLink() {
	inviteLink.select();
	inviteLink.setSelectionRange(0, 99999);
	navigator.clipboard.writeText(inviteLink.value);
	copyButton.innerText = "Copied !";
}
async function sendMsg() {
	const message = messageInput.value;
	if (message == "") { return; }
	const encrypted_msg = await encryptMessageToString(message, friendPubKey);
	sentEncryptedMsg[encrypted_msg] = message;

	// Send message to server
	ws.send(JSON.stringify({ type: 'newMsg', data: { msg: encrypted_msg } }));

	messageInput.value = '';
}
function addInfoMessage(message) {
	const messageElement = document.createElement('p');
	messageElement.innerText = `Info : ${message}`
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
	messageText.innerText = message.replace(/\n/g, '<br>')

	messageElement.appendChild(messageText);
	msgWrap.appendChild(messageElement);
	chatWindow.appendChild(msgWrap);
	chatWindow.scrollTop = chatWindow.scrollHeight;
}
async function countDown(from_s) {
	if (from_s == undefined) { return; }
	countDownStarted = true;
	// Set the remaining time clock to the remaining time formated as : 00:00
	let remaining_s = from_s;
	while (remaining_s > 0) {
		remaining_time_value.innerText = `${Math.floor(remaining_s / 60)}:${remaining_s % 60 < 10 ? '0' + remaining_s % 60 : remaining_s % 60}`;
		remaining_s--;
		await new Promise(r => setTimeout(r, 1000));
	}
	remaining_time_value.innerText = `00:00`;
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
	if (inviteKey == "") {
		inviteKey = createInviteKey();
		// send inviteKey to server
		ws.send(JSON.stringify({ type: 'createConv', data: { convID: inviteKey } }));
	} else {
		// show invite link
		showInviteLink(shortUrl);
	}
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
	//try{
	if (message.data == "pong") { return; }
    const data = JSON.parse(message.data);
	const d_ = data.data;
	if (d_ == undefined) { console.log(`${data.type} not contain proper "data: {}"`); return false; }

	switch (data.type) {
		case 'log_msg':
			console.log(d_);
			break;
		case 'createConv':
			userID = d_.userID;
			console.log(`userID: ${userID}`);
			shortUrl = d_.shortUrl;
			console.log(`shortUrl: ${shortUrl}`);
			showInviteLink(shortUrl);
			if (!countDownStarted) { countDown(d_.remainingS); }
			break;
		case 'userID':
			userID = d_;
			console.log(`userID: ${userID}`);
			break;
		case 'startConv':
			chatWindow.innerText = "";
			addInfoMessage(d_.infoMsg);
			console.log(`startConv: ${d_.infoMsg}`);
			if (!countDownStarted) { countDown(d_.remainingS); }
			console.log(`remainingS: ${d_.remainingS}`);

			// If user created the conversation, send his public key to the contact
			if (userID === 0) { ws.send(JSON.stringify({ type: 'newMsg', data: { msg: arrayBufferToString(userKeys.pubKey) } })); }
			break;
		case 'newMsg':
			modal.style.opacity = 0;
			
			// Initialize cryptographic conversation
			if (cryptInitStep === 0 && userID !== d_.userID) {
				console.log(`0- clear key received`)
				friendPubKey = StringToArrayBuffer(d_.msg);
				// Send own public key encrypted with friend public key to contact
				encrypted = await encryptMessageToString(arrayBufferToString(userKeys.pubKey), friendPubKey);
				ws.send(JSON.stringify({ type: 'newMsg', data: { msg: encrypted } }));
				console.log(`Send own public key encrypted with friend public key to contact`)
			}
			if (cryptInitStep === 1 && userID !== d_.userID) {
				console.log(`1- encrypted key received`)// : ${d_.msg}`)
				decrypted = await decryptStringToString(d_.msg, userKeys.privKey);
				friendPubKey = StringToArrayBuffer(decrypted);
				console.log(`1- friendPubKey decrypted`)

				// Generate new RSA key pair
				userKeys = new cryptoKeys( await generateRSAKeyPair() );
				userKeys.pubKey = await window.crypto.subtle.exportKey('spki', userKeys.keyPair.publicKey);
				userKeys.privKey = await window.crypto.subtle.exportKey('pkcs8', userKeys.keyPair.privateKey);

				// Send own public key encrypted with friend public key to contact
				encrypted = await encryptMessageToString(arrayBufferToString(userKeys.pubKey), friendPubKey);
				ws.send(JSON.stringify({ type: 'newMsg', data: { msg: encrypted } }));
				console.log(`Send own public key encrypted with friend public key to contact`)
			}
			if (cryptInitStep === 2 && userID !== d_.userID) {
				console.log(`2- encrypted key received`)// : ${d_.msg}`)
				decrypted = await decryptStringToString(d_.msg, userKeys.privKey);
				friendPubKey = StringToArrayBuffer(decrypted);
				console.log(`2- friendPubKey received`)
			}
			if (cryptInitStep === 2) { chatWindow.innerText = ""; addInfoMessage(`Conversation is now encrypted`); }
			if (cryptInitStep <= 2) { cryptInitStep++; break; }

			// Check if message is sent by the user
			if (sentEncryptedMsg[d_.msg] != undefined) {
				addMessage(sentEncryptedMsg[d_.msg], true);
				delete sentEncryptedMsg[d_.msg];
				break;
			}

			// if not sent by the user, decrypt the message and add it to the chat window
			decrypted = await decryptStringToString(String(d_.msg), userKeys.privKey);
			addMessage(decrypted, d_.userID == userID);
			break;
		default:
			break;
	}
	//} catch (error) {
	//	console.error(error);
	//}
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
	await new Promise(r => setTimeout(r, 5000));
	// refresh webpage;
	location.reload();
};
//#endregion ----------------------------------------------

});
