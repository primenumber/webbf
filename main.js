"use strict";

let vm = new Vue({
  el: '#app',
  data: {
    sourcecode: '',
    stdin_data: '',
    stdout_data: '',
    stderr_data: '',
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
    }
  },
  methods: {
    start: function(e) {
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
            vm.stdout_data = (new TextDecoder).decode(e.data.stdout);
            vm.stderr_data = (new TextDecoder).decode(e.data.stderr);
            vm.program_status = 'not_started';
            break;
          case 'step':
            vm.prog_ptr = e.data.prog_ptr;
            vm.data_ptr = e.data.data_ptr;
            break;
          case 'stdout':
            vm.stdout_data += String.fromCharCode(e.data.data);
            break;
          case 'stderr':
            vm.stderr_data += String.fromCharCode(e.data.data);
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
      throw "Not implemented step";
    },
    stepout: function(e) {
      throw "Not implemented stepout";
    },
  }
})
