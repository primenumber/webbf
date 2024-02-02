"use strict";

self.importScripts('vector.js');

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
    let data = new Uint8Vector(65536);
    let data_ptr = 0;
    let prog_ptr = 0;
    let cycle_count = 0;
    let input_ptr = 0;
    let output_data = [];
    while (prog_ptr < this._source.length) {
      switch (this._source[prog_ptr]) {
        case '+':
          data.set_at(data_ptr, data.at(data_ptr) + 1);
          break;
        case '-':
          data.set_at(data_ptr, data.at(data_ptr) - 1);
          break;
        case '>':
          data_ptr += 1;
          if (data_ptr >= data.length) {
            data.push(0);
          }
          break;
        case '<':
          data_ptr -= 1;
          if (data_ptr < 0) {
            throw "Out of range";
          }
          break;
        case '[':
          if (data.at(data_ptr) == 0) {
            prog_ptr = this.jumpmap.get(prog_ptr);
          }
          break;
        case ']':
          if (data.at(data_ptr) != 0) {
            prog_ptr = this.jumpmap.get(prog_ptr);
          }
          break;
        case ',':
          if (input_ptr < input.length) {
            data.set_at(data_ptr, input[input_ptr]);
            input_ptr += 1;
          } else {
            data.set_at(data_ptr, this._eof);
          }
          break;
        case '.':
          output_data.push(data.at(data_ptr));
          break;
        default:;
      }
      prog_ptr += 1;
      cycle_count += 1;
    }
    return [Uint8Array.from(output_data), cycle_count];
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
    this._data = new Uint8Vector(1024);
    this._data_ptr = 0;
    this._prog_ptr = 0;
    this._cycle_count = 0;
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
  get cycle_count() {
    return this._cycle_count;
  }
  run(input, interval) {
    this._data = new Uint8Vector(1024);
    this._data_ptr = 0;
    this._prog_ptr = 0;
    this._cycle_count = 0;
    this.input = input;
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
        cycle_count: this._cycle_count,
        stdout: stdout,
        stderr: stderr
      });
      return;
    }
    postMessage({
      type: 'step',
      prog_ptr: this._prog_ptr,
      data_ptr: this._data_ptr,
      cycle_count: this._cycle_count,
      data: this._data.toArray
    });
    switch (this._source[this.prog_ptr]) {
      case '+':
        this._data.set_at(this._data_ptr, this._data.at(this._data_ptr) + 1);
        break;
      case '-':
        this._data.set_at(this._data_ptr, this._data.at(this._data_ptr) - 1);
        break;
      case '>':
        this._data_ptr += 1;
        if (this._data_ptr >= this._data.length) {
          this._data.push(0);
        }
        break;
      case '<':
        this._data_ptr -= 1;
        if (this._data_ptr < 0) {
          throw "Out of range";
        }
        break;
      case '[':
        if (this._data.at(this._data_ptr) == 0) {
          this._prog_ptr = this.jumpmap.get(this._prog_ptr);
        }
        break;
      case ']':
        if (this._data.at(this._data_ptr) != 0) {
          this._prog_ptr = this.jumpmap.get(this._prog_ptr);
        }
        break;
      case ',':
        if (this.input_ptr < this.input.length) {
          this._data.set_at(this._data_ptr, this.input[this.input_ptr]);
          this.input_ptr += 1;
        } else {
          this._data.set_at(this._data_ptr, this._eof);
        }
        break;
      case '.':
        this._stdout_data.push(this._data.at(this._data_ptr));
        postMessage({
          type: 'stdout',
          data: this._data.at(this._data_ptr)
        });
        break;
      case ':':
        this._stderr_data.push(this._data.at(this._data_ptr));
        postMessage({
          type: 'stderr',
          data: this._data.at(this._data_ptr)
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
    this._cycle_count += 1;
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
          const [result, cycle_count] = bfi.run(input);
          postMessage({
            type:'finished',
            cycle_count: cycle_count,
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
