/**
 * @module views/logs/useLogUsage
 * What the log view needs from the usage summary: the entries with a cost filled in where an
 * older entry has none, and the filter the reader picked in the summary.
 */

import { useMemo, useState } from 'react';
import { matchesUsageFilter, NO_USAGE_FILTER, type UsageEntry, type UsageFilter } from '@/domain/story';
import { withLogCost } from '@/services/llm';

export function useLogUsage<T extends UsageEntry & { status?: string; costUsd?: number | null }>(log: T[]) {
    const entries = useMemo(() => log.map((entry) => withLogCost(entry)), [log]);
    const [usageFilter, setUsageFilter] = useState<UsageFilter>(NO_USAGE_FILTER);
    return {
        entries,
        usageFilter,
        setUsageFilter,
        inUsageFilter: (entry: T): boolean => matchesUsageFilter(entry, usageFilter)
    };
}
