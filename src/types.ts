export interface GraphqlMcpModuleOptions {
  /**
   * The route path where the stateless MCP endpoint will be hosted.
   * @default '/mcp/stateless'
   */
  path?: string;

  /**
   * Name reported to the MCP client during handshakes.
   * @default 'nest-graphql-mcp-server'
   */
  serverName?: string;

  /**
   * Version reported to the MCP client during handshakes.
   * @default '1.0.0'
   */
  serverVersion?: string;
}
