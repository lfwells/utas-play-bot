module.exports = {
  apps : [{
        "name": "UTASPlay Bot",
        "script": "discord.js",
        "watch": true,
        "ignore_watch" : ["node_modules", "sessions", "www", "views"],
        "watch_options": {
            "followSymlinks": false
        }
    }]
}