// WELCOME IN MY CONCEPTION OF A SIMPLE NODEJS - EJS PROJECT
// IN VISUAL CODE YOU CAN USE Ctrl+K Ctrl+0 TO FOLD ALL CODE
// THAT CAN BE USEFUL TO FOLD THE #REGION OF CODE

//#region - SETTINGS - LAUNCH ARGUMENTS
const inspector = require('inspector');
const is_debug = inspector.url() !== undefined ? true : false;
console.log(`is_debug: ${is_debug}`);

const settings = {
  p: 4321, // Port
  m: false, // Minify scripts
  ar: false, // Auto restart
  da: false, // Disable admin token usage
  lr: false, // Log routes
  ul: is_debug ? false : true, // Use launch folder as subdomain
  t: "NzQxNzQ2NjEwNjQ0NjQwMzg4XyOg3Q5fJ9v5Kj6Y9o8z0j7z3QJYv6K3c", // admin Token
  shortenerUrl: is_debug ? "http://localhost:4325/shorten" : "https://tto.cx/shorten"
}
console.log(`shortener_url: ${settings.shortenerUrl}`);
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  // Check if the argument starts with "-"
  if (arg.startsWith("-")) {
      // Get the key by removing the "-"
      const key = arg.slice(1);
      if (key == "m") { settings.m = true; continue; }
      if (key == "ar") { settings.ar = true; continue; }
      if (key == "lr") { settings.lr = true; continue; }
      if (key == "rd") { settings.ul = false; continue; } // [root domain] - Don't use launch folder as subdomain

      // Move to the next argument
      i++;
      const value = args[i];

      // if string value is valid number
      if (key == "p" && !isNaN(value)) {settings[key] = Number(value); continue;}

      // Add the key and value to the launchArguments object
      settings[key] = value;
  }
}
//#endregion ----------------------------------------------

//#region - IMPORTS - MODULES - SCRIPTS PUBLIFICATION
const launch_folder = settings.ul ? __dirname.split('\\').pop().split('/').pop() : "";
const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const UglifyJS = require('uglify-js');
const { exec } = require('child_process');
//---------------------------------------------------------
if (settings.ul) { console.log(`launch_folder: ${launch_folder}`) }; // Get the name of the folder where the server is launched
let exit_task = ""; // Exit task to execute when the server is exiting

function create_public_version_of_script(filePath, varName = false) {
  // Lire le contenu du fichier
  let fileContent = fs.readFileSync(filePath, 'utf8');

  // Remplacer "module.exports" par "window.${var_name}"
  if (varName) { fileContent = fileContent.replace(/module\.exports/g, `window.${varName}`); }

  // Replace "subdomain_prefix" by the name of the folder
  fileContent = fileContent.replace(/subdomain_prefix|env_ = 'dev'/g, (match) => {
    if (match === 'subdomain_prefix') {
        return `"${launch_folder}"`;
    } else if (match === "env_ = 'dev'") {
        return "env_ = 'prod'";
    }
  });

  // Replace "shortener_url" by the value of the setting
  fileContent = fileContent.replace(/shortener_url/g, settings.shortenerUrl);

  // Minimiser le contenu modifié
  if (settings.m) { fileContent = UglifyJS.minify(fileContent).code; }

  // Obtenir le nom de fichier sans le chemin
  const fileName = path.basename(filePath);

  // Chemin de destination pour la copie
  const destinationPath = path.join(__dirname, 'public/scripts', fileName);

  // Créer le dossier de destination s'il n'existe pas
  const destinationDir = path.join(__dirname, 'public/scripts');
  if (!fs.existsSync(destinationDir)) { fs.mkdirSync(destinationDir); }

  // Écrire le contenu modifié dans le nouveau fichier
  fs.writeFileSync(destinationPath, fileContent, 'utf8');

  console.log(`File copy success : ${destinationPath}`);
}
function executeServerManagerScript(exec_args = "") {
  const arg_ = exec_args ? ` ${exec_args}` : ""
  exec(`node ServerManager.js${arg_}`, (error, stdout, stderr) => {
    if (error) { console.error(`Error executing the script ServerManager.js: ${error}`); return; }
    console.log('The script ServerManager.js has been executed');
  });
}
// Make public version of scripts in the "public_scripts" folder
fs.readdirSync('./public_scripts').forEach(file => {
  if (file.endsWith('.js')) { create_public_version_of_script(`./public_scripts/${file}`); }
});
//#endregion ----------------------------------------------

//#region - HTTP SERVER - EXPRESS - ROUTES
const app = express();
app.set('view engine', 'ejs');
app.use(express.static('public'));
//app.use(`/${launch_folder}`, express.static('public')) // Route to listen subdomain (ex: localhost:4321/launch_folder)

// Route to listen root domain (ex: localhost:4321) & replace "launch_folder" by the name of the folder
app.get(['/', '//'], (req, res) => { res.render('index', {"launch_folder": launch_folder}); });

// Route to restart the server
if (!is_debug && !settings.da) { // If admin token usage is not disabled
  const restartHandler = (req, res) => { exit_task = "restart"; res.render('simple_msg', {"launch_folder": launch_folder, "message": "Server is restarting..."}); process.exit(0) }
  const gitpullHandler = (req, res) => { exit_task = "gitpull"; res.render('simple_msg', {"launch_folder": launch_folder, "message": "Server is restarting after 'git pull origin main'..."}); process.exit(0) }
  app.get([`/restart/${settings.t}`, `//restart/${settings.t}`], restartHandler);
  app.get([`/gitpull/${settings.t}`, `//gitpull/${settings.t}`], gitpullHandler);
  
  console.log("Admin routes are enabled: /restart, /gitpull");
}

// Log all routes
function logRoutes() {
  const routes = app._router.stack.filter(layer => layer.route).map(layer => {
    return {
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    };
  });
  console.log('---');
  // Affichez les routes dans la console
  routes.forEach(route => {
    console.log(`Path: ${route.path}`);
    console.log(`Methods: ${route.methods.join(', ')}`);
    console.log('---');
  });

  app.use((req, res, next) => { if (req.method === 'GET') { console.log(`Received GET request for ${req.url}`); } next(); });
}; if (settings.lr) { logRoutes() };
//#endregion ----------------------------------------------

//#region - WEBSOCKET
const server  = http.createServer(app);
const wss = new WebSocket.Server({ server });
const conv = { toto: { members: [] } }; // conversations
class convMember {
  constructor(id, ws, key) {
    this.id = id;
    this.ws = ws;
    this.key = key;
  }
}

wss.on('connection', (ws, req) => {
	const remoteAddress = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
	const clientIP = remoteAddress.includes(':') ? remoteAddress.split(':').pop() : remoteAddress;
  let conv_userID = null;
  let convID = null;

	ws.on('message', async (message) => {
		try {
			if (message == "ping") { ws.send("pong"); return; }
			const data = JSON.parse(message);
			const { jsonString, escapedCharacters } = DetectEscaping(data)
			if (escapedCharacters.length > 0) { console.log("escapedCharacters detected"); console.log(escapedCharacters); return false; }

			const d_ = data.data;
			if (d_ == undefined) { console.log("d_ is undefined"); return; }

			// HANDLE DATA
			switch (data.type) {
				case 'log_msg':
					console.log(`[${clientIP}] ${d_}`);
					// EXAMPLE OF SENDING DATA TO CLIENT
					ws.send(JSON.stringify({ type: 'log_msg', data: 'Hello from server' }));
					break;
				case 'createConv':
          convID = d_.convID;
          conv[convID] = { members: [ new convMember(0, ws, false) ] };
          conv_userID = 0;

          // SEND userID TO CLIENT
          ws.send(JSON.stringify({ type: 'userID', data: conv_userID }));
          break;
        case 'joinConv':
          convID = d_.convID;
          if (conv[convID] == undefined) { ws.send(JSON.stringify({ type: 'log_msg', data: `Conversation ${convID} not found` })); return; }
          conv[convID].members.push( new convMember(conv[convID].members.length, ws, false) );
          conv_userID = conv[convID].members.length - 1;

          // SEND userID TO CLIENT
          ws.send(JSON.stringify({ type: 'userID', data: conv_userID }));

          // SEND TO ALL MEMBERS OF THE CONVERSATION
          conv[convID].members.forEach(member => {
            member.ws.send(JSON.stringify({ type: 'startConv', data: `Everyone is here !` }));
          });
          break;
        case 'newMsg':
          if (conv[convID] == undefined) { ws.send(JSON.stringify({ type: 'log_msg', data: `Conversation ${convID} not found` })); return; }
          
          // SEND TO ALL MEMBERS OF THE CONVERSATION
          conv[convID].members.forEach(member => {
            member.ws.send(JSON.stringify({ type: 'newMsg', data: { userID: conv_userID, msg: d_.msg } }));
          });
          break;
        default:
					break;
			}
		} catch (error) {
			console.log(`Error: ${error}`);
		}
	});

	ws.on('close', () => {
    // IF THE USER IS IN A CONVERSATION
    if (conv_userID != null && convID != null) {
      // SEND TO ALL MEMBERS OF THE CONVERSATION
      conv[convID].members.forEach(member => {
        member.ws.send(JSON.stringify({ type: 'log_msg', data: `User ${conv_userID} is disconnected` }));
      });
    }
    console.log(`Client ${clientIP} is disconnected`);
  });
});

//#endregion ----------------------------------------------

// START SERVER
/*app.listen(settings.p, () => {
  console.log(`Server running on port ${settings.p}`);
});*/
server.listen(settings.p, () => {
	const address = server.address();
	console.log(`Server running and listening ${address.address}:${settings.p}`);
});

// EXIT HANDLER
process.on('exit', () => {
  // If no exit task, and auto restart is enabled, set the exit task to "restart"
  if (exit_task === "" && settings.ar) { exit_task = "restart" }
  if (exit_task === "") { return; } // If no exit task, exit the process

  // Add the arguments to the exit task
  args.forEach(arg => { exit_task += " "+ arg })

  // Execute the ServerManager.js script with the exit task as argument
  executeServerManagerScript(exit_task);
  console.log(`exit_task: ${exit_task}`);
});

//#region - FUNCTIONS
function DetectEscaping(object) {
  const jsonString = JSON.stringify(object);
  let escapedCharacters = [];

  // Recherche des caractères d'échappement dans la chaîne JSON
  jsonString.replace(/\\(["\\\/bfrt$])/g, (match) => {
    escapedCharacters.push(match);
    return match;
  });

  return {
    jsonString,
    escapedCharacters
  };
}
//#endregion ----------------------------------------------