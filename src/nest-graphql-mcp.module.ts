import { DynamicModule, Module } from '@nestjs/common';
import { MCP_OPTIONS } from './constants';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';
import { GraphqlMcpModuleOptions } from './types';

@Module({})
export class NestGraphqlMcpModule {
  static forRoot(options: GraphqlMcpModuleOptions = {}): DynamicModule {
    return {
      module: NestGraphqlMcpModule,
      controllers: [McpController],
      providers: [
        {
          provide: MCP_OPTIONS,
          useValue: options,
        },
        McpService,
      ],
      exports: [McpService, MCP_OPTIONS],
    };
  }
}
