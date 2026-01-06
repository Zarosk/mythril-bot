export interface TaskMetadata {
  status: string;
  project: string;
  trustLevel: string;
  priority: string;
  created: string;
  activated: string;
  branch: string;
  repoPath: string;
}

export interface AcceptanceCriterion {
  text: string;
  completed: boolean;
}

export interface ParsedTask {
  id: string;
  title: string;
  metadata: TaskMetadata;
  description: string;
  acceptanceCriteria: AcceptanceCriterion[];
  executionLog: string[];
  rawContent: string;
  contentHash: string;
}

export interface TaskDiff {
  statusChanged: boolean;
  oldStatus?: string;
  newStatus?: string;
  criteriaChanged: boolean;
  changedCriteria: Array<{
    text: string;
    oldCompleted: boolean;
    newCompleted: boolean;
  }>;
  newLogEntries: string[];
  isNewTask: boolean;
}

export interface StreamingConfig {
  bufferIntervalMs: number;
  maxBufferSize: number;
  enabled: boolean;
}

export interface Config {
  discord: {
    token: string;
    guildId: string;
    commandsChannelId: string;
    statusChannelId: string;
    alertsChannelId: string;
    decisionsChannelId: string;
    chatChannelId: string;
  };
  anthropic: {
    apiKey: string;
  };
  paths: {
    vaultPath: string;
    codeProjectsPath: string;
    claudeCodePath: string;
  };
  settings: {
    logLevel: string;
    maxConcurrentInstances: number;
    pollIntervalMs: number;
  };
  streaming: StreamingConfig;
  slashCommands: {
    enabled: boolean;
    deprecatePrefixCommands: boolean;
  };
  brainApi: {
    url: string;
    apiKey: string;
  };
}

export interface QueuedTask {
  filename: string;
  title: string;
  project: string;
  priority: string;
}
