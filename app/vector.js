function roundUpToPowerOf2(x) {
  let y = 1;
  while (y < x) {
    y *= 2;
  }
  return y;
}

class Uint8Vector {
  constructor(length) {
    this._length = length;
    this.capacity = Math.max(1, roundUpToPowerOf2(length));
    this.data = new Uint8Array(this.capacity);
  }
  at(index) {
    if (index >= this._length) {
      throw "Out of range"
    }
    return this.data[index];
  }
  set_at(index, elem) {
    if (index >= this._length) {
      throw "Out of range"
    }
    return this.data[index] = elem;
  }
  push(elem) {
    if (this._length == this.capacity) {
      this.capacity *= 2;
      let newarray = new Uint8Array(this.capacity);
      newarray.set(this.data);
      this.data = newarray;
    }
    this.data[this._length] = elem;
    this._length += 1;
  }
  get length() {
    return this._length;
  }
  get view() {
    let buffer = this.data.buffer;
    let offset = this.data.byteOffset;
    return new DataView(buffer, offset, this._length);
  }
  get toArray() {
    return Uint8Array.from(this.data, x => x);
  }
}
