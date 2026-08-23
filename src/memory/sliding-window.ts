import { type Message } from "../core/types.js";

export interface ContextWindowOptions {
  readonly maxTokens: number;
  readonly reservedResponseTokens?: number;
  readonly charsPerToken?: number;
}

export const estimateMessageTokens = (message: Message, charsPerToken: number = 4): number => {
  let charCount = 0;

  if (message.role === "system" || message.role === "user") {
    charCount += message.content.length;
  } else if (message.role === "assistant") {
    charCount += (message.content ?? "").length;
    if (message.toolCalls) {
      for (const call of message.toolCalls) {
        charCount += call.name.length + JSON.stringify(call.arguments).length + 30;
      }
    }
  } else if (message.role === "tool") {
    charCount += message.content.length + message.toolName.length + 20;
  }

  return Math.ceil(charCount / charsPerToken) + 4;
};

export class SlidingContextWindow {
  private readonly _maxTokens: number;
  private readonly _reservedResponseTokens: number;
  private readonly _charsPerToken: number;

  constructor(options: ContextWindowOptions) {
    this._maxTokens = options.maxTokens;
    this._reservedResponseTokens = options.reservedResponseTokens ?? 1000;
    this._charsPerToken = options.charsPerToken ?? 4;
  }

  public fit(messages: readonly Message[]): Message[] {
    if (messages.length <= 1) {
      return [...messages];
    }

    const usableTokenBudget = Math.max(500, this._maxTokens - this._reservedResponseTokens);

    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    let totalTokens = systemMessages.reduce(
      (sum, m) => sum + estimateMessageTokens(m, this._charsPerToken),
      0
    );

    const selectedMessages: Message[] = [];

    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const msg = nonSystemMessages[i]!;
      const msgTokens = estimateMessageTokens(msg, this._charsPerToken);

      if (totalTokens + msgTokens <= usableTokenBudget) {
        selectedMessages.unshift(msg);
        totalTokens += msgTokens;
      } else {

        if (selectedMessages.length > 0 && i > 0) {
          const truncatedCount = i + 1;
          selectedMessages.unshift({
            role: "user",
            content: `[System Notice: ${truncatedCount} earlier message(s) were pruned to fit the ${usableTokenBudget} token context window limit]`,
          });
        }
        break;
      }
    }

    return [...systemMessages, ...selectedMessages];
  }
}
