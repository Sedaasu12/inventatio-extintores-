import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

/**
 * Suma años calendario en UTC. Las fechas `DATE` se almacenan sin hora.
 * Si el origen es 29 de febrero y el año destino no es bisiesto, se usa el
 * 28 de febrero para no desplazar el vencimiento al mes siguiente.
 */
export function addYears(date: Date, years: number): Date {
  const result = new Date(date.getTime());
  const month = result.getUTCMonth();
  result.setUTCFullYear(result.getUTCFullYear() + years);
  if (result.getUTCMonth() !== month) {
    result.setUTCDate(0);
  }
  return result;
}

/**
 * D-12 / BR-107B: la fecha `EQUIPO` es la más temprana entre la fecha
 * documentada por el fabricante y `manufacture_date + useful_life_years`.
 * Si falta una, se usa la otra; si faltan ambas, no se inventa fecha.
 */
export function earliestEquipmentExpiry(
  manufactureDate: Date | null,
  manufacturerExpiryDate: Date | null,
  usefulLifeYears: number | null,
): Date | null {
  const calculated =
    manufactureDate !== null && usefulLifeYears !== null
      ? addYears(manufactureDate, usefulLifeYears)
      : null;

  if (calculated === null) {
    return manufacturerExpiryDate;
  }
  if (manufacturerExpiryDate === null) {
    return calculated;
  }
  return calculated.getTime() <= manufacturerExpiryDate.getTime()
    ? calculated
    : manufacturerExpiryDate;
}

/**
 * Recalcula la proyección `due_dates` de categoría `EQUIPO` para todos los
 * equipos de un tipo (BR-107E). Debe ejecutarse dentro de la transacción que
 * cambia `useful_life_years`.
 */
@Injectable()
export class EquipmentDueDatesService {
  async recalculateForType(
    typeId: string,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    const type = await client.extinguisherType.findUnique({
      where: { id: typeId },
      select: { usefulLifeYears: true },
    });
    if (type === null) {
      return;
    }

    const extinguishers = await client.extinguisher.findMany({
      where: { typeId },
      select: {
        id: true,
        manufactureDate: true,
        manufacturerExpiryDate: true,
      },
    });

    for (const extinguisher of extinguishers) {
      const dueDate = earliestEquipmentExpiry(
        extinguisher.manufactureDate,
        extinguisher.manufacturerExpiryDate,
        type.usefulLifeYears,
      );

      if (dueDate === null) {
        await client.dueDate.deleteMany({
          where: { extinguisherId: extinguisher.id, eventType: 'EQUIPO' },
        });
        continue;
      }

      await client.dueDate.upsert({
        where: {
          extinguisherId_eventType: {
            extinguisherId: extinguisher.id,
            eventType: 'EQUIPO',
          },
        },
        create: {
          id: randomUUID(),
          extinguisherId: extinguisher.id,
          eventType: 'EQUIPO',
          dueDate,
          sourceType: 'EXTINGUISHER',
          sourceId: extinguisher.id,
        },
        update: {
          dueDate,
          sourceType: 'EXTINGUISHER',
          sourceId: extinguisher.id,
          sourceEventAt: null,
        },
      });
    }
  }
}
