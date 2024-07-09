import { MigrationInterface, QueryRunner, TableColumn } from "typeorm"

export class ModifyApplicationFeeField1719394932687 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("store", "application_fee_multiplier");
        await queryRunner.query(`ALTER TABLE "store" ADD COLUMN "application_fee_multiplier" real`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns(
            "store",
            [
                new TableColumn({
                    name: "application_fee_multiplier",
                    type: "decimal",
                    isNullable: true,
                    precision: 5,
                    scale: 4,
                    default: 0.05,
                }),
            ]
        );
    }

}
