import { NextFunction, Request, RequestHandler, Response } from "express";

export function setStoreId(): RequestHandler {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    let requestStoreId = null;
    const isStoreRequest = true;

    console.log(req.query);
    if (req.query.store_id) {
      requestStoreId = req.query.store_id;
      delete req.query.store_id;
    }
    console.log("registering");

    req.scope.register({
      requestStoreId: {
        resolve: () => requestStoreId,
      },
      isStoreRequest: {
        resolve: () => isStoreRequest,
      },
    });

    next();
  };
}
