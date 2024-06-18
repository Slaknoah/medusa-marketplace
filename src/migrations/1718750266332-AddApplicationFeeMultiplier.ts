import { MigrationInterface, QueryRunner, TableColumn } from "typeorm"

export class AddApplicationFeeMultiplier1718750266332 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
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

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("store", "application_fee_multiplier");
    }
}
