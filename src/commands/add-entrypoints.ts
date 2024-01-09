import { intro, outro } from "@clack/prompts";
import { program } from "commander";
import { array, optional, parse, string } from "valibot";
import { tasks } from "../lib/clack";
import { addEntrypoint, promptEntrypoints } from "../lib/entry-points";

program
  .command("add-entrypoints")
  .argument("[entrypoints...]")
  .action(async (args: unknown) => {
    intro("Add entry points");
    const entryPoints = parse(optional(array(string())), args);

    if (entryPoints?.length) {
      await tasks([
        {
          title: `Adding entry points: ${entryPoints.join(", ")}`,
          async task() {
            for (const entrypoint of entryPoints) {
              await addEntrypoint(entrypoint);
            }
            return "Entry points added";
          },
          getError() {
            return "Failed to add entry points";
          },
        },
      ]);

      await promptEntrypoints();
    } else {
      await promptEntrypoints(true);
    }
    outro("All done!");
  });
