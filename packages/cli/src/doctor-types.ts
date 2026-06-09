import type { LanguageId } from "@tjalve/aiq/model";

export const doctorPrerequisites = [
  {
    binaries: ["node"],
    install: "Install Node.js 24 or newer from your normal Node version manager.",
    minimumMajor: 24,
    required: true,
    name: "Node.js runtime",
  },
  {
    binaries: ["npm"],
    install: "Install npm with Node.js, or use the package manager configured for this project.",
    required: false,
    name: "npm package manager",
  },
  {
    binaries: ["git"],
    install: "Install Git from your OS package manager or git-scm.com.",
    required: false,
    name: "Git",
  },
] as const satisfies readonly DoctorPrerequisite[];

export interface DoctorPrerequisite {
  binaries: readonly string[];
  install: string;
  minimumMajor?: number;
  name: string;
  required: boolean;
}

export interface DoctorToolRequirement extends DoctorPrerequisite {
  source: "external";
}

export interface DoctorBundledTool {
  detail: string;
  name: string;
  source: "bundled" | "project";
}

export const doctorMaxScannedFiles = 2_000;

export const doctorLanguageLabels: Record<LanguageId, string> = {
  bash: "Bash",
  css: "CSS",
  documents: "Documents",
  dotnet: ".NET",
  go: "Go",
  hcl: "HCL",
  html: "HTML",
  java: "Java",
  javascript: "JavaScript",
  kotlin: "Kotlin",
  powershell: "PowerShell",
  python: "Python",
  rust: "Rust",
  sql: "SQL",
  terraform: "Terraform",
  typescript: "TypeScript",
  yaml: "YAML",
};

export const doctorLanguageOrder: LanguageId[] = [
  "javascript",
  "typescript",
  "python",
  "go",
  "rust",
  "dotnet",
  "java",
  "kotlin",
  "terraform",
  "hcl",
  "bash",
  "powershell",
  "html",
  "css",
  "yaml",
  "sql",
  "documents",
];
