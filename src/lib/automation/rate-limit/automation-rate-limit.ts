/**
 * @deprecated Utiliser `automation-rate-limiter.ts` — réexport compatibilité.
 */

export {
  canExecuteAutomationAction,
  recordAutomationExecution,
  checkAutomationRateLimit,
  inputFromAutomationContext,
  resolveActionChannelFromEvent,
} from "./automation-rate-limiter";
export type { CanExecuteAutomationResult, AutomationRateLimitInput } from "./automation-rate-limiter";
export type { AutomationActionChannel } from "./cooldown-engine";
