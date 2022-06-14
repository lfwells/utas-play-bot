import { getBotMemberForGuild, getGuildProperty } from "../guild/guild.js";
import { Permissions } from "discord.js";

export const ROLES = new Map();

export async function init_roles(guild)
{
    //console.log(`init_roles ${guild.name}`);

    ROLES[guild.id] = await guild.roles.fetch();
}

export function getRoleByName(guild, name)
{
    return ROLES[guild.id].find(r => r.name.toLowerCase() == name.toLowerCase());
}
export async function getRoleByNameOrCreate(guild, name)
{
    var existingRole = getRoleByName(guild, name);
    if (existingRole) return existingRole;

    //else create it
    var result = await guild.roles.create({
         name
    });
    await init_roles(guild);
    return result;
}

export async function assignRole(guild, member, role)
{
    if (await botRoleHigherThanMemberRole(member))
        await member.roles.add(role);
    else   
        console.log("cannot add role, the member has a higher role than the bot");
}

export async function unAssignRole(guild, member, role)
{
    if (await botRoleHigherThanMemberRole(member))
        await member.roles.remove(role);
    else   
        console.log("cannot remove role, the member has a higher role than the bot");
}

export async function hasRole(member, role)
{
    return await hasRoleID(member, role.id);
}
export async function hasRoleID(member, roleID)
{
    if (member.roles == null) return false;
    //return await member.roles.has(role);
    //member.roles.cache.each(r => console.log(r.name+"_"+r.id));
    //console.log("roleID", roleID);
    return member.roles.cache.has(roleID)    
}

export async function botRoleHigherThanMemberRole(member)
{
    if (member.id == member.guild.ownerId) return false;

    var us = await getBotMemberForGuild(member.guild);
    var ourHighestRole = us.roles.highest;
    var theirHighestRole = member.roles.highest;
    return ourHighestRole.position > theirHighestRole.position;
}

export async function isAdmin(member)
{
    if (member != null && member.permissions != null && member.permissions.has(Permissions.FLAGS.ADMINISTRATOR)) return true;

    if (member == null || member.guild == null) return false;
    
    var adminRoleID = await getGuildProperty("adminRoleID", member.guild, undefined, true);
    
    if (adminRoleID)
        return await hasRoleID(member, adminRoleID);
    else 
        return false;
}