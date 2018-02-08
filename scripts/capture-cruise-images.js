#!/usr/bin/env node

var Path = require('path')
  , Optionall = require('optionall')
  , FS = require('fs')
  , Async = require('async')
  , _ = require('underscore')
  , Belt = require('jsbelt')
  , Moment = require('moment')
  , Reolink = require('../lib/index.js')
;

var O = new Optionall({
                       '__dirname': process.env.rootdir || process.cwd()
                     , 'file_priority': [
                         'package.json'
                       , 'environment.json'
                       , 'credentials.json'
                       , 'config.json'
                       ]
                     });

var GB = _.defaults(O.argv, {
  //host
  //start_id
  //end_id
  //output_path
  'user_name': O.user_name
, 'password': O.password
});

GB['template'] = _.template(GB.output_path + '/' + Moment().format('MM-DD-YYYY-HH-mm') + '-<%= id %>.jpg');

Async.waterfall([
  function(cb){
    GB['reolink'] = new Reolink(GB);

    GB.reolink.Login(Belt.cw(cb, 0));
  }
, function(cb){
    GB.reolink.CaptureCruiseImages({
      'path_template': GB.template
    , 'ptz_ids': _.range(Belt.cast(GB.start_id, 'number'), Belt.cast(GB.end_id, 'number'))
    }, Belt.cw(cb, 0));
  }
], function(err){
  if (err) console.log(err);

  return process.exit(err ? 1 : 0);
});
