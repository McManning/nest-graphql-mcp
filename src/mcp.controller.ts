import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { All, Controller, Req, Res } from '@nestjs/common';
import { type Request, type Response } from 'express';
import { McpService } from './mcp.service';

@Controller('mcp')
export class McpController {
  // Store active sessions mapped by their session ID
  // private readonly sessions = new Map<string, StreamableHTTPServerTransport>();

  constructor(private readonly mcpService: McpService) {}

  // @All()
  // async handleMcp(@Req() req: Request, @Res() res: Response) {
  //   const authHeader = req.headers.authorization;
  //   if (!authHeader) {
  //     throw new UnauthorizedException('Missing Authorization header');
  //   }

  //   const sessionId = req.headers['mcp-session-id'] as string | undefined;

  //   //  Resume existing session if mcp-session-id header is provided
  //   if (sessionId && this.sessions.has(sessionId)) {
  //     const transport = this.sessions.get(sessionId)!;
  //     await transport.handleRequest(req, res, req.body);
  //     return;
  //   }

  //   const transport = new StreamableHTTPServerTransport({
  //     sessionIdGenerator: () => randomUUID(),
  //     onsessioninitialized: (id) => this.sessions.set(id, transport),
  //   });

  //   transport.onclose = () => {
  //     if (transport.sessionId) {
  //       this.sessions.delete(transport.sessionId);
  //     }
  //   };

  //   // Connect transport to the underlying McpServer and handle request
  //   await this.mcpService.getMcpServer().connect(transport);
  //   await transport.handleRequest(req, res, req.body);
  // }

  @All('stateless')
  async handleStatelessMcp(@Req() req: Request, @Res() res: Response) {
    // TODO: This is if we don't need in-memory session tracking acrosst urns
    // (e.g. token is validated on every request). Probably the preferred route.

    const transport = new StreamableHTTPServerTransport({
      // We don't need to persist state between requests.
      sessionIdGenerator: undefined,
    });

    res.on('close', () => {
      transport.close();
    });

    await this.mcpService.getMcpServer().connect(transport);
    await transport.handleRequest(req, res, req.body);
  }
}
