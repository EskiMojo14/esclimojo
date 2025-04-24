import type { Task as ClackTask } from "@clack/prompts";
import { isCancel, outro, tasks as clackTasks } from "@clack/prompts";

export function ensureNotCancelled<T>(result: T | symbol): asserts result is T {
  if (isCancel(result)) {
    outro("Cancelled");
    process.exit();
  }
}

export interface Task extends ClackTask {
  /**
   * Extract an error message from a thrown error
   */
  getError?: (error?: unknown) => string;
}

/**
 * Define a group of tasks to be executed
 */
export const tasks = (tasks: Array<Task>) =>
  clackTasks(
    tasks.map((task) => ({
      ...task,
      async task(message) {
        try {
          return (await task.task(message)) as string;
        } catch (error) {
          return task.getError?.(error) ?? "Unknown error";
        }
      },
    }))
  );
