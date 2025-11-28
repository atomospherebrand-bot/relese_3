import { spawn } from "child_process";
import { type BotAction } from "@shared/schema";

interface BotCommandResult {
  triggered: boolean;
  action: BotAction;
  message?: string;
}

class BotManager {
  private queue: Promise<void> = Promise.resolve();

  async handleTokenChange(
    previousToken: string | null | undefined,
    nextToken: string | null | undefined,
  ): Promise<BotCommandResult> {
    const prev = (previousToken ?? "").trim();
    const next = (nextToken ?? "").trim();

    if (prev === next) {
      return { triggered: false, action: "none" };
    }

    const action: BotAction = next === "" ? "stop" : prev === "" ? "start" : "restart";
    const command = this.resolveCommand(action);

    if (!command) {
      const message =
        "Перезапуск бота не настроен. Укажите путь к скрипту в переменной окружения BOT_RESTART_SCRIPT" +
        (action === "stop" ? " или BOT_STOP_SCRIPT" : "") +
        ".";
      return { triggered: false, action, message };
    }

    try {
      await this.enqueueCommand(command, { previousToken: prev, nextToken: next, action });
      return { triggered: true, action, message: `Скрипт ${command} выполнен успешно` };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Неизвестная ошибка при перезапуске бота";
      return { triggered: false, action, message };
    }
  }

  private resolveCommand(action: BotAction): string | undefined {
    if (action === "stop") {
      return process.env.BOT_STOP_SCRIPT || process.env.BOT_RESTART_SCRIPT;
    }
    return process.env.BOT_RESTART_SCRIPT;
  }

  private enqueueCommand(command: string, context: { previousToken: string; nextToken: string; action: Exclude<BotAction, "none"> }) {
    this.queue = this.queue.then(() => this.runCommand(command, context));
    return this.queue;
  }

  private runCommand(
    command: string,
    { previousToken, nextToken, action }: { previousToken: string; nextToken: string; action: Exclude<BotAction, "none"> },
  ) {
    return new Promise<void>((resolve, reject) => {
      const child = spawn(command, {
        shell: true,
        env: {
          ...process.env,
          TELEGRAM_BOT_PREVIOUS_TOKEN: previousToken,
          TELEGRAM_BOT_TOKEN: nextToken,
          TELEGRAM_BOT_ACTION: action,
        },
        stdio: "inherit",
      });

      child.on("error", (error) => {
        reject(error);
      });

      child.on("exit", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Скрипт ${command} завершился с кодом ${code}`));
        }
      });
    });
  }
}

export const botManager = new BotManager();
