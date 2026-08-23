import { type Message } from "../core/types.js";

export class MessageHistory {
  private readonly _messages: Message[] = [];

  constructor(initialMessages?: readonly Message[]) {
    if (initialMessages) {
      this._messages.push(...initialMessages);
    }
  }

  public get messages(): readonly Message[] {
    return Object.freeze([...this._messages]);
  }

  public get length(): number {
    return this._messages.length;
  }

  public append(message: Message): MessageHistory {
    this._messages.push(message);
    return this;
  }

  public appendBatch(messages: readonly Message[]): MessageHistory {
    this._messages.push(...messages);
    return this;
  }

  public last(): Message | undefined {
    return this._messages[this._messages.length - 1];
  }

  public clear(): void {
    this._messages.length = 0;
  }

  public clone(): MessageHistory {
    return new MessageHistory(this._messages);
  }
}
