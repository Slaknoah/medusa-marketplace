import { MigrationInterface, QueryRunner, TableColumn } from "typeorm"

export class AddStripeAccountToStore1700655150512 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns(
            "store",
            [
                new TableColumn({
                    name: "c_stripe_account_id",
                    type: "varchar",
                    isNullable: true
                }),
                new TableColumn({
                    name: "c_stripe_account_enabled",
                    type: "boolean",
                    isNullable: true,
                    default: false,
                }),
            ]
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("store", "c_stripe_account_id");
        await queryRunner.dropColumn("store", "c_stripe_account_enabled");
    }
}
