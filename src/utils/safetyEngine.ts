/* eslint-disable @typescript-eslint/no-explicit-any */

export type SafetyTier = 'safe' | 'read-only' | 'interactive' | 'mutating';

export interface SafetyInfo {
  tier: SafetyTier;
  color: string;
  bgColor: string;
  icon: string;
  label: string;
}

export const SAFETY_TIERS: Record<SafetyTier, Omit<SafetyInfo, 'tier'>> = {
  'safe':        { color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)',  icon: '🟢', label: 'Non-Mutating' },
  'read-only':   { color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)', icon: '🔵', label: 'External Read' },
  'interactive': { color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)', icon: '🟡', label: 'User-Facing' },
  'mutating':    { color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)',  icon: '🔴', label: 'External Write' },
};

/**
 * Classifies a Tines Action based on its agent type and configuration options.
 * This is the central logic for the "Safety Map" visualization.
 */
export function classifyAction(action: any): SafetyInfo {
  const type = action.type || '';
  const options = action.payload || action.options || {}; // Handle both API and Canvas formats
  const method = (options.method || '').toLowerCase();

  let tier: SafetyTier;

  // Decision Tree for Risk Classification
  if (type === 'Agents::EventTransformationAgent' || type === 'Agents::TriggerAgent') {
    tier = 'safe';
  } else if (type === 'Agents::FormAgent' || type === 'Agents::WebhookAgent' || type === 'Agents::ScheduleAgent') {
    tier = 'interactive';
  } else if (type === 'Agents::HTTPRequestAgent') {
    // HTTP requests are safe if they are read-only methods
    tier = (method === 'get' || method === 'head' || method === 'options') ? 'read-only' : 'mutating';
  } else if (type === 'Agents::LLMAgent') {
    tier = 'read-only';
  } else if (type === 'Agents::EmailAgent' || type === 'Agents::SendToStoryAgent') {
    tier = 'mutating';
  } else {
    // Default to highest risk for unknown or complex types
    tier = 'mutating';
  }

  return { tier, ...SAFETY_TIERS[tier] };
}

/**
 * Resolves the effective safety information for an action, accounting for user-defined overrides.
 */
export function getEffectiveSafety(action: any, overrides: Record<number, SafetyTier> = {}): SafetyInfo {
  const override = overrides[action.id];
  if (override) {
    return { tier: override, ...SAFETY_TIERS[override] };
  }
  return classifyAction(action);
}
