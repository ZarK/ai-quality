import {
  type CliPackageSchema,
  type RenderSchemaOptions,
  createCommandRegistry,
  renderSchema,
  renderSchemaJson,
} from "@tjalve/qube-cli";

export const aiqSchemaVersion = 1 as const;
export const aiqPackageName = "@tjalve/aiq" as const;
export const aiqPackageVersion = "0.2.0" as const;
export const aiqSchemaBin = "aiq" as const;

import { aiqCommandMetadata } from "./schema-metadata.js";

export const aiqCommandRegistry = createCommandRegistry({ commands: aiqCommandMetadata });

const aiqSchemaOptions = {
  packageName: aiqPackageName,
  packageVersion: aiqPackageVersion,
  bin: aiqSchemaBin,
  sections: {
    capabilities: [
      "quality-control",
      "quality-plan",
      "quality-diagnostics",
      "quality-setup",
      "quality-status",
      "quality-evidence",
    ],
    discovery: {
      command: "aiq schema --format json",
      packageExport: "@tjalve/aiq/schema",
    },
  },
  extensions: {
    aiq: {
      defaultCommand: "aiq",
      explicitTargetCommand: "aiq run <paths...>",
      schemaVersion: aiqSchemaVersion,
      packageExport: "@tjalve/aiq/schema",
    },
    qube: {
      discoverable: true,
      commandPrefix: "quality",
    },
  },
} as const satisfies RenderSchemaOptions;

export function renderAiqCommandSchema(): CliPackageSchema {
  return renderSchema(aiqCommandRegistry, aiqSchemaOptions);
}

export function renderAiqCommandSchemaJson(): string {
  return renderSchemaJson(aiqCommandRegistry, aiqSchemaOptions);
}
