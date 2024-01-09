import { isCancel, outro, spinner } from "@clack/prompts";
import type { MaybePromise } from "../types/util";

export function ensureNotCancelled<T>(result: T | symbol): asserts result is T {
  if (isCancel(result)) {
    outro("Cancelled");
    process.exit();
  }
}

export interface Task {
  /**
   * Task title
   */
  title: string;
  /**
   * Task function
   */
  task: (message: (string: string) => void) => MaybePromise<string | void>;

  /**
   * If enabled === false the task will be skipped
   */
  enabled?: boolean;
  /**
   * Extract an error message from a thrown error
   */
  getError?: (error?: unknown) => string;
}

/**
 * Define a group of tasks to be executed
 */
export const tasks = async (tasks: Array<Task>) => {
  for (const task of tasks) {
    if (task.enabled === false) continue;

    const s = spinner();
    s.start(task.title);
    try {
      const result = await task.task(s.message);
      s.stop(result || task.title);
    } catch (e) {
      s.stop(task.getError?.(e) ?? task.title);
      throw e;
    }
  }
};
