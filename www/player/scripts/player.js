/*
function arraySum(a) {
    var sum = 0
    $.each(a,function(i) {
      sum += a[i];
    });
    return sum;
}


Playlist = function(){}
Playlist.prototype = {
  tracks: [],
  trackids: {},
  currentid: false,
  id: "playlist0001",
  
  init: function(){
    var self=this;
    $('#playlist')
      .clone()
      .attr('id',"list-" + this.id)
      .appendTo("#lists")
      .hide();
    this.dom = $("#lists > div:last"); // a bit ugly
    this.list = $("tbody", this.dom);
    this.colWidths = new Array(20,250,130,50,100); // default col widths
    // header colWidths
    $("table.list-header th",this.dom).each(function(i) {
      $(this).width(self.colWidths[i]);
    });
    

  },
  
  addTrack: function(t){
    var self = this;
    if(!t.qid) t.sid=Playdar.Util.generate_uuid();
    this.tracks[this.tracks.length] = t;
    //this.trackqids[t.qid]=this.tracks.length-1;
    $('#playlist-row table tr')
      .clone()
      //.css("width",SC.arraySum(self.colWidths)+7*7)
      .dblclick(function() {
        //self.player.currentPlaylist = self;
        // find out at which position we are at in the playlist, and store that as the currentPos
        //self.currentPos = $(this).parents("tbody").find("tr").index(this);
        $(this).addClass("selected");
         self.loadTrack(self.currentPos);
      })
      .find("td:nth-child(1)").css("width",self.colWidths[0]).end()
      .find("td:nth-child(2)").css("width",self.colWidths[1]).text(t.track).end()
      .find("td:nth-child(3)").css("width",self.colWidths[2]).text(t.artist).end()
      .find("td:nth-child(4)").css("width",self.colWidths[3]).text(Playdar.Util.mmss(t.duration)).end()
      .find("td:nth-child(5)").css("width",self.colWidths[4]).text("???").end()
      .end()
      .appendTo(this.list);

    return t.qid;
  },
  resolveAll: function(){
    for (var i=0;i<this.tracks.length;i++)
    {
      var trk = this.tracks[i];
      Playdar.client.resolve(trk.artist, trk.track, trk.sid);
      $('#'+trk.qid).addClass('resolving');
    }
  }
};

var fakelist = new Playlist;
fakelist.addTrack({ 'track':'Some track title',
		    'artist': 'Some artistname',
		    'sid': '9437ED1F-FD2B-4A80-8891-58666AA1CAB3',
		    'duration' : 200
		  });
fakelist.addTrack({ 'track':'Some Other track title',
		    'artist': 'Some OTHER artistname',
		    'sid': '9437ED1F-FD2B-4A80-8891-58666AA1CAB3',
		    'duration' : 234
		  });

*/		  
Player = function(){}
Player.prototype = {
  isPlaying: false,
  currentTrack : {},
  
  go: function() {
    Playdar.USE_JSONP=false;
    Playdar.USE_STATUS_BAR=false;
    Playdar.setupClient({
      onAuth: function () {
	  p.initialize();
      },
      onStatTimeout: function(){ alert('No playdar, FAIL. start playdar then refresh player'); },
      // Called in response to each poll with the results so far.
      onResults: function (response, lastPoll) {
	  p.playdarResult(response, lastPoll);
      }
    });
    MK.setWindowTitle("Playdar stat..");
    Playdar.client.go();
  },
  
  initialize: function() {
    MK.setWindowTitle("Env init..");
    this.playlists = [];
    var self = this;
    this.playButton = $('#play');
    this.playButton.click(function() {
      self.togglePlay();
    });

    sidebarWidth = 220;
        
    $("#sidebar").width(sidebarWidth);
    $("#main-container").css("left",sidebarWidth);

    this.volume = 75;//parseFloat($.cookie('volume'));
    if(!this.volume) {
      this.volume = 100; // default to max
    }

    // volume
    $("#volume").slider({
      value : this.volume,
      min : 0,
      max : 100,
      slide : function(e, ui) {
        self.volume = ui.value;
	MK.setVolume(self.volume);
      },
      change : function(e, ui) {
        // save the volume in a cookie
      }
    });

    $('#next').click(function() {
      alert('next');
    });

    $('#prev').click(function() {
      alert('prev');
    }); 
   
    // add playlist button
    $("#add-playlist").click(function(ev) {
      var spiff = prompt("Enter XSPF URL","");
      alert('TODO, load ' + spiff);
    });
    
    // click behaviour for transport buttons
    $("#play,#prev,#next,#rand,#loop,#add-playlist").mousedown(function() {
      $(this).addClass("click");
    }).mouseup(function() {
      $(this).removeClass("click");
    });
    
    $('#loop').click(function(){
      var track = { 'track':'Some track title',
		    'artist': 'Some artistname',
		    'sid': '9437ED1F-FD2B-4A80-8891-58666AA1CAB3',
		    'duration' : 200
		  };
      self.play(track);
    });
    
    $('#rand').click(function(){
      self.switchPlaylist(fakeplaylist);
    });
    this.playlists = {};
    
    // Wire up events from musickit container:
    
    // one of: playing stopped paused buffering loading
    MK.stateChange.connect(function(state){
      this.laststate = state;
      MK.setWindowTitle(this.laststate);
      switch(this.laststate)
      {
	case 'stopped':
	  self.trackEnded();
	  break;	  
	case 'playing':
	  self.trackStarted(self.currentTrack);
	  break;
      }
    });
    
    MK.elapsed.connect(function(elapsed, remaining){
      $('#position').html(Playdar.Util.mmss(elapsed));
      $('#duration').html(Playdar.Util.mmss(remaining));
      //MK.setWindowTitle(elapsed + '/' + remaining);
      var val = 100*elapsed/(elapsed+remaining);
      $('#elapsed').css('width', val+'%');
      //if($('#loaded').css('width') < (val+'%')) $('#loaded').css('width', val+'%');
    });
    
    MK.bufferPercent.connect(function(pc){
       // $('#loaded').css('width', pc +'%');
    });
    
    MK.volumeChanged.connect(function(v){
      $("#volume").slider('option', 'value', v);
    });
    
    MK.setWindowTitle("Ready.");
    
  },
  
  playdarResult: function(response, lastPoll){
    
  },
  
  play: function(track) {
    MK.stop();
    var sid = track.sid;  
    var self = this;
    var url = "http://www.playdar.org/hiding.mp3";
    //var url = "http://localhost:60210/sid/"+sid;
    self.currentTrack = track;
    MK.play(url);
  },
  
  togglePlay : function() {
    MK.togglePause();
  },  
  
  stop: function() {
    MK.stop();  
    self.trackEnded();
  },
  
  trackEnded: function() {
    // TODO move to next track in list
    self.isPlaying = false;
    $("body").removeClass("playing");
    $('#np').fadeOut();
    $('#progress').fadeOut();
    $('#position').fadeOut();
    $('#duration').fadeOut();
  },
  
  trackStarted: function(track) {
    this.isPlaying = true;
    $("body").addClass("playing");
    //this.loading.css('width',"100%");
    $('#np').hide().html(track.artist + " - " + track.track).fadeIn();
    $('#position').hide().html("00:00").fadeIn();
    $('#duration').hide().html("00:00").fadeIn();
    $('#progress').fadeIn();
    $('#elapsed').css('width', '0%').fadeIn();
    //$('#loaded').css('width', '0%').fadeIn();
  },
  
  switchPlaylist: function(pl){
    self.currentPlaylist=pl;
    
  }
  
};


// Playdar



$(document).ready(function(){
  window.p = new Player();
  p.go();
  
   $('#playlist')
      .clone()
      .attr('id',"pl")
      .appendTo("#lists")
      .show();
      
  this.dom = $("#lists > table:last"); // a bit ugly
  //this.dom = $('pl');
  this.list = $("tbody", this.dom);
  
  
  function withinHeaderDragArea(el,e) {
      var left = e.clientX-$(el).offset().left-($(el).width()+3);
      if(left > 0 && left < 4) {
        return true;
      } else {
        return false;
      }
  }
  $("th",this.dom)
      .mousemove(function(e) {
        if(withinHeaderDragArea(this,e)) {
          $(this).css("cursor","col-resize");
        } else {
          $(this).css("cursor","default");
        }
      })
      .mousedown(function(e) {
        var $col = $(this);
        var oldColWidth = $col.width();
        var colIdx = $(this).parents("thead").find("th").index(this) + 1;
        var rowWidth = $(this).parents("tr").width();
        var $row = $(this).parents("tr");
        var $rows = $("tr",self.list);

        if(withinHeaderDragArea(this,e)) {
          $(document)
            .mouseup(function() {
              $(document).unbind("mousemove");
            })
            .mousemove(function(ev) {
              var colWidth = ev.clientX - $col.offset().left;
              $col.width(colWidth);
              // resize all the cells in the same col
              $("td:nth-child(" + colIdx + ")", self.list).width(colWidth);
              $row.width(rowWidth+(colWidth-oldColWidth));
              $rows.width(rowWidth+(colWidth-oldColWidth));
            });
          }
      })
      .mouseup(function(e) {
        //var colIdx = $(this).parents("thead").find("th").index(this) + 1;
        //$.cookie('playlist_col_width_' + (colIdx-1),$(this).width());
      });

  
  
  for(var i=0;i<100;i++)
  {
    $('#playlist-row')
      .clone()
      //.css("width",SC.arraySum(self.colWidths)+7*7)
      .dblclick(function() {
        //self.player.currentPlaylist = self;
        // find out at which position we are at in the playlist, and store that as the currentPos
        //self.currentPos = $(this).parents("tbody").find("tr").index(this);
        $(this).addClass("selected");
         //self.loadTrack(self.currentPos);
      })
      .appendTo(this.list);
  }
    
});



