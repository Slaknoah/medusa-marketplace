import { MigrationInterface, QueryRunner } from "typeorm";

export default class addStoreIdToProduct1645034402086
  implements MigrationInterface
{
  name = "addStoreIdToProduct1645034402086";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const query = `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "store_id" text;`;
    await queryRunner.query(query);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const query = `ALTER TABLE "product" DROP COLUMN "store_id";`;
    await queryRunner.query(query);
  }
}
