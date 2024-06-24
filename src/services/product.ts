import { Lifetime } from "awilix";
import {
  buildQuery,
  ExtendedFindConfig,
  ProductService as MedusaProductService,
  Product,
  User,
} from "@medusajs/medusa";
import {
  CreateProductInput as MedusaCreateProductInput,
  ProductSelector as MedusaProductSelector,
  FindProductConfig,
  ProductFilterOptions,
} from "@medusajs/medusa/dist/types/product";
import { In } from "typeorm";

type CreateProductInput = {
  store_id?: string;
} & MedusaCreateProductInput;

type ProductSelector = {
  store_id?: string;
  options?: string
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

    const productRepo = this.activeManager_.withRepository(
      this.productRepository_
    )

    const { q, options, ...productSelector } = selector
    const query = buildQuery(productSelector, config) as ExtendedFindConfig<
      Product & ProductFilterOptions
    >
    
    // Filter by options
    if (options) {
      const optionFiltersArr = options.split('&')
      query.where = {
        ...query.where,
        options: optionFiltersArr.map((filter) => {
          const [title, values] = filter.split(':')
          return {
            title,
            values: {
              value: In(values.split(',')),
            },
          }
        }),
      }
    }

    return await (productRepo as any).findAndCount(query, q);
  }

  async create(productObject: CreateProductInput): Promise<Product> {
    if (!productObject.store_id && this.loggedInUser_?.store_id) {
      productObject.store_id = this.loggedInUser_.store_id;
    }

    return await super.create(productObject);
  }
}

export default ProductService;
