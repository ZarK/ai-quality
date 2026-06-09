export interface MavenCommandOptions {
  args: string[];
  wrapper?: boolean;
}

export interface GradleCommandOptions {
  args: string[];
  console?: string;
  noDaemon?: boolean;
  projectCacheDir?: string;
  wrapper?: boolean;
}
