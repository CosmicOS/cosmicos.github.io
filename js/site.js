(function() {

var ev = null;
var parts = ["spider", "four", "text", "gate", "hear"];
var partIndex = 1;

function showMessagePart(name, callback) {
  var request = new XMLHttpRequest();
  request.open('GET', '/parts/' + name + '.html', true);
  request.onload = function() {
    if (request.status >= 200 && request.status < 400) {
      $("#show-message-container").html("<div class='show-message'></div>");
      $(".show-message").addClass('fadeIn');
      $(".show-message").html(request.responseText);
      for (var i=0; i<parts.length; i++) {
        if (parts[i] === name) {
          $("#msg-choice-" + i).addClass('msg-active');
        } else {
          $("#msg-choice-" + i).removeClass('msg-active');
        }
      }
      if (callback) {
        setupVideo();
        callback();
      }
    }
  };
  request.send();
  return false;
}

function stopCarousel() {
  if (ev) {
    clearTimeout(ev);
    ev = null;
  }
}

function selectPart(i) {
  stopCarousel();
  showMessagePart(parts[i], null);
}

function switchPart() {
  var part = parts[partIndex];
  partIndex = (partIndex + 1) % parts.length;
  showMessagePart(part, function() { ev = setTimeout(switchPart, 5000); });
}

function setupCarousel() {
  var show = $('.show-message');
  if (show.length === 0) { return; }
  var choices = "";
  for (var i=0; i<parts.length; i++) {
    choices += " <a id='msg-choice-" + i + "' href='#''>&#9679;</a> ";
  }
  $("#msg-choice").html(choices);
  $("#msg-choice-0").addClass("msg-active");
  for (var i=0; i<parts.length; i++) {
    const at = i;
    $("#msg-choice-" + i).click(function(e) {
      e.preventDefault();
      selectPart(at);
      return false;
    });
  }
  ev = setTimeout(switchPart, 5000);
}

function setupVideo() {
  var show = $('iframe.show-video');
  if (show.length === 0) { return; }

  function onPlayerStateChange(event) {
    stopCarousel();
  }

  var player;
  var player2;
  var init = function() {
    player = new YT.Player('player', {
      events: {
        'onStateChange': onPlayerStateChange
      }
    });
    player2 = new YT.Player('player2', {
      events: {
        'onStateChange': onPlayerStateChange
      }
    });
  };
  if (!window.onYouTubePlayerAPIReady) {
    window.onYouTubePlayerAPIReady = init;
    init();
  } else {
    init();
  }
}

function setup() {
  setupCarousel();
  setupVideo();
}

$(document).ready(setup);

}());
