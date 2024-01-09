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
};

export type SupportedManager = keyof typeof packageManagers;

export const supportedManagers = Object.keys(
  packageManagers
) as Array<SupportedManager>;
