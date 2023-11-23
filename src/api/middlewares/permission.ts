import { UserService } from "@medusajs/medusa";
import { NextFunction, Request, RequestHandler, Response } from "express";
import { isEqual } from "lodash";

export function permissionGuard(
  permissions: Record<string, unknown>[]
): RequestHandler {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const userService = req.scope.resolve("userService") as UserService;
    const loggedInUser = await userService.retrieve(req.user.id, {
      select: ["id", "store_id"],
      relations: ["teamRole", "teamRole.permissions"],
    });

    const isAllowed = permissions.every((permission) =>
      loggedInUser.teamRole?.permissions.some((userPermission) =>
        isEqual(userPermission.metadata, permission)
      )
    );

    if (isAllowed) {
      return next();
    }

    //permission denied
    res.sendStatus(401);
  };
}
