/**
 * Output Parser
 * Parses Claude Code output for meaningful events
 */

export interface ParsedOutput {
  type: 'progress' | 'error' | 'completion' | 'info';
  message: string;
  timestamp: Date;
}

export function parseClaudeOutput(rawOutput: string): ParsedOutput[] {
  const results: ParsedOutput[] = [];
  const lines = rawOutput.split('\n').filter(line => line.trim().length > 0);

  for (const line of lines) {
    const parsed = parseLine(line);
    if (parsed) {
      results.push(parsed);
    }
  }

  return results;
}

function parseLine(line: string): ParsedOutput | null {
  const timestamp = new Date();
  const trimmed = line.trim();

  // Skip empty lines
  if (!trimmed) {
    return null;
  }

  // Check for error patterns
  if (
    trimmed.toLowerCase().includes('error') ||
    trimmed.startsWith('[stderr]')
  ) {
    return {
      type: 'error',
      message: trimmed.replace('[stderr] ', ''),
      timestamp,
    };
  }

  // Check for completion patterns
  if (
    trimmed.toLowerCase().includes('completed') ||
    trimmed.toLowerCase().includes('finished') ||
    trimmed.toLowerCase().includes('done')
  ) {
    return {
      type: 'completion',
      message: trimmed,
      timestamp,
    };
  }

  // Check for progress patterns
  if (
    trimmed.includes('✓') ||
    trimmed.includes('✔') ||
    trimmed.toLowerCase().includes('working on') ||
    trimmed.toLowerCase().includes('updating') ||
    trimmed.toLowerCase().includes('creating')
  ) {
    return {
      type: 'progress',
      message: trimmed,
      timestamp,
    };
  }

  // Default to info
  return {
    type: 'info',
    message: trimmed,
    timestamp,
  };
}

export function formatOutputForDiscord(outputs: ParsedOutput[]): string {
  const icons: Record<ParsedOutput['type'], string> = {
    progress: '🔄',
    error: '❌',
    completion: '✅',
    info: '📝',
  };

  return outputs
    .map(o => `${icons[o.type]} ${o.message}`)
    .join('\n')
    .substring(0, 1900); // Discord message limit
}
