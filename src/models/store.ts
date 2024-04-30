import { Column, Entity, JoinColumn, OneToMany } from "typeorm";

import { Invite } from "./invite";
import { Store as MedusaStore } from "@medusajs/medusa";
import { Order } from "./order";
import { Product } from "./product";
import { Role } from "./role";
import { User } from "./user";

@Entity()
export class Store extends MedusaStore {
  @OneToMany(() => User, (user) => user.store)
  @JoinColumn({ name: "id", referencedColumnName: "store_id" })
  members: User[];

  @OneToMany(() => Product, (product) => product.store)
  @JoinColumn({ name: "id", referencedColumnName: "store_id" })
  products: Product[];

  @OneToMany(() => Order, (order) => order.store)
  @JoinColumn({ name: "id", referencedColumnName: "store_id" })
  orders: Order[];

  @OneToMany(() => Invite, (invite) => invite.store)
  @JoinColumn({ name: "id", referencedColumnName: "store_id" })
  invites: Invite[];

  @OneToMany(() => Role, (role) => role.store)
  @JoinColumn({ name: "id", referencedColumnName: "store_id" })
  roles: Role[];
  
  @Column({ nullable: true })
  c_stripe_account_id: string;

  @Column({ nullable: true, default: false })
  c_stripe_account_enabled: boolean;
}
