'use strict';

var express = require('express');
var mongo = require('mongodb');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var dns = require('dns');
var cors = require('cors');

var app = express();

// Basic Configuration 
var port = process.env.PORT || 3000;

/** this project needs a db !! **/ 
mongoose.connect(process.env.MONGO_URI);

app.use(cors());

/** this project needs to parse POST bodies **/
// you should mount the body-parser here
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json());

app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', function(req, res){
  res.sendFile(process.cwd() + '/views/index.html');
});

  
// your first API endpoint... 
app.get("/api/hello", function (req, res) {
  res.json({greeting: 'hello API'});
});


var Schema = mongoose.Schema;
var availableTinyUrlSchema = new Schema({
  tinyUrl: {type: String, required: true}
})

var AvailableTinyUrl = mongoose.model('AvailableTinyUrl', availableTinyUrlSchema);

/*
Initialize the Mongo db with the available tinyUrls
Using base62 encoding, a 6 letters long key would result in 62^6 = ~56.8 billion possible strings
*/
app.get('/init', function(req, res) {
  var urls = [];
  var BASE_62_VALUES = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  var base = 62;
  for(var i = 0; i < 1000; i++) {
    var num = i;
    if(num == 0) {
      var url = AvailableTinyUrl({tinyUrl: BASE_62_VALUES.charAt(0)});
      urls.push(url);
      continue;
    }
    var result = "";
    while(num > 0) {
      var r = num % base
      result = BASE_62_VALUES.charAt(r) + result;
      num = Math.floor(num / base); 
    }  
    var url = AvailableTinyUrl({tinyUrl: result});
    urls.push(url);
  }
  console.log(urls);
  AvailableTinyUrl.create(urls, function(err, data) {
    if(err) return res.json(err);
    res.json(data);
  });
});

var urlsDbSchema = new Schema({
  short_url: {type: String, required: true},
  original_url: {type: String, required: true}
})
var validUrl = require('valid-url');

var UsedTinyUrl = mongoose.model('UsedTinyUrl', urlsDbSchema);
app.post("/api/shorturl/new", function(req, res) {
  var userUrl = req.body.url;
  var invalidUrl = false;
  
  if (!validUrl.isUri(userUrl)){
    res.json({"error":"invalid URL"});
    return;
  } 
  AvailableTinyUrl.count().exec(function (err, count) {
    // Get a random entry
    var random = Math.floor(Math.random() * count)
    // Again query all tinyUrls but only fetch one offset by our random #
    AvailableTinyUrl.findOne().skip(random).exec(
      function (err, result) {
        // Tada! random tinyUrl
        console.log(result) 
        var usedTinyUrlDoc = UsedTinyUrl({short_url: result.tinyUrl, original_url: req.body.url}) 
        usedTinyUrlDoc.save(function(err, data) {
          if(err) console.log(err);
        })
        AvailableTinyUrl.remove(result, function(err, data) {
          if(err) console.log(err);
        })
        res.json({"original_url": req.body.url, "short_url": result.tinyUrl})
    })
  })
})

app.get("/api/shorturl/:short_url", function(req, res) {
  var short_url = req.params.short_url;
  UsedTinyUrl.find({short_url: short_url}, function(err, tinyUrl) {
    console.log(tinyUrl);
    res.status(301).redirect(tinyUrl[0].original_url);
  })
})

app.listen(port, function () {
  console.log('Node.js listening ...');
});
  