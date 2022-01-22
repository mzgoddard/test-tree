export class Arg {
  contextIndex: number;
}

export class ContextInfo {
  public args: Arg[];
}

export class Context {
  constructor(public chunk: Chunk, public chunkStart: number) {}
  newChild(contextInfo: ContextInfo): Context {
    return this.chunk.newContext(contextInfo, this);
  }
  newSnapshot(): Context {
    return this.chunk.newContext(
      this.chunk.contextInfo(this),
      this.chunk.childOf(this),
      this
    );
  }
  has(arg: Arg) {
    return this.chunk.has(this, arg);
  }
  get(arg: Arg) {
    return this.chunk.get(this, arg);
  }
  set(arg: Arg, value) {
    this.chunk.set(this, arg, value);
    return this;
  }
  delete(arg: Arg) {
    this.chunk.delete(this, arg);
    return this;
  }
}

export class Chunk {
  constructor(
    public memory: Memory,
    public previous: Chunk,
    public next: Chunk,
    public data: any[],
    public freeStart: number
  ) {}
  newContext(
    contextInfo: ContextInfo,
    parent: Context = null,
    snapshotOf: Context = null
  ) {
    if (this.data.length - this.freeStart < contextInfo.args.length) {
      this.memory.pushChunk();
      return this.next.newContext(contextInfo, parent, snapshotOf);
    }
    const context = new Context(this, this.freeStart);
    this.data[context.chunkStart] = contextInfo;
    this.data[context.chunkStart + 1] = parent;
    this.data[context.chunkStart + 2] = snapshotOf;
    this.data[context.chunkStart + 3 + contextInfo.args.length] =
      context.chunkStart;
    this.freeStart += 4 + contextInfo.args.length;
    return context;
  }
  freeContext(context: Context) {
    this.data[context.chunkStart] = null;
    context.chunk = null;
    context.chunkStart = -1;
    this.cleanup();
  }
  cleanup() {
    while (
      this.freeStart > 0 &&
      this.data[this.data[this.freeStart - 1]] === null
    ) {
      this.freeStart = this.data[this.freeStart - 1];
    }
    this.memory.cleanup();
  }
  contextInfo(context: Context): ContextInfo {
    return this.data[context.chunkStart];
  }
  childOf(context: Context): Context {
    return this.data[context.chunkStart + 1];
  }
  snapshotOf(context: Context): Context {
    return this.data[context.chunkStart + 2];
  }
  has(context: Context, arg: Arg) {
    return this.data[context.chunkStart + 3 + arg.contextIndex] !== undefined;
  }
  get(context: Context, arg: Arg) {
    return this.data[context.chunkStart + 3 + arg.contextIndex];
  }
  set(context: Context, arg: Arg, value) {
    this.data[context.chunkStart + 3 + arg.contextIndex] = value;
  }
  delete(context: Context, arg: Arg) {
    this.data[context.chunkStart + 3 + arg.contextIndex] = undefined;
  }
}

export class MemoryConfig {
  chunkSize: number;
  constructor({ chunkSize }: { chunkSize: number }) {
    this.chunkSize = chunkSize;
  }
  static default() {
    return new MemoryConfig({ chunkSize: 4096 });
  }
}

export class Memory {
  constructor(
    public config: MemoryConfig = MemoryConfig.default(),
    public activeChunk: Chunk = null
  ) {
    this.pushChunk();
  }
  pushChunk() {
    const chunk = new Chunk(
      this,
      this.activeChunk,
      null,
      new Array(this.config.chunkSize),
      0
    );
    this.activeChunk.next = chunk;
    this.activeChunk = chunk;
  }
  cleanup() {
    while (
      this.activeChunk.freeStart === 0 &&
      this.activeChunk.previous !== null
    ) {
      this.activeChunk = this.activeChunk.previous;
      this.activeChunk.next = null;
    }
  }
}
