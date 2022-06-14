import * as config from './config.js';
import { send } from "./client.js";
import { getGuildProperty } from '../guild/guild.js';

export function initErrorHandler(client) {

    process.on('uncaughtException', async function(err) {
        try 
        {
        //console.error('!!! Caught exception: ', err);
        var str = JSON.stringify(err, Object.getOwnPropertyNames(err)).substr(0,1700);
        if (str.toLocaleLowerCase().indexOf("quota") > 0)
            return; 
            
        str = str.replaceAll("\\n", "\n");

            var errorChannel = await client.channels.fetch(config.ERROR_LOG_CHANNEL_ID);
            if(errorChannel)
            {
                await send(errorChannel, "<@"+config.LINDSAY_ID+"> Exception on server "+(await getGuildNameFromError(err))+"```"+str+"```", true);
            }
        } catch (e) { console.error(e)}
        process.nextTick(function() { process.exit(1) })
    });
    process.on('unhandledRejection', async function(err) {
        
        try {
        //console.error('!!! Unhandled rejection: ',err); 
        var str = JSON.stringify(err, Object.getOwnPropertyNames(err)).substr(0,1700);
        if (str.toLocaleLowerCase().indexOf("quota") > 0)
            return; 
    
        str = str.replaceAll("\\n", "\n");

            var errorChannel = await client.channels.fetch(config.ERROR_LOG_CHANNEL_ID);
            if(errorChannel)
            {
                await send(errorChannel, "<@"+config.LINDSAY_ID+"> Rejection on server "+(await getGuildNameFromError(err))+"```"+str+"```", true);//TODO: indicate server that caused the problem
            }
        } catch (e) { console.error('!!! Unhandled rejection: ',err); console.error(e)}
    
    });
}

async function getEmbedFromError(error)
{
    var statsEmbed = {
        title: "Stats for "+(member.nickname ?? member.username),
        fields: [],
        thumbnail: { 
            url:member.user.displayAvatarURL()
        }
    };
}

async function getGuildNameFromError(error)
{
    try
    {
        var path = error.path;
        if (path)
        {
            if (path.indexOf("/guilds/") > 0)
            {
                path = path.replace("/guilds/", "");
                path = path.substr(0, path.indexOf("/"));
                return await getGuildProperty("name", path, null, false);
            }
        }
    }
    catch (e) {}
    return null;
}