'use strict';

var Reolink = require('../lib/index.js')
  , Async = require('async')
  , Options = require('../config.json')
  , Client = new Reolink(Options)
  , Assert = require('assert')
  , Belt = require('jsbelt')
  , _ = require('underscore')
  , FS = require('fs')
  , gb = {}
;

Async.waterfall([
  function(cb){
    Client.Login(Belt.cw(cb, 0));
  }
, function(cb){
    Assert(Client.__token);

    Client.GetPtzPresets(Belt.cs(cb, gb, 'presets', 1, 0));
  }
, function(cb){
    Assert(_.any(gb.presets));

    gb['ptz'] = _.sample(gb.presets.slice(0, 10));

    Client.MoveToPtzPreset({
      'id': gb.ptz.id
    }, Belt.cw(cb, 0));
  }
, function(cb){
    gb['file'] = '/tmp/' + Belt.uuid() + '.jpg';
    gb['write_stream'] = FS.createWriteStream(gb.file);

    Client.CaptureImage({
      'write_stream': gb.write_stream
    }, Belt.cw(cb, 0));
  }
, function(cb){
    FS.stat(gb.file, Belt.cs(cb, gb, 'stat', 1, 0));
  }
, function(cb){
    Assert(gb.stat);

    gb['dir'] = '/tmp/' + Belt.uuid();

    FS.mkdirSync(gb.dir);

    console.log(gb.dir);

    Client.CaptureCruiseImages({
      'ptz_ids': _.range(1, 15)
    , 'path_template': _.template(gb.dir + '/<%= id %>.jpg')
    }, Belt.cs(cb, gb, 'paths', 1, 0));
  }
, function(cb){
    console.log(Belt.stringify(gb.paths));

    Assert(gb.paths.length === 14);

    cb();
  }
], function(err){
  Assert(!err);
});
