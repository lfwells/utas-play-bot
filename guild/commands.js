/*
    TODO: Application Commands instead of these
    TODO: fix admin-only commands

    Discord complains when we register too many commands are generated in a day
    And we don't need to generate existing commands
    Only need to regenerate a command if it is:
        a) New; or
        b) something about it changed (command name, args, etc -- NOT code content)
    To regenerate, add the command name (with no slash) to the array below.

    Similarly, to delete old commands, use the variables below
*/
const unregisterAllOnStartUp = false; //put back to false
const registerAllOnStartUp = false; //put back to false
const commandsToRegenerate = ["room"]; //put back to []
const commandsToUnregister = []; //put back to []
const applicationCommandsToRegenerate = []; //put back to []
const applicationCommandsToUnregister = []; //put back to []

export const newGuilds = []; //managed by the guildCreate event, to make sure new servers get commands registered when the bot is added 

const adminOnlyCommands = [];

export const allCommandData = {}
export const adminCommandData = {}

export async function registerCommand(guild, commandData)
{
    if (adminOnlyCommands.findIndex(e => e == commandData.name) == -1)
        allCommandData[commandData.name] = commandData;
    else
        adminCommandData[commandData.name] = commandData;

    if (registerAllOnStartUp || commandsToRegenerate.findIndex(e => e == commandData.name) >= 0 || newGuilds.findIndex(g => g.id == guild.id) >= 0)
    {
        console.log("Registering Command", commandData.name," on ", guild.name, "...");
        await guild.commands.create(commandData)
    }
}
export async function unregisterAllCommandsIfNecessary(guild)
{
    var commands = await guild.commands.fetch(); 
    await Promise.all(commands.map( async (commandData) => 
    { 
        if (unregisterAllOnStartUp || commandsToUnregister.findIndex(e => e == commandData.name) >= 0)
        {
            console.log("Unregistering Command", commandData.name," on ", guild.name, "...");
            await guild.commands.delete(commandData);
        }
    }));
}

export async function init_application_commands(client)
{
    await unregisterAllApplicationCommandsIfNecessary(client);
}

export async function registerApplicationCommand(client, commandData)
{
    allCommandData[commandData.name] = commandData;
    if (registerAllOnStartUp || applicationCommandsToRegenerate.findIndex(e => e == commandData.name) >= 0)
    {
        console.log("Registering Application Command", commandData.name,"...");
        await client.application.commands.create(commandData)
    }
}
export async function unregisterAllApplicationCommandsIfNecessary(client)
{
    var commands = await client.application.commands.fetch(); 
    await Promise.all(commands.map( async (commandData) => 
    { 
        if (unregisterAllOnStartUp || applicationCommandsToUnregister.findIndex(e => e == commandData.name) >= 0)
        {
            console.log("Unregistering Application Command", commandData.name,"...");
            await client.application.commands.delete(commandData);
        }
    }));
}