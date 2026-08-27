export function connectorDisplayDescription(item: {
  description?: string | null;
  mcpInstructions?: string | null;
}) {
  const manual = item.description?.trim();
  if (manual) return manual;
  return item.mcpInstructions?.trim() ?? '';
}
