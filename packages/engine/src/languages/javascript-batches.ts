import { resolveProjectConcurrencyLimit } from "../runtime-tunables.js";

export async function runProjectBatches<TProject, TResult>(
  projects: readonly TProject[],
  runProject: (project: TProject, index: number) => Promise<TResult>,
): Promise<TResult[]> {
  const results: TResult[] = [];
  const concurrencyLimit = resolveProjectConcurrencyLimit();

  for (let index = 0; index < projects.length; index += concurrencyLimit) {
    const projectBatch = projects.slice(index, index + concurrencyLimit);
    results.push(
      ...(await Promise.all(
        projectBatch.map((project, batchIndex) => runProject(project, index + batchIndex)),
      )),
    );
  }

  return results;
}
