import moment from "moment";

var weeksAhead = 5;
var weeklyDevSessionEventRoot = "987149197637718076";
var weeklyStreamEventRoot = "987370614006366329";

export async function init_events_client(client)
{
    client.on("guildScheduledEventUpdate", async function (oldEvent, newEvent) {
        //console.log({oldEvent, newEvent});

        if (oldEvent && newEvent && oldEvent.status != newEvent.status)
        {
            console.log("event status changed", oldEvent.status, newEvent.status);
            if (newEvent.status == "COMPLETED")
            {
                //sadly this doesn't work, so need to clone the event
                //await newEvent.setStatus("SCHEDULED");

                await cloneEvent(newEvent.guild, newEvent);
            }
        }

        /*newEvent.guild.scheduledEvents.edit({
            //newEvent.stat
        });*/
    });
}
export async function init_events(guild)
{
    /*
    guild.scheduledEvents.cache.each(function(v,i,a) {
        console.log(v.id, v.name);
    });*/

    //return;

    //await cloneEvent(guild, await guild.scheduledEvents.fetch(weeklyDevSessionEventRoot));
    //await cloneEvent(guild, await guild.scheduledEvents.fetch(weeklyStreamEventRoot));
}

async function cloneEvent(guild, evt)
{
    //var evt = await guild.scheduledEvents.fetch(eventID);
    
    //for (let i = 0; i < weeksAhead; i++) {
        var copy = Object.assign({}, evt);
        
        var start = moment(copy.scheduledStartTimestamp);
        var end = moment(copy.scheduledEndTimestamp);
        var newStart = start.add(1, "week");
        var newEnd = end.add(1, "week");

        if (copy.channelId)
            copy.channel = copy.channelId;
        copy.scheduledStartTime = moment(newStart).utcOffset(0).toISOString();
        copy.scheduledEndTime = moment(newEnd).utcOffset(0).toISOString();

        console.log("b", copy.scheduledStartTime);

        await guild.scheduledEvents.create(copy);  
    //}
}