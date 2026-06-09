import {
  runDotNetCoverageTask as runDotNetCoverageLanguageTask,
  runDotNetFormatTask as runDotNetFormatLanguageTask,
  runDotNetLintTask as runDotNetLintLanguageTask,
  runDotNetMetricsTask as runDotNetMetricsLanguageTask,
  runDotNetTypecheckTask as runDotNetTypecheckLanguageTask,
  runDotNetUnitTask as runDotNetUnitLanguageTask,
} from "./languages/dotnet.js";
import {
  runGoCoverageTask as runGoCoverageLanguageTask,
  runGoFormatTask as runGoFormatLanguageTask,
  runGoLintTask as runGoLintLanguageTask,
  runGoMetricsTask as runGoMetricsLanguageTask,
  runGoTypecheckTask as runGoTypecheckLanguageTask,
  runGoUnitTask as runGoUnitLanguageTask,
} from "./languages/go.js";
import {
  runJavaScriptCoverageTask as runJavaScriptCoverageLanguageTask,
  runJavaScriptE2eTask as runJavaScriptE2eLanguageTask,
  runJavaScriptMetricsTask as runJavaScriptMetricsLanguageTask,
  runJavaScriptUnitTask as runJavaScriptUnitLanguageTask,
} from "./languages/javascript.js";
import {
  runJvmCoverageTask as runJvmCoverageLanguageTask,
  runJvmFormatTask as runJvmFormatLanguageTask,
  runJvmLintTask as runJvmLintLanguageTask,
  runJvmMetricsTask as runJvmMetricsLanguageTask,
  runJvmTypecheckTask as runJvmTypecheckLanguageTask,
  runJvmUnitTask as runJvmUnitLanguageTask,
} from "./languages/jvm.js";
import {
  runPythonComplexityTask as runPythonComplexityLanguageTask,
  runPythonCoverageTask as runPythonCoverageLanguageTask,
  runPythonFormatTask as runPythonFormatLanguageTask,
  runPythonLintTask as runPythonLintLanguageTask,
  runPythonMaintainabilityTask as runPythonMaintainabilityLanguageTask,
  runPythonSlocTask as runPythonSlocLanguageTask,
  runPythonTypecheckTask as runPythonTypecheckLanguageTask,
  runPythonUnitTask as runPythonUnitLanguageTask,
} from "./languages/python.js";
import {
  runRustCoverageTask as runRustCoverageLanguageTask,
  runRustFormatTask as runRustFormatLanguageTask,
  runRustLintTask as runRustLintLanguageTask,
  runRustMetricsTask as runRustMetricsLanguageTask,
  runRustTypecheckTask as runRustTypecheckLanguageTask,
  runRustUnitTask as runRustUnitLanguageTask,
} from "./languages/rust.js";
import { runTypeScriptTypecheckTask as runTypeScriptTypecheckLanguageTask } from "./languages/typescript.js";
import {
  createDotNetRunnerRuntime,
  createGoRunnerRuntime,
  createJavaScriptRunnerRuntime,
  createJvmRunnerRuntime,
  createPythonRunnerRuntime,
  createRustRunnerRuntime,
  createTypeScriptRunnerRuntime,
} from "./runners-runtimes.js";
import { runSharedSecurityTask } from "./runners-security-task.js";
import type { RunnerLanguageModule } from "./runners-stage-types.js";

export const runtimeRunnerLanguageModules: RunnerLanguageModule[] = [
  {
    id: "go",
    stageHandlers: {
      complexity: (task, context) =>
        runGoMetricsLanguageTask(
          task,
          createGoRunnerRuntime(context.cwd, context.signal),
          "complexity",
        ),
      coverage: (task, context) =>
        runGoCoverageLanguageTask(task, createGoRunnerRuntime(context.cwd, context.signal)),
      format: (task, context) =>
        runGoFormatLanguageTask(task, createGoRunnerRuntime(context.cwd, context.signal)),
      lint: (task, context) =>
        runGoLintLanguageTask(task, createGoRunnerRuntime(context.cwd, context.signal)),
      maintainability: (task, context) =>
        runGoMetricsLanguageTask(
          task,
          createGoRunnerRuntime(context.cwd, context.signal),
          "maintainability",
        ),
      sloc: (task, context) =>
        runGoMetricsLanguageTask(task, createGoRunnerRuntime(context.cwd, context.signal), "sloc"),
      typecheck: (task, context) =>
        runGoTypecheckLanguageTask(task, createGoRunnerRuntime(context.cwd, context.signal)),
      unit: (task, context) =>
        runGoUnitLanguageTask(task, createGoRunnerRuntime(context.cwd, context.signal)),
    },
  },
  {
    id: "rust",
    stageHandlers: {
      complexity: (task, context) =>
        runRustMetricsLanguageTask(
          task,
          createRustRunnerRuntime(context.cwd, context.signal),
          "complexity",
        ),
      coverage: (task, context) =>
        runRustCoverageLanguageTask(task, createRustRunnerRuntime(context.cwd, context.signal)),
      format: (task, context) =>
        runRustFormatLanguageTask(task, createRustRunnerRuntime(context.cwd, context.signal)),
      lint: (task, context) =>
        runRustLintLanguageTask(task, createRustRunnerRuntime(context.cwd, context.signal)),
      maintainability: (task, context) =>
        runRustMetricsLanguageTask(
          task,
          createRustRunnerRuntime(context.cwd, context.signal),
          "maintainability",
        ),
      sloc: (task, context) =>
        runRustMetricsLanguageTask(
          task,
          createRustRunnerRuntime(context.cwd, context.signal),
          "sloc",
        ),
      typecheck: (task, context) =>
        runRustTypecheckLanguageTask(task, createRustRunnerRuntime(context.cwd, context.signal)),
      unit: (task, context) =>
        runRustUnitLanguageTask(task, createRustRunnerRuntime(context.cwd, context.signal)),
    },
  },
  {
    id: "jvm",
    stageHandlers: {
      complexity: (task, context) =>
        runJvmMetricsLanguageTask(
          task,
          createJvmRunnerRuntime(context.cwd, context.signal),
          "complexity",
        ),
      coverage: (task, context) =>
        runJvmCoverageLanguageTask(task, createJvmRunnerRuntime(context.cwd, context.signal)),
      format: (task, context) =>
        runJvmFormatLanguageTask(task, createJvmRunnerRuntime(context.cwd, context.signal)),
      lint: (task, context) =>
        runJvmLintLanguageTask(task, createJvmRunnerRuntime(context.cwd, context.signal)),
      maintainability: (task, context) =>
        runJvmMetricsLanguageTask(
          task,
          createJvmRunnerRuntime(context.cwd, context.signal),
          "maintainability",
        ),
      sloc: (task, context) =>
        runJvmMetricsLanguageTask(
          task,
          createJvmRunnerRuntime(context.cwd, context.signal),
          "sloc",
        ),
      typecheck: (task, context) =>
        runJvmTypecheckLanguageTask(task, createJvmRunnerRuntime(context.cwd, context.signal)),
      unit: (task, context) =>
        runJvmUnitLanguageTask(task, createJvmRunnerRuntime(context.cwd, context.signal)),
    },
  },
  {
    id: "dotnet",
    stageHandlers: {
      complexity: (task, context) =>
        runDotNetMetricsLanguageTask(
          task,
          createDotNetRunnerRuntime(context.cwd, context.signal),
          "complexity",
        ),
      coverage: (task, context) =>
        runDotNetCoverageLanguageTask(task, createDotNetRunnerRuntime(context.cwd, context.signal)),
      format: (task, context) =>
        runDotNetFormatLanguageTask(task, createDotNetRunnerRuntime(context.cwd, context.signal)),
      lint: (task, context) =>
        runDotNetLintLanguageTask(task, createDotNetRunnerRuntime(context.cwd, context.signal)),
      maintainability: (task, context) =>
        runDotNetMetricsLanguageTask(
          task,
          createDotNetRunnerRuntime(context.cwd, context.signal),
          "maintainability",
        ),
      sloc: (task, context) =>
        runDotNetMetricsLanguageTask(
          task,
          createDotNetRunnerRuntime(context.cwd, context.signal),
          "sloc",
        ),
      typecheck: (task, context) =>
        runDotNetTypecheckLanguageTask(
          task,
          createDotNetRunnerRuntime(context.cwd, context.signal),
        ),
      unit: (task, context) =>
        runDotNetUnitLanguageTask(task, createDotNetRunnerRuntime(context.cwd, context.signal)),
    },
  },
  {
    id: "typescript",
    stageHandlers: {
      typecheck: (task, context) =>
        runTypeScriptTypecheckLanguageTask(
          task,
          createTypeScriptRunnerRuntime(context.cwd, context.signal),
        ),
    },
  },
  {
    id: "javascript",
    stageHandlers: {
      complexity: (task, context) =>
        runJavaScriptMetricsLanguageTask(
          task,
          createJavaScriptRunnerRuntime(context.cwd, context.signal),
          "complexity",
        ),
      coverage: (task, context) =>
        runJavaScriptCoverageLanguageTask(
          task,
          createJavaScriptRunnerRuntime(context.cwd, context.signal),
        ),
      e2e: (task, context) =>
        runJavaScriptE2eLanguageTask(
          task,
          createJavaScriptRunnerRuntime(context.cwd, context.signal),
        ),
      maintainability: (task, context) =>
        runJavaScriptMetricsLanguageTask(
          task,
          createJavaScriptRunnerRuntime(context.cwd, context.signal),
          "maintainability",
        ),
      sloc: (task, context) =>
        runJavaScriptMetricsLanguageTask(
          task,
          createJavaScriptRunnerRuntime(context.cwd, context.signal),
          "sloc",
        ),
      unit: (task, context) =>
        runJavaScriptUnitLanguageTask(
          task,
          createJavaScriptRunnerRuntime(context.cwd, context.signal),
        ),
    },
  },
  {
    id: "python",
    stageHandlers: {
      complexity: (task, context) =>
        runPythonComplexityLanguageTask(
          task,
          createPythonRunnerRuntime(context.cwd, context.signal),
        ),
      coverage: (task, context) =>
        runPythonCoverageLanguageTask(task, createPythonRunnerRuntime(context.cwd, context.signal)),
      format: (task, context) =>
        runPythonFormatLanguageTask(task, createPythonRunnerRuntime(context.cwd, context.signal)),
      lint: (task, context) =>
        runPythonLintLanguageTask(task, createPythonRunnerRuntime(context.cwd, context.signal)),
      maintainability: (task, context) =>
        runPythonMaintainabilityLanguageTask(
          task,
          createPythonRunnerRuntime(context.cwd, context.signal),
        ),
      sloc: (task, context) =>
        runPythonSlocLanguageTask(task, createPythonRunnerRuntime(context.cwd, context.signal)),
      typecheck: (task, context) =>
        runPythonTypecheckLanguageTask(
          task,
          createPythonRunnerRuntime(context.cwd, context.signal),
        ),
      unit: (task, context) =>
        runPythonUnitLanguageTask(task, createPythonRunnerRuntime(context.cwd, context.signal)),
    },
  },
  {
    id: "security",
    stageHandlers: {
      security: (task) => runSharedSecurityTask(task),
    },
  },
];
