import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface CounterDefinition {
  scope: string;
  prefix: string;
  padding: number;
}

export const LOCATION_COUNTER: CounterDefinition = {
  scope: 'LOCATION',
  prefix: 'UBI-',
  padding: 6,
};

export const EXTINGUISHER_COUNTER: CounterDefinition = {
  scope: 'EXTINGUISHER',
  prefix: 'EXT-',
  padding: 6,
};

export function formatCounterCode(
  prefix: string,
  value: number,
  padding: number,
): string {
  return `${prefix}${String(value).padStart(padding, '0')}`;
}

interface CounterRow {
  prefix: string;
  next_value: number | bigint;
  padding: number | bigint;
}

/**
 * Generador de códigos secuenciales por ámbito (`EXT-000001`, `UBI-000001`).
 *
 * La fila del contador se bloquea con `SELECT ... FOR UPDATE` dentro de la
 * transacción del llamador, de modo que dos altas simultáneas no obtienen el
 * mismo código (D-04 / BR-027C).
 */
@Injectable()
export class CodeCounterService {
  constructor(private readonly prisma: PrismaService) {}

  nextCode(
    definition: CounterDefinition,
    client?: Prisma.TransactionClient,
  ): Promise<string> {
    if (client !== undefined) {
      return this.nextInTransaction(definition, client);
    }
    return this.prisma.$transaction((tx) =>
      this.nextInTransaction(definition, tx),
    );
  }

  private async nextInTransaction(
    definition: CounterDefinition,
    client: Prisma.TransactionClient,
  ): Promise<string> {
    let rows = await this.selectForUpdate(definition.scope, client);

    if (rows.length === 0) {
      await client.codeCounter.create({
        data: {
          id: randomUUID(),
          scope: definition.scope,
          prefix: definition.prefix,
          nextValue: 1,
          padding: definition.padding,
        },
      });
      rows = await this.selectForUpdate(definition.scope, client);
    }

    const counter = rows[0];
    if (counter === undefined) {
      throw new Error(
        `No se pudo inicializar el contador de códigos "${definition.scope}".`,
      );
    }

    const value = Number(counter.next_value);
    const padding = Number(counter.padding);
    const code = formatCounterCode(counter.prefix, value, padding);

    await client.codeCounter.update({
      where: { scope: definition.scope },
      data: { nextValue: { increment: 1 } },
    });

    return code;
  }

  private selectForUpdate(
    scope: string,
    client: Prisma.TransactionClient,
  ): Promise<CounterRow[]> {
    return client.$queryRaw<CounterRow[]>`
      SELECT prefix, next_value, padding
      FROM code_counters
      WHERE scope = ${scope}
      FOR UPDATE
    `;
  }
}
