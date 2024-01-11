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
      await tasks(
        entryPoints.map((entrypoint) => ({
          title: `Adding entry point: ${entrypoint}`,
          async task() {
            await addEntrypoint(entrypoint);
            return `Added entry point: ${entrypoint}`;
          },
          getError() {
            return `Failed to add entry point:  ${entrypoint}`;
          },
        }))
      );

      await promptEntrypoints();
    } else {
      await promptEntrypoints(true);
    }
    outro("All done!");
  });
