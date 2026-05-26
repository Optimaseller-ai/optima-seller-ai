export { closingLine, pickCloseLevel, type CloseLevel } from "./closing-engine";
export {
  classifyObjectionSnippet,
  latestObjectionCategory,
  objectionResponseHint,
  type ObjectionCategory,
} from "./objection-handler";
export { runSalesBrain } from "./sales-brain-engine";
export type {
  SalesBrainBusinessContext,
  SalesBrainConversationContext,
  SalesBrainInput,
  SalesBrainMessageStyle,
  SalesBrainNextAction,
  SalesBrainOutput,
} from "./sales-brain-types";
export { composeSalesBrainMessage, type SalesMessageGeneratorInput } from "./sales-message-generator";
export { detectSalesOpportunity, type SalesOpportunitySignal, type SalesOpportunityType } from "./sales-opportunity-detector";
export { selectSalesStrategy, type SalesStrategyKey, type SalesStrategyPick } from "./sales-strategy-selector";
export { computeRealisticUrgency, type UrgencyCue, type UrgencyLevel } from "./urgency-engine";
