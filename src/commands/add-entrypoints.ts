import { intro, outro, spinner } from "@clack/prompts";
import { program } from "commander";
import { array, optional, parse, string } from "valibot";
import { addEntrypoint, promptEntrypoints } from "../lib/entry-points";
import { withSpinner } from "../lib/util";

program
  .command("add-entrypoints")
  .argument("[entrypoints...]")
  .action(async (args: unknown) => {
    intro("Add entry points");
    const s = spinner();
    const entryPoints = parse(optional(array(string())), args);

    if (entryPoints?.length) {
      await withSpinner(
        async () => {
          for (const entrypoint of entryPoints) {
            await addEntrypoint(entrypoint);
          }
        },
        s,
        {
          pending: `Adding entry points: ${entryPoints.join(", ")}`,
          fulfilled: "Entry points added",
          rejected: "Failed to add entry points",
        }
      );

      await promptEntrypoints(s);
    } else {
      await promptEntrypoints(s, true);
    }
    outro("All done!");
  });
