/*!
 * Playdar.js JavaScript client library
 * http://www.playdarjs.org/
 *
 * Copyright (c) 2009 James Wheare
 * Distributed under the terms of the BSD licence
 * http://www.playdarjs.org/LICENSE
 */
Playdar = {
    VERSION: "0.6.0",
    SERVER_ROOT: "localhost",
    SERVER_PORT: "60210",
    STATIC_HOST: "http://www.playdar.org",
    STAT_TIMEOUT: 2000,
    AUTH_COOKIE_NAME: "Playdar.Auth",
    AUTH_POPUP_NAME: "Playdar.AuthPopup",
    AUTH_POPUP_SIZE: {
        'w': 500,
        'h': 260
    },
    MAX_POLLS: 4,
    MAX_CONCURRENT_RESOLUTIONS: 5,
    USE_STATUS_BAR: true,
    USE_SCROBBLER: true,
    USE_JSONP: true,
    USE_WEBSOCKETS: false,
    USE_COMET: false,
    
    client: null,
    statusBar: null,
    player: null,
    auth_details: {
        name: window.document.title,
        website: window.location.protocol + '//' + window.location.host + '/'
    },
    nop: function () {},
    setupClient: function (listeners) {
        new Playdar.Client(listeners);
    },
    setupPlayer: function (soundmanager, url, onready, options) {
        new Playdar.SM2Player(soundmanager, url, onready, options);
    },
    beforeunload: function (e) {
        if (Playdar.player) {
            var sound = Playdar.player.getNowPlaying();
            if (sound && sound.playState == 1 && !sound.paused) {
                var confirmation = "The music will stop if you leave this page.";
                e.returnValue = confirmation;
                return confirmation;
            }
        }
    },
    unload: function (e) {
        if (Playdar.player) {
            Playdar.player.stop_current(true);
        } else if (Playdar.scrobbler) {
            Playdar.scrobbler.stop(true);
        }
    }
};

Playdar.DefaultListeners = {
    onStartStat: Playdar.nop,
    onStat: Playdar.nop,
    onStartManualAuth: Playdar.nop,
    onAuth: Playdar.nop,
    onAuthClear: Playdar.nop,
    onCancelResolve: Playdar.nop,
    onResults: Playdar.nop,
    onResolveIdle: Playdar.nop
};

Playdar.Client = function (listeners) {
    Playdar.client = this;

    this.auth_token = false;
    this.authPopup = null;

    this.wsclient = null;
    this.comet_id = null;

    this.listeners = {};
    this.resultsCallbacks = {};

    this.resolveQids = [];
    this.lastQid = "";
    this.pollCounts = {};

    this.initialiseResolve();

    this.register_listeners(Playdar.DefaultListeners);
    this.register_listeners(listeners);

    this.uuid = Playdar.Util.generate_uuid();
};
Playdar.Client.prototype = {
    register_listener: function (event, callback) {
        callback = callback || Playdar.nop;
        this.listeners[event] = function () { return callback.apply(Playdar.client, arguments); };
    },
    register_listeners: function (listeners) {
        if (!listeners) {
            return;
        }
        for (var event in listeners) {
            this.register_listener(event, listeners[event]);
        }
        return true;
    },
    register_results_handler: function (handler, qid) {
        if (qid) {
            this.resultsCallbacks[qid] = handler;
        } else {
            this.register_listener('onResults', handler);
        }
    },


    go: function () {
        if (!this.is_authed()) {
            this.auth_token = Playdar.Util.getCookie(Playdar.AUTH_COOKIE_NAME);
        }
        this.stat();
    },

    stat: function (postAuth) {
        this.statResponse = null;
        if (!postAuth) {
            this.listeners.onStartStat();
        }
        setTimeout(function () {
            Playdar.client.onStatTimeout();
        }, Playdar.STAT_TIMEOUT);
        Playdar.Util.loadJs(this.getUrl("stat", {}, "handleStat"));
    },
    isAvailable: function () {
        return this.statResponse && this.statResponse.name == "playdar";
    },
    onStatTimeout: function () {
        if (!this.isAvailable()) {
            this.listeners.onStat(false);
        }
    },
    handleStat: function (response) {
        // call this once stat is setup ok:
        var that = this; // for closure
        var statted = function()
        {
          that.statResponse = response;
          
          if (Playdar.USE_STATUS_BAR) {
              new Playdar.StatusBar();
              Playdar.statusBar.handleStat(response);
          }
          that.listeners.onStat(response);
          
          if (response.authenticated) {
              if (!Playdar.scrobbler && Playdar.USE_SCROBBLER && response.capabilities.audioscrobbler) {
              new Playdar.Scrobbler();
              }
              that.listeners.onAuth();
          } else if (that.is_authed()) {
              that.clearAuth();
          }
        };
        
        // If USE_WEBSOCKETS is true, but websocket setup fails, make the stat fail too.
        if(Playdar.USE_WEBSOCKETS)
        {
          var pldr = this;
          new Playdar.WSClient();
          Playdar.wsclient.onConnected = function(){statted();};
          Playdar.wsclient.onMessage = function(m)
          {
            var j = JSON.parse(m);
            switch(j.method)
            {
              case 'results':
            //alert(m);
            pldr.handleResultsCallback(j,null);
            break;
            }
          };
          Playdar.wsclient.onClose = function(){alert('closed');};
          // TODO WS setup timeout should trigger stat timeout:
          Playdar.wsclient.connect();
          return;
        } else {
          if(Playdar.USE_COMET)
          {
            this.comet_id = 'xxxx';//Playdar.Util.generate_uuid();
            var req = {
                method: 'comet',
                id:     this.comet_id,
                jsonp:  'parent.myalert'
            };
            Playdar.Util.loadIframe( this.getBaseUrl('/api', req) );
          }
          // No websockets? just complete the stat now:
          statted();
        }
    },
    
    clearAuth: function () {
        if (Playdar.scrobbler) {
            Playdar.scrobbler.stop(true);
        }
        Playdar.Util.loadJs(this.getRevokeUrl());
        this.auth_token = false;
        Playdar.Util.deleteCookie(Playdar.AUTH_COOKIE_NAME);
        this.cancel_resolve();
        this.stat();
        this.listeners.onAuthClear();
        if (Playdar.statusBar) {
            Playdar.statusBar.offline();
        }
    },
    is_authed: function () {
        if (!Playdar.USE_JSONP) {
            return true;
        }
        if (this.auth_token) {
            return true;
        }
        return false;
    },
    getAuthUrl: function () {
        return this.getBaseUrl("/auth_1/", Playdar.auth_details);
    },
    getRevokeUrl: function () {
        return this.getBaseUrl("/authcodes", {
            revoke: this.auth_token
        });
    },
    get_stat_link_html: function (title) {
        title = title || "Retry";
        var html = '<a href="#"'
            + ' onclick="Playdar.client.go(); return false;'
            + '">' + title + '</a>';
        return html;
    },
    get_auth_link_html: function (title) {
        title = title || "Connect";
        var html = '<a href="' + this.getAuthUrl()
            + '" target="' + Playdar.AUTH_POPUP_NAME
            + '" onclick="Playdar.client.start_auth(); return false;'
        + '">' + title + '</a>';
        return html;
    },
    get_disconnect_link_html: function (text) {
        text = text || "Disconnect";
        var html = '<a href="' + this.getRevokeUrl()
            + '" onclick="Playdar.client.clearAuth(); return false;'
        + '">' + text + '</a>';
        return html;
    },
    start_auth: function () {
        if (!this.authPopup || this.authPopup.closed) {
            this.authPopup = window.open(
                this.getAuthUrl(),
                Playdar.AUTH_POPUP_NAME,
                Playdar.Util.getPopupOptions(Playdar.AUTH_POPUP_SIZE)
            );
        } else {
            this.authPopup.focus();
        }
        if (!Playdar.auth_details.receiverurl) {
            this.listeners.onStartManualAuth();
            if (Playdar.statusBar) {
                Playdar.statusBar.startManualAuth();
            }
        }
    },

    auth_callback: function (token) {
        Playdar.Util.setCookie(Playdar.AUTH_COOKIE_NAME, token, 365);
        if (this.authPopup && !this.authPopup.closed) {
            this.authPopup.close();
            this.authPopup = null;
        }
        this.auth_token = token;
        this.stat(true);
    },
    manualAuthCallback: function (input_id) {
        var input = document.getElementById(input_id);
        if (input && input.value) {
            this.auth_callback(input.value);
        }
    },

    autodetect: function (callback, context) {
        if (!this.is_authed()) {
            return false;
        }
        var qid, i, j, list, track;
        try {
            var mf = Playdar.Parse.microformats(context);
            var rdfa = Playdar.Parse.rdfa(context);
            var data = mf.concat(rdfa);
            for (i = 0; i < data.length; i++) {
                list = data[i];
                for (j = 0; j < list.tracks.length; j++) {
                    track = list.tracks[j];
                    if (callback) {
                        qid = callback(track);
                    }
                    this.resolve(track.artist, track.title, track.album, qid);
                }
            }
            return data;
        } catch (error) {
            console.warn(error);
        }
    },

    resolve: function (artist, track, album, qid, results) {
        if (!this.is_authed()) {
            return false;
        }
        qid = qid || Playdar.Util.generate_uuid();
        var query = {
            artist: artist || '',
            album: album || '',
            track: track || '',
            qid: qid,
            results: results
        };
        if(Playdar.USE_COMET) query.comet = this.comet_id;
        if (Playdar.player) {
            query.mimetypes = Playdar.player.getMimeTypes().join(',');
        }
        if (Playdar.statusBar) {
            Playdar.statusBar.incrementRequests();
        }
	if(Playdar.USE_WEBSOCKETS)
	{
	  query.method = "resolve";
	  Playdar.wsclient.send(JSON.stringify(query));
	} else {
	  this.resolutionQueue.push(query);
	  this.processResolutionQueue();
        }
	return qid;
    },
    processResolutionQueue: function() {
        if (this.resolutionsInProgress.count >= Playdar.MAX_CONCURRENT_RESOLUTIONS) {
            return false;
        }
        var resolution_count = this.resolutionQueue.length + this.resolutionsInProgress.count;
        if (resolution_count) {
            var available_resolution_slots = Playdar.MAX_CONCURRENT_RESOLUTIONS - this.resolutionsInProgress.count;
            for (var i = 1; i <= available_resolution_slots; i++) {
                var query = this.resolutionQueue.shift();
                if (!query) {
                    break;
                }
                this.resolutionsInProgress.queries[query.qid] = query;
                this.resolutionsInProgress.count++;
                Playdar.Util.loadJs(this.getUrl("resolve", query, "handleResolution"));
            }
        } else {
            this.listeners.onResolveIdle();
        }
    },
    cancel_resolve: function () {
        this.initialiseResolve();
        this.listeners.onResolveIdle();
        this.listeners.onCancelResolve();
        if (Playdar.statusBar) {
            Playdar.statusBar.cancelResolve();
        }
    },
    initialiseResolve: function () {
        this.resolutionQueue = [];
        this.resolutionsInProgress = {
            count: 0,
            queries: {}
        };
    },
    recheck_results: function (qid) {
        var query = {
            qid: qid
        };
        this.resolutionsInProgress.queries[qid] = query;
        this.resolutionsInProgress.count++;
        this.handleResolution(query);
    },
    handleResolution: function (query) {
        if (this.resolutionsInProgress.queries[query.qid]) {
            this.lastQid = query.qid;
            this.resolveQids.push(this.lastQid);
            this.getResults(query.qid);
        }
    },

    getResults: function (qid) {
        if (this.resolutionsInProgress.queries[qid]) {
            return this.getResultsPoll(qid);
        }
    },
    getResultsPoll: function (qid) {
        if (!this.pollCounts[qid]) {
            this.pollCounts[qid] = 0;
        }
        this.pollCounts[qid]++;
        Playdar.Util.loadJs(this.getUrl("get_results", {
            qid: qid,
            poll: this.pollCounts[qid]
        }, "handleResults"));
    },
    getResultsLong: function (qid) {
        Playdar.Util.loadJs(this.getUrl("get_results_long", {
            qid: qid
        }, "handleResultsLong"));
    },
    pollResults: function (response, callback, scope) {
        var final_answer = this.shouldStopPolling(response);
        scope = scope || this;
        if (!final_answer) {
            setTimeout(function () {
                callback.call(scope, response.qid);
            }, response.poll_interval);
        }
        return final_answer;
    },
    shouldStopPolling: function (response) {
        if (response.poll_interval <= 0) {
            return true;
        }
        if (response.solved === true) {
            return true;
        }
        if (this.pollCounts[response.qid] >= (response.poll_limit || Playdar.MAX_POLLS)) {
            return true;
        }
        return false;
    },
    handleResultsCallback: function (response, final_answer) {
        if (this.resultsCallbacks[response.qid]) {
            this.resultsCallbacks[response.qid](response, final_answer);
        } else {
            this.listeners.onResults(response, final_answer);
        }
    },
    handleResults: function (response) {
        if (this.resolutionsInProgress.queries[response.qid]) {
            var final_answer = this.pollResults(response, this.getResults);
            if (Playdar.statusBar) {
                Playdar.statusBar.handleResults(response, final_answer);
            }
            this.handleResultsCallback(response, final_answer);
            if (final_answer) {
                delete this.resolutionsInProgress.queries[response.qid];
                this.resolutionsInProgress.count--;
                this.processResolutionQueue();
            }
        }
    },
    handleResultsLong: function (response) {
        if (this.resolutionsInProgress.queries[response.qid]) {
            if (Playdar.statusBar) {
                Playdar.statusBar.handleResults(response, true);
            }
            if (this.resultsCallbacks[response.qid]) {
                this.resultsCallbacks[response.qid](response, true);
            } else {
                this.listeners.onResults(response, true);
            }
            delete this.resolutionsInProgress.queries[response.qid];
            this.resolutionsInProgress.count--;
            this.processResolutionQueue();
        }
    },
    get_last_results: function () {
        if (this.lastQid) {
            if (Playdar.statusBar) {
                Playdar.statusBar.incrementRequests();
            }
            this.getResults(this.lastQid);
        }
    },


    getBaseUrl: function (path, query_params) {
        var url = "http://" + Playdar.SERVER_ROOT + ":" + Playdar.SERVER_PORT;
        if (path) {
            url += path;
        }
        if (query_params) {
            url += '?' + Playdar.Util.toQueryString(query_params);
        }
        return url;
    },

    getUrl: function (method, query_params, callback) {
        query_params = query_params || {};
        query_params.call_id = new Date().getTime();
        query_params.method = method;
        this.addAuthToken(query_params);
        if (Playdar.USE_JSONP) {
            callback = callback ? ("Playdar.client." + callback) : "Playdar.nop";
            query_params.jsonp = callback;
            return this.getBaseUrl("/api/", query_params);
        } else {
            var onLoad = Playdar.nop;
            if (callback) {
                onLoad = function () {
                    Playdar.client[callback].apply(Playdar.client, arguments);
                };
            }
            return [this.getBaseUrl("/api/", query_params), onLoad];
        }
    },

    addAuthToken: function (query_params) {
        if (this.is_authed()) {
            query_params.auth = this.auth_token;
        }
        return query_params;
    },

    get_stream_url: function (sid) {
        return this.getBaseUrl("/sid/" + sid);
    }
};
Playdar.Scrobbler = function () {
    Playdar.scrobbler = this;
};
Playdar.Scrobbler.prototype = {
    getUrl: function (method, query_params, callback) {
        query_params = query_params || {};
        query_params.call_id = new Date().getTime();
        Playdar.client.addAuthToken(query_params);
        if (Playdar.USE_JSONP) {
            callback ? ("Playdar.scrobbler." + callback) : "Playdar.nop";
            query_params.jsonp = callback;
            return Playdar.client.getBaseUrl("/audioscrobbler/" + method, query_params);
        } else {
            var onLoad = Playdar.nop;
            if (callback) {
                onLoad = function () {
                    Playdar.scrobbler[callback].apply(Playdar.scrobbler, arguments);
                };
            }
            return [Playdar.client.getBaseUrl("/audioscrobbler/" + method, query_params), onLoad];
        }
    },

    start: function (artist, track, album, duration, track_number, mbid) {
        var query_params = {
            a: artist,
            t: track,
            o: 'P'
        };
        if (album) {
            query_params['b'] = album;
        }
        if (duration) {
            query_params['l'] = duration;
        }
        if (track_number) {
            query_params['n'] = track_number;
        }
        if (mbid) {
            query_params['m'] = mbid;
        }
        Playdar.Util.loadJs(this.getUrl("start", query_params));
    },
    stopCallback: function () {
        this.stopping = false;
    },
    stop: function (sleep) {
        this.stopping = true;
        Playdar.Util.loadJs(this.getUrl("stop"), {}, "stopCallback");
        if (sleep) {
            Playdar.Util.sleep(100, function () {
                return Playdar.scrobbler.stopping == false;
            });
        }
    },
    pause: function () {
        Playdar.Util.loadJs(this.getUrl("pause"));
    },
    resume: function () {
        Playdar.Util.loadJs(this.getUrl("resume"));
    },
    getSoundCallbacks: function (result) {
        var scrobbler = this;
        return {
            onplay: function () {
                this.scrobbleStart = true;
            },
            onpause: function () {
                scrobbler.pause();
            },
            onresume: function () {
                scrobbler.resume();
            },
            onfinish: function () {
                if (!this.options.chained) {
                    scrobbler.stop();
                }
            },
            whileplaying: function () {
                if (this.scrobbleStart) {
                    this.scrobbleStart = false;
                    var durationEstimate = Math.floor(this.durationEstimate/1000);
                    if (durationEstimate < 30) {
                        durationEstimate = 31;
                    }
                    var duration = result.duration || durationEstimate;
                    scrobbler.start(result.artist, result.track, result.album, duration);
                }
            }
        };
    }
};
Playdar.SM2Player = function (soundmanager, swfUrl, onready, options) {
    Playdar.player = this;

    this.results = {};
    this.nowplayingid = null;

    if (typeof soundmanager == 'string') {
        SM2_DEFER = true;
        Playdar.Util.loadJs(soundmanager, 'SoundManager', function (SoundManager) {
            soundManager = new SoundManager();
            Playdar.player.setupSoundmanager(soundManager, swfUrl, onready, options);
        });
    } else {
        Playdar.player.setupSoundmanager(soundmanager, swfUrl, onready, options);
    }
};

Playdar.SM2Player.DefaultOptions = {
    flashVersion: 9,
    useMovieStar: true,
    consoleOnly: true,
    debugMode: false,
    flashLoadTimeout: 0
};

Playdar.SM2Player.MIMETYPES = {
    "audio/mpeg": false,
    "audio/aac": true,
    "audio/x-aac": true,
    "audio/mp4": true,
    "audio/m4a": true,
    "audio/x-m4a": true,
    "audio/x-m4b": true,
    "video/mp4": true,
    "video/mov": true,
    "video/quicktime": true,
    "video/flv": true,
    "video/m4v": true,
    "video/x-m4v": true,
    "video/mp4v": true,
    "video/f4v": true,
    "video/3gp": true,
    "video/3g2": true
};
Playdar.SM2Player.prototype = {
    setupSoundmanager: function (soundmanager, swfUrl, onready, options) {
        this.soundmanager = soundmanager;
        options = options || {};
        options.url = swfUrl;
        var k;
        for (k in Playdar.SM2Player.DefaultOptions) {
            options[k] = options[k] || Playdar.SM2Player.DefaultOptions[k];
        }
        for (k in options) {
            this.soundmanager[k] = options[k];
        }
        if (onready) {
            this.soundmanager.onready(onready);
        }
        this.soundmanager.beginDelayedInit();
    },
    getMimeTypes: function () {
        var mime_types = [];
        for (var type in Playdar.SM2Player.MIMETYPES) {
            mime_types.push(type);
        }
        return mime_types;
    },
    register_stream: function (result, options) {
        options = options || {};
        if (!result.sid) {
            result.sid = Playdar.Util.generate_uuid();
            options.external = true;
        }
        if (this.results[result.sid]) {
            return false;
        }
        this.results[result.sid] = result;

        var url = options.external ? result.url : Playdar.client.get_stream_url(result.sid);
        var isMp3 = url.match(this.soundmanager.filePatterns.flash8);
        var isNetStream = url.match(this.soundmanager.netStreamPattern);
        var isMovieStar;
        if (isMp3) {
            isMovieStar = false;
        } else {
            isMovieStar = (isNetStream ? true : false) || Playdar.SM2Player.MIMETYPES[result.mimetype];
        }

        var sound_options = Playdar.Util.extendObject({
            id: 's_' + result.sid,
            url: url,
            isMovieStar: isMovieStar,
            useVideo: true,
            bufferTime: 2
        }, options);

        var callbackOptions = [options];
        if (Playdar.statusBar) {
            callbackOptions.push(Playdar.statusBar.getSoundCallbacks(result));
        }
        if (Playdar.scrobbler) {
            callbackOptions.push(Playdar.scrobbler.getSoundCallbacks(result));
        }
        Playdar.Util.extendObject(sound_options, Playdar.Util.mergeCallbackOptions(callbackOptions));
        try {
            var sound = this.soundmanager.createSound(sound_options);
        } catch (e) {
            return false;
        }
        return sound;
    },
    play_stream: function (sid) {
        var sound = this.getSound(sid);
        if (this.nowplayingid != sid) {
            this.stop_current();
            if (sound.playState === 0) {
                this.nowplayingid = sid;
                if (Playdar.statusBar) {
                    Playdar.statusBar.playHandler(this.results[sid]);
                }
            }
        }

        sound.togglePause();
        return sound;
    },
    stop_current: function (hard) {
        if (hard) {
            if (Playdar.scrobbler) {
                Playdar.scrobbler.stop();
            }
        }
        var nowPlaying = this.getNowPlaying();
        if (nowPlaying) {
            if (nowPlaying.playState == 1) {
                nowPlaying.stop();
            }
            nowPlaying.unload();
            this.nowplayingid = null;
        }
        if (Playdar.statusBar) {
            Playdar.statusBar.stopCurrent();
        }
    },
    stop_stream: function (sid) {
        if (sid && sid == this.nowplayingid) {
            this.stop_current();
            return true;
        }
        return false;
    },
    is_now_playing: function () {
        if (this.nowplayingid) {
            return true;
        }
        return false;
    },
    getNowPlaying: function () {
        if (this.nowplayingid) {
            return this.getSound(this.nowplayingid);
        }
    },
    getSound: function (sid) {
        return this.soundmanager.getSoundById('s_' + sid);
    },
    toggle_nowplaying: function () {
        if (this.nowplayingid) {
            this.play_stream(this.nowplayingid);
        }
    }
};
Playdar.PlaydarPlayer = function () {
    Playdar.player = this;

    this.sounds = {};
    this.nowplayingid = null;
};

Playdar.PlaydarPlayer.MIMETYPES = {
    "audio/mpeg": false,
    "audio/aac": true,
    "audio/x-aac": true,
    "audio/flv": true,
    "audio/mov": true,
    "audio/mp4": true,
    "audio/m4v": true,
    "audio/f4v": true,
    "audio/m4a": true,
    "audio/x-m4a": true,
    "audio/x-m4b": true,
    "audio/mp4v": true,
    "audio/3gp": true,
    "audio/3g2": true
};
Playdar.PlaydarPlayer.BaseCallbacks = {
    onload: Playdar.nop,
    onplay: Playdar.nop,
    onpause: Playdar.nop,
    onresume: Playdar.nop,
    onstop: Playdar.nop,
    onfinish: Playdar.nop,
    whileloading: Playdar.nop,
    whileplaying: Playdar.nop
};
Playdar.PlaydarPlayer.prototype = {
    getMimeTypes: function () {
        var mime_types = [];
        for (var type in Playdar.PlaydarPlayer.MIMETYPES) {
            mime_types.push(type);
        }
        return mime_types;
    },
    register_stream: function (result, callbacks) {
        if (this.sounds[result.sid]) {
            return false;
        }

        callbacks = callbacks || {};
        var callbackOptions = [callbacks];
        callbackOptions.push(Playdar.PlaydarPlayer.BaseCallbacks);
        if (Playdar.statusBar) {
            callbackOptions.push(Playdar.statusBar.getSoundCallbacks(result));
        }
        if (Playdar.scrobbler) {
            callbackOptions.push(Playdar.scrobbler.getSoundCallbacks(result));
        }
        Playdar.Util.extendObject(callbacks, Playdar.Util.mergeCallbackOptions(callbackOptions));
        var player = this;
        var sound = {
            sID: 's_' + result.sid,
            result: result,
            callbacks: callbacks,
            /*
            Numeric value indicating a sound's current load status
            0 = uninitialised
            1 = loading
            2 = failed/error
            3 = loaded/success
            */
            readyState: 0,
            /*
            Numeric value indicating the current playing state of the sound.
            0 = stopped/uninitialised
            1 = playing or buffering sound (play has been called, waiting for data etc.)
            Note that a 1 may not always guarantee that sound is being heard, given buffering and autoPlay status.
            */
            playState: 0,
            togglePause: function () {
                player.togglePause(result.sid);
            },
            setPosition: function (position) {
                player.setPosition(result.sid, position);
            },
            stop: function (onUnload) {
                player.stop(result.sid, onUnload);
            },
            playCallback: function (json) {
                if (json.response == 'ok') {
                    this.playState = 1;
                    this.readyState = 3;
                    Playdar.player.nowplayingid = this.sID;
                    if (Playdar.statusBar) {
                        Playdar.statusBar.playHandler(this.result);
                    }
                    this.callbacks.onplay.call(this);
                } else {
                    this.readyState = 2;
                }
                this.callbacks.onload.call(this);
            },
            stopCallback: function (status) {
                this.playState = 0;
                this.readyState = 0;
                Playdar.player.nowplayingid = null;
                this.callbacks.onstop.call(this);
            },
            togglePauseCallback: function (json) {
                this.playState = this.playState ? 0 : 1;
                if (this.playState === 1) {
                    this.callbacks.onresume.call(this);
                } else {
                    this.callbacks.onpause.call(this);
                }
            },
            unload: Playdar.nop,
            chained: false // TODO, allow options to override. Figure out options/callbacks
        };
        this.sounds[result.sid] = sound;
        return sound;
    },
    play_stream: function (sid) {
        var sound = this.sounds[sid];
        if (this.nowplayingid != sid) {
            this.stop_current();
        }

        sound.togglePause();
        return sound;
    },
    stop_current: function (hard) {
        if (hard) {
            if (Playdar.scrobbler) {
                Playdar.scrobbler.stop();
            }
        }
        if (Playdar.statusBar) {
            Playdar.statusBar.stopCurrent();
        }
        var sound = this.getNowPlaying();
        if (sound) {
            sound.stop(hard);
        }
    },
    stop_stream: function (sid) {
        if (sid && sid == this.nowplayingid) {
            this.stop_current();
            return true;
        }
        return false;
    },
    is_now_playing: function () {
        if (this.nowplayingid) {
            return true;
        }
        return false;
    },
    getNowPlaying: function () {
        if (this.nowplayingid) {
            return this.sounds[this.nowplayingid];
        }
    },
    toggle_nowplaying: function () {
        if (this.is_now_playing()) {
            this.play_stream(this.nowplayingid);
        }
    },
    /* API methods */
    getUrl: function (method, query_params) {
        query_params = query_params || {};
        query_params.call_id = new Date().getTime();
        query_params.jsonp = query_params.jsonp || 'Playdar.nop';
        query_params.method = method;
        Playdar.client.addAuthToken(query_params);
        return Playdar.client.getBaseUrl("/player", query_params);
    },

    play: function (sid) {
        Playdar.Util.loadJs(this.getUrl('play', {
            sid: sid,
            jsonp: 'Playdar.player.sounds["'+sid+'"].playCallback'
        }));
    },
    stop: function (sid, onUnload) {
        if (onUnload) {
            var stopper = window.open();
            var stopUrl = this.getUrl('stop', {
                jsonp: "function Playdar_close (json) { window.close() } Playdar_close"
            });
            stopper.document.write('<html>'
                + '<body>'
                + '<script src="' + stopUrl + '"></script>'
                + '</body>'
                + '</html>'
            );
        } else {
            Playdar.Util.loadJs(this.getUrl('stop', {
                jsonp: 'Playdar.player.sounds["'+sid+'"].stopCallback'
            }));
        }
    },
    togglePause: function (sid) {
        if (this.sounds[sid].readyState == 0) {
            this.play(sid);
        } else {
            Playdar.Util.loadJs(this.getUrl('pausetoggle', {
                jsonp: 'Playdar.player.sounds["'+sid+'"].togglePauseCallback'
            }));
        }
    },
    getPosition: function (sid) {
        Playdar.Util.loadJs(this.getUrl('pos'));
    },
    setPosition: function (sid, position) {
    },
    getNowPlayingSid: function () {
        Playdar.Util.loadJs(this.getUrl('np'));
    }
};


Playdar.WSClient = function(){
  Playdar.wsclient = this;
  this.connected = false;;
  this.onConnected = false;
  this.onClose = false;
  this._ws = false;
};

Playdar.WSClient.prototype = {
  connect: function(){
         this._ws=new WebSocket("ws://localhost:60210/ws:api");
         this._ws.onopen=this._onopen;
         this._ws.onmessage=this._onmessage;
         this._ws.onclose=this._onclose;
  },
  
  _onopen: function(){
    // wtf is going on with this's scope?
    Playdar.wsclient.connected = true;
    Playdar.wsclient.onConnected();
  },
  
  send: function(message){
    if (Playdar.wsclient._ws)
      Playdar.wsclient._ws.send(message);
  },
  
  _onmessage: function(m) {
          if (m.data){
	    Playdar.wsclient.onMessage(m.data);
          }
  },
  
  _onclose: function(m) {
          Playdar.wsclient._ws=null;
	  Playdar.wsclient.connected = false;
	  Playdar.wsclient.onClose();
  }
};
  


Playdar.StatusBar = function () {
    Playdar.statusBar = this;

    this.progressBarWidth = 200;

    this.requestCount = 0;
    this.pendingCount = 0;
    this.successCount = 0;

    this.build();
};
Playdar.StatusBar.prototype = {
    build: function () {
        /* Status bar
           ---------- */
        var statusBar = document.createElement("div");
        statusBar.style.position = 'fixed';
        statusBar.style.bottom = 0;
        statusBar.style.left = 0;
        statusBar.style.zIndex = 100;
        statusBar.style.width = '100%';
        statusBar.style.height = '36px';
        statusBar.style.padding = '7px 0';
        statusBar.style.borderTop = '2px solid #4c7a0f';
        statusBar.style.font = 'normal 13px/18px "Calibri", "Lucida Grande", sans-serif';
        statusBar.style.color = "#335507";
        statusBar.style.background = '#e8f9bb';

        /* Left column
           ----------- */
        var leftCol = document.createElement("div");
        leftCol.style.padding = "0 7px";
        var logo = '<img src="' + Playdar.STATIC_HOST + '/static/playdar_logo_32x32.png" width="32" height="32" style="vertical-align: middle; float: left; margin: 0 10px 0 0; border: 0; line-height: 36px;" />';
        leftCol.innerHTML = logo;

        this.status = document.createElement("p");
        this.status.style.margin = "0";
        this.status.style.padding = "0 8px";
        this.status.style.lineHeight = "36px";
        this.status.style.fontSize = "15px";
        leftCol.appendChild(this.status);

        this.playback = document.createElement("div");
        this.playback.style.padding = "0 7px";
        this.playback.style.display = "none";
        var trackTitle = document.createElement("p");
        trackTitle.style.margin = "0";
        this.trackLink = document.createElement("a");
        this.trackLink.style.textDecoration = "none";

        this.artistName = document.createElement("span");
        this.artistName.style.textTransform = "uppercase";
        this.artistName.style.color = "#4c7a0f";

        this.trackName = document.createElement("strong");
        this.trackName.style.margin = "0 0 0 10px";
        this.trackName.style.color = "#335507";

        this.trackLink.appendChild(this.artistName);
        this.trackLink.appendChild(this.trackName);
        trackTitle.appendChild(this.trackLink);
        this.playback.appendChild(trackTitle);

        var progressTable = document.createElement("table");
        progressTable.setAttribute('cellpadding', 0);
        progressTable.setAttribute('cellspacing', 0);
        progressTable.setAttribute('border', 0);
        progressTable.style.color = "#4c7a0f";
        progressTable.style.font = 'normal 10px/16px "Verdana", sans-serif';
        var progressTbody = document.createElement("tbody");
        var progressRow = document.createElement("tr");
        this.trackElapsed = document.createElement("td");
        this.trackElapsed.style.verticalAlign = "middle";
        progressRow.appendChild(this.trackElapsed);
        var progressCell = document.createElement("td");
        progressCell.style.padding = "0 5px";
        progressCell.style.verticalAlign = "middle";
        var progressBar = document.createElement("div");
        progressBar.style.width = this.progressBarWidth + "px";
        progressBar.style.height = "9px";
        progressBar.style.border = "1px solid #4c7a0f";
        progressBar.style.background = "#fff";
        progressBar.style.position = "relative";
        this.loadHead = document.createElement("div");
        this.loadHead.style.position = "absolute";
        this.loadHead.style.width = 0;
        this.loadHead.style.height = "9px";
        this.loadHead.style.background = "#d2f380";
        progressBar.appendChild(this.loadHead);
        this.playHead = document.createElement("div");
        this.playHead.style.position = "absolute";
        this.playHead.style.width = 0;
        this.playHead.style.height = "9px";
        this.playHead.style.background = "#6ea31e";
        progressBar.appendChild(this.playHead);
        progressBar.onclick = function () {
            Playdar.player.toggle_nowplaying();
        };
        progressCell.appendChild(progressBar);
        progressRow.appendChild(progressCell);
        this.trackDuration = document.createElement("td");
        this.trackDuration.style.verticalAlign = "middle";
        progressRow.appendChild(this.trackDuration);

        progressTbody.appendChild(progressRow);
        progressTable.appendChild(progressTbody);
        this.playback.appendChild(progressTable);

        leftCol.appendChild(this.playback);

        /* Right column
           ------------ */
        var rightCol = document.createElement("div");
        rightCol.style.cssFloat = "right";
        rightCol.style.padding = "0 8px";
        rightCol.style.textAlign = "right";
        var settingsLink = document.createElement("p");
        settingsLink.style.margin = 0;
        settingsLink.innerHTML = '<a href="' + Playdar.client.getBaseUrl() + '" target="_blank">Settings</a>';
        rightCol.appendChild(settingsLink);
        this.playdarLinks = document.createElement("p");
        this.playdarLinks.style.margin = 0;

        this.playdarLinks.innerHTML = Playdar.client.get_disconnect_link_html();
        rightCol.appendChild(this.playdarLinks);

        this.queryCount = document.createElement("span");
        this.queryCount.style.margin = "0 5px 0 5px";
        this.queryCount.style.fontSize = "11px";
        this.queryCount.style.fontWeight = "normal";
        this.queryCount.style.color = "#6ea31e";
        this.playdarLinks.insertBefore(this.queryCount, this.playdarLinks.firstChild);

        /* Build status bar
           --------------- */
        statusBar.appendChild(rightCol);
        statusBar.appendChild(leftCol);

        /* Build status bar */
        document.body.appendChild(statusBar);

        var marginBottom = document.body.style.marginBottom;
        if (!marginBottom) {
            var css = document.defaultView.getComputedStyle(document.body, null);
            if (css) {
                marginBottom = css.marginBottom;
            }
        }
        document.body.style.marginBottom = (marginBottom.replace('px', '') - 0) + 36 + (7*2) + 2 + 'px';

        return statusBar;
    },

    ready: function () {
        this.playdarLinks.style.display = "";
        var message = "Ready";
        this.status.innerHTML = message;
    },
    offline: function () {
        this.playdarLinks.style.display = "none";
        var message = Playdar.client.get_auth_link_html();
        this.status.innerHTML = message;
    },
    startManualAuth: function () {
        this.playdarLinks.style.display = "none";
        var input_id = "manualAuth_" + Playdar.client.uuid;
        var form = '<form>'
            + '<input type="text" id="' + input_id + '" />'
            + ' <input type="submit" value="Allow access to Playdar"'
                + ' onclick="Playdar.client.manualAuthCallback(\'' + input_id + '\'); return false;'
            + '" />'
            + '</form>';
        this.status.innerHTML = form;
        Playdar.Util.select('#' + input_id)[0].focus();
    },

    handleStat: function (response) {
        if (response.authenticated) {
            this.ready();
        } else {
            this.offline();
        }
    },

    showResolutionStatus: function () {
        if (this.queryCount) {
            var status = " ";
            if (this.pendingCount) {
                status += this.pendingCount + ' <img src="' + Playdar.STATIC_HOST + '/static/track_throbber.gif" width="16" height="16" style="vertical-align: middle; margin: -2px 2px 0 2px"/> ';
            }
            status += " " + this.successCount + "/" + this.requestCount;
            this.queryCount.innerHTML = status;
        }
    },
    handleResults: function (response, final_answer) {
        if (final_answer) {
            this.pendingCount--;
            if (response.results.length) {
                this.successCount++;
            }
        }
        this.showResolutionStatus();
    },
    incrementRequests: function () {
        this.requestCount++;
        this.pendingCount++;
        this.showResolutionStatus();
    },
    cancelResolve: function () {
        this.pendingCount = 0;
        this.showResolutionStatus();
    },

    getSoundCallbacks: function (result) {
        return {
            whileplaying: function () {
                Playdar.statusBar.playingHandler(this);
            },
            whileloading: function () {
                Playdar.statusBar.loadingHandler(this);
            }
        };
    },

    playHandler: function (result) {
        this.trackElapsed.innerHTML = Playdar.Util.mmss(0);
        this.trackLink.href = Playdar.client.get_stream_url(result.sid);
        this.trackLink.title = result.source;
        this.trackName.innerHTML = result.track;
        this.artistName.innerHTML = result.artist;
        this.trackDuration.innerHTML = Playdar.Util.mmss(result.duration);
        this.status.style.display = "none";
        this.playback.style.display = "";
    },
    playingHandler: function (sound) {
        this.trackElapsed.innerHTML = Playdar.Util.mmss(Math.round(sound.position/1000));
        var duration;
        if (sound.readyState == 3) { // loaded/success
            duration = sound.duration;
        } else {
            duration = sound.durationEstimate;
        }
        var portionPlayed = sound.position / duration;
        this.playHead.style.width = Math.round(portionPlayed * this.progressBarWidth) + "px";
        this.loadingHandler(sound);
    },
    loadingHandler: function (sound) {
        var loaded = sound.bytesLoaded/sound.bytesTotal;
        this.loadHead.style.width = Math.round(loaded * this.progressBarWidth) + "px";
    },
    stopCurrent: function () {
        this.playback.style.display = "none";
        this.status.style.display = "";

        this.trackLink.href = "#";
        this.trackLink.title = "";
        this.trackName.innerHTML = "";
        this.artistName.innerHTML = "";

        this.loadHead.style.width = 0;
        this.playHead.style.width = 0;
    }
};
Playdar.Util = {
    generate_uuid: function () {
        var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
        var uuid = [];
        var rnd = Math.random;

        var r;

        uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
        uuid[14] = '4';

        for (var i = 0; i < 36; i++) {
            if (!uuid[i]) {
                r = 0 | rnd()*16;
                uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r & 0xf];
            }
        }
        return uuid.join('');
    },

    toQueryPair: function (key, value) {
        if (value === null) {
            return key;
        }
        return key + '=' + encodeURIComponent(value);
    },
    toQueryString: function (params) {
        var results = [];
        for (var key in params) {
            var value = params[key];
            key = encodeURIComponent(key);

            if (typeof value == 'object') {
                results.push(Playdar.Util.toQueryPair(key, JSON.stringify(value)));
            } else {
                results.push(Playdar.Util.toQueryPair(key, value));
            }
        }
        return results.join('&');
    },

    mmss: function (secs) {
        var s = secs % 60;
        if (s < 10) {
            s = "0" + s;
        }
        return Math.floor(secs/60) + ":" + s;
    },

    loadJs: function (url, checkForGlobal, onLoad) {
        if (typeof url != 'string' && url.join && url.length == 2) {
            var response = this.loadJson(url[0]);
            url[1](response);
        } else {
            var s = document.createElement("script");
            s.src = url;
            document.getElementsByTagName("head")[0].appendChild(s);
            if (checkForGlobal) {
                Playdar.Util.pollForGlobal(checkForGlobal, onLoad);
            }
        }
    },

    loadIframe: function (url) {
        alert(url);
        var s = document.createElement("iframe");
        s.src = url;
        s.style.display = 'none';
        document.getElementsByTagName("body")[0].appendChild(s);
    },

    loadJson: function (url, method, options) {
        var request = this.xhr(url, method, options);
        this.checkJsonResponse(request);
        return JSON.parse(request.responseText);
    },
    xhr: function (url, method, options) {
        method = method || 'GET';
        options = options || {};
        var request = null;
        if (typeof XMLHttpRequest != "undefined") {
            request = new XMLHttpRequest();
        } else if (typeof ActiveXObject != "undefined") {
            request = new ActiveXObject("Microsoft.XMLHTTP");
        } else {
            throw new Error("No XMLHTTPRequest support detected");
        }
        request.open(method, url, false);
        if (options.headers) {
            var headers = options.headers;
            for (var headerName in headers) {
                request.setRequestHeader(headerName, headers[headerName]);
            }
        }
        request.send(options.body || "");
        return request;
    },
    checkJsonResponse: function (request) {
        if (request.status >= 400) {
            var result;
            try {
                result = JSON.parse(request.responseText);
            } catch (ParseError) {
                result = {
                    error: "unknown",
                    reason: request.responseText
                };
            }
            throw result;
        }
    },
    pollForGlobal: function (globalObject, onLoad) {
       setTimeout(function () {
           if (window[globalObject]) {
               return onLoad(window[globalObject]);
           }
           Playdar.Util.pollForGlobal(globalObject, onLoad);
       });
    },

    setCookie: function (name, value, days) {
        var expires;
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days*24*60*60*1000));
            expires = "; expires=" + date.toGMTString();
        } else {
            expires = "";
        }
        document.cookie = name + "=" + value + expires + "; path=/";
    },
    getCookie: function (name) {
        var namekey = name + "=";
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length;i++) {
            var c = cookies[i];
            while (c.charAt(0) == ' ') {
                c = c.substring(1, c.length);
            }
            if (c.indexOf(namekey) === 0) {
                return c.substring(namekey.length, c.length);
            }
        }
        return null;
    },
    deleteCookie: function (name) {
        Playdar.Util.setCookie(name, "", -1);
    },

    getWindowPosition: function () {
        var location = {};
        if (window.screenLeft) {
            location.x = window.screenLeft || 0;
            location.y = window.screenTop || 0;
        } else {
            location.x = window.screenX || 0;
            location.y = window.screenY || 0;
        }
        return location;
    },
    getWindowSize: function () {
        return {
            'w': (window && window.innerWidth) ||
                 (document && document.documentElement && document.documentElement.clientWidth) ||
                 (document && document.body && document.body.clientWidth) ||
                 0,
            'h': (window && window.innerHeight) ||
                 (document && document.documentElement && document.documentElement.clientHeight) ||
                 (document && document.body && document.body.clientHeight) ||
                 0
        };
    },

    getPopupOptions: function (size) {
        var popupLocation = Playdar.Util.getPopupLocation(size);
        return [
            "left=" + popupLocation.x,
            "top=" + popupLocation.y,
            "width=" + size.w,
            "height=" + size.h,
            "location=yes",
            "toolbar=no",
            "menubar=yes",
            "status=yes",
            "resizable=yes",
            "scrollbars=yes"
        ].join(',');
    },
    getPopupLocation: function (size) {
        var windowLocation = Playdar.Util.getWindowPosition();
        var windowSize = Playdar.Util.getWindowSize();
        return {
            'x': Math.max(0, windowLocation.x + (windowSize.w - size.w) / 2),
            'y': Math.max(0, windowLocation.y + (windowSize.h - size.h) / 2)
        };
    },

    addEvent: function (obj, type, fn) {
        if (obj.attachEvent) {
            obj['e'+type+fn] = fn;
            obj[type+fn] = function () {
                obj['e'+type+fn](window.event);
            };
            obj.attachEvent('on'+type, obj[type+fn]);
        } else {
            obj.addEventListener(type, fn, false);
        }
    },
    getTarget: function (e) {
        e = e || window.event;
        return e.target || e.srcElement;
    },

    extendObject: function (destination, source) {
        source = source || {};
        for (var property in source) {
            destination[property] = source[property];
        }
        return destination;
    },

    mergeCallbackOptions: function (callbackOptions) {
        var optionMap = {};
        var keys = [];
        var i, options, optionName;
        for (i = 0; i < callbackOptions.length; i++) {
            options = callbackOptions[i];
            for (optionName in options) {
                if (typeof (options[optionName]) == 'function') {
                    if (!optionMap[optionName]) {
                        keys.push(optionName);
                        optionMap[optionName] = [];
                    }
                    optionMap[optionName].push(options[optionName]);
                }
            }
        }
        var finalOptions = {};
        for (i = 0; i < keys.length; i++) {
            var key = keys[i];
            finalOptions[key] = (function (key, mappedOptions) {
                return function () {
                    for (var j = 0; j < mappedOptions.length; j++) {
                        mappedOptions[j].apply(this, arguments);
                    }
                };
            })(key, optionMap[key]);
        }
        return finalOptions;
    },

    location_from_url: function (url) {
        var dummy = document.createElement('a');
        dummy.href = url;
        var location = {};
        for (var k in window.location) {
            if (typeof window.location[k] === 'string') {
                location[k] = dummy[k];
            }
        }
        return location;
    },

    sleep: function (ms, breakCondition) {
        var start = (new Date()).getTime();
        while (((new Date()).getTime() - start) < ms) {
            if (breakCondition && breakCondition()) {
                break;
            }
        }
    },

    log: function (response) {
        if (typeof console != 'undefined') {
            console.dir(response);
        }
    }
};
Playdar.Parse = {
    getProperty: function (collection, prop) {
        var prop = prop || 'textContent';
        var i, coll, property;
        for (i = 0; i < collection.length; i++) {
            coll = collection[i];
            property = coll[prop] || coll.getAttribute(prop);
            if (property) {
                return property;
            }
        }
        return;
    },
    getValue: function (collection) {
        var i, coll, value;
        for (i = 0; i < collection.length; i++) {
            coll = collection[i];
            value = Playdar.Util.select('.value', coll);
            if (value.length) {
                return Playdar.Parse.getContentWithoutValue(value);
            }
        }
        return;
    },
    getContentWithoutValue: function (collection) {
        return Playdar.Parse.getProperty(collection, 'content')
            || Playdar.Parse.getProperty(collection, 'title')
            || Playdar.Parse.getProperty(collection);
    },
    getContent: function (collection) {
        var content = Playdar.Parse.getValue(collection)
                   || Playdar.Parse.getContentWithoutValue(collection);
        if (content) {
            return content.replace(/(^\s*)|(\s*$)/g, '');
        }
        return;
    },
    getPosition: function (trackNode) {
        var currentNode = trackNode;
        var elderSiblings = 0;
        if (trackNode.nodeName == 'LI' && trackNode.parentNode.nodeName == 'OL') {
            while (currentNode.previousSibling) {
                currentNode = currentNode.previousSibling;
                if (currentNode.nodeName == 'LI') {
                    elderSiblings++;
                }
            }
            return elderSiblings + 1;
        }
        return;
    },
    getNS: function (node, url) {
        for (var i = 0; i < node.attributes.length; i++) {
            var attr = node.attributes[i];
            if (attr.nodeValue == url) {
                return attr.nodeName.replace('xmlns:', '');
            }
        }
    },
    getExc: function (exclude, selector) {
        return ':not(' + exclude + ' ' + selector + ')';
    },

    microformats: function (context) {
        var sel = Playdar.Util.select;
        function selExcRec (selector, context) {
            return sel(selector + Playdar.Parse.getExc('.item', selector), context);
        }

        function getBuyData (context, rec) {
            var buySel = rec ? sel : selExcRec;
            var buyURL = Playdar.Parse.getProperty(buySel('.payment', context), 'href')
                      || Playdar.Parse.getProperty(buySel('[rel~=payment]', context), 'href');
            if (!buyURL) {
                return;
            }
            return {
                url: buyURL,
                currency: Playdar.Parse.getContent(buySel('.price .currency', context)),
                amount: Playdar.Parse.getContent(buySel('.price .amount', context))
            };
        }
        function getTrackData (tracks, artist, album) {
            var data = [];
            var i, track;
            for (i = 0; i < tracks.length; i++) {
                if (!tracks[i].playdarParsed) {
                    track = {
                        title: Playdar.Parse.getContent(sel('.fn', tracks[i]))
                            || Playdar.Parse.getContent(sel('.title', tracks[i])),
                        artist: Playdar.Parse.getContent(sel('.contributor', tracks[i]))
                             || artist,
                        album: album,
                        position: Playdar.Parse.getContent(sel('.position', tracks[i]))
                               || Playdar.Parse.getPosition(tracks[i]),
                        duration: Playdar.Parse.getContent(sel('.duration', tracks[i])),
                        buy: getBuyData(tracks[i], true),
                        element: tracks[i]
                    };
                    data.push(track);
                    tracks[i].playdarParsed = true;
                }
            }
            return data;
        }

        function getArtist (context) {
            var artist = selExcRec('.contributor', context);
            var artistName = Playdar.Parse.getContent(sel('.fn', artist[0]));
            if (!artistName) {
                artistName = Playdar.Parse.getContent(artist);
            }
            return artistName;
        }

        function getAlbums (context) {
            var data = [];
            var albums = sel('.haudio', context);
            var i, album_name, album_artist, album_tracks, album, item_artist, item_track, tracks;
            for (i = 0; i < albums.length; i++) {
                if (!albums[i].playdarParsed) {
                    album_name = Playdar.Parse.getContent(selExcRec('.album', albums[i]));
                    if (!album_name) {
                        continue;
                    }
                    album_artist = getArtist(albums[i]);
                    if (!album_artist) {
                        continue;
                    }
                    album_tracks = getTrackData(sel('.item', albums[i]), album_artist, album_name);
                    if (!album_tracks.length) {
                        continue;
                    }
                    data.push({
                        type: 'album',
                        title: album_name,
                        artist: album_artist,
                        tracks: album_tracks,
                        image: Playdar.Parse.getProperty(selExcRec('.photo', albums[i]), 'src')
                            || Playdar.Parse.getProperty(selExcRec('.photo', albums[i]), 'href'),
                        download: Playdar.Parse.getProperty(selExcRec('[rel~=enclosure]', albums[i]), 'href'),
                        released: Playdar.Parse.getContent(selExcRec('.published', albums[i])),
                        duration: Playdar.Parse.getContent(selExcRec('.duration', albums[i])),
                        buy: getBuyData(albums[i])
                    });
                    albums[i].playdarParsed = true;
                }
            }
            return data;
        }

        function getTrackLists (context) {
            var lists = getAlbums(context);
            var tracks = getTrackData(sel('.haudio'));
            if (tracks.length) {
                lists.push({
                    type: 'page',
                    title: window.document.title || window.location.href,
                    tracks: tracks
                });
            }
            return lists;
        }

        var lists = getTrackLists(context);
        return lists;
    },

    rdfa: function (context) {
        var sel = Playdar.Util.select;

        var htmlNode = sel('html')[0];
        var commerceNS = Playdar.Parse.getNS(htmlNode, 'http://purl.org/commerce#');
        var audioNS = Playdar.Parse.getNS(htmlNode, 'http://purl.org/media/audio#');
        var mediaNS = Playdar.Parse.getNS(htmlNode, 'http://purl.org/media#');
        var dcNS = Playdar.Parse.getNS(htmlNode, 'http://purl.org/dc/terms/')
                || Playdar.Parse.getNS(htmlNode, 'http://purl.org/dc/elements/1.1/');

        var foafNS = Playdar.Parse.getNS(htmlNode, 'http://xmlns.com/foaf/0.1/');
        var moNS = Playdar.Parse.getNS(htmlNode, 'http://purl.org/ontology/mo/');

        function selExcRec (selector, context) {
            var final_selector = selector;
            if (audioNS) {
                final_selector += Playdar.Parse.getExc('[typeof='+audioNS+':Recording]', selector);
            }
            if (moNS) {
                final_selector += Playdar.Parse.getExc('[typeof='+moNS+':Track]', selector);
            }
            return sel(final_selector, context);
        }

        if (!audioNS && !moNS) {
            return [];
        }

        function getBuyData (context, rec) {
            var buySel = rec ? sel : selExcRec;
            var buyURL = Playdar.Parse.getProperty(buySel('[rel~='+commerceNS+':payment]', context), 'href');
            if (!buyURL) {
                return;
            }
            return {
                url: buyURL,
                currency: Playdar.Parse.getContent(buySel('[rel~='+commerceNS+':costs] [property='+commerceNS+':currency]', context)),
                amount: Playdar.Parse.getContent(buySel('[rel~='+commerceNS+':costs] [property='+commerceNS+':amount]', context))
            };
        }

        function getTracks (context, artist, album) {
            var data = [];
            var selectors = [];
            if (audioNS) {
                selectors.push('[typeof='+audioNS+':Recording]');
            }
            if (moNS) {
                selectors.push('[typeof='+moNS+':Track]');
            }
            var tracks = selExcRec(selectors.join(','), context);
            var i, track;
            for (i = 0; i < tracks.length; i++) {
                if (!tracks[i].playdarParsed) {
                    track = {
                        title: Playdar.Parse.getContent(sel('[property='+dcNS+':title]', tracks[i])),
                        artist: Playdar.Parse.getContent(sel('[property='+dcNS+':creator], [rel~='+foafNS+':maker] [property='+foafNS+':name]', tracks[i]))
                             || artist,
                        album: Playdar.Parse.getContent(sel('[typeof='+moNS+':Record] [property='+dcNS+':title]'))
                            || album,
                        position: Playdar.Parse.getContent(sel('[property='+mediaNS+':position]', tracks[i]))
                               || Playdar.Parse.getPosition(tracks[i]),
                        duration: Playdar.Parse.getContent(sel('[property='+mediaNS+':duration]', tracks[i]))
                               || Playdar.Parse.getContent(sel('[property='+dcNS+':duration]', tracks[i])),
                        buy: getBuyData(tracks[i], true),
                        element: tracks[i]
                    };
                    data.push(track);
                    tracks[i].playdarParsed = true;
                }
            }
            return data;
        }

        function getArtist (context) {
            var artist = selExcRec('[property='+dcNS+':creator]', context);
            if (!artist.length) {
                artist = selExcRec('[rel~='+foafNS+':maker]', context);
            }
            var artistName;
            if (artist.length) {
                artistName = Playdar.Parse.getContent(sel('[property='+foafNS+':name]', artist[0]));
            }
            if (!artistName) {
                var artistLink = sel('[rel~='+dcNS+':creator]', context);
                var artistId = Playdar.Parse.getProperty(artistLink, 'resource');
                if (artistId) {
                    var resource = sel('[about='+artistId+']');
                    artistName = Playdar.Parse.getContent(sel('[property='+foafNS+':name]', resource[0]))
                              || Playdar.Parse.getContent(resource);
                }
            }
            if (!artistName) {
                artistName = Playdar.Parse.getContent(artist);
            }
            return artistName;
        }

        function getAlbums (context) {
            var data = [];
            var albums = sel('[typeof='+audioNS+':Album], [typeof='+moNS+':Record]', context);
            var i, album, album_name, album_artist, album_tracks;
            for (i = 0; i < albums.length; i++) {
                if (!albums[i].playdarParsed) {
                    album_name = Playdar.Parse.getContent(selExcRec('[property='+dcNS+':title]', albums[i]));
                    if (!album_name) {
                        continue;
                    }
                    album_artist = getArtist(albums[i]);
                    if (!album_artist) {
                        continue;
                    }
                    album_tracks = getTracks(albums[i], album_artist, album_name);
                    if (!album_tracks.length) {
                        continue;
                    }
                    data.push({
                        type: 'album',
                        title: album_name,
                        artist: album_artist,
                        tracks: album_tracks,
                        image: Playdar.Parse.getProperty(selExcRec('[rel~='+mediaNS+':depiction]', albums[i]), 'src')
                            || Playdar.Parse.getProperty(selExcRec('[rev~='+mediaNS+':depiction]', albums[i]), 'src'),
                        download: Playdar.Parse.getProperty(selExcRec('[rel~='+mediaNS+':download]', albums[i]), 'href'),
                        released: Playdar.Parse.getContent(selExcRec('[property='+dcNS+':issued]', albums[i]))
                               || Playdar.Parse.getContent(selExcRec('[property='+dcNS+':published]', albums[i]))
                               || Playdar.Parse.getContent(selExcRec('[property='+dcNS+':date]', albums[i])),
                        duration: Playdar.Parse.getContent(selExcRec('[property='+mediaNS+':duration]', albums[i]))
                               || Playdar.Parse.getContent(selExcRec('[property='+dcNS+':duration]', albums[i])),
                        buy: getBuyData(albums[i])
                    });
                    albums[i].playdarParsed = true;
                }
            }
            return data;
        }

        function getTrackLists (context) {
            var lists = getAlbums(context);
            var tracks = getTracks(context);
            if (tracks.length) {
                lists.push({
                    type: 'page',
                    title: window.document.title || window.location.href,
                    tracks: tracks
                });
            }
            return lists;
        }

        var lists = getTrackLists(context);
        return lists;
    }
};
/*
    http://www.JSON.org/json2.js
    2009-09-29

    Public Domain.

    NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.

    See http://www.JSON.org/js.html

    This file creates a global JSON object containing two methods: stringify
    and parse.

        JSON.stringify(value, replacer, space)
            value       any JavaScript value, usually an object or array.

            replacer    an optional parameter that determines how object
                        values are stringified for objects. It can be a
                        function or an array of strings.

            space       an optional parameter that specifies the indentation
                        of nested structures. If it is omitted, the text will
                        be packed without extra whitespace. If it is a number,
                        it will specify the number of spaces to indent at each
                        level. If it is a string (such as '\t' or '&nbsp;'),
                        it contains the characters used to indent at each level.

            This method produces a JSON text from a JavaScript value.

            When an object value is found, if the object contains a toJSON
            method, its toJSON method will be called and the result will be
            stringified. A toJSON method does not serialize: it returns the
            value represented by the name/value pair that should be serialized,
            or undefined if nothing should be serialized. The toJSON method
            will be passed the key associated with the value, and this will be
            bound to the value

            For example, this would serialize Dates as ISO strings.

                Date.prototype.toJSON = function (key) {
                    function f(n) {
                        return n < 10 ? '0' + n : n;
                    }

                    return this.getUTCFullYear()   + '-' +
                         f(this.getUTCMonth() + 1) + '-' +
                         f(this.getUTCDate())      + 'T' +
                         f(this.getUTCHours())     + ':' +
                         f(this.getUTCMinutes())   + ':' +
                         f(this.getUTCSeconds())   + 'Z';
                };

            You can provide an optional replacer method. It will be passed the
            key and value of each member, with this bound to the containing
            object. The value that is returned from your method will be
            serialized. If your method returns undefined, then the member will
            be excluded from the serialization.

            If the replacer parameter is an array of strings, then it will be
            used to select the members to be serialized. It filters the results
            such that only members with keys listed in the replacer array are
            stringified.

            Values that do not have JSON representations, such as undefined or
            functions, will not be serialized. Such values in objects will be
            dropped; in arrays they will be replaced with null. You can use
            a replacer function to replace those with JSON values.
            JSON.stringify(undefined) returns undefined.

            The optional space parameter produces a stringification of the
            value that is filled with line breaks and indentation to make it
            easier to read.

            If the space parameter is a non-empty string, then that string will
            be used for indentation. If the space parameter is a number, then
            the indentation will be that many spaces.

            Example:

            text = JSON.stringify(['e', {pluribus: 'unum'}]);


            text = JSON.stringify(['e', {pluribus: 'unum'}], null, '\t');

            text = JSON.stringify([new Date()], function (key, value) {
                return this[key] instanceof Date ?
                    'Date(' + this[key] + ')' : value;
            });


        JSON.parse(text, reviver)
            This method parses a JSON text to produce an object or array.
            It can throw a SyntaxError exception.

            The optional reviver parameter is a function that can filter and
            transform the results. It receives each of the keys and values,
            and its return value is used instead of the original value.
            If it returns what it received, then the structure is not modified.
            If it returns undefined then the member is deleted.

            Example:


            myData = JSON.parse(text, function (key, value) {
                var a;
                if (typeof value === 'string') {
                    a =
/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/.exec(value);
                    if (a) {
                        return new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4],
                            +a[5], +a[6]));
                    }
                }
                return value;
            });

            myData = JSON.parse('["Date(09/09/2001)"]', function (key, value) {
                var d;
                if (typeof value === 'string' &&
                        value.slice(0, 5) === 'Date(' &&
                        value.slice(-1) === ')') {
                    d = new Date(value.slice(5, -1));
                    if (d) {
                        return d;
                    }
                }
                return value;
            });


    This is a reference implementation. You are free to copy, modify, or
    redistribute.

    This code should be minified before deployment.
    See http://javascript.crockford.com/jsmin.html

    USE YOUR OWN COPY. IT IS EXTREMELY UNWISE TO LOAD CODE FROM SERVERS YOU DO
    NOT CONTROL.
*/

/*jslint evil: true, strict: false */

/*members "", "\b", "\t", "\n", "\f", "\r", "\"", JSON, "\\", apply,
    call, charCodeAt, getUTCDate, getUTCFullYear, getUTCHours,
    getUTCMinutes, getUTCMonth, getUTCSeconds, hasOwnProperty, join,
    lastIndex, length, parse, prototype, push, replace, slice, stringify,
    test, toJSON, toString, valueOf
*/



if (!this.JSON) {
    this.JSON = {};
}

(function () {

    function f(n) {
        return n < 10 ? '0' + n : n;
    }

    if (typeof Date.prototype.toJSON !== 'function') {

        Date.prototype.toJSON = function (key) {

            return isFinite(this.valueOf()) ?
                   this.getUTCFullYear()   + '-' +
                 f(this.getUTCMonth() + 1) + '-' +
                 f(this.getUTCDate())      + 'T' +
                 f(this.getUTCHours())     + ':' +
                 f(this.getUTCMinutes())   + ':' +
                 f(this.getUTCSeconds())   + 'Z' : null;
        };

        String.prototype.toJSON =
        Number.prototype.toJSON =
        Boolean.prototype.toJSON = function (key) {
            return this.valueOf();
        };
    }

    var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        gap,
        indent,
        meta = {    // table of character substitutions
            '\b': '\\b',
            '\t': '\\t',
            '\n': '\\n',
            '\f': '\\f',
            '\r': '\\r',
            '"' : '\\"',
            '\\': '\\\\'
        },
        rep;


    function quote(string) {


        escapable.lastIndex = 0;
        return escapable.test(string) ?
            '"' + string.replace(escapable, function (a) {
                var c = meta[a];
                return typeof c === 'string' ? c :
                    '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
            }) + '"' :
            '"' + string + '"';
    }


    function str(key, holder) {


        var i,          // The loop counter.
            k,          // The member key.
            v,          // The member value.
            length,
            mind = gap,
            partial,
            value = holder[key];


        if (value && typeof value === 'object' &&
                typeof value.toJSON === 'function') {
            value = value.toJSON(key);
        }


        if (typeof rep === 'function') {
            value = rep.call(holder, key, value);
        }


        switch (typeof value) {
        case 'string':
            return quote(value);

        case 'number':


            return isFinite(value) ? String(value) : 'null';

        case 'boolean':
        case 'null':


            return String(value);


        case 'object':


            if (!value) {
                return 'null';
            }


            gap += indent;
            partial = [];


            if (Object.prototype.toString.apply(value) === '[object Array]') {


                length = value.length;
                for (i = 0; i < length; i += 1) {
                    partial[i] = str(i, value) || 'null';
                }


                v = partial.length === 0 ? '[]' :
                    gap ? '[\n' + gap +
                            partial.join(',\n' + gap) + '\n' +
                                mind + ']' :
                          '[' + partial.join(',') + ']';
                gap = mind;
                return v;
            }


            if (rep && typeof rep === 'object') {
                length = rep.length;
                for (i = 0; i < length; i += 1) {
                    k = rep[i];
                    if (typeof k === 'string') {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            } else {


                for (k in value) {
                    if (Object.hasOwnProperty.call(value, k)) {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            }


            v = partial.length === 0 ? '{}' :
                gap ? '{\n' + gap + partial.join(',\n' + gap) + '\n' +
                        mind + '}' : '{' + partial.join(',') + '}';
            gap = mind;
            return v;
        }
    }


    if (typeof JSON.stringify !== 'function') {
        JSON.stringify = function (value, replacer, space) {


            var i;
            gap = '';
            indent = '';


            if (typeof space === 'number') {
                for (i = 0; i < space; i += 1) {
                    indent += ' ';
                }


            } else if (typeof space === 'string') {
                indent = space;
            }


            rep = replacer;
            if (replacer && typeof replacer !== 'function' &&
                    (typeof replacer !== 'object' ||
                     typeof replacer.length !== 'number')) {
                throw new Error('JSON.stringify');
            }


            return str('', {'': value});
        };
    }



    if (typeof JSON.parse !== 'function') {
        JSON.parse = function (text, reviver) {


            var j;

            function walk(holder, key) {


                var k, v, value = holder[key];
                if (value && typeof value === 'object') {
                    for (k in value) {
                        if (Object.hasOwnProperty.call(value, k)) {
                            v = walk(value, k);
                            if (v !== undefined) {
                                value[k] = v;
                            } else {
                                delete value[k];
                            }
                        }
                    }
                }
                return reviver.call(holder, key, value);
            }



            cx.lastIndex = 0;
            if (cx.test(text)) {
                text = text.replace(cx, function (a) {
                    return '\\u' +
                        ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
                });
            }



            if (/^[\],:{}\s]*$/.
test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@').
replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']').
replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {


                j = eval('(' + text + ')');


                return typeof reviver === 'function' ?
                    walk({'': j}, '') : j;
            }


            throw new SyntaxError('JSON.parse');
        };
    }
}());
/*!
 * Sizzle CSS Selector Engine - v1.0
 *  Copyright 2009, The Dojo Foundation
 *  Released under the MIT, BSD, and GPL Licenses.
 *  More information: http://sizzlejs.com/
 */
(function(){

var chunker = /((?:\((?:\([^()]+\)|[^()]+)+\)|\[(?:\[[^[\]]*\]|['"][^'"]*['"]|[^[\]'"]+)+\]|\\.|[^ >+~,(\[\\]+)+|[>+~])(\s*,\s*)?/g,
    done = 0,
    toString = Object.prototype.toString,
    hasDuplicate = false;

var Sizzle = function(selector, context, results, seed) {
    results = results || [];
    var origContext = context = context || document;

    if ( context.nodeType !== 1 && context.nodeType !== 9 ) {
        return [];
    }

    if ( !selector || typeof selector !== "string" ) {
        return results;
    }

    var parts = [], m, set, checkSet, check, mode, extra, prune = true, contextXML = isXML(context);

    chunker.lastIndex = 0;

    while ( (m = chunker.exec(selector)) !== null ) {
        parts.push( m[1] );

        if ( m[2] ) {
            extra = RegExp.rightContext;
            break;
        }
    }

    if ( parts.length > 1 && origPOS.exec( selector ) ) {
        if ( parts.length === 2 && Expr.relative[ parts[0] ] ) {
            set = posProcess( parts[0] + parts[1], context );
        } else {
            set = Expr.relative[ parts[0] ] ?
                [ context ] :
                Sizzle( parts.shift(), context );

            while ( parts.length ) {
                selector = parts.shift();

                if ( Expr.relative[ selector ] )
                    selector += parts.shift();

                set = posProcess( selector, set );
            }
        }
    } else {
        if ( !seed && parts.length > 1 && context.nodeType === 9 && !contextXML &&
                Expr.match.ID.test(parts[0]) && !Expr.match.ID.test(parts[parts.length - 1]) ) {
            var ret = Sizzle.find( parts.shift(), context, contextXML );
            context = ret.expr ? Sizzle.filter( ret.expr, ret.set )[0] : ret.set[0];
        }

        if ( context ) {
            var ret = seed ?
                { expr: parts.pop(), set: makeArray(seed) } :
                Sizzle.find( parts.pop(), parts.length === 1 && (parts[0] === "~" || parts[0] === "+") && context.parentNode ? context.parentNode : context, contextXML );
            set = ret.expr ? Sizzle.filter( ret.expr, ret.set ) : ret.set;

            if ( parts.length > 0 ) {
                checkSet = makeArray(set);
            } else {
                prune = false;
            }

            while ( parts.length ) {
                var cur = parts.pop(), pop = cur;

                if ( !Expr.relative[ cur ] ) {
                    cur = "";
                } else {
                    pop = parts.pop();
                }

                if ( pop == null ) {
                    pop = context;
                }

                Expr.relative[ cur ]( checkSet, pop, contextXML );
            }
        } else {
            checkSet = parts = [];
        }
    }

    if ( !checkSet ) {
        checkSet = set;
    }

    if ( !checkSet ) {
        throw "Syntax error, unrecognized expression: " + (cur || selector);
    }

    if ( toString.call(checkSet) === "[object Array]" ) {
        if ( !prune ) {
            results.push.apply( results, checkSet );
        } else if ( context && context.nodeType === 1 ) {
            for ( var i = 0; checkSet[i] != null; i++ ) {
                if ( checkSet[i] && (checkSet[i] === true || checkSet[i].nodeType === 1 && contains(context, checkSet[i])) ) {
                    results.push( set[i] );
                }
            }
        } else {
            for ( var i = 0; checkSet[i] != null; i++ ) {
                if ( checkSet[i] && checkSet[i].nodeType === 1 ) {
                    results.push( set[i] );
                }
            }
        }
    } else {
        makeArray( checkSet, results );
    }

    if ( extra ) {
        Sizzle( extra, origContext, results, seed );
        Sizzle.uniqueSort( results );
    }

    return results;
};

Sizzle.uniqueSort = function(results){
    if ( sortOrder ) {
        hasDuplicate = false;
        results.sort(sortOrder);

        if ( hasDuplicate ) {
            for ( var i = 1; i < results.length; i++ ) {
                if ( results[i] === results[i-1] ) {
                    results.splice(i--, 1);
                }
            }
        }
    }
};

Sizzle.matches = function(expr, set){
    return Sizzle(expr, null, null, set);
};

Sizzle.find = function(expr, context, isXML){
    var set, match;

    if ( !expr ) {
        return [];
    }

    for ( var i = 0, l = Expr.order.length; i < l; i++ ) {
        var type = Expr.order[i], match;

        if ( (match = Expr.match[ type ].exec( expr )) ) {
            var left = RegExp.leftContext;

            if ( left.substr( left.length - 1 ) !== "\\" ) {
                match[1] = (match[1] || "").replace(/\\/g, "");
                set = Expr.find[ type ]( match, context, isXML );
                if ( set != null ) {
                    expr = expr.replace( Expr.match[ type ], "" );
                    break;
                }
            }
        }
    }

    if ( !set ) {
        set = context.getElementsByTagName("*");
    }

    return {set: set, expr: expr};
};

Sizzle.filter = function(expr, set, inplace, not){
    var old = expr, result = [], curLoop = set, match, anyFound,
        isXMLFilter = set && set[0] && isXML(set[0]);

    while ( expr && set.length ) {
        for ( var type in Expr.filter ) {
            if ( (match = Expr.match[ type ].exec( expr )) != null ) {
                var filter = Expr.filter[ type ], found, item;
                anyFound = false;

                if ( curLoop == result ) {
                    result = [];
                }

                if ( Expr.preFilter[ type ] ) {
                    match = Expr.preFilter[ type ]( match, curLoop, inplace, result, not, isXMLFilter );

                    if ( !match ) {
                        anyFound = found = true;
                    } else if ( match === true ) {
                        continue;
                    }
                }

                if ( match ) {
                    for ( var i = 0; (item = curLoop[i]) != null; i++ ) {
                        if ( item ) {
                            found = filter( item, match, i, curLoop );
                            var pass = not ^ !!found;

                            if ( inplace && found != null ) {
                                if ( pass ) {
                                    anyFound = true;
                                } else {
                                    curLoop[i] = false;
                                }
                            } else if ( pass ) {
                                result.push( item );
                                anyFound = true;
                            }
                        }
                    }
                }

                if ( found !== undefined ) {
                    if ( !inplace ) {
                        curLoop = result;
                    }

                    expr = expr.replace( Expr.match[ type ], "" );

                    if ( !anyFound ) {
                        return [];
                    }

                    break;
                }
            }
        }

        if ( expr == old ) {
            if ( anyFound == null ) {
                throw "Syntax error, unrecognized expression: " + expr;
            } else {
                break;
            }
        }

        old = expr;
    }

    return curLoop;
};

var Expr = Sizzle.selectors = {
    order: [ "ID", "NAME", "TAG" ],
    match: {
        ID: /#((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,
        CLASS: /\.((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,
        NAME: /\[name=['"]*((?:[\w\u00c0-\uFFFF_-]|\\.)+)['"]*\]/,
        ATTR: /\[\s*((?:[\w\u00c0-\uFFFF_-]|\\.)+)\s*(?:(\S?=)\s*(['"]*)(.*?)\3|)\s*\]/,
        TAG: /^((?:[\w\u00c0-\uFFFF\*_-]|\\.)+)/,
        CHILD: /:(only|nth|last|first)-child(?:\((even|odd|[\dn+-]*)\))?/,
        POS: /:(nth|eq|gt|lt|first|last|even|odd)(?:\((\d*)\))?(?=[^-]|$)/,
        PSEUDO: /:((?:[\w\u00c0-\uFFFF_-]|\\.)+)(?:\((['"]*)((?:\([^\)]+\)|[^\2\(\)]*)+)\2\))?/
    },
    attrMap: {
        "class": "className",
        "for": "htmlFor"
    },
    attrHandle: {
        href: function(elem){
            return elem.getAttribute("href");
        }
    },
    relative: {
        "+": function(checkSet, part, isXML){
            var isPartStr = typeof part === "string",
                isTag = isPartStr && !(/\W/).test(part),
                isPartStrNotTag = isPartStr && !isTag;

            if ( isTag && !isXML ) {
                part = part.toUpperCase();
            }

            for ( var i = 0, l = checkSet.length, elem; i < l; i++ ) {
                if ( (elem = checkSet[i]) ) {
                    while ( (elem = elem.previousSibling) && elem.nodeType !== 1 ) {}

                    checkSet[i] = isPartStrNotTag || elem && elem.nodeName === part ?
                        elem || false :
                        elem === part;
                }
            }

            if ( isPartStrNotTag ) {
                Sizzle.filter( part, checkSet, true );
            }
        },
        ">": function(checkSet, part, isXML){
            var isPartStr = typeof part === "string";

            if ( isPartStr && !(/\W/).test(part) ) {
                part = isXML ? part : part.toUpperCase();

                for ( var i = 0, l = checkSet.length; i < l; i++ ) {
                    var elem = checkSet[i];
                    if ( elem ) {
                        var parent = elem.parentNode;
                        checkSet[i] = parent.nodeName === part ? parent : false;
                    }
                }
            } else {
                for ( var i = 0, l = checkSet.length; i < l; i++ ) {
                    var elem = checkSet[i];
                    if ( elem ) {
                        checkSet[i] = isPartStr ?
                            elem.parentNode :
                            elem.parentNode === part;
                    }
                }

                if ( isPartStr ) {
                    Sizzle.filter( part, checkSet, true );
                }
            }
        },
        "": function(checkSet, part, isXML){
            var doneName = done++, checkFn = dirCheck;

            if ( !part.match(/\W/) ) {
                var nodeCheck = part = isXML ? part : part.toUpperCase();
                checkFn = dirNodeCheck;
            }

            checkFn("parentNode", part, doneName, checkSet, nodeCheck, isXML);
        },
        "~": function(checkSet, part, isXML){
            var doneName = done++, checkFn = dirCheck;

            if ( typeof part === "string" && !part.match(/\W/) ) {
                var nodeCheck = part = isXML ? part : part.toUpperCase();
                checkFn = dirNodeCheck;
            }

            checkFn("previousSibling", part, doneName, checkSet, nodeCheck, isXML);
        }
    },
    find: {
        ID: function(match, context, isXML){
            if ( typeof context.getElementById !== "undefined" && !isXML ) {
                var m = context.getElementById(match[1]);
                return m ? [m] : [];
            }
        },
        NAME: function(match, context, isXML){
            if ( typeof context.getElementsByName !== "undefined" ) {
                var ret = [], results = context.getElementsByName(match[1]);

                for ( var i = 0, l = results.length; i < l; i++ ) {
                    if ( results[i].getAttribute("name") === match[1] ) {
                        ret.push( results[i] );
                    }
                }

                return ret.length === 0 ? null : ret;
            }
        },
        TAG: function(match, context){
            return context.getElementsByTagName(match[1]);
        }
    },
    preFilter: {
        CLASS: function(match, curLoop, inplace, result, not, isXML){
            match = " " + match[1].replace(/\\/g, "") + " ";

            if ( isXML ) {
                return match;
            }

            for ( var i = 0, elem; (elem = curLoop[i]) != null; i++ ) {
                if ( elem ) {
                    if ( not ^ (elem.className && (" " + elem.className + " ").indexOf(match) >= 0) ) {
                        if ( !inplace )
                            result.push( elem );
                    } else if ( inplace ) {
                        curLoop[i] = false;
                    }
                }
            }

            return false;
        },
        ID: function(match){
            return match[1].replace(/\\/g, "");
        },
        TAG: function(match, curLoop){
            for ( var i = 0; curLoop[i] === false; i++ ){}
            return curLoop[i] && isXML(curLoop[i]) ? match[1] : match[1].toUpperCase();
        },
        CHILD: function(match){
            if ( match[1] == "nth" ) {
                var test = /(-?)(\d*)n((?:\+|-)?\d*)/.exec(
                    match[2] == "even" && "2n" || match[2] == "odd" && "2n+1" ||
                    !(/\D/).test( match[2] ) && "0n+" + match[2] || match[2]);

                match[2] = (test[1] + (test[2] || 1)) - 0;
                match[3] = test[3] - 0;
            }

            match[0] = done++;

            return match;
        },
        ATTR: function(match, curLoop, inplace, result, not, isXML){
            var name = match[1].replace(/\\/g, "");

            if ( !isXML && Expr.attrMap[name] ) {
                match[1] = Expr.attrMap[name];
            }

            if ( match[2] === "~=" ) {
                match[4] = " " + match[4] + " ";
            }

            return match;
        },
        PSEUDO: function(match, curLoop, inplace, result, not){
            if ( match[1] === "not" ) {
                if ( match[3].match(chunker).length > 1 || (/^\w/).test(match[3]) ) {
                    match[3] = Sizzle(match[3], null, null, curLoop);
                } else {
                    var ret = Sizzle.filter(match[3], curLoop, inplace, true ^ not);
                    if ( !inplace ) {
                        result.push.apply( result, ret );
                    }
                    return false;
                }
            } else if ( Expr.match.POS.test( match[0] ) || Expr.match.CHILD.test( match[0] ) ) {
                return true;
            }

            return match;
        },
        POS: function(match){
            match.unshift( true );
            return match;
        }
    },
    filters: {
        enabled: function(elem){
            return elem.disabled === false && elem.type !== "hidden";
        },
        disabled: function(elem){
            return elem.disabled === true;
        },
        checked: function(elem){
            return elem.checked === true;
        },
        selected: function(elem){
            elem.parentNode.selectedIndex;
            return elem.selected === true;
        },
        parent: function(elem){
            return !!elem.firstChild;
        },
        empty: function(elem){
            return !elem.firstChild;
        },
        has: function(elem, i, match){
            return !!Sizzle( match[3], elem ).length;
        },
        header: function(elem){
            return (/h\d/i).test( elem.nodeName );
        },
        text: function(elem){
            return "text" === elem.type;
        },
        radio: function(elem){
            return "radio" === elem.type;
        },
        checkbox: function(elem){
            return "checkbox" === elem.type;
        },
        file: function(elem){
            return "file" === elem.type;
        },
        password: function(elem){
            return "password" === elem.type;
        },
        submit: function(elem){
            return "submit" === elem.type;
        },
        image: function(elem){
            return "image" === elem.type;
        },
        reset: function(elem){
            return "reset" === elem.type;
        },
        button: function(elem){
            return "button" === elem.type || elem.nodeName.toUpperCase() === "BUTTON";
        },
        input: function(elem){
            return (/input|select|textarea|button/i).test(elem.nodeName);
        }
    },
    setFilters: {
        first: function(elem, i){
            return i === 0;
        },
        last: function(elem, i, match, array){
            return i === array.length - 1;
        },
        even: function(elem, i){
            return i % 2 === 0;
        },
        odd: function(elem, i){
            return i % 2 === 1;
        },
        lt: function(elem, i, match){
            return i < match[3] - 0;
        },
        gt: function(elem, i, match){
            return i > match[3] - 0;
        },
        nth: function(elem, i, match){
            return match[3] - 0 == i;
        },
        eq: function(elem, i, match){
            return match[3] - 0 == i;
        }
    },
    filter: {
        PSEUDO: function(elem, match, i, array){
            var name = match[1], filter = Expr.filters[ name ];

            if ( filter ) {
                return filter( elem, i, match, array );
            } else if ( name === "contains" ) {
                return (elem.textContent || elem.innerText || "").indexOf(match[3]) >= 0;
            } else if ( name === "not" ) {
                var not = match[3];

                for ( var i = 0, l = not.length; i < l; i++ ) {
                    if ( not[i] === elem ) {
                        return false;
                    }
                }

                return true;
            }
        },
        CHILD: function(elem, match){
            var type = match[1], node = elem;
            switch (type) {
                case 'only':
                case 'first':
                    while (node = node.previousSibling)  {
                        if ( node.nodeType === 1 ) return false;
                    }
                    if ( type == 'first') return true;
                    node = elem;
                case 'last':
                    while (node = node.nextSibling)  {
                        if ( node.nodeType === 1 ) return false;
                    }
                    return true;
                case 'nth':
                    var first = match[2], last = match[3];

                    if ( first == 1 && last == 0 ) {
                        return true;
                    }

                    var doneName = match[0],
                        parent = elem.parentNode;

                    if ( parent && (parent.sizcache !== doneName || !elem.nodeIndex) ) {
                        var count = 0;
                        for ( node = parent.firstChild; node; node = node.nextSibling ) {
                            if ( node.nodeType === 1 ) {
                                node.nodeIndex = ++count;
                            }
                        }
                        parent.sizcache = doneName;
                    }

                    var diff = elem.nodeIndex - last;
                    if ( first == 0 ) {
                        return diff == 0;
                    } else {
                        return ( diff % first == 0 && diff / first >= 0 );
                    }
            }
        },
        ID: function(elem, match){
            return elem.nodeType === 1 && elem.getAttribute("id") === match;
        },
        TAG: function(elem, match){
            return (match === "*" && elem.nodeType === 1) || elem.nodeName === match;
        },
        CLASS: function(elem, match){
            return (" " + (elem.className || elem.getAttribute("class")) + " ")
                .indexOf( match ) > -1;
        },
        ATTR: function(elem, match){
            var name = match[1],
                result = Expr.attrHandle[ name ] ?
                    Expr.attrHandle[ name ]( elem ) :
                    elem[ name ] != null ?
                        elem[ name ] :
                        elem.getAttribute( name ),
                value = result + "",
                type = match[2],
                check = match[4];

            return result == null ?
                type === "!=" :
                type === "=" ?
                value === check :
                type === "*=" ?
                value.indexOf(check) >= 0 :
                type === "~=" ?
                (" " + value + " ").indexOf(check) >= 0 :
                !check ?
                value && result !== false :
                type === "!=" ?
                value != check :
                type === "^=" ?
                value.indexOf(check) === 0 :
                type === "$=" ?
                value.substr(value.length - check.length) === check :
                type === "|=" ?
                value === check || value.substr(0, check.length + 1) === check + "-" :
                false;
        },
        POS: function(elem, match, i, array){
            var name = match[2], filter = Expr.setFilters[ name ];

            if ( filter ) {
                return filter( elem, i, match, array );
            }
        }
    }
};

var origPOS = Expr.match.POS;

for ( var type in Expr.match ) {
    Expr.match[ type ] = new RegExp( Expr.match[ type ].source + (/(?![^\[]*\])(?![^\(]*\))/).source );
}

var makeArray = function(array, results) {
    array = Array.prototype.slice.call( array );

    if ( results ) {
        results.push.apply( results, array );
        return results;
    }

    return array;
};

try {
    Array.prototype.slice.call( document.documentElement.childNodes );

} catch(e){
    makeArray = function(array, results) {
        var ret = results || [];

        if ( toString.call(array) === "[object Array]" ) {
            Array.prototype.push.apply( ret, array );
        } else {
            if ( typeof array.length === "number" ) {
                for ( var i = 0, l = array.length; i < l; i++ ) {
                    ret.push( array[i] );
                }
            } else {
                for ( var i = 0; array[i]; i++ ) {
                    ret.push( array[i] );
                }
            }
        }

        return ret;
    };
}

var sortOrder;

if ( document.documentElement.compareDocumentPosition ) {
    sortOrder = function( a, b ) {
        var ret = a.compareDocumentPosition(b) & 4 ? -1 : a === b ? 0 : 1;
        if ( ret === 0 ) {
            hasDuplicate = true;
        }
        return ret;
    };
} else if ( "sourceIndex" in document.documentElement ) {
    sortOrder = function( a, b ) {
        var ret = a.sourceIndex - b.sourceIndex;
        if ( ret === 0 ) {
            hasDuplicate = true;
        }
        return ret;
    };
} else if ( document.createRange ) {
    sortOrder = function( a, b ) {
        var aRange = a.ownerDocument.createRange(), bRange = b.ownerDocument.createRange();
        aRange.selectNode(a);
        aRange.collapse(true);
        bRange.selectNode(b);
        bRange.collapse(true);
        var ret = aRange.compareBoundaryPoints(Range.START_TO_END, bRange);
        if ( ret === 0 ) {
            hasDuplicate = true;
        }
        return ret;
    };
}

(function(){
    var form = document.createElement("div"),
        id = "script" + (new Date).getTime();
    form.innerHTML = "<a name='" + id + "'/>";

    var root = document.documentElement;
    root.insertBefore( form, root.firstChild );

    if ( !!document.getElementById( id ) ) {
        Expr.find.ID = function(match, context, isXML){
            if ( typeof context.getElementById !== "undefined" && !isXML ) {
                var m = context.getElementById(match[1]);
                return m ? m.id === match[1] || typeof m.getAttributeNode !== "undefined" && m.getAttributeNode("id").nodeValue === match[1] ? [m] : undefined : [];
            }
        };

        Expr.filter.ID = function(elem, match){
            var node = typeof elem.getAttributeNode !== "undefined" && elem.getAttributeNode("id");
            return elem.nodeType === 1 && node && node.nodeValue === match;
        };
    }

    root.removeChild( form );
})();

(function(){

    var div = document.createElement("div");
    div.appendChild( document.createComment("") );

    if ( div.getElementsByTagName("*").length > 0 ) {
        Expr.find.TAG = function(match, context){
            var results = context.getElementsByTagName(match[1]);

            if ( match[1] === "*" ) {
                var tmp = [];

                for ( var i = 0; results[i]; i++ ) {
                    if ( results[i].nodeType === 1 ) {
                        tmp.push( results[i] );
                    }
                }

                results = tmp;
            }

            return results;
        };
    }

    div.innerHTML = "<a href='#'></a>";
    if ( div.firstChild && typeof div.firstChild.getAttribute !== "undefined" &&
            div.firstChild.getAttribute("href") !== "#" ) {
        Expr.attrHandle.href = function(elem){
            return elem.getAttribute("href", 2);
        };
    }
})();

if ( document.querySelectorAll ) (function(){
    var oldSizzle = Sizzle, div = document.createElement("div");
    div.innerHTML = "<p class='TEST'></p>";

    if ( div.querySelectorAll && div.querySelectorAll(".TEST").length === 0 ) {
        return;
    }

    Sizzle = function(query, context, extra, seed){
        context = context || document;

        if ( !seed && context.nodeType === 9 && !isXML(context) ) {
            try {
                return makeArray( context.querySelectorAll(query), extra );
            } catch(e){}
        }

        return oldSizzle(query, context, extra, seed);
    };

    for ( var prop in oldSizzle ) {
        Sizzle[ prop ] = oldSizzle[ prop ];
    }
})();

if ( document.getElementsByClassName && document.documentElement.getElementsByClassName ) (function(){
    var div = document.createElement("div");
    div.innerHTML = "<div class='test e'></div><div class='test'></div>";

    if ( div.getElementsByClassName("e").length === 0 )
        return;

    div.lastChild.className = "e";

    if ( div.getElementsByClassName("e").length === 1 )
        return;

    Expr.order.splice(1, 0, "CLASS");
    Expr.find.CLASS = function(match, context, isXML) {
        if ( typeof context.getElementsByClassName !== "undefined" && !isXML ) {
            return context.getElementsByClassName(match[1]);
        }
    };
})();

function dirNodeCheck( dir, cur, doneName, checkSet, nodeCheck, isXML ) {
    var sibDir = dir == "previousSibling" && !isXML;
    for ( var i = 0, l = checkSet.length; i < l; i++ ) {
        var elem = checkSet[i];
        if ( elem ) {
            if ( sibDir && elem.nodeType === 1 ){
                elem.sizcache = doneName;
                elem.sizset = i;
            }
            elem = elem[dir];
            var match = false;

            while ( elem ) {
                if ( elem.sizcache === doneName ) {
                    match = checkSet[elem.sizset];
                    break;
                }

                if ( elem.nodeType === 1 && !isXML ){
                    elem.sizcache = doneName;
                    elem.sizset = i;
                }

                if ( elem.nodeName === cur ) {
                    match = elem;
                    break;
                }

                elem = elem[dir];
            }

            checkSet[i] = match;
        }
    }
}

function dirCheck( dir, cur, doneName, checkSet, nodeCheck, isXML ) {
    var sibDir = dir == "previousSibling" && !isXML;
    for ( var i = 0, l = checkSet.length; i < l; i++ ) {
        var elem = checkSet[i];
        if ( elem ) {
            if ( sibDir && elem.nodeType === 1 ) {
                elem.sizcache = doneName;
                elem.sizset = i;
            }
            elem = elem[dir];
            var match = false;

            while ( elem ) {
                if ( elem.sizcache === doneName ) {
                    match = checkSet[elem.sizset];
                    break;
                }

                if ( elem.nodeType === 1 ) {
                    if ( !isXML ) {
                        elem.sizcache = doneName;
                        elem.sizset = i;
                    }
                    if ( typeof cur !== "string" ) {
                        if ( elem === cur ) {
                            match = true;
                            break;
                        }

                    } else if ( Sizzle.filter( cur, [elem] ).length > 0 ) {
                        match = elem;
                        break;
                    }
                }

                elem = elem[dir];
            }

            checkSet[i] = match;
        }
    }
}

var contains = document.compareDocumentPosition ?  function(a, b){
    return a.compareDocumentPosition(b) & 16;
} : function(a, b){
    return a !== b && (a.contains ? a.contains(b) : true);
};

var isXML = function(elem){
    return elem.nodeType === 9 && elem.documentElement.nodeName !== "HTML" ||
        !!elem.ownerDocument && elem.ownerDocument.documentElement.nodeName !== "HTML";
};

var posProcess = function(selector, context){
    var tmpSet = [], later = "", match,
        root = context.nodeType ? [context] : context;

    while ( (match = Expr.match.PSEUDO.exec( selector )) ) {
        later += match[0];
        selector = selector.replace( Expr.match.PSEUDO, "" );
    }

    selector = Expr.relative[selector] ? selector + "*" : selector;

    for ( var i = 0, l = root.length; i < l; i++ ) {
        Sizzle( selector, root[i], tmpSet );
    }

    return Sizzle.filter( later, tmpSet );
};


Playdar.Util.select = Sizzle;

})();

Playdar.Util.addEvent(window, 'beforeunload', Playdar.beforeunload);
Playdar.Util.addEvent(window, 'unload', Playdar.unload);
