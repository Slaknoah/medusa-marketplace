import { Role } from "models/role";

export declare module "@medusajs/medusa/dist/models/user" {
  declare interface User {
    store_id: string;
    role_id: string;
    store?: Store;
    teamRole?: Role;
  }
}

export declare module "@medusajs/medusa/dist/models/product" {
  declare interface Product {
    store_id: string;
    store?: Store;
  }
}

export declare module "@medusajs/medusa/dist/models/store" {
  declare interface Store {
    c_stripe_account_id: string;
    c_stripe_account_enabled: boolean;
  }
}

 export declare module "@medusajs/medusa/dist/models/invite" {
  declare interface Invite {
    store_id: string;
    store?: Store;
  }
}

export declare module "@medusajs/medusa/dist/models/order" {
  declare interface Order {
    store_id: string;
    store?: Store;
    order_parent_id: string;
    parent?: Order;
    children?: Order[];
  }
}

export declare module "@medusajs/medusa/dist/services/product" {
  declare interface ProductSelector {
    store_id?: string;
  }
}
