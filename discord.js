//discord
import { getClient, init_client } from './core/client.js'; 

//import things need to initialize discord
import init_guilds from "./guild/guild.js";

import { init_db } from './core/database.js';

//listen for when discord is logged in
const client = getClient();
client.on('ready', async () => 
{
	await init_db(); 

	console.log(`Logged in as ${client.user.tag}!`);

	//save all the guilds etc to db
	await init_guilds(client);

	await init_client(client);

	console.log('\u0007');
	console.log("---------\nREADY\n---------"); 
});

//login with discord auth token
import token from './core/token.js';  
console.log("Logging in to Discord...");  
client.login(token).catch(reason => {

    console.log("Login failed: " + reason);
    console.log("Token used: " + token);

}); 

//register for errors to be posted to test server
//import { initErrorHandler } from './core/errors.js';
//initErrorHandler(client);

//web server
//import { init_server } from "./core/server.js";
//init_server();
