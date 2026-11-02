import { DirectiveLocation, GraphQLDirective, GraphQLString } from 'graphql';

export const MCP_OPTIONS = Symbol('MCP_OPTIONS');

/**
 * GraphQL directive definition for exposing fields as MCP.
 */
export const MCP_DIRECTIVE_DEFINITION = new GraphQLDirective({
  name: 'mcp',
  locations: [DirectiveLocation.FIELD_DEFINITION],
  args: {
    instructions: { type: GraphQLString },
  },
});
