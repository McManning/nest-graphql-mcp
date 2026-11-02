import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function runAgent() {
  const jwtToken = '<YOUR_JWT_HERE>';

  // 1. Initialize Streamable HTTP Transport
  const transport = new StreamableHTTPClientTransport(
    new URL('http://localhost:3000/mcp/stateless'),
    {
      requestInit: {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
        },
      },
    }
  );

  // 2. Initialize MCP Client
  const client = new Client(
    { name: 'service-agent', version: '1.0.0' },
    { capabilities: {} }
  );

  // 3. Connect to NestJS server
  await client.connect(transport);

  // 4. Discover tools available to this service account
  const { tools } = await client.listTools();
  console.log(
    'Available MCP Tools:',
    tools.map((t) => t.name)
  );

  // 5. Invoke a tool
  const result = await client.callTool({
    name: 'query_getUser',
    arguments: { id: 'usr_123' },
  });

  console.log('Tool Execution Result:', result);
}

runAgent();
