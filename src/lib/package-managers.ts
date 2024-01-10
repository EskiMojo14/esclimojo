interface CommandMap {
  init: ["yes"];
  install: ["dev"];
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
