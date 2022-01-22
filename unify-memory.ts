export class Arg {}

export class ContextInfo {}

export class Context {
  constructor(
    public memory: Memory,
    public chunk: Chunk,
    public info: ContextInfo
  ) {}
}

export class Chunk {
  constructor(
    public memory: Memory,
    public previous: Chunk,
    public next: Chunk
  ) {}
}

export class Memory {}
