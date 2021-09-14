{
  class OutOfRangeError extends Error {}

  class CharPointer {
    constructor(public source: string, public start: number = 0) {}
    get(index: number) {
      const i = this.start + index;
      if (i >= this.source.length) {
        throw new Error();
      }
      return this.source[i];
    }
    has(index: number) {
      const i = this.start + index;
      return i >= 0 && i < this.source.length;
    }
    slice(start: number) {
      if (start === 0) {
        return this;
      }
      return new CharPointer(this.source, this.start + start);
    }
    first() {
      return this.get(0);
    }
    isEmpty() {
      return !this.has(0);
    }
    next() {
      if (this.isEmpty()) {
        throw new OutOfRangeError();
      }
      return this.slice(1);
    }
  }

  class IndexPointer<T = any> {
    constructor(public source: T[], public start: number = 0) {}
    get(index: number) {
      const i = this.start + index;
      if (i >= this.source.length) {
        throw new Error();
      }
      return this.source[i];
    }
    has(index: number) {
      const i = this.start + index;
      return i >= 0 && i < this.source.length;
    }
    slice(start: number) {
      if (start === 0) {
        return this;
      }
      return new IndexPointer(this.source, this.start + start);
    }
    first() {
      return this.get(0);
    }
    isEmpty() {
      return !this.has(0);
    }
    next() {
      if (this.isEmpty()) {
        throw new OutOfRangeError();
      }
      return this.slice(1);
    }
  }

  interface KeyPointerLike<T extends { [key: string]: any } = any> {
    readonly source: T;
    readonly key: keyof T;
    readonly value: T[keyof T];
    readonly next: KeyPointerLike<T>;
    isNull(): boolean;
    find(key: keyof T): KeyPointerLike<T>;
    remove(key: keyof T): KeyPointerLike<T>;
  }

  class NullKeyPointer<T extends { [key: string]: any } = any>
    implements KeyPointerLike<T>
  {
    constructor(public source: T) {}
    get key(): keyof T {
      throw new OutOfRangeError();
    }
    get value(): T[keyof T] {
      throw new OutOfRangeError();
    }
    get next() {
      return this;
    }
    isNull() {
      return true;
    }
    find() {
      return this;
    }
    remove() {
      return this;
    }
  }

  class KeyPointer<T extends { [key: string]: any } = any>
    implements KeyPointerLike<T>
  {
    constructor(
      public source: T,
      public key: string,
      public next: KeyPointerLike<T> = new NullKeyPointer(source)
    ) {}
    get value() {
      return this.source[this.key];
    }
    isNull() {
      return false;
    }
    find(key: keyof T) {
      if (this.key === key) return this;
      return this.next.find(key);
    }
    remove(key: keyof T) {
      if (this.key === key) return this.next;
      const next = this.next.remove(key);
      if (next === this.next) return this;
      return new KeyPointer(this.source, this.key, next);
    }
    static from(source: object) {
      return Object.keys(source).reduceRight(
        (next, key) => new KeyPointer(source, key, next),
        new NullKeyPointer(source)
      );
    }
  }

  function toPointer(source: any) {
    if (
      source instanceof CharPointer ||
      source instanceof IndexPointer ||
      source instanceof KeyPointer
    ) {
      return source;
    }
    if (typeof source === "string") {
      return new CharPointer(source, 0);
    }
    if (typeof source !== "object") {
      return source;
    }
    if (Array.isArray(source)) {
      return new IndexPointer(source, 0);
    }
    return KeyPointer.from(source);
  }

  class HistoryCell {
    constructor(
      public boundCell: BoundCell,
      public lastValue: any,
      public previous: HistoryCell
    ) {}
    undo() {
      this.boundCell.state.memory[this.boundCell.cell.property] =
        this.lastValue;
    }
  }

  class History {
    top: HistoryCell = new HistoryCell(null, null, null);
    mark() {
      return this.top;
    }
    remember(boundCell: BoundCell) {
      this.top.boundCell = boundCell;
      this.top.lastValue = boundCell.state.memory[boundCell.cell.property];
      this.top = new HistoryCell(null, null, this.top);
    }
    undo(start: HistoryCell, end: HistoryCell) {
      if (end === this.top) {
      }
      while (end !== start) {
        end.undo();
        end = end.previous;
      }
      end.previous = start.previous;
    }
    createState(memory) {
      return new State(this, memory);
    }
  }

  class State {
    constructor(public history, public memory) {}
  }

  class Cell {
    constructor(public property: string) {}
    bind(state: State) {
      return new BoundCell(this, state);
    }
  }

  class RestCell {
    constructor(public cell: Cell) {}
    bind(state: State) {
      return new BoundCell(this.cell, state);
    }
  }

  class BoundCell {
    constructor(public cell: Cell, public state: State) {}
    get() {
      return this.state[this.cell.property];
    }
    set(value: any) {
      this.state.history.remember(this);
      this.state.memory[this.cell.property] = value;
    }
  }

  class ObjectCell {
    constructor(public object: object, public state: State) {}
  }

  const stateHandler: ProxyHandler<any> = {};

  function _matchLiteral(
    a: string | number | symbol | boolean | undefined,
    b: string | number | symbol | boolean | undefined
  ) {
    return a === b;
  }

  function _matchObject(
    a: KeyPointerLike,
    sa: State,
    b: KeyPointerLike,
    sb: State
  ) {
    if (a.isNull()) {
      return b.isNull();
    }
    if (b.isNull()) {
      return false;
    }
    const _b = b.find(a.key);
    if (_b.isNull()) return false;
    return (
      _match(a.value, sa, _b.value, sb) &&
      _matchObject(a.remove(a.key), sa, b.remove(a.key), sb)
    );
  }

  function _matchArray(a: IndexPointer, sa: State, b: IndexPointer, sb: State) {
    if (a.isEmpty()) {
      if (b.isEmpty()) {
        return true;
      } else if (b.first() instanceof RestCell) {
        return _match(b.first().cell, sb, a, sa);
      }
      return false;
    } else if (b.isEmpty()) {
      if (a.first() instanceof RestCell) {
        return _match(a.first().cell, sa, b, sb);
      }
      return false;
    }
    return (
      _match(a.first(), sa, b.first(), sb) &&
      _matchArray(a.next(), sa, b.next(), sb)
    );
  }

  function _matchPattern(
    a: CharPointer,
    sa: State,
    b: IndexPointer,
    sb: State
  ) {
    if (a.isEmpty()) {
      if (b.isEmpty()) {
        return true;
      } else if (b.first() instanceof RestCell) {
        return _match(a, sa, b.first().cell, sb);
      }
      return false;
    } else if (b.isEmpty()) {
      return false;
    }
    return (
      _match(a.first(), sa, b.first(), sb) &&
      _matchPattern(a.next(), sa, b.next(), sb)
    );
  }

  function _matchString(a: CharPointer, sa: State, b: CharPointer, sb: State) {
    if (a.source.length - a.start !== b.source.length - b.start) {
      return false;
    }
    return a.source.slice(a.start) === b.source.slice(b.start);
  }

  function _match(a, sa: State, b, sb: State) {
    let ca: BoundCell;
    while (a instanceof BoundCell) {
      ca = a;
      sa = a.state;
      a = a.get();
    }
    if (a instanceof ObjectCell) {
      ({ object: a, state: sa } = a);
    }
    if (a instanceof Cell) {
      a = a.bind(sa);
      if (ca instanceof BoundCell) {
        ca.set(a);
      }
      ca = a;
      a = a.get();
    }
    let cb: BoundCell;
    while (b instanceof BoundCell) {
      cb = b;
      sb = b.state;
      b = b.get();
    }
    if (b instanceof ObjectCell) {
      ({ object: b, state: sb } = b);
    }
    if (b instanceof Cell) {
      b = b.bind(sa);
      if (cb instanceof BoundCell) {
        cb.set(b);
      }
      cb = b;
      b = b.get();
    }

    if (a === b) return true;

    if (typeof a === "string" && typeof b === "string") {
      return false;
    }

    a = toPointer(a);
    b = toPointer(b);
    if (a instanceof CharPointer) {
      if (b instanceof CharPointer) {
        return _matchString(a, sa, b, sb);
      } else if (b instanceof IndexPointer) {
        return _matchPattern(a, sa, b, sb);
      }
    } else if (a instanceof IndexPointer) {
      if (b instanceof CharPointer) {
        return _matchPattern(b, sb, a, sa);
      } else if (b instanceof IndexPointer) {
        return _matchArray(a, sa, b, sb);
      }
    } else if (a instanceof KeyPointer && b instanceof KeyPointer) {
      return _matchObject(a, sa, b, sb);
    }
    return false;
  }

  function match(a, b) {
    if (a === b) return true;
  }
}
