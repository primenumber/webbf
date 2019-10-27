"use strict";

function encodeWithMode(data, mode, decoder) {
  switch (mode) {
    case 'raw':
      return decoder.decode(data, {stream: true});
    case 'hex':
      return Array.prototype.map.call(data, x => ('00' + x.toString(16)).slice(-2)).join('');
    default:
      throw "Unknown encode mode: " + mode;
  }
}

function decodeWithMode(string, mode) {
  switch (mode) {
    case 'raw':
      return (new TextEncoder).encode(string);
    case 'hex':
      const len = string.length / 2;
      let res = new Uint8Array(len);
      for (let i = 0; i < len; ++i) {
        res[i] = parseInt(string.substring(i*2, 2), 16);
      }
      return res;
    default:
      throw "Unknown decode mode: " + mode;
  }
}

let vm = new Vue({
  el: '#app',
  data: {
    sourcecode: '',
    stdout_decoder: new TextDecoder(),
    stderr_decoder: new TextDecoder(),
    stdin_string: '',
    stdout_string: '',
    stderr_string: '',
    debug_mode: 'simple',
    stdin_mode: 'raw',
    stdout_mode: 'raw',
    stderr_mode: 'raw',
    eof: 0,
    interval: 100,
    worker: new Worker('bfi.js'),
    program_status: 'not_started',
    prog_ptr: 0,
    data_ptr: 0
  },
  computed: {
    enable_debug: function() {
      switch (this.debug_mode) {
        case 'simple': return true;
        case 'logging': return true;
        case 'disable': return false;
        default:
          throw 'unknown debug mode: ' + this.debug_mode;
      }
    },
    is_running: function() {
      return this.program_status == 'running';
    },
    is_breaking: function() {
      return this.program_status == 'breaking';
    },
    stdin_data: function() {
      return decodeWithMode(this.stdin_string, this.stdin_mode);
    }
  },
  methods: {
    start: function(e) {
      this.stdout_decoder = new TextDecoder;
      this.stderr_decoder = new TextDecoder;
      this.stdout_string = '';
      this.stderr_string = '';
      let data = {
        command: 'start',
        mode: this.debug_mode,
        source: this.sourcecode,
        eof: this.eof,
        input: this.stdin_data,
        interval: this.interval
      };
      this.worker = new Worker('bfi.js');
      this.worker.onmessage = function(e) {
        switch (e.data.type) {
          case 'finished':
            vm.stdout_string = encodeWithMode(e.data.stdout, vm.stdout_mode, vm.stdout_decoder);
            vm.program_status = 'not_started';
            break;
          case 'step':
            vm.prog_ptr = e.data.prog_ptr;
            vm.data_ptr = e.data.data_ptr;
            break;
          case 'stdout':
            let stdout = new Uint8Array([e.data.data]);
            vm.stdout_string += encodeWithMode(stdout, vm.stdout_mode, vm.stdout_decoder);
            break;
          case 'stderr':
            let stderr = new Uint8Array([e.data.data]);
            vm.stderr_string += encodeWithMode(stderr, vm.stderr_mode, vm.stderr_decoder);
            break;
          case 'break':
            vm.program_status = 'breaking';
            break;
          default:
            throw "Unknown type: " + e.data.type;
        }
      }
      this.worker.onerror = function(e) {
        console.log(e.message);
      }
      this.worker.postMessage(data);
      this.program_status = 'running';
    },
    stop: function(e) {
      if (this.debug_mode == 'disable') {
        this.worker.terminate();
        this.program_status = 'not_started';
      } else {
        this.worker.postMessage({
          command: 'stop'
        });
        this.program_status = 'breaking';
      }
    },
    restart: function(e) {
      this.worker.postMessage({
        command: 'restart',
        interval: this.interval
      });
      this.program_status = 'running';
    },
    step: function(e) {
      this.worker.postMessage({
        command: 'step'
      });
    },
    stepout: function(e) {
      throw "Not implemented stepout";
    },
  }
})
