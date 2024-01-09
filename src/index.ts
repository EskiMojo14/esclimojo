#! /usr/bin/env node
import { program } from "commander";
import { name, version, description } from "../package.json";
import "./commands/add-entrypoints";
import "./commands/copy-template";
import "./commands/init";

program.name(name).version(version).description(description);

program.parse();
