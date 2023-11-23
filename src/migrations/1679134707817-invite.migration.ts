import { MigrationInterface, QueryRunner } from "typeorm";

export class InviteMigration1679134707817 implements MigrationInterface {
  name = "InviteMigration1679134707817";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const query = `
            ALTER TABLE "invite" ADD COLUMN IF NOT EXISTS "store_id" text; 
        `;
    await queryRunner.query(query);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const query = `
            ALTER TABLE "invite" DROP COLUMN "store_id";
        `;
    await queryRunner.query(query);
  }
}
