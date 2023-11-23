import { MigrationInterface, QueryRunner, TableForeignKey } from "typeorm";

export class UserMigration1679134833262 implements MigrationInterface {
  name = "UserMigration1679134833262";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const query = `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "store_id" text;`;
    await queryRunner.query(query);
    await queryRunner.createForeignKey(
      "user",
      new TableForeignKey({
        columnNames: ["store_id"],
        referencedColumnNames: ["id"],
        referencedTableName: "store",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const query = `ALTER TABLE "user" DROP COLUMN "store_id";`;
    await queryRunner.query(query);
  }
}
