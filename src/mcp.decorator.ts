import { Directive } from '@nestjs/graphql';

/**
 * Whitelists a GraphQL Query or Mutation for MCP and optionally adds custom
 * instructions specifically for AI agents.
 */
export const ExposeMcp = (agentInstructions?: string) => {
  if (agentInstructions) {
    // Escape quotes to prevent directive string syntax errors
    const sanitized = agentInstructions.replace(/"/g, '\\"');
    return Directive(`@mcp(instructions: "${sanitized}")`);
  }
  return Directive('@mcp');
};
