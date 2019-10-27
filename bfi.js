"use strict";

class BFInterpreterBase {
  constructor(source, eof) {
    this._source = source;
    this._eof = eof;
  }
  get source() {
    return this._source;
  }
  get eof() {
    return this._eof;
  }
}

class OptimizedBFInterpreter extends BFInterpreterBase {
  constructor(source, eof) {
    super(source, eof);
    this.jumpmap = new Map();
    let stack = [];
    Array.prototype.forEach.call(this._source, (chr, index) => {
      switch (chr) {
        case '[':
          stack.push(index);
          break;
        case ']':
          const matched_index = stack.pop();
          if (matched_index == undefined) {
            throw "Unmatched brackets";
          }
          this.jumpmap.set(index, matched_index);
          this.jumpmap.set(matched_index, index);
        default:;
      }
    });
    if (stack.length > 0) {
      throw "Unmatched brackets";
    }
  }
  run(input) {
    let data = new Uint8Array(65536);
    let data_ptr = 0;
    let prog_ptr = 0;
    const input_bytes = (new TextEncoder).encode(input);
    let input_ptr = 0;
    let output_data = [];
    while (prog_ptr < this._source.length) {
      switch (this._source[prog_ptr]) {
        case '+':
          data[data_ptr] += 1;
          break;
        case '-':
          data[data_ptr] -= 1;
          break;
        case '>':
          data_ptr += 1;
          if (data_ptr >= data.length) {
            throw "Out of range";
          }
          break;
        case '<':
          data_ptr -= 1;
          if (data_ptr < 0) {
            throw "Out of range";
          }
          break;
        case '[':
          if (data[data_ptr] == 0) {
            prog_ptr = this.jumpmap.get(prog_ptr);
          }
          break;
        case ']':
          if (data[data_ptr] != 0) {
            prog_ptr = this.jumpmap.get(prog_ptr);
          }
          break;
        case ',':
          if (input_ptr < input_bytes.length) {
            data[data_ptr] = input_bytes[input_ptr];
            input_ptr += 1;
          } else {
            data[data_ptr] = this._eof;
          }
          break;
        case '.':
          output_data.push(data[data_ptr]);
          break;
        default:;
      }
      prog_ptr += 1;
    }
    return Uint8Array.from(output_data);
  }
}

class SimplBFDebbuger extends BFInterpreterBase {
  constructor(source, eof) {
    super(source, eof);
    this.jumpmap = new Map();
    let stack = [];
    Array.prototype.forEach.call(this._source, (chr, index) => {
      switch (chr) {
        case '[':
          stack.push(index);
          break;
        case ']':
          const matched_index = stack.pop();
          if (matched_index == undefined) {
            throw "Unmatched brackets";
          }
          this.jumpmap.set(index, matched_index);
          this.jumpmap.set(matched_index, index);
        default:;
      }
    });
    if (stack.length > 0) {
      throw "Unmatched brackets";
    }
    this._data = new Uint8Array(65536);
    this._data_ptr = 0;
    this._prog_ptr = 0;
  }
  get data() {
    return this._data;
  }
  get data_ptr() {
    return this._data_ptr;
  }
  get prog_ptr() {
    return this._prog_ptr;
  }
  get stdout_data() {
    return Uint8Array.from(this._stdout_data);
  }
  get stderr_data() {
    return Uint8Array.from(this._stderr_data);
  }
  run(input, interval) {
    this._data = new Uint8Array(65536);
    this._data_ptr = 0;
    this._prog_ptr = 0;
    this.input_bytes = (new TextEncoder).encode(input);
    this.input_ptr = 0;
    this._stdout_data = [];
    this._stderr_data = [];
    this.handle = setInterval(() => this.step(), interval);
  }
  step() {
    if (this._prog_ptr >= this._source.length) {
      clearInterval(this.handle);
      const stdout = Uint8Array.from(this._stdout_data);
      const stderr = Uint8Array.from(this._stderr_data);
      postMessage({
        type: 'finished',
        stdout: stdout,
        stderr: stderr
      });
      return;
    }
    postMessage({
      type: 'step',
      prog_ptr: this._prog_ptr,
      data_ptr: this._data_ptr,
      data: this._data
    });
    switch (this._source[this.prog_ptr]) {
      case '+':
        this._data[this._data_ptr] += 1;
        break;
      case '-':
        this._data[this._data_ptr] -= 1;
        break;
      case '>':
        this._data_ptr += 1;
        if (this._data_ptr >= this._data.length) {
          throw "Out of range";
        }
        break;
      case '<':
        this._data_ptr -= 1;
        if (this._data_ptr < 0) {
          throw "Out of range";
        }
        break;
      case '[':
        if (this._data[this._data_ptr] == 0) {
          this._prog_ptr = this.jumpmap.get(this._prog_ptr);
        }
        break;
      case ']':
        if (this._data[this._data_ptr] != 0) {
          this._prog_ptr = this.jumpmap.get(this._prog_ptr);
        }
        break;
      case ',':
        if (this.input_ptr < this.input_bytes.length) {
          this._data[this._data_ptr] = this.input_bytes[this.input_ptr];
          this.input_ptr += 1;
        } else {
          this._data[this._data_ptr] = this._eof;
        }
        break;
      case '.':
        this._stdout_data.push(this._data[this._data_ptr]);
        postMessage({
          type: 'stdout',
          data: this._data[this._data_ptr]
        });
        break;
      case ':':
        this._stderr_data.push(this._data[this._data_ptr]);
        postMessage({
          type: 'stderr',
          data: this._data[this._data_ptr]
        });
        break;
      case '@':
        clearInterval(this.handle);
        postMessage({
          type: 'break'
        });
        break;
      default:;
    }
    this._prog_ptr += 1;
  }
  stop() {
    clearInterval(this.handle);
  }
  restart(interval) {
    this.handle = setInterval(() => this.step(), interval);
  }
}

let instance;
let current_mode = 'disable';

onmessage = function(e) {
  switch (e.data.command) {
    case 'start':
      const source = e.data.source;
      const eof = e.data.eof;
      const input = e.data.input;
      switch (e.data.mode) {
        case 'disable':
          let bfi = new OptimizedBFInterpreter(source, eof);
          const result = bfi.run(input);
          postMessage({
            type:'finished',
            stdout: result,
            stderr: new Uint8Array()
          });
          break;
        case 'simple':
          instance = new SimplBFDebbuger(source, eof);
          instance.run(input, e.data.interval);
          break;
        default:
          throw "Not implemented interpreter";
      }
      current_mode = e.data.mode;
      break;
    case 'stop':
      instance.stop();
      break;
    case 'restart':
      instance.restart(e.data.interval);
      break;
    case 'step':
      instance.step();
      break;
    default:
      throw "Unknown command: " + e.data.command;
  }
}
