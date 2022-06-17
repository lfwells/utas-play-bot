import { Client, Intents } from 'discord.js';
const client = new Client({ 
    intents: [ 
        Intents.FLAGS.GUILDS, 
        //Intents.FLAGS.GUILD_INVITES, 
        Intents.FLAGS.GUILD_MEMBERS, 
        Intents.FLAGS.GUILD_MESSAGE_REACTIONS, 
        Intents.FLAGS.GUILD_PRESENCES,
        Intents.FLAGS.GUILD_MESSAGES, 
        Intents.FLAGS.GUILD_VOICE_STATES,
        Intents.FLAGS.GUILD_SCHEDULED_EVENTS,
        Intents.FLAGS.DIRECT_MESSAGES,
    ],partials: ["CHANNEL"],
    fetchAllMembers: true
});
//https://discord.com/api/oauth2/authorize?client_id=978162562468282378&permissions=1505921923442&scope=bot%20applications.commands
export function getClient() { return client };


import { init_application_commands, init_interaction_cache } from '../guild/commands.js';
import init_voice_events from "../voice/events.js";
import init_role_events from "../roles/events.js";
import { createOAuthLink } from './login.js';
import { init_events_client } from '../events/events.js';


var activityInterval;
export async function init_client(client)
{
    console.log("Begin init_client...");
    client.removeAllListeners();

	//register the appropriate discord event listeners
    console.log("Init Interaction Cache");      await init_interaction_cache(client);
    console.log("Init Application Commands...");await init_application_commands(client);
    console.log("Init Voice Events...");        await init_voice_events(client);
    console.log("Init Role Events...");         await init_role_events(client);
    console.log("Init Scheduled Events...");    await init_events_client(client);
    console.log("End init_client.");

    createOAuthLink();
}



export async function reply(originalMessage, message)
{
    var result = null;
    if (config.enableSendMessagesAndReplies)
    {
        result = await originalMessage.reply(message);
        console.log("REPLIED: "+message);
    } 
    else
    {
        console.log("(would have) REPLIED: "+message);
    }
    return result;
}
export async function send(channel, message, dontLogIt)
{
    if (channel && channel.send)
    {
        var result = null;
        if (config.enableSendMessagesAndReplies)
        {
            result = await channel.send(message);
            if (!dontLogIt) console.log("SENT: "+message);
        } 
        else
        {
            if (!dontLogIt) console.log("(would have) SENT: "+message);
        }
        return result;
    }
}