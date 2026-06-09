import {
  runBashCoverageTask as runBashCoverageLanguageTask,
  runBashFormatTask as runBashFormatLanguageTask,
  runBashLintTask as runBashLintLanguageTask,
  runBashUnitTask as runBashUnitLanguageTask,
} from "./languages/bash.js";
import {
  runPowerShellCoverageTask as runPowerShellCoverageLanguageTask,
  runPowerShellFormatTask as runPowerShellFormatLanguageTask,
  runPowerShellLintTask as runPowerShellLintLanguageTask,
  runPowerShellUnitTask as runPowerShellUnitLanguageTask,
} from "./languages/powershell.js";
import {
  runTerraformFormatTask as runTerraformFormatLanguageTask,
  runTerraformLintTask as runTerraformLintLanguageTask,
  runTerraformTypecheckTask as runTerraformTypecheckLanguageTask,
} from "./languages/terraform.js";
import { runBiomeFormatTask, runBiomeLintTask } from "./runners-biome-tasks.js";
import { runPrettierDocumentFormatTask, runSqlFormatTask } from "./runners-format-tasks.js";
import {
  createBashRunnerRuntime,
  createHashicorpRunnerRuntime,
  createPowerShellRunnerRuntime,
} from "./runners-runtimes.js";
import type { RunnerLanguageModule } from "./runners-stage-types.js";
import {
  runCssLintTask,
  runHtmlLintTask,
  runSqlLintTask,
  runYamlLintTask,
} from "./runners-web-lint-tasks.js";

export const basicRunnerLanguageModules: RunnerLanguageModule[] = [
  {
    id: "terraform",
    stageHandlers: {
      format: (task, context) =>
        runTerraformFormatLanguageTask(
          task,
          createHashicorpRunnerRuntime(context.cwd, context.signal),
        ),
      lint: (task, context) =>
        runTerraformLintLanguageTask(
          task,
          createHashicorpRunnerRuntime(context.cwd, context.signal),
        ),
      typecheck: (task, context) =>
        runTerraformTypecheckLanguageTask(
          task,
          createHashicorpRunnerRuntime(context.cwd, context.signal),
        ),
    },
  },
  {
    id: "biome",
    stageHandlers: {
      format: (task, context) => runBiomeFormatTask(task, context.cwd, context.signal),
      lint: (task, context) => runBiomeLintTask(task, context.cwd, context.signal),
    },
  },
  {
    id: "html",
    stageHandlers: {
      lint: (task, context) => runHtmlLintTask(task, context.cwd),
    },
  },
  {
    id: "css",
    stageHandlers: {
      lint: (task, context) => runCssLintTask(task, context.cwd),
    },
  },
  {
    id: "yaml",
    stageHandlers: {
      lint: (task, context) => runYamlLintTask(task, context.cwd),
    },
  },
  {
    id: "sql",
    stageHandlers: {
      format: (task, context) => runSqlFormatTask(task, context.cwd),
      lint: (task, context) => runSqlLintTask(task, context.cwd),
    },
  },
  {
    id: "documents",
    stageHandlers: {
      format: (task, context) => runPrettierDocumentFormatTask(task, context.cwd),
    },
  },
  {
    id: "bash",
    stageHandlers: {
      coverage: (task, context) =>
        runBashCoverageLanguageTask(task, createBashRunnerRuntime(context.cwd, context.signal)),
      format: (task, context) =>
        runBashFormatLanguageTask(task, createBashRunnerRuntime(context.cwd, context.signal)),
      lint: (task, context) =>
        runBashLintLanguageTask(task, createBashRunnerRuntime(context.cwd, context.signal)),
      unit: (task, context) =>
        runBashUnitLanguageTask(task, createBashRunnerRuntime(context.cwd, context.signal)),
    },
  },
  {
    id: "powershell",
    stageHandlers: {
      coverage: (task, context) =>
        runPowerShellCoverageLanguageTask(
          task,
          createPowerShellRunnerRuntime(context.cwd, context.signal),
        ),
      format: (task, context) =>
        runPowerShellFormatLanguageTask(
          task,
          createPowerShellRunnerRuntime(context.cwd, context.signal),
        ),
      lint: (task, context) =>
        runPowerShellLintLanguageTask(
          task,
          createPowerShellRunnerRuntime(context.cwd, context.signal),
        ),
      unit: (task, context) =>
        runPowerShellUnitLanguageTask(
          task,
          createPowerShellRunnerRuntime(context.cwd, context.signal),
        ),
    },
  },
];
