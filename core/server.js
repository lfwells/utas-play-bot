import * as config from './config.js'; 
import init_routes from './routes.js';

//create a server to listen to requests
import express  from 'express';

export const app = express();

//import basicAuth from 'express-basic-auth';
//import users from "../users.js";
import { loginPage, oauth } from './login.js';

import cors from "cors"; 

import fileUpload from "express-fileupload";

import cookieParser from 'cookie-parser';
import sessions from "express-session";

import ejs from 'ejs';
import path from 'path';

import FileStore from 'session-file-store';

export function init_server()
{
  app.use(cors())

  app.use(cookieParser())
  
  var fs = FileStore(sessions);
  const fileStoreOptions = {};
  const oneDay = 1000 * 60 * 60 * 24;
  app.use(sessions({
      secret: "thisismysecrctekeyfhrgfgrfrty84fwir767",
      saveUninitialized:true,
      store: new fs(fileStoreOptions),
      cookie: { maxAge: oneDay * 90 },
      resave: false 
  }));

  app.use(authHandler);
  /*app.use())*/
  
  app.use(express.json());
  app.use(express.urlencoded({extended:true}));

  //allow file uploads
  app.use(fileUpload({
    useTempFiles : true,
    tempFileDir : '/tmp/'
  }));

  //https://stackoverflow.com/questions/13442377/redirect-all-trailing-slashes-globally-in-express/35927027
  app.use((req, res, next) => {
    if (req.path.substr(-1) === '/' && req.path.length > 1) {
      const query = req.url.slice(req.path.length)
      const safepath = req.path.slice(0, -1).replace(/\/+/g, '/')
      res.redirect(301, safepath + query)
    } else {
      next()
    }
  })
  
  app.engine('.html', ejs.__express);
  
  // Optional since express defaults to CWD/views
  const __dirname = path.resolve(); //todo put in export
  
  app.set('views', path.join(__dirname, 'views')); 
  app.set('view engine', 'html');
  app.use('/static', express.static(path.join(__dirname, 'www')))
  app.use(function(req, res, next) {
    res.locals.query = req.query;
    res.locals.params = req.params;
    res.locals.url   = req.originalUrl;
    res.locals.body   = req.body;
    next();
  });
  app.use(function(req, res, next) {
    res.locals.config = config;
    next();
  });
  
  
  app.get("/testmode/:onoff", (req, res, next) =>
  {
    config.setTestMode(req.params.onoff == "true");
    res.redirect("/");
  });
  
  app.listen(config.__port, () => console.log(`Server running on ${config.__port}...`));
  
  
  //web server routes
  init_routes(app);
}

export async function authHandler (req, res, next)  { 

  if (req.path != "/" && (
    
    req.path.indexOf("obs") >= 0 ||  //TODO: this shouldn't bypass security, it should instead require a secret key (but this will mean we need to update our browser sources etc)

    req.path.indexOf("/login") >= 0 || 
    req.path.indexOf("/loginComplete") >= 0 || 
    req.path.indexOf("/guide") >= 0 || 
    req.path.indexOf("/text") >= 0 || 
    req.path.indexOf("/text/latest") || 
    req.path.indexOf("/poll") >= 0 || 
    req.path.indexOf("/recordProgress") >= 0 || 
    req.path.indexOf("/recordSectionProgress") >= 0 || 
    req.path.endsWith(".js") || 
    req.path.endsWith(".css") || 
    req.path.endsWith(".ico")|| 
    req.path.indexOf("/static") === 0)) {
    //console.log("skipping auth to allow polls to work", req.path);

    //store some basic discord info (but in this case, don't error)
    try
    {
      req.discordUser = await oauth.getUser(req.session.auth.access_token);
      res.locals.discordUser = req.discordUser;
    }
    catch (DiscordHTTPError) { }

    next();
  } 
  else 
  {
    //console.log("challenge:", req.path);
    //console.log(("auth check"), req.session);
    if (req.session == undefined || req.session.auth == undefined)
    {
      loginPage(req,res);
    }
    else
    {
      //store some basic discord info
      try
      {
        req.discordUser = await oauth.getUser(req.session.auth.access_token);
        res.locals.discordUser = req.discordUser;
      }
      catch (DiscordHTTPError) {
        console.log("caught discord http error");
        return loginPage(req,res);
      }
      //console.log(req.discordUser);

      //basicAuth(users)(req, res, next);
      next();
    }
  }
}

export function beginStreamingRes(res)
{
   //stream the content thru
  //should have used a websocket or something but meh
  //just call res.write after this, and it will stream to browser
  //after calling this, write messages with res.write(str);
  //and finish it all up with res.end();

  res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'X-Content-Type-Options': 'nosniff'});
  return res;
}

export function renderErrorPage(message)
{
  return function (req,res,next)
  {
    res.render("error", {
      error: message
    });
  };
}

export function renderEJS(page, options)
{
  return function (req,res,next) {
    res.render(page, options);
  };
}