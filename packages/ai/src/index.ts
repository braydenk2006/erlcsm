export type AiProviderName = "none" | "openai" | "anthropic";

export type AiSafetyPolicy = {
  requireHumanConfirmationForWrites: true;
  labelOutputsAsAiGenerated: true;
  respectDocumentPermissions: true;
  allowAutonomousDiscipline: false;
};

export const DEFAULT_AI_SAFETY_POLICY: AiSafetyPolicy = {
  requireHumanConfirmationForWrites: true,
  labelOutputsAsAiGenerated: true,
  respectDocumentPermissions: true,
  allowAutonomousDiscipline: false,
};
