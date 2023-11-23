import { MigrationInterface, QueryRunner, TableForeignKey } from "typeorm";

export class UserMigration1679134883865 implements MigrationInterface {
  name = "UserMigration1679134883865";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const query = `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role_id" text;`;
    await queryRunner.query(query);

    await queryRunner.createForeignKey(
      "user",
      new TableForeignKey({
        columnNames: ["role_id"],
        referencedColumnNames: ["id"],
        referencedTableName: "role",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const query = `ALTER TABLE "user" DROP COLUMN "role_id";`;
    await queryRunner.query(query);
  }
}
