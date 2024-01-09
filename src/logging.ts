import isUnicodeSupported from "is-unicode-supported";
import color from "picocolors";

const unicode = isUnicodeSupported();
const s = (c: string, fallback: string) => (unicode ? c : fallback);

const S_BAR = s("│", "|");

export const getMessage = (message: string) =>
  `${color.gray(S_BAR)}  ${message}`;

export const getLogger = () => {
  let logged = false;
  let closed = false;
  return {
    log(message: string) {
      if (!closed) {
        process.stdout.write(getMessage(message));
        logged = true;
      }
    },
    close() {
      if (logged) {
        process.stdout.write(getMessage("\n"));
      }
      closed = true;
    },
  };
};
