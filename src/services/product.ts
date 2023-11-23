import { Lifetime } from "awilix";
import {
  ProductService as MedusaProductService,
  Product,
  User,
} from "@medusajs/medusa";
import {
  CreateProductInput as MedusaCreateProductInput,
  ProductSelector as MedusaProductSelector,
  FindProductConfig,
} from "@medusajs/medusa/dist/types/product";

type CreateProductInput = {
  store_id?: string;
} & MedusaCreateProductInput;

type ProductSelector = {
  store_id?: string;
} & MedusaProductSelector;

class ProductService extends MedusaProductService {
  static LIFE_TIME = Lifetime.TRANSIENT;
  protected readonly loggedInUser_: User | null;
  protected readonly requestStoreId_: string | null;

  constructor(container) {
    // @ts-expect-error prefer-rest-params
    // eslint-disable-next-line prefer-rest-params
    super(...arguments);

    try {
      this.requestStoreId_ = container.requestStoreId;
    } catch (e) {
      // avoid errors when backend first runs
    }

    try {
      this.loggedInUser_ = container.loggedInUser;
    } catch (e) {
      // avoid errors when backend first runs
    }
  }

  async list(
    selector: ProductSelector,
    config?: FindProductConfig
  ): Promise<Product[]> {
    if (this.loggedInUser_?.role === "admin") {
      return super.list(selector, config);
    }

    // Store scoping
    if (this.requestStoreId_) {
      selector.store_id = this.requestStoreId_;
    }
    // Admin scoping
    else if (!selector.store_id && this.loggedInUser_?.store_id) {
      selector.store_id = this.loggedInUser_.store_id;
    }

    return await super.list(selector, config);
  }

  async listAndCount(
    selector: ProductSelector,
    config?: FindProductConfig
  ): Promise<[Product[], number]> {
    if (this.loggedInUser_?.role === "admin") {
      return super.listAndCount(selector, config);
    }

    // Store scoping
    if (this.requestStoreId_) {
      selector.store_id = this.requestStoreId_;
    }
    // Admin scoping
    else if (!selector.store_id && this.loggedInUser_?.store_id) {
      selector.store_id = this.loggedInUser_.store_id;
    }

    return await super.listAndCount(selector, config);
  }

  async create(productObject: CreateProductInput): Promise<Product> {
    if (!productObject.store_id && this.loggedInUser_?.store_id) {
      productObject.store_id = this.loggedInUser_.store_id;
    }

    return await super.create(productObject);
  }
}

export default ProductService;
