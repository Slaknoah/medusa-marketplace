import { User } from "@medusajs/medusa";
import { NextFunction, Request, RequestHandler, Response } from "express";
import { Repository } from "typeorm";

export function registerLoggedInUser(): RequestHandler {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    let loggedInUser: User | null = null;

    const userId = req.user && (req.user.id || req.user.userId);
    if (userId) {
      const userRepository: Repository<User> =
        req.scope.resolve("userRepository");

      // Get user id depending on if from database or from JWT
      try {
        loggedInUser = await userRepository.findOne({
          where: {
            id: userId,
          },
          select: ["id", "store_id", "role", "teamRole"],
        });
      } catch (e) {
        next(e);
      }
    }
    console.log("registering logged in user in request scope")
    console.log("req url", req.method, req.originalUrl)
    req.scope.register({
      loggedInUser: {
        resolve: () => loggedInUser,
      },
    });

    next();
  };
}
