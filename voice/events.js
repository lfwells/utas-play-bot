import admin from "firebase-admin";
import { Permissions } from "discord.js";
import { getClient } from '../core/client.js';
import { registerCommand } from '../guild/commands.js';
import { deleteGuildProperty, getGuildDocument, getGuildProperty, setGuildProperty } from '../guild/guild.js';
import { MessageActionRow, MessageButton } from 'discord.js';
import { asyncForEach } from "../core/utils.js";

var emoji_open = "🟢";
var emoji_busy = "🟡";
var emoji_muted = "🟠";
var emoji_closed = "🔴";
var emoji_away = "⚫";

var statusDescriptions = {
    "🟢" : "Open - Come and chat!",
    "🟡" : "Busy - You can come in and chat, but they are working hard.",
    "🟠" : "Muted - You can join, but talking is turned off.",
    "🔴" : "Closed - Only group members can join.",
    "⚫" : "Away - There's nobody here / the team are having a break."
}

/*
TODO: 
- room order alphabetical? ugh
*/

//TODO: store these per server
var devSessionCategory = "978162215213498408";
var roomStatusChannelID = "981315171928666183";
var roomMembersChannelID = "986325768281944064";

var ROOMS = {};


export default async function(client)
{
    const roomCommand = {
        name: 'room',
        description: 'Commands for managing rooms',
        options: [
            {
                name: "create", type:"SUB_COMMAND",
                description: "Create a room",
                options: 
                [
                    {
                        name: "name",
                        description: "The name of the room to create",
                        type: "STRING", 
                        required: true
                    }
                ]
            },
            {
                name: "rename", type:"SUB_COMMAND",
                description: "Rename an existing room. Must be run in the room channel by room creator.",
                options: 
                [
                    {
                        name: "name",
                        description: "The new name of the room to create",
                        type: "STRING", 
                        required: true
                    }
                ]
            },
            {
                name: "delete", type:"SUB_COMMAND", 
                description: "Delete an existing room. Must be run in the room channel by room creator.",
            },
            {
                name: "controls", type:"SUB_COMMAND", 
                description: "Display controls for controlling the room. Must be run in the room channel by a room member.",
            },
        ]
    }; 
    
    const roomMembersCommand = {
        name: 'room_member',
        description: 'Commands for manging room team members.',
        options: [
            {
                name: "add", type:"SUB_COMMAND", 
                description: "Add member to room team. Must be run in the room text channel by a room member.",
                options: 
                [
                    {
                        name: "user",
                        description: "The user to add.",
                        type: "USER", 
                        required: true
                    }
                ]
            },
            {
                name: "remove", type:"SUB_COMMAND", 
                description: "Remove member from room team. Must be run in the room text channel by a room member.",
                options: 
                [
                    {
                        name: "user",
                        description: "The user to remove.",
                        type: "USER", 
                        required: true
                    }
                ]
            },
            {
                name: "list", type:"SUB_COMMAND", 
                description: "Show all members of a room team. Must be run in the room text channel.",
            },
        ]
    }; 

    const roomControlCommand = {
        name: 'room_control',
        description: 'Set the status of the room directly, without needing to use /room controls',
        options:[
            {
                name: "status", type:"STRING",
                description: "The status to set the room to.",
                choices:[
                    { name: emoji_open+" "+statusDescriptions[emoji_open], value: emoji_open },
                    { name: emoji_busy+" "+statusDescriptions[emoji_busy], value: emoji_busy },
                    { name: emoji_muted+" "+statusDescriptions[emoji_muted], value: emoji_muted },
                    { name: emoji_closed+" "+statusDescriptions[emoji_closed], value: emoji_closed },
                    { name: emoji_away+" "+statusDescriptions[emoji_away], value: emoji_away }
                ],
                required: true
            }
        ]
    }; 

    const helpCommand = {
        name: 'help',
        description: 'Learn about the commands you can run for this bot',
    }; 


    var guilds = client.guilds.cache;
    await guilds.each( async (guild) => { 
        await registerCommand(guild, roomCommand);
        await registerCommand(guild, roomMembersCommand);
        await registerCommand(guild, roomControlCommand);
        await registerCommand(guild, helpCommand);
        
        ROOMS[guild.id] = await fetchAllRooms(guild);
        await setUpRoomMembersChannel(guild);
        await setUpRoomStatusChannel(guild);
    });

    client.on('interactionCreate', async function(interaction) 
    {
        // If the interaction isn't a slash command, return
        if (interaction.isCommand() && interaction.guild)
        {
            if (interaction.commandName === "room") 
            {
                var subCommand = interaction.options.getSubcommand();
                if (subCommand == "create")
                {
                    await doCreateRoomCommand(interaction);            
                }
                else if (subCommand == "delete")
                {
                    await doDeleteRoomCommand(interaction);            
                }
                else if (subCommand == "rename")
                {
                    await doRenameRoomCommand(interaction);            
                }
                else if (subCommand == "controls")
                {
                    await doRoomControlsCommand(interaction);            
                }
            }
            else if (interaction.commandName === "room_member") 
            {
                var subCommand = interaction.options.getSubcommand();
                if (subCommand == "add")
                {
                    await doAddMemberCommand(interaction);            
                }
                else if (subCommand == "remove")
                {
                    await doRemoveMemberCommand(interaction);            
                }   
                else if (subCommand == "list")
                {
                    await doListMembersCommand(interaction);            
                }       
            }
            else if (interaction.commandName === "room_control") 
            {
                await doRoomControlDirectCommand(interaction);      
            }
            else if (interaction.commandName === "help") 
            {
                await doHelpCommand(interaction);      
            }
            
        }
        else if (interaction.isMessageComponent() && interaction.message.interaction)
        {
            if (interaction.message.interaction.commandName != "role_select_message") //ugh
            {
                if (interaction.customId == "delete")
                {
                    await doDeleteRoomButton(interaction);
                }
                else if (interaction.customId == "cancel")
                {
                    //TODO: this doesn't work lol
                    await doCancelButton(interaction);
                }
                else
                {
                    await doRoomControlsButtons(interaction);
                }
            }
        }
    });

    client.on('voiceStateUpdate', async (oldMember, newMember) => 
    {    
        const newUserChannel = newMember.channel;
        const oldUserChannel = oldMember.channel;

        var guild;
        
        //left
        if (newUserChannel == undefined)
        {
            var member = oldMember.guild.members.cache.get(oldMember.id);
            var channel = oldUserChannel;//await client.channels.cache.get(oldUserChannel);
            guild = channel.guild;

            //console.log(`${member.displayName} (${oldMember.id}) has left the channel ${channel.name}`); 
            await channelLeave(member, oldMember.channel);
        }
        else //its possible they are unmuting, or sharing video
        {
            var member = newMember.guild.members.cache.get(newMember.id);
            var channel = newUserChannel;//await client.channels.cache.get(newUserChannel);
            guild = channel.guild;

            //detect channel switch
            if (oldMember.channel && oldMember.channel != newMember.channel)
            {
                //console.log("detect channel change!");
                await channelLeave(member, oldMember.channel);
                await channelJoin(member, newMember.channel);
            }
            else if (oldMember.channel == undefined)
            {
                //console.log("detect channel join!");
                await channelJoin(member, newMember.channel);
            }
        } 
    });

    client.on("guildMemberUpdate", async (oldMember, newMember) =>
    {
        // check if roles were removed
        var removedRole = null;
        oldMember.roles.cache.every(function (value) {
            if (value.name == "@everyone") return;
            if (newMember.roles.cache.has(value.id) == false) {
                removedRole = value
            }
        });

        // check if roles were added
        var addedRole = null;
        newMember.roles.cache.every(function (value) {
            if (value.name == "@everyone") return;
            if (oldMember.roles.cache.has(value.id) == false) {
                addedRole = value
            }
        });
        if (addedRole != null || removedRole != null)
        {
            var rooms = Object.values(getAllRooms(newMember.guild));
            for (var room of rooms)
            {
                //console.log({ role: room.role, add:addedRole?.id, remove:removedRole?.id, addEq: room.role == addedRole?.id, removedEq: room.role == removedRole?.id});
                if ((room.role == addedRole?.id) || (room.role == removedRole?.id))
                {
                    await setNicknamesOfActiveMembers(room);
                }
            }
        }
    });

    client.on("channelDelete", async function(deletedChannel) {
        
        var roomDetails = await getRoomForTextChannel(deletedChannel);
        if (roomDetails == null) await getRoomForVoiceChannel(deletedChannel);
        if (roomDetails != null)
        {
            await deleteRoom(roomDetails);
        }
    });

    //if deleting a team role, we don't want to just go and delete the room -- we will just magically re-create the role, lol
    //we will sadly lose all the team members, but can re-assign at least the creator
    client.on("roleDelete", async deletedRole => {
        var roomDetails = await getRoomForRole(deletedRole);
        if (roomDetails != null)
        {
            console.log("deleted a room role, response is to just recreate it!");
            var guild = await getGuildFor(roomDetails);
            var name = roomDetails.name;
            var role = await guild.roles.create({
                name,
                reason: `role for room ${name}`
            });

            roomDetails.role = role.id;
        
            await saveRoomDetails(roomDetails);

            var creator = guild.members.cache.get(roomDetails.creator);        
            await addMemberToRoom(creator, roomDetails);
            await updateRoomMembersChannel(guild);
        }
    });
}

async function doGenericCommandResponse(interaction, command)
{
    await interaction.reply(`Command not implemented for \`${command}\``);
}

//TODO: this doesn't work lol
async function doCancelButton(interaction, command)
{
    await interaction.deleteReply();
}

async function doCreateRoomCommand(interaction)
{
    var name = interaction.options.getString("name");
    var channelName = name.toLowerCase().replace(" ","-");
    
    await interaction.deferReply({ephemeral:true});
            
    var textChannel = await interaction.guild.channels.create(`${channelName}-text`, {
        type: 'GUILD_TEXT',
    });
    await textChannel.setParent(devSessionCategory);

    var voiceChannel = await interaction.guild.channels.create(`${name} Voice`, {
        type: 'GUILD_VOICE',
    });
    await voiceChannel.setParent(devSessionCategory);

    var role = await interaction.guild.roles.create({
        name,
        reason: `role for room ${name}`
    });

    var roomDetails =  {
        name,
        guild: interaction.guild.id,
        text: textChannel.id,
        voice: voiceChannel.id,
        role: role.id,
        creator: interaction.member.id
    };

    await saveRoomDetails(roomDetails);

    await addMemberToRoom(interaction.member, roomDetails)
    await setRoomStatus(roomDetails, emoji_open);

    await addRoom(roomDetails);

    await interaction.editReply({ content: `**${name}** room created.\n- Text Channel <#${textChannel.id}>\n- Voice Channel <#${voiceChannel.id}>\n- Role: <@&${role.id}>\n\nTo add team members run \`/room_member add @user\` in the <#${textChannel.id}> channel.\nFor more commands run \`/help\` anywhere!` });
    await textChannel.send(`**${name}** room created by <@${interaction.member.id}>.`);

    await updateRoomStatusChannel(interaction.guild);
}
async function doRenameRoomCommand(interaction)
{
    var name = interaction.options.getString("name");
    var channelName = name.toLowerCase().replace(" ","-");

    await interaction.deferReply({ephemeral:true});

    var roomDetails = await getRoomForCurrentChannel(interaction);
    if (!roomDetails) return;

    //limit this to the creator of the channel
    if (!await isRoomCreator(interaction.member, roomDetails, true))
    {
        return await interaction.editReply({ content: `You don't have permission to rename this room.` });
    }

    roomDetails.name = name;

    var textChannel = await getTextChannelFor(roomDetails);
    await textChannel.setName(`${channelName}-text`);

    var voiceChannel = await getVoiceChannelFor(roomDetails);
    await voiceChannel.setName(`${name} Voice`);

    var role = await getRoleFor(roomDetails);
    await role.setName(name);

    await saveRoomDetails(roomDetails);

    await interaction.editReply({ content: `**${name}** is the new name of the room.` });

    await updateRoomStatusChannel(interaction.guild);
}
async function doDeleteRoomCommand(interaction)
{
    await interaction.deferReply({ephemeral:true});

    var roomDetails = await getRoomForCurrentChannel(interaction);
    if (!roomDetails) return;

    //limit this to the creator of the channel
    if (!await isRoomCreator(interaction.member, roomDetails, true))
    {
        return await interaction.editReply({ content: `You don't have permission to delete this room.` });
    }
    
    const row = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId('delete')
                .setLabel('YES, really delete the room')
                .setStyle('DANGER')
                .setEmoji('🗑️'),
                
            //TODO: this doesn't work lol 
            /*
            new MessageButton()
                .setCustomId('cancel')
                .setLabel('NO, don\'t delete the room')
                .setStyle('SECONDARY')
                .setEmoji('❌'),*/
        );
    

    const rows = [ row ]

    var name = roomDetails.name;
    var content = { 
        content: `Are you sure you want to delete the room **${name}**?`,
        components: rows
     };
    await interaction.editReply(content);
}
async function doDeleteRoomButton(interaction)
{
    var roomDetails = await getRoomForCurrentChannel(interaction);
    if (!roomDetails) return;
    
    //limit this to the creator of the channel
    if (!await isRoomCreator(interaction.member, roomDetails, true))
    {
        return await interaction.editReply({ content: `You don't have permission to delete this room.` });
    }

    await deleteRoom(roomDetails);

    await updateRoomStatusChannel(interaction.guild);
    //dont need to write a message, since channel will be killed
}
async function doRoomControlsCommand(interaction)
{
    await interaction.deferReply({ephemeral:true});

    var roomDetails = await getRoomForCurrentChannel(interaction);
    if (!roomDetails) return;

    //limit this to the members of the channel
    if (!await isRoomMember(interaction.member, roomDetails, true))
    {
        return await interaction.editReply({ content: `You don't have permission to change this room.` });
    }

    await createRoomControls(interaction, roomDetails);
}
async function doRoomControlsButtons(interaction)
{
    //await interaction.deferReply({ ephemeral: false });
    await interaction.deferUpdate();
    
    var roomDetails = await getRoomForCurrentChannel(interaction, true);
    if (!roomDetails) return;

    //limit this to the owners of the channel
    if (!await isRoomMember(interaction.member, roomDetails, true))
    {
        return await interaction.reply({ content: `You don't have permission to change this room.` });
    }

    console.log("customId", interaction.customId);
    switch (interaction.customId)
    {
        default:
        case "Open":
            await setRoomStatus(roomDetails, emoji_open);
            break;
        case "Busy":
            await setRoomStatus(roomDetails, emoji_busy);
            break;
        case "Muted":
            await setRoomStatus(roomDetails, emoji_muted);
            break;
        case "Closed":
            await setRoomStatus(roomDetails, emoji_closed);
            break;
        case "Away":
            await setRoomStatus(roomDetails, emoji_away);
            break;
    }

    //await interaction.editReply({content:"wtf"});

    //await interaction.editReply({ content: `Room status for ${voiceChannel.name} set to ${roomDetails.status} ${statusDescriptions[roomDetails.status]}` });
    await createRoomControls(interaction, roomDetails, true);

    await saveRoomDetails(roomDetails);
    await updateRoomStatusChannel(interaction.guild);
}
async function createRoomControls(interaction, roomDetails, button)
{
    const row = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId('Open')
                .setLabel('Open')
                .setStyle('PRIMARY')
                .setEmoji(emoji_open),
                
            new MessageButton()
                .setCustomId('Busy')
                .setLabel('Busy')
                .setStyle('PRIMARY')
                .setEmoji(emoji_busy),

                
            new MessageButton()
                .setCustomId('Muted')
                .setLabel('Muted')
                .setStyle('PRIMARY')
                .setEmoji(emoji_muted),
        
                new MessageButton()
                .setCustomId('Closed')
                .setLabel('Closed')
                .setStyle('PRIMARY')
                .setEmoji(emoji_closed),

            new MessageButton()
                .setCustomId('Away')
                .setLabel('Away')
                .setStyle('PRIMARY')
                .setEmoji(emoji_away),
        );
    

    const rows = [ row ]

    var name = roomDetails.name;
    var status = roomDetails.status ?? emoji_open;
    var content = { 
        content: `Current Room Status for **${name}**: ${status} ${statusDescriptions[status]}\n\nRoom controls:`,
        components: rows
     };

    if (button)
    {
        console.log("double yew tee eff?");
        //await interaction.update(content);
        await interaction.editReply(content);
    }
    else
    {
        console.log("double yew tee eff? 222");
        await interaction.editReply(content);
    }
}
async function doRoomControlDirectCommand(interaction)
{
    await interaction.deferReply({ephemeral:true});

    var roomDetails = await getRoomForCurrentChannel(interaction);
    if (!roomDetails) return;

    //limit this to the members of the channel
    if (!await isRoomMember(interaction.member, roomDetails, true))
    {
        return await interaction.editReply({ content: `You don't have permission to change this room.` });
    }

    await setRoomStatus(roomDetails, interaction.options.getString("status") ?? emoji_open);

    await interaction.editReply({ content: `Room status for ${roomDetails.name} set to ${roomDetails.status} ${statusDescriptions[roomDetails.status]}` });

    await saveRoomDetails(roomDetails);
    await updateRoomStatusChannel(interaction.guild);
}

async function doAddMemberCommand(interaction)
{
    await interaction.deferReply({ephemeral:true});

    var roomDetails = await getRoomForCurrentChannel(interaction);
    if (!roomDetails) return;

    //limit this to the creator of the channel
    if (!await isRoomMember(interaction.member, roomDetails, true))
    {
        return await interaction.reply({ content: `You don't have permission to add members to this room.` , ephemeral: true});
    }

    var addMember = interaction.options.getMember("user");
    await addMemberToRoom(addMember, roomDetails);
    await updateRoomMembersChannel(interaction.guild);

    await setNicknamesOfActiveMembers(roomDetails);
    await interaction.channel.send({ content: `Member <@${addMember.id}> added to ${roomDetails.name}.`, ephemeral: false });
    await interaction.editReply({ content: "Done" });
    
}
async function doRemoveMemberCommand(interaction)
{
    await interaction.deferReply({ephemeral:true});

    var roomDetails = await getRoomForCurrentChannel(interaction);
    if (!roomDetails) return;

    //limit this to the creator of the channel
    if (!await isRoomMember(interaction.member, roomDetails, true))
    {
        return await interaction.editReply({ content: `You don't have permission to remove members from this room.`, ephemeral: true });
    }

    var removeMember = interaction.options.getMember("user");
    if (!await isRoomMember(removeMember, roomDetails, true))
    {
        return await interaction.editReply({ content: `<@${removeMember.id}> is already not a member of this room.`, ephemeral: true });
    }

    await removeMemberFromRoom(removeMember, roomDetails);
    await updateRoomMembersChannel(interaction.guild);

    await setNicknamesOfActiveMembers(roomDetails);
    
    await interaction.editReply({ content: `Member <@${removeMember.id}> removed from ${roomDetails.name}.`, ephemeral: true });
}
async function doListMembersCommand(interaction)
{
    await interaction.deferReply({ephemeral:true});

    var roomDetails = await getRoomForCurrentChannel(interaction);
    if (!roomDetails) return;

    var role = await getRoleFor(roomDetails);
    var members = role.members;

    var membersEmbed = {
        title: `${roomDetails.name} Room Team Members`,
        description: members.map(function (m) {
            return `<@${m.id}>`;
        }).join("\n"),
        thumbnail: { 
            url:interaction.guild.iconURL()
        }
    };

    await interaction.editReply({ 
        embeds: [ membersEmbed ]
     });
}

async function doHelpCommand(interaction)
{
    var helpEmbed = {
        title: "UTASPlay Room Bot Help",
        description: "Dev in a room with your team or solo, and set the room status to indicate if you want visitors or if you just want to focus.\n\n"+(Object.entries(statusDescriptions).map((v, i) => `${v[0]} **${v[1]}**`).join("\n")),
        fields: [
            { name: "`/room create [name]`", value: "Create a room for your team" },
            { name: "`/room controls`", value: "Show the controls to set the status of a room" },
            { name: "`/room delete`", value: "Delete a room if you are the owner of that room" },
            { name: "`/room_member add [user]`", value: "Add someone to your team. Team members can enter the room even if it is closed and can always speak." },
            { name: "`/room_member remove [user]`", value: "Remove someone from your team. Boo!" },
            { name: "`/room_member list`", value: "Show all the members of the team." },
            { name: "`/room_control [open/busy/muted/closed]`", value: "Set the status of your room directly" },
        ],
        thumbnail: { 
            url:interaction.guild.iconURL()
        }
    };
    await interaction.reply({
        embeds: [helpEmbed],
        ephemeral: !interaction.member.permissions.has("ADMINISTRATOR")
    });
}


async function setRoomStatus(roomDetails, emoji)
{
    roomDetails.status = emoji;
    if (emoji != emoji_away)
        roomDetails.lastStatus = emoji;

    await saveRoomDetails(roomDetails);

    await setNicknamesOfActiveMembers(roomDetails);

    var guild = await getGuildFor(roomDetails);
    var voiceChannel = await getVoiceChannelFor(roomDetails);

    /*var client = getClient();
    var voiceChannel = await client.channels.cache.get(roomDetails.voice);

    var id = voiceChannel.id;
    console.log({
        id, emoji
    });
    await voiceChannel.setName(emoji +" "+stripEmoji(voiceChannel.name));*/

    var permissions;
    var permissions_members = {
        id: roomDetails.role,
        deny: [],
        allow: [Permissions.FLAGS.CONNECT, Permissions.FLAGS.SPEAK, Permissions.FLAGS.VIEW_CHANNEL],
    };
    switch (emoji)
    {
        default:
        case emoji_away://actually the away status should just keep the previous permissions maybe?
            break;
        case emoji_open:
        case emoji_busy:
            permissions = {
                id: guild.id,
                deny: [],
                allow: [Permissions.FLAGS.CONNECT, Permissions.FLAGS.SPEAK, Permissions.FLAGS.VIEW_CHANNEL],
            };
            break;
        
        case emoji_muted:
            permissions = {
                id: guild.id,
                deny: [Permissions.FLAGS.SPEAK],
                allow: [Permissions.FLAGS.CONNECT, Permissions.FLAGS.VIEW_CHANNEL],
            };
            break;

        case emoji_closed:
            permissions = {
                id: guild.id,
                deny: [Permissions.FLAGS.SPEAK, Permissions.FLAGS.CONNECT],
                allow: [Permissions.FLAGS.VIEW_CHANNEL],
            };
            break;
    }

    if (emoji != emoji_away)
    {
        await voiceChannel.permissionOverwrites.set([
            permissions,
            permissions_members
        ]);
    }
    
    //now, because discord doesn't do things to existing members, handle people who are in the room who are non-members
    await asyncForEach(voiceChannel.members, async function (nonMember) 
    {
        if (await isRoomMember(nonMember, roomDetails, true) == false)
        {
            //console.log(`found nonMember ${nonMember.displayName} in the room`);
            switch (emoji)
            {
                case emoji_muted:
                    nonMember.voice.setMute(true);
                    break;

                case emoji_closed:
                    await nonMember.voice.setMute(false);
                    await nonMember.voice.disconnect();
                    break;

                default:
                    await nonMember.voice.setMute(false);
                    break;
            }
        }
    });
}
async function setNicknamesOfActiveMembers(roomDetails)
{
    var emoji = roomDetails.status;
    var voiceChannel = await getVoiceChannelFor(roomDetails);
    var role = await getRoleFor(roomDetails);
    await asyncForEach(voiceChannel.members, async function (m) 
    {
        if (await isRoomMember(m, roomDetails, false))
        {
            //console.log(`found member ${m.displayName} in the room, change their nick!`);
            await setMemberStatus(m, emoji);
        }
        else
        {
            //console.log(`found NON-member ${m.displayName} in the room, change their nick!`);
            await setMemberStatus(m, "");
        }
    });

    //need to set nicks of people not in the room too, to clear their stuff
    await asyncForEach(Array.from(role.members.values), async function (m){
        if (m.voice.channel == null || m.voice.channel.id != voiceChannel.id)
        {
            await setMemberStatus(m, "");
        }
    });
}
async function setMemberStatus(member, emoji)
{
    if (member.permissions.has("ADMINISTRATOR")) return; 
    if (emoji != "")
        await member.setNickname(emoji +" "+stripEmoji(member.nickname ?? member.user.username));
    else
        await member.setNickname(stripEmoji(member.nickname ?? member.user.username));
}


async function addMemberToRoom(member, roomDetails)
{
    var role = await getRoleFor(roomDetails);
    await member.roles.add(role);
}
async function removeMemberFromRoom(member, roomDetails)
{
    var role = await getRoleFor(roomDetails);
    await member.roles.remove(role);
}
async function isRoomMember(member, roomDetails, includeAdmin)
{
    if (includeAdmin && member.permissions.has("ADMINISTRATOR"))
    {
        return true;
    }
    var role = await getRoleFor(roomDetails); 
    return member.roles.cache.has(role.id);
}
async function isRoomCreator(member, roomDetails, includeAdmin)
{
    if (includeAdmin && member.permissions.has("ADMINISTRATOR"))
    {
        return true;
    }
    return member.id == roomDetails.creator;
}


async function saveRoomDetails(roomDetails)
{
    var guild = await getGuildFor(roomDetails);
    await setGuildProperty(guild, roomID(roomDetails), roomDetails);

    ROOMS[guild.id][roomID(roomDetails)] = roomDetails;
}

async function getRoomForCurrentChannel(interaction, dontDoAutoReplyErrorMessage)
{
    var roomDetails = await getRoomForTextChannel(interaction.channel);

    //var textChannel = interaction.channel;
    //var roomDetails = await getGuildProperty(`room-${textChannel.id}`, interaction.guild, null);
    if (roomDetails == null)
    {
        if (dontDoAutoReplyErrorMessage == undefined)
            await interaction.editReply({ content: `This channel isn't set up as a room. This command needs to be run in the text channel for the room you want to modify.` });

        return false;
    }
    return roomDetails;
}

async function getRoomForTextChannel(textChannel)
{
    var rooms = Object.values(ROOMS[textChannel.guild.id]);
    for (var room of rooms)
    {
        if (room.text == textChannel.id)
        {
            ///console.log("found room for text channel -- "+room.name);
            return room;
        }
    }
    return null;
}
async function getRoomForVoiceChannel(voiceChannel)
{
    var rooms = Object.values(ROOMS[voiceChannel.guild.id]);
    for (var room of rooms)
    {
        if (room.voice == voiceChannel.id)
        {
            //console.log("found room for voice channel -- "+room.name);
            return room;
        }
    }
    return null;
}
async function getRoomForRole(role)
{
    var rooms = Object.values(ROOMS[role.guild.id]);
    for (var room of rooms)
    {
        if (room.role == role.id)
        {
            //console.log("found room for role -- "+room.name);
            return room;
        }
    }
    return null;
}
async function getGuildFor(roomDetails)
{
    var client = getClient();
    var guild = client.guilds.cache.get(roomDetails.guild);
    if (guild && guild.roles == undefined)
        guild = await guild.fetch();
    return guild;
}
async function getTextChannelFor(roomDetails)
{
    var client = getClient();
    return await client.channels.cache.get(roomDetails.text);
}
async function getVoiceChannelFor(roomDetails)
{
    var client = getClient();
    return await client.channels.cache.get(roomDetails.voice);
}
async function getRoleFor(roomDetails)
{
    var guild = await getGuildFor(roomDetails);
    return await guild.roles.cache.get(roomDetails.role);
}



async function setUpRoomStatusChannel(guild) 
{
    var roomStatusChannel = await guild.channels.cache.get(roomStatusChannelID);
    var client = getClient();
    
    await roomStatusChannel.permissionOverwrites.set([{
        id:  guild.id,//guild.roles.everyone,
        deny: [Permissions.FLAGS.SEND_MESSAGES],
        allow: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.READ_MESSAGE_HISTORY],
    }, {
        id: client.user,
        deny: [],
        allow: [Permissions.FLAGS.SEND_MESSAGES, Permissions.FLAGS.MANAGE_MESSAGES ],
    }]);

    await updateRoomStatusChannel(guild);
}
async function updateRoomStatusChannel(guild)
{
    var message = await getRoomStatusMessage(guild);

    var statusEmbed = {
        title: "Room Status",
        fields: [],
        thumbnail: { 
            url:guild.iconURL()
        }
    };

    var rooms = Object.values(getAllRooms(guild)).sort((a,b) => a.name.localeCompare(b.name));
    for (var room of rooms)
    {
        var status = room.status ?? emoji_open;
        statusEmbed.fields.push({
            name:room.name ?? "DELETE ME",
            value:`${status} ${statusDescriptions[status]}`
        });    
    };

    await message.edit({ content: null, embeds: [ statusEmbed ] });

    await updateRoomMembersChannel(guild);

}
async function getRoomStatusMessage(guild)
{
    var message;
    var roomStatusChannel = await guild.channels.cache.get(roomStatusChannelID);

    var messageID = await getGuildProperty(`statusMessage`, guild, null);
    if (messageID == null)
    {
        message = await roomStatusChannel.send("Room Status");
        await setGuildProperty(guild, "statusMessage", message.id);
    }
    else
    {
        try
        {
            message = await roomStatusChannel.messages.fetch(messageID);
        
            //if the message has been deleted, then recreate it and start this again
            if (message == null)
            {
                await deleteGuildProperty(guild, "statusMessage");
                return await getRoomStatusMessage(guild);
            }
        }
        catch (DiscordAPIError)
        {
            await deleteGuildProperty(guild, "statusMessage");
            return await getRoomStatusMessage(guild);
        }
    }

    return message;
}


async function setUpRoomMembersChannel(guild) 
{
    var roomMembersChannel = await guild.channels.cache.get(roomMembersChannelID);
    var client = getClient();
    
    await roomMembersChannel.permissionOverwrites.set([{
        id:  guild.id,//guild.roles.everyone,
        deny: [Permissions.FLAGS.SEND_MESSAGES],
        allow: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.READ_MESSAGE_HISTORY],
    }, {
        id: client.user,
        deny: [],
        allow: [Permissions.FLAGS.SEND_MESSAGES, Permissions.FLAGS.MANAGE_MESSAGES ],
    }]);
}
async function getRoomMembersMessage(guild)
{
    var message;
    var roomMembersChannel = await guild.channels.cache.get(roomMembersChannelID);

    var messageID = await getGuildProperty(`membersMessage`, guild, null);
    if (messageID == null)
    {
        message = await roomMembersChannel.send("Room Members");
        await setGuildProperty(guild, "membersMessage", message.id);
    }
    else
    {
        try
        {
            message = await roomMembersChannel.messages.fetch(messageID);
        
            //if the message has been deleted, then recreate it and start this again
            if (message == null)
            {
                await deleteGuildProperty(guild, "membersMessage");
                return await getRoomMembersMessage(guild);
            }
        }
        catch (DiscordAPIError)
        {
            await deleteGuildProperty(guild, "membersMessage");
            return await getRoomMembersMessage(guild);
        }
    }

    return message;
}
async function updateRoomMembersChannel(guild)
{
    var message = await getRoomMembersMessage(guild);

    var membersEmbed = {
        title: "Room Members",
        fields: [],
        thumbnail: { 
            url:guild.iconURL()
        }
    };

    var rooms = Object.values(getAllRooms(guild)).sort((a,b) => a.name.localeCompare(b.name));
    for (var room of rooms)
    {
        var role = await getRoleFor(room);
        var membersJoin = role.members.map(m => {
            return `<@${m.id}>`
        }).join("\n");
        membersEmbed.fields.push({
            name:room.name ?? "DELETE ME",
            value:membersJoin
        });    
    };

    await message.edit({ content: null, embeds: [ membersEmbed ] });

}

function getAllRooms(guild) 
{
    return ROOMS[guild.id];
}
async function fetchAllRooms(guild)
{
    var guildDocument = await (await getGuildDocument(guild.id)).get();
    var data = guildDocument.data();
    var rooms = Object.fromEntries(Object.entries(data).filter(([key]) => key.includes('room-')));
    return rooms;
}
async function addRoom(roomDetails)
{
    var guild = await getGuildFor(roomDetails);
    ROOMS[guild.id][roomID(roomDetails)] = roomDetails;

    await updateRoomStatusChannel(guild);
}
async function deleteRoom(roomDetails)
{
    var guild = await getGuildFor(roomDetails);

    //delete cache
    delete ROOMS[guild.id][roomID(roomDetails)];

    //delete from db
    var guildDocument = await getGuildDocument(guild.id);
    await guildDocument.update({
        [roomID(roomDetails)]: admin.firestore.FieldValue.delete()
    });


    //delete discord things
    try
    {
        var textChannel = await getTextChannelFor(roomDetails);
        if (textChannel) await textChannel.delete();
    } catch (DiscordAPIError) { console.log("could not delete text channel"); }

    try {
        var voiceChannel = await getVoiceChannelFor(roomDetails);
        if (voiceChannel) await voiceChannel.delete();
    } catch (DiscordAPIError) { console.log("could not delete voice channel"); }

    try {
        var role = await getRoleFor(roomDetails);
        if (role) await role.delete();
    } catch (DiscordAPIError) { console.log("could not delete role"); }

    await updateRoomStatusChannel(guild);
}

function roomID(roomDetails)
{
    return "room-"+roomDetails.text;
}


async function channelJoin(member, channel)
{
    console.log(`${member.displayName} JOINED ${channel.name}`);

    var roomDetails = await getRoomForVoiceChannel(channel);
    if (roomDetails)
    {
        await setNicknamesOfActiveMembers(roomDetails);
        if (roomDetails.status != emoji_muted)
        {
            await member.voice.setMute(false);
        }

        //check if the room now has a team member, and restore previous status
        if (roomDetails.status == emoji_away)
        {
            var voiceChannel = await getVoiceChannelFor(roomDetails);
            var roomMembersRemaining = 0;
            await asyncForEach(voiceChannel.members, async function (m) {
                roomMembersRemaining += (await isRoomMember(m, roomDetails)) ? 1 : 0;
            });
            if (roomMembersRemaining >= 1)
            {
                console.log(`Room ${roomDetails.name} now has a team member after being away, updating status to previous one ${roomDetails.lastStatus ?? emoji_open}`);
                await setRoomStatus(roomDetails, roomDetails.lastStatus ?? emoji_open);
                await updateRoomStatusChannel(member.guild);
            }
        }
    }
    else
    {     
        await member.voice.setMute(false);
    }
}
async function channelLeave(member, channel)
{
    console.log(`${member.displayName} LEFT ${channel.name}`);
    await setMemberStatus(member, "");

    var roomDetails = await getRoomForVoiceChannel(channel);
    if (roomDetails)
    {
        await setNicknamesOfActiveMembers(roomDetails);
        
        //check if the room is now empty, and put it to away
        var voiceChannel = await getVoiceChannelFor(roomDetails);
        var roomMembersRemaining = 0; 
        var results = await asyncForEach(voiceChannel.members, async function (m) 
        {
            return (await isRoomMember(m, roomDetails, false)) ? 1 : 0;
        });
        var roomMembersRemaining = results.reduce(
            (previousValue, currentValue) => previousValue + currentValue,
            0
        );
        console.log(roomMembersRemaining);
        if (roomMembersRemaining == 0)
        {
            console.log(`Room ${roomDetails.name} No team members remaining, switch to away!`);

            await setRoomStatus(roomDetails, emoji_away);
            await updateRoomStatusChannel(member.guild);
        }
        //console.log({ roomMembersRemaining });
    }
}

var unified_emoji_ranges = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;//['\ud83c[\udf00-\udfff]','\ud83d[\udc00-\ude4f]','\ud83d[\ude80-\udeff]'];
var reg = new RegExp(unified_emoji_ranges);//.join('|'), 'g');
export function stripEmoji(txt)
{
  return txt.replace(reg, "").trim();
}