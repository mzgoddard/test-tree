export abstract class Slice<
  T = any,
  A extends number | KeyList = number | KeyList
> {
  start: A;
  end: A;
  abstract hasFirst(): boolean;
  abstract first(): T | undefined;
  abstract tail(): Slice<T, A>;
  abstract slice(start: A, end: A): Slice<T, A>;
}
export class StringSlice extends Slice<string, number> {
  target: string;
  constructor(target: string, start: number = 0, end: number = target.length) {
    super();
    this.target = target;
    this.start = start;
    this.end = end;
  }
  has(index: number) {
    return index + this.start < this.end;
  }
  get(index: number) {
    return this.target[index + this.start];
  }
  hasFirst() {
    return this.has(0);
  }
  first() {
    return this.get(0);
  }
  startsWith(goal: string) {
    return this.target.slice(this.start, this.start + goal.length) === goal;
  }
  tail() {
    return this.slice(1);
  }
  slice(start: number = 0, end: number = this.end - this.start) {
    return new StringSlice(this.target, this.start + start, this.start + end);
  }
}
export class ArraySlice<T = any> extends Slice<T, number> {
  target: T[];
  constructor(target: T[], start: number = 0, end: number = target.length) {
    super();
    this.target = target;
    this.start = start;
    this.end = end;
  }
  has(index: number) {
    return index + this.start < this.end;
  }
  get(index: number) {
    return this.target[index + this.start];
  }
  hasFirst() {
    return this.has(0);
  }
  first() {
    return this.get(0);
  }
  tail() {
    return this.slice(1);
  }
  slice(start: number = 0, end: number = this.end - this.start): ArraySlice<T> {
    if (start === 0 && end === this.end - this.start) {
      return this;
    }
    return new ArraySlice(this.target, this.start + start, this.start + end);
  }
}
interface KeyListNode {
  key: string;
  next: KeyListNode | null;
}
function concatKeyListNode(
  a: KeyListNode | null,
  b: KeyListNode | null
): KeyListNode {
  if (a !== null) {
    if (a.next === null) {
      return { key: a.key, next: b };
    }
    return { key: a.key, next: concatKeyListNode(a.next, b) };
  }
  return b;
}
export class KeyList {
  constructor(public keys: KeyListNode | null = null) {}
  static empty() {
    return new KeyList(null);
  }
  static one(key: string) {
    return new KeyList({ key, next: null });
  }
  add(key: string): KeyList {
    return new KeyList({ key, next: this.keys });
  }
  concat(keyList: KeyList | null): KeyList {
    if (keyList === null) {
      return this;
    }
    return new KeyList(concatKeyListNode(this.keys, keyList.keys));
  }
  some(fn: (key: string) => boolean): boolean {
    for (const storedKey of this) {
      if (fn(storedKey)) {
        return true;
      }
    }
    return false;
  }
  includes(key: string): boolean {
    return this.some((storedKey) => storedKey === key);
  }
  *[Symbol.iterator]() {
    let keys = this.keys;
    while (keys !== null) {
      yield keys.key;
      keys = keys.next;
    }
  }
}
export class ObjectSlice<T extends { [key: string]: any } = any> extends Slice<
  T,
  KeyList
> {
  target: T;
  constructor(
    target: T,
    start: KeyList = new KeyList(),
    end: KeyList = new KeyList()
  ) {
    super();
    this.target = target;
    this.start = start;
    this.end = end;
  }
  has(key: string) {
    if (this.start.includes(key) || this.end.includes(key)) {
      return false;
    }
    return key in this.target;
  }
  get(key: string) {
    if (this.has(key)) {
      return this.target[key];
    }
  }
  hasFirst() {
    for (const _ of this.keys()) {
      return true;
    }
    return false;
  }
  firstKey() {
    for (const key of this.keys()) {
      return key;
    }
  }
  first() {
    for (const value of this.values()) {
      return value;
    }
  }
  tail() {
    return this.slice(this.start.add(this.firstKey()));
  }
  slice(start: KeyList | null = null, end: KeyList | null = null) {
    return new ObjectSlice(
      this.target,
      this.start.concat(start),
      this.end.concat(end)
    );
  }
  *keys() {
    for (const key of Object.keys(this.target)) {
      if (this.has(key)) {
        yield key;
      }
    }
  }
  *values() {
    for (const key of this.keys()) {
      yield this.target[key];
    }
  }
  *entries() {
    for (const key of this.keys()) {
      yield [key, this.target[key]];
    }
  }
}
