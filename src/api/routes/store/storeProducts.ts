import { ProductService } from "@medusajs/medusa";
import { Request, Response } from "express";

export const getStoreProducts = async (
  req: Request,
  res: Response
): Promise<void> => {
  const productService = req.scope.resolve("productService") as ProductService;

  const products = await productService.list(req.query);
  res.status(200).json({ products });
};
