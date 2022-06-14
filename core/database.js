import admin from "firebase-admin"; 

//var serviceAccount = require(path.join(__dirname, "partygolflite-firebase-adminsdk-dfc3p-8e78d63026.json"));
import serviceAccount from '../carers-care-service-account.js';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  //databaseURL: "https://partygolflite.firebaseio.com"
  databaseURL: "https://carers-care.firebaseio.com"
});

export const db = admin.firestore(); 
export const guildsCollection = db.collection("guilds_utasplay");
export async function init_db(){}
export async function transfer(){}

export function momentToTimestamp(momentObj)
{
  return admin.firestore.Timestamp.fromDate(momentObj.toDate());
}
/*
export const db2 = admin.firestore(); 
export const guildsCollection2 = db2.collection("guilds");

import { MongoClient, Collection } from "mongodb";
import { getGuildDocument } from "../guild/guild.js";

const uri = "mongodb://localhost:27017/?retryWrites=true&writeConcern=majority";
export const client = new MongoClient(uri);
export var db;
export var guildsCollection;
export async function init_db()
{
    await client.connect();
    db = client.db('local');
    guildsCollection = db.collection('guilds');
}

Collection.prototype.doc = async function(docID) {
  var collection = this;
  var t;
  if (docID)
  {
    t = await this.findOne({"_id": docID});
    if (t == null) 
    {
      var result = await this.insertOne({"_id": docID});
      t = await collection.doc(result.insertedId);
      return handleResult(t, collection, result.insertedId); 
    }
  }
  else
  {
    var result = await this.insertOne({});
    t = await collection.doc(result.insertedId);
    return handleResult(t, collection, result.insertedId); 
  }

  return handleResult(t, collection, docID); 
};
Collection.prototype.get = async function(docID) {
  var collection = this;
  var results = await this.find();
  results.forEach(t => {
    handleResult(t, collection, t._id);
  });
return results;
};

function handleResult(t, collection, docID)
{
  t.get = async function(field) 
  { 
    var snap = { v: this[field], get:async function() { 
      return this.v;
    }}
    return snap; 
  };
  t.set = async function(doc, opts)
  {
    if (opts && opts.merge)
    {
      var result = await collection.updateOne({"_id":docID}, {$set:doc}); 
    }
    else
    {
     await collection.replaceOne({"_id":docID}, doc); 
    }
    return await collection.doc(docID);
  };
  t.update = async function(doc)
  {
    return await this.set(doc, { merge: true });
  };
  t.collection = function(collectionName)
  {
    return db.collection(this.name+"_"+collectionName);
  }
  return t;
}

export async function transfer(id)
{
  return; //hiding this away now, it was a once-off

  var db2 = admin.firestore(); 
  var guildsCollection2 = db2.collection("guilds");
  var guildDoc2 = guildsCollection2.doc(id);
  var goog = await guildDoc2.get();

  var guildDoc =  (await getGuildDocument(id));
  guildDoc.update(goog.data());
 
 await transferSubCollection("analytics", guildDoc, guildDoc2);
 await transferSubCollection("analytics_history", guildDoc, guildDoc2);
 await transferSubCollection("attendance", guildDoc, guildDoc2);
 await transferSubCollection("audit", guildDoc, guildDoc2);
 await transferSubCollection("lecture-text", guildDoc, guildDoc2);
 await transferSubCollection("polls", guildDoc, guildDoc2);
 await transferSubCollection("invites", guildDoc, guildDoc2);
 await transferSubCollection("progress", guildDoc, guildDoc2);
 await transferSubCollection("section_progress", guildDoc, guildDoc2);
}

async function transferSubCollection(subcollection, guildDoc, guildDoc2)
{
  var analyticsTable = await guildDoc2.collection(subcollection).get();
  await Promise.all(analyticsTable.docs.map(async (element) => {
   var d = await guildDoc.collection(subcollection).doc();  
   d = await d.update(element.data()); 
  }));
}
*/