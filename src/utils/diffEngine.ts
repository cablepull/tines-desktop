/**
 * Diff Engine: Identifies configuration regressions between Action versions.
 */

export interface DiffResult {
  hasChanged: boolean;
  changes: {
    path: string;
    oldValue: any;
    newValue: any;
  }[];
}

/**
 * Performs a deep diff between two Action objects.
 * Focuses on 'options', 'source_ids', and 'receiver_ids'.
 */
export function diffActions(oldAction: any, newAction: any): DiffResult {
  const result: DiffResult = {
    hasChanged: false,
    changes: []
  };

  if (!oldAction || !newAction) return result;

  const pathsToCompare = ['options', 'source_ids', 'receiver_ids', 'name', 'type'];

  pathsToCompare.forEach(path => {
    const oldVal = oldAction[path];
    const newVal = newAction[path];

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      result.hasChanged = true;
      
      if (path === 'options' && typeof oldVal === 'object' && typeof newVal === 'object') {
        // Deep dive into options
        const allKeys = new Set([...Object.keys(oldVal || {}), ...Object.keys(newVal || {})]);
        allKeys.forEach(key => {
          if (JSON.stringify(oldVal[key]) !== JSON.stringify(newVal[key])) {
            result.changes.push({
              path: `options.${key}`,
              oldValue: oldVal[key],
              newValue: newVal[key]
            });
          }
        });
      } else {
        result.changes.push({
          path,
          oldValue: oldVal,
          newValue: newVal
        });
      }
    }
  });

  return result;
}

/**
 * Heuristic to determine if a diff is likely a "Regression" that caused a failure.
 */
export function isLikelyRegression(diff: DiffResult): boolean {
  // Changes to critical nodes like credentials or URLs are high-risk
  return diff.changes.some(c => 
    c.path.includes('url') || 
    c.path.includes('credential') || 
    c.path.includes('method') ||
    c.path === 'source_ids'
  );
}
