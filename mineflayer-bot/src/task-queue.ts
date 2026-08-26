export type Task =
  | { kind: "mine"; blockName: string }
  | { kind: "farm" }
  | { kind: "guard" };

export class TaskQueue {
  private readonly queue: Task[] = [];
  private active: Task | null = null;

  enqueue(task: Task): void {
    this.queue.push(task);
  }

  clear(): void {
    this.queue.length = 0;
    this.active = null;
  }

  next(): Task | null {
    this.active = this.queue.shift() ?? null;
    return this.active;
  }

  peek(): Task | null {
    return this.active ?? this.queue[0] ?? null;
  }

  get pending(): number {
    return this.queue.length;
  }

  get current(): Task | null {
    return this.active;
  }

  finish(): void {
    this.active = null;
  }
}