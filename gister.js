var request = require('request');
var EventEmitter = require('events').EventEmitter;

// ## Gist
//
// Constructs a new Gist object.
// Instance of EventEmitter.
//
// **o** is an Object which contains
//
// * __username__ GitHub username
// * __token__ Your secret API token, can be found in [Account Settings](https://github.com/account/admin)
// * __gist_id__ (optional) The Gist ID
function Gist(o) {
  EventEmitter.call(this);

  o = o || {};

  this.username = o.username;
  this.token = o.token;
  this.gist_id = o.gist_id;
}

Gist.prototype = Object.create(EventEmitter.prototype);

function response(statusCode, cb) {
  return function (err, response, body) {
    if (err) {
      throw err;
    }

    if (response.statusCode !== statusCode) {
      throw new Error(body);
    } else {
      cb(body, response);
    }
  };
}

function xhr(opts, data, cb) {
  if (data) {
    if (!this.username || !this.token) {
      return this.emit("error:credentials");
    }

    opts.form = {
      login: this.username,
      token: this.token,
      "file_contents[gistfile1json]": data
    };
  }

  return this.request(opts, cb);
}

// Uses request to talk to GitHub API.
// Provided in the prototype so request can be mocked for tests.
Gist.prototype.request = function (opts, cb) {
  return request(opts, cb);
};

// Retrieves a gist from gist.github.com
//
// Uses `gist_id` to determine which gist it'll retrieve
// compatible with GitHub API v3
//
// If no `gist_id` is provided, event **error:gist_id** is emitted.
//
// On success, event **get** is emitted with `body` passed.
// `body` is the response from GitHub.
Gist.prototype.get = function () {
  if (!this.gist_id) {
    return this.emit('error:gist_id');
  }

  var uri = 'https://api.github.com/gists/' + this.gist_id;
  var req = xhr.bind(this);

  req({ uri: uri }, null, response(200, function (body) {
    this.emit('get', body);
  }.bind(this)));
};

// Convenience method which will create a new gist
// if `gist_id` is not provided. If it is provided,
// the gist will be updated.
//
// Parameter __data__ is the data to create/edit to gist
Gist.prototype.sync = function (data) {
  if (!this.gist_id) {
    return this.create(data);
  } else {
    return this.edit(data);
  }
};

// Edits a gist
//
// Compatible with GitHub API v2. Success is status code 302.
//
// If no `gist_id` is provided, event **error:gist_id** is emitted.
//
// On success, event **updated** is emitted with
// `body`, the response from GitHub.
Gist.prototype.edit = function (data) {
  if (!this.gist_id) {
    return this.emit('error:gist_id');
  }

  var opts = {
    uri: 'https://gist.github.com/gists/' + this.gist_id,
    method: 'PUT'
  };
  var req = xhr.bind(this);

  req(opts, data, response(302, function (body) {
    this.emit('updated', body);
  }.bind(this)));
};

// Creates a new gist
//
// Compatible with GitHub API v2. Success is status code 302.
//
// On success, event **created** is emitted with
// `body` as well as the new `gist_id`.
Gist.prototype.create = function (data) {
  var opts = {
    uri: 'https://gist.github.com/gists',
    method: 'POST'
  };
  var req = xhr.bind(this);

  req(opts, data, response(302, function (body, res) {
    var gist = /(\d+)/;
    var location = res.headers.location;
    var gist_id = null;

    if (gist.test(location)) {
      gist_id = gist.exec(location)[0];
    }

    this.emit('created', body, gist_id);
  }.bind(this)));
};

module.exports = Gist;
