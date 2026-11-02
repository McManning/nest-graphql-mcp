import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import {
  ConstDirectiveNode,
  graphql,
  GraphQLField,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLType,
  isNonNullType,
  isObjectType,
  isScalarType,
} from 'graphql';
import { z } from 'zod';
import { MCP_OPTIONS } from './constants';
import { type GraphqlMcpModuleOptions } from './types';

@Injectable()
export class McpService implements OnModuleInit {
  private readonly mcpServer: McpServer;
  private schemaHost!: GraphQLSchemaHost;

  constructor(
    private readonly moduleRef: ModuleRef,
    @Inject(MCP_OPTIONS) private readonly options: GraphqlMcpModuleOptions
  ) {
    this.mcpServer = new McpServer({
      name: this.options.serverName || 'nestjs-mcp-server',
      version: this.options.serverVersion || '1.0.0',
    });
  }

  onModuleInit() {
    this.schemaHost = this.moduleRef.get(GraphQLSchemaHost, { strict: false });

    const { schema } = this.schemaHost;
    if (!schema) {
      return;
    }

    const queryType = schema.getQueryType();
    if (queryType) {
      this.registerObjectTypeFields(queryType, 'query');
    }

    const mutationType = schema.getMutationType();
    if (mutationType) {
      this.registerObjectTypeFields(mutationType, 'mutation');
    }
  }

  /**
   * Helper to parse the `@mcp` directive and its `instructions` argument from field AST.
   */
  private getMcpDirectiveConfig(field: GraphQLField<any, any>): {
    isExposed: boolean;
    instructions?: string;
  } {
    const directives = field.astNode?.directives;
    if (!directives) {
      return { isExposed: false };
    }

    const mcpDirective = directives.find(
      (d: ConstDirectiveNode) => d.name.value === 'mcp'
    );
    if (!mcpDirective) {
      return { isExposed: false };
    }

    let instructions: string | undefined;
    const arg = mcpDirective.arguments?.find(
      (a) => a.name.value === 'instructions'
    );

    if (arg && arg.value.kind === 'StringValue') {
      instructions = arg.value.value;
    }

    return { isExposed: true, instructions };
  }

  private mapGraphQLTypeToZod(type: GraphQLType): z.ZodType {
    const isNonNull = isNonNullType(type);
    const unwrappedType = isNonNull
      ? (type as GraphQLNonNull<any>).ofType
      : type;

    let schema: z.ZodType;

    if (isScalarType(unwrappedType)) {
      switch (unwrappedType.name) {
        case 'Int':
        case 'Float':
          schema = z.number();
          break;
        case 'Boolean':
          schema = z.boolean();
          break;
        default:
          schema = z.string();
      }
    } else {
      schema = z.any();
    }

    return isNonNull ? schema : schema.optional();
  }

  private buildSelectionSet(returnType: GraphQLOutputType): string {
    let namedType = returnType;
    while ('ofType' in namedType) {
      namedType = namedType.ofType;
    }

    if (isObjectType(namedType)) {
      const fields = namedType.getFields();
      const scalarFields = Object.keys(fields).filter((key) => {
        let fType = fields[key].type;
        while ('ofType' in fType) {
          fType = fType.ofType;
        }
        return isScalarType(fType);
      });
      return scalarFields.join('\n');
    }

    return '';
  }

  getMcpServer(): McpServer {
    return this.mcpServer;
  }

  private registerObjectTypeFields(
    objectType: GraphQLObjectType,
    operationType: 'query' | 'mutation'
  ) {
    const fields = objectType.getFields();

    for (const [fieldName, field] of Object.entries(fields)) {
      // Check for @mcp/@ExposeMcp directives and parse instructions
      const mcpConfig = this.getMcpDirectiveConfig(field);
      if (!mcpConfig.isExposed) {
        continue;
      }

      const toolName = `${operationType}_${fieldName}`;

      // Build an additive description (Base GraphQL + Agent Context)
      const baseDescription =
        field.description || `Executes the ${fieldName} ${operationType}.`;

      const finalDescription = mcpConfig.instructions
        ? `${baseDescription}\n\n[Agent Context]: ${mcpConfig.instructions}`
        : baseDescription;

      // Build input schema
      const zodShape: Record<string, z.ZodType> = {};
      for (const arg of field.args) {
        zodShape[arg.name] = this.mapGraphQLTypeToZod(arg.type);
      }

      this.mcpServer.registerTool(
        toolName,
        {
          title: fieldName,
          description: finalDescription,
          inputSchema: zodShape,
        },
        async (args, extra) => {
          const selectionSet = this.buildSelectionSet(field.type);
          const selectionBlock = selectionSet ? `{ ${selectionSet} }` : '';

          const varDefs = field.args
            .map((a) => `$${a.name}: ${a.type.toString()}`)
            .join(', ');
          const varArgs = field.args
            .map((a) => `${a.name}: $${a.name}`)
            .join(', ');

          const queryString = `
            ${operationType} ${fieldName}McpWrapper${
            varDefs ? `(${varDefs})` : ''
          } {
              ${fieldName}${varArgs ? `(${varArgs})` : ''} ${selectionBlock}
            }
          `;

          const req = (extra as any)?.request;
          const authHeader = req?.headers?.['authorization'];

          const result = await graphql({
            schema: this.schemaHost.schema,
            source: queryString,
            variableValues: args,
            contextValue: {
              req: {
                headers: { authorization: authHeader },
              },
            },
          });

          if (result.errors) {
            return {
              isError: true,
              content: [
                { type: 'text', text: JSON.stringify(result.errors, null, 2) },
              ],
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result.data?.[fieldName], null, 2),
              },
            ],
          };
        }
      );
    }
  }
}
