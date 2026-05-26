import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface DayStats {
  date: string;   // YYYY-MM-DD
  messages: number;
  toolCalls: number;
}

export interface UsageStats {
  today: {
    messages: number;
    toolCalls: number;
    sessions: number;
  };
  last7Days: DayStats[];
  allTime: {
    messages: number;
    sessions: number;
    toolCalls: number;
  };
}

export function parseUsage(): UsageStats {
  const transcriptDir = path.join(os.homedir(), '.claude', 'transcripts');
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  const dayStats = new Map<string, { messages: number; toolCalls: number }>();
  let totalMessages = 0;
  let totalToolCalls = 0;
  let totalSessions = 0;
  let recentMessages = 0;
  let recentToolCalls = 0;
  let recentSessions = 0;

  if (!fs.existsSync(transcriptDir)) {
    return buildEmpty();
  }

  const files = fs.readdirSync(transcriptDir).filter(f => f.endsWith('.jsonl'));

  for (const file of files) {
    const filePath = path.join(transcriptDir, file);
    let lines: string[];
    try {
      lines = fs.readFileSync(filePath, 'utf8').trim().split('\n').filter(Boolean);
    } catch {
      continue;
    }

    totalSessions++;
    let fileHasRecent = false;

    for (const line of lines) {
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }

      const ts = event['timestamp'] as string | undefined;
      if (!ts) { continue; }

      const date = ts.slice(0, 10);
      const isRecent = new Date(ts).getTime() >= cutoff;

      if (!dayStats.has(date)) {
        dayStats.set(date, { messages: 0, toolCalls: 0 });
      }
      const day = dayStats.get(date)!;

      if (event['type'] === 'user') {
        day.messages++;
        totalMessages++;
        if (isRecent) { recentMessages++; fileHasRecent = true; }
      } else if (event['type'] === 'tool_use') {
        day.toolCalls++;
        totalToolCalls++;
        if (isRecent) { recentToolCalls++; }
      }
    }

    if (fileHasRecent) { recentSessions++; }
  }

  return {
    today: {
      messages: recentMessages,
      toolCalls: recentToolCalls,
      sessions: recentSessions,
    },
    last7Days: buildLast7Days(dayStats),
    allTime: {
      messages: totalMessages,
      sessions: totalSessions,
      toolCalls: totalToolCalls,
    },
  };
}

function buildLast7Days(dayStats: Map<string, { messages: number; toolCalls: number }>): DayStats[] {
  const result: DayStats[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const stats = dayStats.get(dateStr) ?? { messages: 0, toolCalls: 0 };
    result.push({ date: dateStr, messages: stats.messages, toolCalls: stats.toolCalls });
  }
  return result;
}

function buildEmpty(): UsageStats {
  return {
    today: { messages: 0, toolCalls: 0, sessions: 0 },
    last7Days: buildLast7Days(new Map()),
    allTime: { messages: 0, sessions: 0, toolCalls: 0 },
  };
}

