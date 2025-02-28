import { execFile as execFileAsync } from "node:child_process";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { cwd } from "node:process";
import { promisify } from "node:util";
import type { MaybePromise } from "../types/util";
import { tasks } from "./clack";
import { touch } from "./fs";

interface CommandMap {
  init: ["yes"];
  install: ["dev"];
  run: [];
}

export const packageManagers = {
  yarn: {
    init: {
      command: "init",
      args: {
        yes: "-y",
      },
    },
    install: {
      command: "add",
      args: {
        dev: "-D",
      },
    },
    run: {
      command: "run",
      args: {},
    },
  },
  npm: {
    init: {
      command: "init",
      args: {
        yes: "-y",
      },
    },
    install: {
      command: "install",
      args: {
        dev: "-D",
      },
    },
    run: {
      command: "run",
      args: {},
    },
  },
  pnpm: {
    init: {
      command: "init",
      args: {
        yes: "-y",
      },
    },
    install: {
      command: "add",
      args: {
        dev: "-D",
      },
    },
    run: {
      command: "run",
      args: {},
    },
  },
  bun: {
    init: {
      command: "init",
      args: {
        yes: "-y",
      },
    },
    install: {
      command: "install",
      args: {
        dev: "-D",
      },
    },
    run: {
      command: "run",
      args: {},
    },
  },
} satisfies Record<
  string,
  {
    [Command in keyof CommandMap]: {
      command: string;
      args: Record<CommandMap[Command][number], string>;
    };
  }
>;

export type SupportedManager = keyof typeof packageManagers;

export const supportedManagers = Object.keys(
  packageManagers
) as Array<SupportedManager>;

const execFile = promisify(execFileAsync);

export const initLifecycles: Partial<
  Record<
    SupportedManager,
    Partial<Record<"preinit" | "postinit", () => MaybePromise<void>>>
  >
> = {
  yarn: {
    async preinit() {
      await touch(join(cwd(), "yarn.lock"));
      await tasks([
        {
          title: "Setting up Yarn",
          async task() {
            await execFile("yarn", ["set", "version", "stable"]);
            return "Yarn successfully set up";
          },
          getError() {
            return "Failed to setup Yarn";
          },
        },
      ]);
    },
  },
  bun: {
    async postinit() {
      await rm(join(cwd(), "index.ts"));
    },
  },
};
