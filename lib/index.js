/*
 * Copyright (c) 2018 Ben Sack
 * Licensed under the MIT license.
 */

var Belt = require('jsbelt')
  , _ = require('underscore')
  , Optionall = require('optionall')
  , Request = require('request')
  , Events = require('events')
  , Async = require('async')
  , FS = require('fs')
;

module.exports = function(O){
  var Opts = O || new Optionall({
                                  '__dirname': process.cwd()
                                , 'file_priority': [
                                    'package.json'
                                  , 'assets.json'
                                  , 'settings.json'
                                  , 'environment.json'
                                  , 'config.json'
                                  , 'credentials.json'
                                  ]
                                });

  var S = new (Events.EventEmitter.bind({}))();
  S.settings = Belt.extend({
    //host
  }, Opts);

  S['Login'] = function(options, callback){
    var a = Belt.argulint(arguments)
      , self = this
      , gb = {};
    a.o = _.defaults(a.o, {
      'host': self.settings.host
    , 'user_name': self.settings.user_name
    , 'password': self.settings.password
    });

    Async.waterfall([
      function(cb){
        Request({
          'url': a.o.host + '/cgi-bin/api.cgi'
        , 'qs': {
            'cmd': 'Login'
          , 'token': 'null'
          }
        , 'method': 'post'
        , 'json': true
        , 'body': [
            {
              'cmd': 'Login'
            , 'action': 0
            , 'param': {
                'User': {
                  'userName': a.o.user_name
                , 'password': a.o.password
                }
              }
            }
          ]
        }, Belt.cs(cb, gb, 'token', 2, '0.value.Token.name', 0));
      }
    , function(cb){
        if (!gb.token) return cb(new Error('Login failed'));

        self['__token'] = gb.token;

        cb();
      }
    ], function(err){
      a.cb(err, gb.token);
    });
  };

  S['GetPtzPresets'] = function(options, callback){
    var a = Belt.argulint(arguments)
      , self = this
      , gb = {};
    a.o = _.defaults(a.o, {
      'host': self.settings.host
    , 'token': self.__token
    });

    Async.waterfall([
      function(cb){
        Request({
          'url': a.o.host + '/cgi-bin/api.cgi'
        , 'qs': {
            'token': a.o.token
          }
        , 'method': 'post'
        , 'json': true
        , 'body': [
            {
              'cmd': 'GetPtzPreset'
            , 'action': 1
            , 'param': {
                'channel': 0
              }
            }
          ]
        }, Belt.cs(cb, gb, 'res', 2, '0.value.PtzPreset', 0));
      }
    ], function(err){
      a.cb(err, gb.res);
    });
  };

  S['MoveToPtzPreset'] = function(options, callback){
    var a = Belt.argulint(arguments)
      , self = this
      , gb = {};
    a.o = _.defaults(a.o, {
      'host': self.settings.host
    , 'token': self.__token
    , 'speed': 32
      //id
    });

    Async.waterfall([
      function(cb){
        Request({
          'url': a.o.host + '/cgi-bin/api.cgi'
        , 'qs': {
            'token': a.o.token
          , 'cmd': 'PtzCtrl'
          }
        , 'method': 'post'
        , 'json': true
        , 'body': [
            {
              'cmd': 'PtzCtrl'
            , 'action': 1
            , 'param': {
                'channel': 0
              , 'op': 'ToPos'
              , 'speed': a.o.speed
              , 'id': a.o.id
              }
            }
          ]
        }, Belt.cs(cb, gb, 'res', 2, '0.value.rspCode', 0));
      }
    , function(cb){
        if (gb.res !== 200) return cb(new Error('Error moving to PTZ preset'));

        cb();
      }
    ], function(err){
      a.cb(err);
    });
  };

  S['CaptureImage'] = function(options, callback){
    var a = Belt.argulint(arguments)
      , self = this
      , gb = {};
    a.o = _.defaults(a.o, {
      'host': self.settings.host
    , 'token': self.__token
      //write_stream
    });

    Async.waterfall([
      function(cb){
        var ocb = _.once(cb);

        Request({
          'url': a.o.host + '/cgi-bin/api.cgi'
        , 'qs': {
            'token': a.o.token
          , 'cmd': 'Snap'
          , 'channel': 0
          }
        , 'method': 'get'
        })
        .on('error', Belt.cw(ocb, 0))
        .on('end', Belt.cw(ocb))
        .pipe(a.o.write_stream);
      }
    ], function(err){
      a.cb(err, a.o.write_stream);
    });
  };

  S['CaptureCruiseImages'] = function(options, callback){
    var a = Belt.argulint(arguments)
      , self = this
      , gb = {};
    a.o = _.defaults(a.o, {
      'host': self.settings.host
    , 'token': self.__token
    , 'delay': 20 * 1000
      //path_template
      //ptz_ids
    });

    Async.waterfall([
      function(cb){
        Async.mapSeries(a.o.ptz_ids, function(i, cb2){
          var path = a.o.path_template(_.extend({}, a.o, {
            'id': i
          })), ws = FS.createWriteStream(path);

          Async.waterfall([
            function(cb3){
              self.MoveToPtzPreset({
                'id': i
              }, Belt.cw(cb3, 0));
            }
          , function(cb3){
              setTimeout(cb3, a.o.delay);
            }
          , function(cb3){
              self.CaptureImage({
                'write_stream': ws
              }, Belt.cw(cb3, 0));
            }
          ], function(err){
            Belt.get(ws, 'close()');

            cb2(err, path);
          });
        }, Belt.cs(cb, gb, 'paths', 1, 0));
      }
    ], function(err){
      a.cb(err, gb.paths);
    });
  };

  return S;
};



if (require.main === module){
  var M = new module.exports();
}
