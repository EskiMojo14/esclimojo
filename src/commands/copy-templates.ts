import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { intro, log, multiselect, outro } from "@clack/prompts";
import { program } from "commander";
import picocolors from "picocolors";
import { object, optional, boolean, parse, string, array } from "valibot";
import { __dirname } from "../constants";
import { ensureNotCancelled } from "../lib/clack";
import type { SupportedManager } from "../lib/package-managers";
import { supportedManagers } from "../lib/package-managers";
import { copyTemplate } from "../lib/templates";
import { includes } from "../lib/util";

interface TemplateDesc {
  filename: string;
  packageManager?: SupportedManager;
}

const copyTemplateOptions = object({
  yes: optional(boolean()),
});

program
  .command("copy-templates")
  .option("-y, --yes", "override existing file without asking")
  .argument(
    "[filenames...]",
    "file paths - package specific templates need to be prefixed e.g. yarn:.yarnrc.yml"
  )
  .action(async (files, options) => {
    intro("Copy templates");
    const templates = (
      await readdir(join(__dirname, "templates"), {
        recursive: true,
      })
    ).map(
      (filename): TemplateDesc => ({
        filename,
      })
    );
    for (const packageManager of supportedManagers) {
      try {
        const pmTemplates = await readdir(
          join(__dirname, "pm-templates", packageManager),
          { recursive: true }
        );
        templates.push(
          ...pmTemplates.map((filename) => ({
            filename,
            packageManager,
          }))
        );
      } catch {
        // no specific templates
      }
    }
    const filenames = parse(optional(array(string())), files);
    const { yes } = parse(copyTemplateOptions, options);

    let processed: Array<TemplateDesc> = [];
    if (!filenames?.length) {
      const selected = await multiselect({
        message: "Which templates should be copied?",
        options: templates.map((desc) => ({
          value: desc,
          label: `${
            desc.packageManager
              ? picocolors.italic(picocolors.bold(desc.packageManager + ":"))
              : ""
          }${desc.filename}`,
        })),
      });
      ensureNotCancelled(selected);
      processed = selected;
    } else {
      processed = filenames.map((filename) => {
        const [first, second] = filename.split(":");
        if (second) {
          if (!includes(supportedManagers, first))
            throw new Error(
              "Unsupported package manager: " + picocolors.red(first)
            );
          return {
            filename: second,
            packageManager: first,
          };
        } else {
          return { filename };
        }
      });
    }

    const final: Array<TemplateDesc> = [];
    let i = processed.length;
    while (i--) {
      const desc = processed[i];
      if (!desc) continue;
      const valid = templates.some(
        (temp) =>
          temp.filename === desc.filename &&
          temp.packageManager === desc.packageManager
      );
      if (valid) {
        final.push(desc);
      } else {
        log.info(
          picocolors.red(
            `"${
              desc.packageManager
                ? picocolors.italic(picocolors.bold(desc.packageManager + ":"))
                : ""
            }${desc.filename}"`
          ) + ` is not a valid template and will be ignored`
        );
      }
    }

    for (const template of final) {
      await copyTemplate(template.filename, yes, template.packageManager);
    }

    outro("Done");
  });
