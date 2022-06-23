import crypto from 'crypto';
import { oauth } from '../_oauthDiscord.js';

const scope = ["identify", "guilds", "email"];


export async function createOAuthLink()
{
    const url = oauth.generateAuthUrl({
        scope: scope, 
        state: crypto.randomBytes(16).toString("hex"), // Be aware that randomBytes is sync if no callback is provided
    });

    console.log(url);
}

export async function loginPage(req,res)
{
    const url = oauth.generateAuthUrl({
        scope: scope, 
        state: crypto.randomBytes(16).toString("hex"), // Be aware that randomBytes is sync if no callback is provided
    });

    //console.log(url);  
    res.render('login', { url: url });//TODO: redirect url within the site??
}
export async function loginComplete(req,res)
{
    //console.log(req.query);

    var auth = await oauth.tokenRequest({
        code: req.query.code,
        scope: scope,
        grantType: "authorization_code",
    });
    //console.log(auth);
    var session = req.session;
    session.auth = auth;
    //console.log("saving auth to session", req.session);
    //await authHandler(true)(req,res, function() {}); //forceAuth = true is used to ensure req.discordUser gets populated
//    guildList(req,res);
    res.redirect("/");

}


export async function logout(req,res)
{
    req.session.auth = null;
    res.redirect("/");
}