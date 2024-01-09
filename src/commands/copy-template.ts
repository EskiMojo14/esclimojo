import { confirm, intro, outro } from "@clack/prompts";
import { program } from "commander";
import { access, constants, copyFile } from "fs/promises";
import { join } from "path";
import { cwd } from "process";
import { object, optional, boolean, parse, string } from "valibot";
import { ensureNotCancelled, withSpinner } from "../lib/util";
import { __dirname } from "../constants";

const copyTemplateOptions = object({
  yes: optional(boolean()),
});

program
  .command("copy-template")
  .option("-y, --yes", "override existing file without asking")
  .argument("<filename>")
  .action(async (file, options) => {
    intro("Copy template");
    const filename = parse(string(), file);
    let { yes } = parse(copyTemplateOptions, options);
    try {
      await access(join(__dirname, "templates", filename), constants.R_OK);
    } catch (e) {
      program.error(`Template "${filename}" not found`);
    }
    if (!yes) {
      let fileAlreadyExists = false;
      try {
        await access(join(cwd(), filename), constants.F_OK);
        fileAlreadyExists = true;
      } catch {
        // file doesn't exist
      }
      if (fileAlreadyExists) {
        const overwrite = await confirm({
          message: "File already exists, overwrite?",
        });
        ensureNotCancelled(overwrite);
        yes = overwrite;
      }
    }
    if (yes) {
      await withSpinner(
        () =>
          copyFile(
            join(__dirname, "templates", filename),
            join(cwd(), filename)
          ),
        undefined,
        {
          pending: `Copying template: ${filename}`,
          fulfilled: `Template ${filename} copied`,
          rejected: `Failed to copy template: ${filename}`,
        }
      );
    }
    outro("Done");
  });
