import { readdir } from "fs/promises";
import { join } from "path";
import { intro, log, multiselect, outro } from "@clack/prompts";
import { program } from "commander";
import picocolors from "picocolors";
import { object, optional, boolean, parse, string, array } from "valibot";
import { __dirname } from "../constants";
import { ensureNotCancelled } from "../lib/clack";
import { copyTemplate } from "../lib/templates";

const copyTemplateOptions = object({
  yes: optional(boolean()),
});

program
  .command("copy-templates")
  .option("-y, --yes", "override existing file without asking")
  .argument("[filenames...]")
  .action(async (files, options) => {
    intro("Copy templates");
    const templates = await readdir(join(__dirname, "templates"));
    let filenames = parse(optional(array(string())), files);
    const { yes } = parse(copyTemplateOptions, options);

    if (!filenames?.length) {
      const selected = await multiselect<Array<{ value: string }>, string>({
        message: "Which templates should be copied?",
        options: templates.map((value) => ({ value })),
      });
      ensureNotCancelled(selected);
      filenames = selected;
    }

    let i = filenames.length;
    while (i--) {
      const name = filenames[i] ?? "";
      const valid = templates.includes(name);
      if (!valid) {
        log.info(
          picocolors.red(`"${name}"`) +
            ` is not a valid template and will be ignored`
        );
        filenames.splice(i, 1);
      }
    }

    for (const template of filenames) {
      await copyTemplate(template, yes);
    }

    outro("Done");
  });
