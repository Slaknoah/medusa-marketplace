import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";

import { Product as MedusaProduct } from "@medusajs/medusa/dist";
import { Store } from "./store";

@Entity()
export class Product extends MedusaProduct {
  @Index()
  @Column({ nullable: false })
  store_id: string;

  @ManyToOne(() => Store, (store) => store.members)
  @JoinColumn({ name: "store_id", referencedColumnName: "id" })
  store: Store;
}
